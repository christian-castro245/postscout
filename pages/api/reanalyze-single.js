import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { parseGermanDate } from '../../lib/dateUtils'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Du analysierst Dokumente (Briefe, Bescheide, Rechnungen) für ältere Menschen in Deutschland.
Antworte AUSSCHLIESSLICH mit einem JSON-Objekt. Kein Text davor oder danach.

JSON-Schema:
{
  "titel": "Kurztitel des Dokuments (max 60 Zeichen)",
  "absender": "Name der sendenden Organisation/Person",
  "absender_email": "E-Mail-Adresse falls erkennbar, sonst null",
  "dringlichkeit": "Überfällig" | "Dringend" | "Mittelfristig" | "Zur Kenntnis" | "Werbung/Ignorieren",
  "zusammenfassung": "2-3 Sätze in einfachem Deutsch was in dem Dokument steht",
  "faelligkeitsdatum": "YYYY-MM-DD oder null wenn kein konkretes Datum erkennbar",
  "antwort_erforderlich": true | false,
  "aufgaben": [
    {
      "beschreibung": "Aufgabe MIT konkreten Details aus dem Dokument — IMMER spezifisch: Betrag in €, Name des Empfängers, Referenznummer, Frist. BEISPIEL GUT: '€247,50 offener Posten Nebenkosten 2025 an Hausverwaltung Muster GmbH bis 31.07.2026 überweisen'. BEISPIEL SCHLECHT: 'Betrag überweisen'. Wenn kein Betrag → trotzdem konkret mit Bezug auf Dokument.",
      "kontext": "Ein Satz der erklärt: Wer fordert was und warum? Für jemanden der diesen Brief nie gesehen hat. Beispiel: 'Die Hausverwaltung fordert ausstehende Nebenkosten 2025, da laut Schreiben bislang keine Zahlung eingegangen ist.'",
      "faelligkeitsdatum": "YYYY-MM-DD oder null",
      "empfehlung": "Was die Person konkret tun soll — Schritt für Schritt falls sinnvoll",
      "antwort_erforderlich": true | false,
      "typ": "zahlung" | "antwort" | "aktion" | "kenntnis",
      "betrag": Zahl in Euro als Dezimalzahl oder null,
      "empfaenger": "Name des Zahlungsempfängers oder null",
      "iban": "IBAN des Empfängers oder null",
      "bic": "BIC/SWIFT oder null",
      "verwendungszweck": "Verwendungszweck / Referenznummer / Rechnungsnummer oder null",
      "belegstelle": "Wörtliches Zitat aus dem Dokument (max 150 Zeichen) — die Textstelle auf der diese Aufgabe basiert",
      "belegstelle_bbox": {"page": 0, "x": 0.05, "y": 0.60, "w": 0.90, "h": 0.08}
    }
  ]
}

