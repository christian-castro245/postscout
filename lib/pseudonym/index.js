// lib/pseudonym/index.js
// Lokale Pseudonymisierung vor Modellaufruf — kein externer Dienst.
// Die Zuordnungstabelle lebt ausschließlich im Speicher für die Dauer eines Analysevorgangs.

/**
 * @typedef {Object} Pseudonymisierung
 * @property {string} text - Entschärfter Text mit Platzhaltern
 * @property {Map<string, string>} zuordnung - Platzhalter → Originalwert (nie persistieren)
 * @property {string[]} gefundeneTypen - Erkannte Typen für Diagnose (ohne Werte)
 */

/**
 * Ersetzt personenbezogene Daten im Text durch Platzhalter.
 * @param {string} text
 * @returns {Pseudonymisierung}
 */
export function pseudonymisiere(text) {
  if (!text || typeof text !== 'string') {
    return { text: text || '', zuordnung: new Map(), gefundeneTypen: [] }
  }

  const zuordnung = new Map()
  const gefundeneTypen = new Set()
  const counter = {}

  function nextPlatzhalter(typ) {
    counter[typ] = (counter[typ] || 0) + 1
    return `[${typ}_${counter[typ]}]`
  }

  function ersetzeMitKonsistenz(wert, typ) {
    // Gleicher Wert → gleicher Platzhalter (Konsistenz innerhalb eines Dokuments)
    for (const [platzhalter, original] of zuordnung) {
      if (original === wert) return platzhalter
    }
    const platzhalter = nextPlatzhalter(typ)
    zuordnung.set(platzhalter, wert)
    gefundeneTypen.add(typ)
    return platzhalter
  }

  let result = text

  // ── E-Mail (vor Namen, da Emails auch Name-Muster enthalten können) ────────
  result = result.replace(
    /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    (m) => ersetzeMitKonsistenz(m, 'EMAIL')
  )

  // ── IBAN (inkl. Prüfsummenvalidierung) ────────────────────────────────────
  result = result.replace(
    /\b([A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]{0,16}))\b/g,
    (m) => {
      if (!validateIban(m)) return m
      return ersetzeMitKonsistenz(m, 'IBAN')
    }
  )

  // ── BIC ───────────────────────────────────────────────────────────────────
  result = result.replace(
    /\b([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/g,
    (m) => {
      // BIC mindestens 8, maximal 11 Zeichen
      if (m.length < 8 || m.length > 11) return m
      return ersetzeMitKonsistenz(m, 'BIC')
    }
  )

  // ── Steuer-ID / Steuernummer ──────────────────────────────────────────────
  // Format: 13-stellige Steueridentifikationsnummer
  result = result.replace(
    /\b(\d{2}\s*\/\s*\d{3}\s*\/\s*\d{5})\b/g,
    (m) => ersetzeMitKonsistenz(m.replace(/\s/g, ''), 'STEUERNR')
  )
  result = result.replace(
    /(?:Steuer-?(?:identifikations-?)?nummer|Steuer-?ID|IdNr\.?|StNr\.?)\s*:?\s*(\d[\d\s\/]{9,14}\d)/gi,
    (m, nr) => {
      const cleaned = nr.replace(/\s/g, '')
      return m.replace(nr, ersetzeMitKonsistenz(cleaned, 'STEUERNR'))
    }
  )

  // ── Sozialversicherungsnummer ─────────────────────────────────────────────
  result = result.replace(
    /(?:Sozialversicherungs-?(?:nummer|nr\.?)|SVNR|Rentenversicherungs-?(?:nummer|nr\.?))\s*:?\s*([\d\s]{8,14}[A-Z]?\d*)/gi,
    (m, nr) => {
      const cleaned = nr.replace(/\s/g, '')
      return m.replace(nr, ersetzeMitKonsistenz(cleaned, 'SVNR'))
    }
  )
  // Klassisches DE-Rentenversicherungs-Format: 2 Stellen, 6 Stellen Datum, 1 Buchstabe, 3 Stellen
  result = result.replace(
    /\b(\d{2}\s?\d{6}\s?[A-Z]\s?\d{3})\b/g,
    (m) => ersetzeMitKonsistenz(m.replace(/\s/g, ''), 'SVNR')
  )

  // ── Krankenversichertennummer ─────────────────────────────────────────────
  result = result.replace(
    /(?:Krankenversicherten-?(?:nummer|nr\.?)|KVN[rR]\.?|Versicherten-?(?:nummer|nr\.?))\s*:?\s*([A-Z]\d{9,10})/gi,
    (m, nr) => m.replace(nr, ersetzeMitKonsistenz(nr, 'KVNR'))
  )
  result = result.replace(
    /\b([A-Z]\d{9})\b/g,
    (m) => ersetzeMitKonsistenz(m, 'KVNR')
  )

  // ── Akten-, Geschäfts-, Kunden-, Vertragsnummer ───────────────────────────
  result = result.replace(
    /(?:Aktenzeichen|Az\.?|Geschäfts-?zeichen|Kunden-?(?:nummer|nr\.?)|Vertrags-?(?:nummer|nr\.?)|Referenz-?(?:nummer|nr\.?)|Rechnungs-?(?:nummer|nr\.?))\s*:?\s*([\w\/\-\.]{4,30})/gi,
    (m, nr) => m.replace(nr, ersetzeMitKonsistenz(nr.trim(), 'AKTENZ'))
  )

  // ── Telefonnummer ─────────────────────────────────────────────────────────
  result = result.replace(
    /(?:(?:\+49|0049)\s*[\d\s\-\/\(\)]{7,20}|\b0\d{2,4}[\s\/\-]?\d{3,12}(?:[\s\/\-]\d{2,6})?)\b/g,
    (m) => {
      const cleaned = m.trim()
      if (cleaned.replace(/\D/g, '').length < 7) return m
      return ersetzeMitKonsistenz(cleaned, 'TEL')
    }
  )

  // ── KFZ-Kennzeichen ───────────────────────────────────────────────────────
  result = result.replace(
    /\b([A-ZÄÖÜ]{1,3})-([A-Z]{1,2})\s?(\d{1,4}[HE]?)\b/g,
    (m) => ersetzeMitKonsistenz(m, 'KFZ')
  )

  // ── PLZ + Ort ─────────────────────────────────────────────────────────────
  result = result.replace(
    /\b(\d{5})\s+([A-ZÄÖÜ][a-zäöüß]+(?:[\s\-][A-Za-zäöüÄÖÜß]+)*)\b/g,
    (m, plz, ort) => ersetzeMitKonsistenz(`${plz} ${ort}`, 'ORT')
  )

  // ── Straße + Hausnummer ───────────────────────────────────────────────────
  result = result.replace(
    /\b([A-ZÄÖÜ][a-zäöüßA-ZÄÖÜ\s\-]+(?:straße|str\.|gasse|weg|platz|allee|ring|damm|ufer|chaussee|promenade)\.?\s+\d+\s*[a-z]?)\b/gi,
    (m) => ersetzeMitKonsistenz(m.trim(), 'STRASSE')
  )

  // ── Geburtsdatum (NUR mit Kontext-Marker) ─────────────────────────────────
  // Datum wird nur ersetzt wenn davor/daneben ein expliziter Marker steht
  // Im Zweifel NICHT ersetzen (Fristen sollen nicht maskiert werden)
  const gebMarker = /(?:geb(?:oren)?\.?(?:\s+am)?|Geburtsdatum|[*]\s*)/i
  result = result.replace(
    new RegExp(`(${gebMarker.source})\\s*(\\d{1,2}\\.\\d{1,2}\\.\\d{2,4}|\\d{4}-\\d{2}-\\d{2})`, 'gi'),
    (m, marker, datum) => marker + ersetzeMitKonsistenz(datum, 'GEBDATUM')
  )

  // ── Personennamen (Empfänger, Ansprechpartner) ────────────────────────────
  // Nur mit explizitem Anrede-Marker um Organisationsnamen zu schützen
  result = result.replace(
    /\b(Herr(?:n)?|Frau)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){0,3})\b/g,
    (m, anrede, name) => `${anrede} ${ersetzeMitKonsistenz(name, 'NAME')}`
  )
  // Adressblock-Namen (ohne Anrede, aber vor einer Straße im gleichen Block)
  result = result.replace(
    /^([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+)\s*\n\s*(?=\S+(?:straße|str\.|gasse|weg|platz))/gm,
    (m, name) => ersetzeMitKonsistenz(name, 'NAME') + m.slice(name.length)
  )

  return {
    text: result,
    zuordnung,
    gefundeneTypen: Array.from(gefundeneTypen),
  }
}

/**
 * Setzt Originalwerte aus der Zuordnungstabelle wieder ein.
 * Muss auf ALLEN Textfeldern der Modellantwort aufgerufen werden.
 * @param {string} text
 * @param {Map<string, string>} zuordnung
 * @returns {string}
 */
export function rehydriere(text, zuordnung) {
  if (!text || !zuordnung || zuordnung.size === 0) return text || ''
  let result = text
  for (const [platzhalter, original] of zuordnung) {
    result = result.split(platzhalter).join(original)
  }
  return result
}

// ── IBAN-Prüfsummenvalidierung (Mod-97) ──────────────────────────────────────
function validateIban(iban) {
  const cleaned = iban.replace(/\s/g, '').toUpperCase()
  if (cleaned.length < 15 || cleaned.length > 34) return false
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4)
  const numeric = rearranged.split('').map(c => {
    const code = c.charCodeAt(0)
    return code >= 65 ? String(code - 55) : c
  }).join('')
  let remainder = 0
  for (const chunk of numeric.match(/.{1,9}/g) || []) {
    remainder = parseInt(String(remainder) + chunk, 10) % 97
  }
  return remainder === 1
}
