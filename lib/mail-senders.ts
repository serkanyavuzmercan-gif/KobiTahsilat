import 'server-only'
import { createAdminClient } from './supabase/admin'
import type { MailSenderAccount } from './types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseMailFrom(value: string | undefined): { email: string; adSoyad: string | null } | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()
  const named = trimmed.match(/^(.+?)\s*<([^>]+)>$/)
  if (named) {
    const email = named[2]!.trim().toLowerCase()
    const adSoyad = named[1]!.trim().replace(/^["']|["']$/g, '')
    return EMAIL_RE.test(email) ? { email, adSoyad: adSoyad || null } : null
  }
  const email = trimmed.toLowerCase()
  return EMAIL_RE.test(email) ? { email, adSoyad: null } : null
}

export function formatMailFrom(email: string, adSoyad?: string | null) {
  if (adSoyad?.trim()) return `${adSoyad.trim()} <${email}>`
  return email
}

export function allowedSenderDomains(): string[] {
  const fromEnv = String(process.env.MUTABAKAT_ALLOWED_SENDER_DOMAINS || '')
    .split(/[,;]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  if (fromEnv.length) return fromEnv

  const parsed = parseMailFrom(process.env.MAIL_FROM)
  if (parsed) {
    const domain = parsed.email.split('@')[1]
    if (domain) return [domain]
  }
  return ['hidroteknik.com.tr']
}

export function isAllowedSenderEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  if (!EMAIL_RE.test(normalized)) return false
  const domain = normalized.split('@')[1]
  return allowedSenderDomains().includes(domain || '')
}

function systemSender(): MailSenderAccount | null {
  const parsed = parseMailFrom(process.env.MAIL_FROM)
  if (!parsed) return null
  return {
    id: 'system',
    email: parsed.email,
    ad_soyad: parsed.adSoyad,
    varsayilan: true,
    sistem: true,
  }
}

export async function listMailSenders(userId: string): Promise<MailSenderAccount[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('mutabakat_gonderici_hesaplari')
    .select('id,email,ad_soyad,varsayilan')
    .eq('user_id', userId)
    .eq('aktif', true)
    .order('created_at', { ascending: true })

  if (error) {
    if (error.code === '42P01') {
      const system = systemSender()
      return system ? [system] : []
    }
    throw error
  }

  const userSenders: MailSenderAccount[] = (data || []).map((row) => ({
    id: String(row.id),
    email: String(row.email).toLowerCase(),
    ad_soyad: row.ad_soyad ? String(row.ad_soyad) : null,
    varsayilan: Boolean(row.varsayilan),
    sistem: false,
  }))

  const system = systemSender()
  const senders = system ? [system, ...userSenders] : userSenders
  if (!senders.some((sender) => sender.varsayilan) && senders[0]) {
    senders[0] = { ...senders[0], varsayilan: true }
  }
  return senders
}

export async function getMailSenderById(
  userId: string,
  senderId: string
): Promise<MailSenderAccount | null> {
  if (senderId === 'system') return systemSender()
  const senders = await listMailSenders(userId)
  return senders.find((sender) => sender.id === senderId) || null
}

export async function addMailSender(userId: string, email: string, adSoyad?: string | null) {
  const normalized = email.trim().toLowerCase()
  if (!isAllowedSenderEmail(normalized)) {
    throw new Error(
      `Yalnızca şu alan adlarından gönderici eklenebilir: ${allowedSenderDomains().join(', ')}`
    )
  }

  const admin = createAdminClient()
  const { data: existing, error: existingError } = await admin
    .from('mutabakat_gonderici_hesaplari')
    .select('id')
    .eq('user_id', userId)
    .eq('email', normalized)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) throw new Error('Bu e-posta adresi zaten bağlı.')

  const { count, error: countError } = await admin
    .from('mutabakat_gonderici_hesaplari')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('aktif', true)
  if (countError) throw countError

  const makeDefault = (count || 0) === 0
  const { data, error } = await admin
    .from('mutabakat_gonderici_hesaplari')
    .insert({
      user_id: userId,
      email: normalized,
      ad_soyad: adSoyad?.trim() || null,
      varsayilan: makeDefault,
      aktif: true,
    })
    .select('id,email,ad_soyad,varsayilan')
    .single()
  if (error) throw error

  return {
    id: String(data.id),
    email: String(data.email),
    ad_soyad: data.ad_soyad ? String(data.ad_soyad) : null,
    varsayilan: Boolean(data.varsayilan),
    sistem: false,
  } satisfies MailSenderAccount
}

export async function removeMailSender(userId: string, senderId: string) {
  if (senderId === 'system') throw new Error('Sistem göndericisi kaldırılamaz.')
  const admin = createAdminClient()
  const { error } = await admin
    .from('mutabakat_gonderici_hesaplari')
    .update({ aktif: false, varsayilan: false })
    .eq('id', senderId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function setDefaultMailSender(userId: string, senderId: string) {
  if (senderId === 'system') {
    const admin = createAdminClient()
    const { error } = await admin
      .from('mutabakat_gonderici_hesaplari')
      .update({ varsayilan: false })
      .eq('user_id', userId)
    if (error) throw error
    return
  }

  const admin = createAdminClient()
  const { error: clearError } = await admin
    .from('mutabakat_gonderici_hesaplari')
    .update({ varsayilan: false })
    .eq('user_id', userId)
  if (clearError) throw clearError

  const { error } = await admin
    .from('mutabakat_gonderici_hesaplari')
    .update({ varsayilan: true })
    .eq('id', senderId)
    .eq('user_id', userId)
  if (error) throw error
}

export function defaultSenderId(senders: MailSenderAccount[]) {
  return senders.find((sender) => sender.varsayilan)?.id || senders[0]?.id || null
}
