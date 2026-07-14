import 'server-only'
import { createAdminClient } from './supabase/admin'
import type { MailSenderAccount } from './types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SENDER_TIP = 'mutabakat_gonderici'
const DEFAULT_TIP = 'mutabakat_gonderici_varsayilan'

type SenderState = {
  email: string
  ad_soyad: string | null
  varsayilan: boolean
  aktif: boolean
  updated_at: string
}

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
    varsayilan: false,
    sistem: true,
  }
}

function parseSenderMeta(value: unknown): { varsayilan: boolean; aktif: boolean } {
  try {
    const parsed = JSON.parse(String(value || '{}')) as { varsayilan?: boolean; aktif?: boolean }
    return {
      varsayilan: Boolean(parsed.varsayilan),
      aktif: parsed.aktif !== false,
    }
  } catch {
    return { varsayilan: false, aktif: true }
  }
}

function senderIdForEmail(email: string) {
  return `user-${email}`
}

function emailFromSenderId(senderId: string) {
  return senderId.startsWith('user-') ? senderId.slice(5) : null
}

async function loadSenderStates(userId: string): Promise<SenderState[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('mail_gonderim_log')
    .select('mail_to,subject,body_preview,sent_at')
    .eq('ilgili_tip', SENDER_TIP)
    .eq('ilgili_id', userId)
    .order('sent_at', { ascending: false })

  if (error) throw error

  const latest = new Map<string, SenderState>()
  for (const row of data || []) {
    const email = String(row.mail_to || '').trim().toLowerCase()
    if (!email || latest.has(email)) continue
    const meta = parseSenderMeta(row.body_preview)
    latest.set(email, {
      email,
      ad_soyad: String(row.subject || '').trim() || null,
      varsayilan: meta.varsayilan,
      aktif: meta.aktif,
      updated_at: String(row.sent_at || new Date().toISOString()),
    })
  }

  return [...latest.values()].filter((item) => item.aktif)
}

async function loadPreferredSenderId(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('mail_gonderim_log')
    .select('mail_to,sent_at')
    .eq('ilgili_tip', DEFAULT_TIP)
    .eq('ilgili_id', userId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data?.mail_to ? String(data.mail_to) : null
}

async function writeSenderState(
  userId: string,
  email: string,
  adSoyad: string | null,
  varsayilan: boolean,
  aktif: boolean
) {
  const admin = createAdminClient()
  const { error } = await admin.from('mail_gonderim_log').insert({
    ilgili_id: userId,
    ilgili_tip: SENDER_TIP,
    mail_to: email,
    subject: adSoyad || '',
    body_preview: JSON.stringify({ varsayilan, aktif }),
    kaynak: 'kobi_tahsilat',
    sent_at: new Date().toISOString(),
  })
  if (error) throw error
}

async function writePreferredSenderId(userId: string, senderId: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('mail_gonderim_log').insert({
    ilgili_id: userId,
    ilgili_tip: DEFAULT_TIP,
    mail_to: senderId,
    subject: 'Varsayılan gönderici',
    body_preview: 'kobi_tahsilat',
    kaynak: 'kobi_tahsilat',
    sent_at: new Date().toISOString(),
  })
  if (error) throw error
}

function mapSenders(states: SenderState[], preferredId: string | null): MailSenderAccount[] {
  const system = systemSender()
  const userSenders: MailSenderAccount[] = states.map((state) => ({
    id: senderIdForEmail(state.email),
    email: state.email,
    ad_soyad: state.ad_soyad,
    varsayilan: preferredId === senderIdForEmail(state.email),
    sistem: false,
  }))

  const senders = system ? [system, ...userSenders] : userSenders
  const effectivePreferred = preferredId || (userSenders.length === 1 ? userSenders[0]!.id : null)

  return senders.map((sender) => ({
    ...sender,
    varsayilan:
      effectivePreferred != null
        ? sender.id === effectivePreferred
        : sender.sistem && senders.length === 1,
  }))
}

export async function listMailSenders(userId: string): Promise<MailSenderAccount[]> {
  const [states, preferredId] = await Promise.all([
    loadSenderStates(userId),
    loadPreferredSenderId(userId),
  ])
  const senders = mapSenders(states, preferredId)

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

  const existing = await loadSenderStates(userId)
  if (existing.some((item) => item.email === normalized)) {
    throw new Error('Bu e-posta adresi zaten bağlı.')
  }

  const makeDefault = existing.length === 0
  await writeSenderState(userId, normalized, adSoyad?.trim() || null, makeDefault, true)
  if (makeDefault) {
    await writePreferredSenderId(userId, senderIdForEmail(normalized))
  }

  return {
    id: senderIdForEmail(normalized),
    email: normalized,
    ad_soyad: adSoyad?.trim() || null,
    varsayilan: makeDefault,
    sistem: false,
  } satisfies MailSenderAccount
}

export async function removeMailSender(userId: string, senderId: string) {
  if (senderId === 'system') throw new Error('Sistem göndericisi kaldırılamaz.')
  const email = emailFromSenderId(senderId)
  if (!email) throw new Error('Geçersiz gönderici.')

  const states = await loadSenderStates(userId)
  const current = states.find((item) => item.email === email)
  if (!current) throw new Error('Gönderici bulunamadı.')

  await writeSenderState(userId, email, current.ad_soyad, false, false)

  const preferredId = await loadPreferredSenderId(userId)
  if (preferredId === senderId) {
    const remaining = states.filter((item) => item.email !== email)
    if (remaining[0]) {
      await writePreferredSenderId(userId, senderIdForEmail(remaining[0].email))
    } else {
      await writePreferredSenderId(userId, 'system')
    }
  }
}

export async function setDefaultMailSender(userId: string, senderId: string) {
  if (senderId === 'system') {
    await writePreferredSenderId(userId, 'system')
    return
  }

  const email = emailFromSenderId(senderId)
  if (!email) throw new Error('Geçersiz gönderici.')

  const states = await loadSenderStates(userId)
  const current = states.find((item) => item.email === email)
  if (!current) throw new Error('Gönderici bulunamadı.')

  await writeSenderState(userId, email, current.ad_soyad, true, true)
  await writePreferredSenderId(userId, senderId)
}

export function defaultSenderId(senders: MailSenderAccount[]) {
  return senders.find((sender) => sender.varsayilan)?.id || senders[0]?.id || null
}
