#!/usr/bin/env node
/**
 * Meta WABA'daki onaylı WhatsApp şablonlarını listeler.
 *
 * Kullanım:
 *   WHATSAPP_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... node scripts/whatsapp-templates.mjs
 *   WHATSAPP_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... node scripts/whatsapp-templates.mjs --test 905337274822
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx <= 0) continue
      const key = trimmed.slice(0, idx).trim()
      let value = trimmed.slice(idx + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // optional local env
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'))

const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'}`
const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || ''
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
const wabaIdFromEnv = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || ''

async function graphGet(path) {
  const response = await fetch(`${GRAPH}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const raw = await response.text()
  let json = {}
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error(`Geçersiz JSON (${response.status}): ${raw.slice(0, 200)}`)
  }
  if (!response.ok) {
    throw new Error(json.error?.message || `Graph hata ${response.status}`)
  }
  return json
}

async function graphPost(path, body) {
  const response = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const raw = await response.text()
  let json = {}
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error(`Geçersiz JSON (${response.status}): ${raw.slice(0, 200)}`)
  }
  if (!response.ok) {
    throw new Error(json.error?.message || `Graph hata ${response.status}`)
  }
  return json
}

async function resolveWabaId() {
  if (wabaIdFromEnv) return wabaIdFromEnv
  const result = await graphGet(`${phoneNumberId}?fields=whatsapp_business_account`)
  const wabaId = result.whatsapp_business_account?.id
  if (!wabaId) throw new Error('WABA kimliği bulunamadı.')
  return wabaId
}

async function listTemplates() {
  const wabaId = await resolveWabaId()
  const result = await graphGet(
    `${wabaId}/message_templates?limit=100&fields=name,status,language,category,components`
  )
  const rows = result.data || []
  if (!rows.length) {
    console.log('Şablon bulunamadı.')
    return
  }
  for (const row of rows) {
    const body = (row.components || []).find((part) => part.type === 'BODY')
    console.log(
      [
        row.status?.padEnd(12),
        row.language,
        row.name,
        row.category || '',
        body?.text ? `— ${body.text.replace(/\s+/g, ' ').slice(0, 120)}` : '',
      ]
        .filter(Boolean)
        .join(' ')
    )
  }
}

async function testTemplate(to) {
  const templateName = process.env.WHATSAPP_HATIRLATMA_TEMPLATE || 'hello_world'
  const language = process.env.WHATSAPP_HATIRLATMA_TEMPLATE_LANG || 'en_US'
  const digits = to.replace(/\D/g, '')
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: digits,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
    },
  }
  if (templateName !== 'hello_world') {
    payload.template.components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Test Firma A.Ş.' },
          { type: 'text', text: '1.150.000 ₺' },
          { type: 'text', text: 'Bilgilendirme amaçlıdır.' },
          { type: 'text', text: '30 gün' },
        ],
      },
    ]
  }
  const result = await graphPost(`${phoneNumberId}/messages`, payload)
  console.log('Test gönderildi:', result.messages?.[0]?.id || result)
}

async function main() {
  if (!token || !phoneNumberId) {
    console.error('WHATSAPP_TOKEN ve WHATSAPP_PHONE_NUMBER_ID gerekli.')
    process.exit(1)
  }

  const testArgIdx = process.argv.indexOf('--test')
  if (testArgIdx >= 0) {
    const to = process.argv[testArgIdx + 1]
    if (!to) {
      console.error('--test sonrası telefon numarası verin.')
      process.exit(1)
    }
    await testTemplate(to)
    return
  }

  await listTemplates()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
