/**
 * Parses a date string in various formats.
 * Returns ISO date string (YYYY-MM-DD) or null if unparseable.
 * Never throws. Never returns "Invalid Date".
 */
export function parseGermanDate(raw) {
  if (!raw) return null;
  if (typeof raw !== 'string') raw = String(raw);
  raw = raw.trim();

  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(raw);
    return isNaN(d) ? null : raw;
  }

  // German: DD.MM.YYYY or DD.MM.YY
  const m1 = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m1) {
    let [, day, month, year] = m1;
    if (year.length === 2) year = '20' + year;
    const iso = `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
    const d = new Date(iso);
    return isNaN(d) ? null : iso;
  }

  // German month names: "2. Juli 2026" or "02. Juli 2026"
  const months = {
    januar:1,februar:2,märz:3,april:4,mai:5,juni:6,
    juli:7,august:8,september:9,oktober:10,november:11,dezember:12,
  };
  const m2 = raw.toLowerCase().match(/^(\d{1,2})\.\s*([a-zä]+)\s+(\d{4})$/);
  if (m2) {
    const day = m2[1].padStart(2,'0');
    const mon = months[m2[2]];
    const year = m2[3];
    if (mon) {
      const iso = `${year}-${String(mon).padStart(2,'0')}-${day}`;
      const d = new Date(iso);
      return isNaN(d) ? null : iso;
    }
  }

  // Fallback: JS native parse (catches many formats)
  const d = new Date(raw);
  if (!isNaN(d)) {
    return d.toISOString().slice(0,10);
  }

  return null; // truly unparseable — caller should prompt user
}
