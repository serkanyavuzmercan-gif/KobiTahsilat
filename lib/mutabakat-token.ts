import 'server-only'
import crypto from 'crypto'

type MutabakatTokenPayload = {
  cariKod: string
  snapshotTarihi: string
  bakiye: number
  exp: number
}

export function createMutabakatToken(cariKod: string, snapshotTarihi: string, bakiye: number) {
  const secret = getSecret()
  const payload: MutabakatTokenPayload = {
    cariKod,
    snapshotTarihi,
    bakiye: Math.round(bakiye * 100) / 100,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

export function verifyMutabakatToken(token: string): MutabakatTokenPayload | null {
  try {
    const secret = getSecret()
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) return null

    const expected = crypto.createHmac('sha256', secret).update(encoded).digest()
    const received = Buffer.from(signature, 'base64url')
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as MutabakatTokenPayload
    if (
      !payload.cariKod ||
      !/^\d{4}-\d{2}-\d{2}$/.test(payload.snapshotTarihi) ||
      !Number.isFinite(payload.bakiye) ||
      !payload.exp ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

function getSecret() {
  const secret = process.env.MUTABAKAT_TOKEN_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('Mutabakat token anahtarı yapılandırılmadı')
  }
  return secret
}