DATUM-REGEL: Erkannte Daten IMMER als YYYY-MM-DD formatieren. Heute ist ${new Date().toISOString().slice(0, 10)}.
Falls ein Datum im Text steht (z.B. "02. Juli 2026") → "2026-07-02".
Falls kein Datum erkennbar → null. NIEMALS leere Strings oder unformatierte Daten.
TYP-REGEL: "zahlung" wenn Geld überwiesen/gezahlt werden muss. "antwort" wenn schriftlich geantwortet werden muss. "aktion" für sonstige Handlungen. "kenntnis" für reine Information.
BESCHREIBUNGS-REGEL: NIEMALS generisch. Immer: konkreter Betrag + Empfänger ODER spezifische Anforderung + Referenz aus dem Dokument. Die Beschreibung muss ohne das Originaldokument verständlich sein.
BBOX-REGEL: belegstelle_bbox = Position des Belegstellen-Textes im Dokument. Koordinaten relativ zur Seitengröße (0.0 = linker/oberer Rand, 1.0 = rechter/unterer Rand). x/y = obere linke Ecke, w/h = Breite/Höhe des Bereichs. page = 0-basierter Seitenindex.`

const DRING_MAP = {
  'Überfällig':         'ueberfaellig',
  'Dringend':           'hoch',
  'Mittelfristig':      'mittel',
  'Zur Kenntnis':       'niedrig',
  'Werbung/Ignorieren': 'ignorieren',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const authHeader = req.headers['authorization'] || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return res.status(401).json({ error: 'Nicht eingeloggt' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt)
  if (authErr || !user) return res.status(401).json({ error: 'Session ungültig' })

  const { docId } = req.body
  if (!docId) return res.status(400).json({ error: 'docId erforderlich' })

  // Load the document — verify ownership
  const { data: doc, error: docErr } = await supabaseAdmin
    .from('dokumente')
    .select('id, bild_url, bild_urls, todos, aufgaben, dringlichkeit')
    .eq('id', docId)
    .eq('user_id', user.id)
    .single()

  if (docErr || !doc) return res.status(404).json({ error: 'Dokument nicht gefunden' })
  if (!doc.bild_url && !(doc.bild_urls?.length)) {
    return res.status(422).json({ error: 'Kein Bild gespeichert — Analyse nicht möglich' })
  }

  // Build image blocks from stored URLs (fetch → base64)
  const urls = (doc.bild_urls?.length ? doc.bild_urls : [doc.bild_url]).filter(Boolean).slice(0, 5)
  const fileBlocks = []

  for (const url of urls) {
    try {
      const r = await fetch(url)
      if (!r.ok) continue
      const buf = Buffer.from(await r.arrayBuffer())
      const ct = r.headers.get('content-type') || 'image/jpeg'
      const mimeType = ct.split(';')[0].trim()
      fileBlocks.push({
        type: mimeType === 'application/pdf' ? 'document' : 'image',
        source: { type: 'base64', media_type: mimeType, data: buf.toString('base64') },
      })
    } catch { /* skip unreadable page */ }
  }

  if (!fileBlocks.length) return res.status(422).json({ error: 'Bilder konnten nicht geladen werden' })
  fileBlocks.push({ type: 'text', text: 'Analysiere dieses Dokument vollständig und gib das JSON zurück.' })

  // Run Claude
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: fileBlocks }],
  })

  let parsed = {}
  try {
    parsed = JSON.parse((msg.content[0]?.text || '{}').replace(/```json\n?|```/g, '').trim())
  } catch {
    return res.status(500).json({ error: 'Claude-Antwort konnte nicht verarbeitet werden' })
  }

  const safeDate = v => parseGermanDate(v)
  const dring = DRING_MAP[parsed.dringlichkeit] || doc.dringlichkeit || 'niedrig'

  const aufgaben = (parsed.aufgaben || []).map(t => ({
    beschreibung:         t.beschreibung || '',
    kontext:              t.kontext || null,
    faelligkeitsdatum:    safeDate(t.faelligkeitsdatum),
    empfehlung:           t.empfehlung || null,
    antwort_erforderlich: Boolean(t.antwort_erforderlich),
    typ:                  t.typ || 'aktion',
    betrag:               typeof t.betrag === 'number' ? t.betrag : null,
    empfaenger:           t.empfaenger || null,
    iban:                 t.iban || null,
    bic:                  t.bic || null,
    verwendungszweck:     t.verwendungszweck || null,
    belegstelle:          t.belegstelle || null,
    belegstelle_bbox:     t.belegstelle_bbox || null,
    erledigt:             false,
  }))

  // Preserve existing completion state by index
  const todos = aufgaben.map((t, i) => {
    const old = (doc.todos || [])[i] || {}
    return {
      aufgabe:          t.beschreibung,
      kontext:          t.kontext,
      frist:            t.faelligkeitsdatum,
      dringlichkeit:    dring,
      status:           old.status || 'offen',
      erledigt:         old.erledigt || false,
      erledigt_von:     old.erledigt_von || null,
      erledigt_am:      old.erledigt_am || null,
      typ:              t.typ,
      betrag:           t.betrag,
      empfaenger:       t.empfaenger,
      iban:             t.iban,
      bic:              t.bic,
      verwendungszweck: t.verwendungszweck,
      belegstelle:      t.belegstelle,
      belegstelle_bbox: t.belegstelle_bbox,
    }
  })

  const { error: updateErr } = await supabaseAdmin
    .from('dokumente')
    .update({ aufgaben, todos })
    .eq('id', doc.id)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  res.json({ ok: true, todoCount: todos.length })
}
