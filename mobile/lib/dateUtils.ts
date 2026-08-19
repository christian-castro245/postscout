// Identisch mit lib/dateUtils.js in der Web-App — kein externer Import nötig

export function parseGermanDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (typeof raw !== 'string') raw = String(raw)
  raw = raw.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(raw)
    return isNaN(d.getTime()) ? null : raw
  }

  const m1 = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
  if (m1) {
    let [, day, month, year] = m1
    if (year.length === 2) year = '20' + year
    const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    const d = new Date(iso)
    return isNaN(d.getTime()) ? null : iso
  }

  const months: Record<string, number> = {
    januar:1, februar:2, märz:3, april:4, mai:5, juni:6,
    juli:7, august:8, september:9, oktober:10, november:11, dezember:12,
  }
  const m2 = raw.toLowerCase().match(/^(\d{1,2})\.\s*([a-zä]+)\s+(\d{4})$/)
  if (m2) {
    const day = m2[1].padStart(2, '0')
    const mon = months[m2[2]]
    const year = m2[3]
    if (mon) {
      const iso = `${year}-${String(mon).padStart(2, '0')}-${day}`
      const d = new Date(iso)
      return isNaN(d.getTime()) ? null : iso
    }
  }

  const d = new Date(raw)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso || ''
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - new Date().setHours(0,0,0,0)
  return Math.ceil(diff / 86400000)
}
