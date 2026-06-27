// POST /api/anschreiben
// Generiert ein Anschreiben basierend auf dem Dokument und dem Nutzerprofil

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY fehlt' })

  const { dokument, profil, anweisung } = req.body
  // dokument: { absender, zusammenfassung, kategorie, todos, empfehlungen }
  // profil: { vorname, nachname, strasse, hausnummer, plz, ort, geburtsdatum, steuer_id, iban }
  // anweisung: optionaler Hinweis was das Anschreiben bezwecken soll

  const absenderBlock = profil ? `
${profil.vorname} ${profil.nachname}
${profil.strasse} ${profil.hausnummer}
${profil.plz} ${profil.ort}
${profil.telefon || ''}
`.trim() : 'Absender unbekannt'

  const system = `Du bist ein professioneller Briefassistent für ältere Menschen in Deutschland.
Erstelle ein höfliches, klares Anschreiben auf Deutsch.
Antworte NUR mit einem JSON-Objekt (kein Markdown):
{
  "betreff": "Betreff des Briefes",
  "anschreiben": "Vollständiger Brieftext mit Anrede, Hauptteil und Grußformel",
  "empfaenger_name": "Name des Empfängers falls bekannt",
  "empfaenger_adresse": "Adresse des Empfängers falls bekannt"
}`

  const prompt = `Erstelle ein Anschreiben für folgende Situation:

ABSENDER (Briefschreiber):
${absenderBlock}

BEZUG AUF DIESES DOKUMENT:
Absender des Originalbriefs: ${dokument.absender || 'Unbekannt'}
Kategorie: ${dokument.kategorie}
Zusammenfassung: ${dokument.zusammenfassung}
Offene Todos: ${(dokument.todos || []).map(t => t.aufgabe).join(', ')}

${anweisung ? `GEWÜNSCHTE AKTION: ${anweisung}` : 'Reagiere angemessen auf den Brief.'}

Schreibe in einfacher, freundlicher Sprache. Datum: ${new Date().toLocaleDateString('de-DE')}.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) { const e = await response.json(); return res.status(response.status).json({ error: e.error?.message }) }
    const data = await response.json()
    const raw = data.content[0].text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    return res.status(200).json(JSON.parse(raw))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
