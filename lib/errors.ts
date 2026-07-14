type MaybeError = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

export function toErrorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message) return cause.message
  if (typeof cause === 'string' && cause.trim()) return cause.trim()
  if (cause && typeof cause === 'object') {
    const err = cause as MaybeError
    if (err.message) {
      if (err.code === '42P01' || err.code === 'PGRST205') {
        return 'Gönderici tablosu henüz oluşturulmamış. Supabase SQL Editor\'da docs/sql/mutabakat_gonderici_hesaplari.sql dosyasını çalıştırın.'
      }
      if (err.code === '23503') {
        return 'Kullanıcı kaydı doğrulanamadı. Oturumu kapatıp tekrar giriş yapın.'
      }
      return err.message
    }
  }
  return fallback
}

export function isMissingTableError(cause: unknown): boolean {
  if (!cause || typeof cause !== 'object') return false
  const code = String((cause as MaybeError).code || '')
  return code === '42P01' || code === 'PGRST205'
}
