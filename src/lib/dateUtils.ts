// Date parsing and formatting utilities

const GED_MONTHS: Record<string, string> = {
  JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',
  JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'
}

// Parse any date string to HTML date input value (YYYY-MM-DD)
// Handles: "03 AUG 2006", "2006-08-03", "03.08.2006", "1950"
export function parseToInputDate(raw: string): string {
  if (!raw) return ''
  const s = raw.trim().toUpperCase()

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // GEDCOM: DD MON YYYY or MON YYYY or YYYY
  const gedFull = s.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/)
  if (gedFull) {
    const [, d, m, y] = gedFull
    const mm = GED_MONTHS[m]
    if (mm) return `${y}-${mm}-${d.padStart(2,'0')}`
  }
  const gedMonYear = s.match(/^([A-Z]{3})\s+(\d{4})$/)
  if (gedMonYear) {
    const [, m, y] = gedMonYear
    const mm = GED_MONTHS[m]
    if (mm) return `${y}-${mm}-01`
  }
  const gedYear = s.match(/^(\d{4})$/)
  if (gedYear) return `${gedYear[1]}-01-01`

  // DD.MM.YYYY
  const dotDate = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dotDate) {
    const [, d, m, y] = dotDate
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  return '' // unparseable
}

// Format YYYY-MM-DD to DD.MM.YYYY for display
export function formatDateDisplay(isoDate: string | undefined): string {
  if (!isoDate) return ''
  const parsed = parseToInputDate(isoDate)
  if (!parsed) return isoDate  // return raw if can't parse
  const [y, m, d] = parsed.split('-')
  return `${d}.${m}.${y}`
}

// Format a raw date string (any format) to DD.MM.YYYY for display
export function formatRawDate(raw: string | undefined): string {
  if (!raw) return ''
  return formatDateDisplay(parseToInputDate(raw)) || raw
}
