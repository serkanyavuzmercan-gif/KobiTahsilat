import Holidays from 'date-holidays'

const turkeyHolidays = new Holidays('TR')

/** Hafta sonları ve Türkiye resmî tatilleri hariç iş günü ekler. */
export function addBusinessDays(value: string | Date, days: number): Date {
  const date = new Date(value)
  let added = 0
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1)
    if (isBusinessDay(date)) added++
  }
  return date
}

export function isBusinessDay(date: Date): boolean {
  const day = date.getUTCDay()
  if (day === 0 || day === 6) return false
  // Öğlen kullanmak, saat dilimi sınırında tarihin bir önceki/sonraki güne kaymasını önler.
  const calendarDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12)
  )
  return !turkeyHolidays.isHoliday(calendarDate)
}
