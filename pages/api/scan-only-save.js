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
      "beschreibung": "Aufgabe MIT konkreten Details — IMMER spezifisch: Betrag in €, Name, Referenz, Frist. BEISPIEL GUT: '€247,50 offener Posten Nebenkosten 2025 an Hausverwaltung bis 31.07.2026 überweisen'. BEISPIEL SCHLECHT: 'Betrag überweisen'.",
      "kontext": "Ein Satz: Wer fordert was und warum? Für jemanden der diesen Brief nie gesehen hat.",
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
BBOX-REGEL: belegstelle_bbox = Position des Belegstellen-Textes im Dokument. Koordinaten relativ zur Seitengröße (0.0 = linker/oberer Rand, 1.0 = rechter/unterer Rand). x/y = obere linke Ecke, w/h = Breite/Höhe. page = 0-basierter Seitenindex.`

const DRING_MAP = {
  'Überfällig':         'ueberfaellig',
  'Dringend':           'hoch',
  'Mittelfristig':      'mittel',
  'Zur Kenntnis':       'niedrig',
  'Werbung/Ignorieren': 'ignorieren',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST' })

  const { scanToken, ownerId, images, pageCount } = req.body
  // images: [{ base64: string }]

  if (!scanToken || !ownerId || !Array.isArray(images) || !images.length) {
    return res.status(400).json({ error: 'scanToken, ownerId und images erforderlich' })
  }

  // Validate token
  const { data: token, error: tokenErr } = await supabaseAdmin
    .from('scan_tokens')
    .select('inhaber_id, aktiv')
    .eq('token', scanToken)
    .eq('inhaber_id', ownerId)
    .single()

  if (tokenErr || !token || !token.aktiv) {
    return res.status(401).json({ error: 'Ungültiger Scan-Token' })
  }

  // Build Claude image blocks
  const fileBlocks = images.map(img => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: img.base64 },
  }))
  fileBlocks.push({
    type: 'text',
    text: images.length > 1
      ? `Analysiere diese ${images.length} Seiten als ein Dokument.`
      : 'Analysiere diesen Brief.',
  })

  const ts = Date.now()

  // Upload to storage server-side (service role — no iOS Safari risk)
  const uploadPromise = (async () => {
    const urls = []
    for (let i = 0; i < images.length; i++) {
      const path = `${ownerId}/scan-only/${ts}_${i}.jpg`
      const buf = Buffer.from(images[i].base64, 'base64')
      const { error: upErr } = await supabaseAdmin.storage
        .from('dokumente')
        .upload(path, buf, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) throw new Error(`Storage: ${upErr.message}`)
      const { data: urlData } = supabaseAdmin.storage.from('dokumente').getPublicUrl(path)
      urls.push(urlData?.publicUrl || '')
    }
    return urls
  })()

  const analyzePromise = anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: fileBlocks }],
  }).then(msg => msg.content[0]?.text || '{}')

  let analysisText, uploadedUrls
  try {
    ;[analysisText, uploadedUrls] = await Promise.all([analyzePromise, uploadPromise])
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }

  let parsed = {}
  try {
    parsed = JSON.parse(analysisText.replace(/```json\n?|```/g, '').trim())
  } catch {
    return res.status(500).json({ error: 'Analyse-JSON fehlerhaft' })
  }

  const safeDate = v => parseGermanDate(v)
  const dring = DRING_MAP[parsed.dringlichkeit] || 'niedrig'

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

  const { error: dbErr } = await supabaseAdmin.from('dokumente').insert({
    user_id:              ownerId,
    dateiname:            `Scan (${pageCount} Seite${pageCount !== 1 ? 'n' : ''})`,
    bild_url:             uploadedUrls[0] || null,
    bild_urls:            uploadedUrls,
    mime_type:            'image/jpeg',
    quelle:               'scan-only',
    anhaenge:             [],
    notizen:              [],
    titel:                parsed.titel || 'Scan',
    absender:             parsed.absender || null,
    absender_email:       parsed.absender_email || null,
    zusammenfassung:      parsed.zusammenfassung || '',
    dringlichkeit:        dring,
    faelligkeitsdatum:    safeDate(parsed.faelligkeitsdatum),
    antwort_erforderlich: Boolean(parsed.antwort_erforderlich),
    analysiert:           true,
    aufgaben,
    todos: aufgaben.map(t => ({
      aufgabe:          t.beschreibung,
      kontext:          t.kontext,
      frist:            t.faelligkeitsdatum,
      dringlichkeit:    dring,
      status:           'offen',
      erledigt:         false,
      typ:              t.typ,
      betrag:           t.betrag,
      empfaenger:       t.empfaenger,
      iban:             t.iban,
      bic:              t.bic,
      verwendungszweck: t.verwendungszweck,
      belegstelle:      t.belegstelle,
      belegstelle_bbox: t.belegstelle_bbox,
    })),
    jahr: new Date().getFullYear(),
  })

  if (dbErr) return res.status(500).json({ error: dbErr.message })
  return res.status(200).json({ ok: true })
}
