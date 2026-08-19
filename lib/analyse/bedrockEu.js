// lib/analyse/bedrockEu.js
// BedrockEuProvider — AWS Bedrock in eu-central-1 (Frankfurt).
//
// Zero Data Retention (ZDR) bei Bedrock:
// - Aktiviert durch die Nutzung von Inference Profiles mit ZDR-fähigen Modellen
// - AWS Bedrock speichert Input/Output standardmäßig NICHT, wenn kein Guardrails-Logging
//   oder Model Invocation Logging konfiguriert ist.
// - Sicherstellen: In der AWS-Konsole unter Bedrock → Modellaufruf-Protokollierung DEAKTIVIERT lassen.
// - AVV (Auftragsverarbeitungsvertrag) mit AWS liegt über den AWS-Standardvertragsbedingungen vor.
//
// WICHTIG: Kein stiller Fallback auf eine Nicht-EU-Region.
// Wenn dieser Provider fehlschlägt, kommt ein sichtbarer Fehler zurück.

import { buildSystemPrompt } from './prompt.js'
import { parseGermanDate } from '../dateUtils.js'

const EU_REGION = 'eu-central-1'
const MAX_RETRIES = 3

export class BedrockEuProvider {
  constructor() {
    this.name = 'bedrock-eu'
    this.region = EU_REGION
  }

  async analysiere(text) {
    // Lazy import um AWS SDK nicht zu laden wenn der Provider nicht aktiv ist
    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime')

    const bedrockClient = new BedrockRuntimeClient({
      region: EU_REGION,
      // Auth über IAM-Rolle (keine Keys im Code)
    })

    // EU-Inferenzprofil (cross-region inference profile für eu-central-1)
    // Modell-ID über EU-Inferenzprofil ansprechen
    const modelId = process.env.BEDROCK_EU_MODEL_ID || 'eu.anthropic.claude-sonnet-4-5-20251101-v1:0'

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: text }],
    })

    let lastError
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const command = new InvokeModelCommand({
          modelId,
          body,
          contentType: 'application/json',
          accept: 'application/json',
        })

        const response = await Promise.race([
          bedrockClient.send(command),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Bedrock-Timeout nach 30s')), 30000)
          ),
        ])

        const result = JSON.parse(new TextDecoder().decode(response.body))
        const rawText = result.content?.[0]?.text || '{}'
        return parseAntwort(rawText)
      } catch (err) {
        lastError = err
        if (attempt < MAX_RETRIES) {
          await sleep(Math.pow(2, attempt) * 1000)
        }
      }
    }

    // Kein stiller Fallback — sichtbarer Fehler
    throw new Error(`Bedrock EU (${EU_REGION}) nicht erreichbar: ${lastError?.message}`)
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseAntwort(raw) {
  const cleaned = raw.replace(/```json\n?|```/g, '').trim()
  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Bedrock-Antwort nicht parsierbar: ${cleaned.slice(0, 120)}`)
  }

  const safeDate = v => parseGermanDate(v)

  return {
    titel:             parsed.titel || null,
    absender:          parsed.absender || null,
    absenderEmail:     parsed.absenderEmail || null,
    kategorie:         parsed.kategorie || 'Sonstiges',
    zusammenfassung:   parsed.zusammenfassung || '',
    aufgaben:          (parsed.aufgaben || []).map(a => ({
      text:             a.text || '',
      faelligkeitsdatum: safeDate(a.faelligkeitsdatum),
      erledigt:         false,
    })),
    faelligkeitsdatum: safeDate(parsed.faelligkeitsdatum),
    antwortErforderlich: Boolean(parsed.antwortErforderlich),
    konfidenz: {
      gesamt:            parsed.konfidenz?.gesamt || 'mittel',
      faelligkeitsdatum: parsed.konfidenz?.faelligkeitsdatum || 'keins',
      hinweis:           parsed.konfidenz?.hinweis || null,
    },
  }
}
