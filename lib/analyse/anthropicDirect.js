// lib/analyse/anthropicDirect.js
// AnthropicDirectProvider — bestehende API direkt aufrufen.
// Kapselt das bisherige Verhalten. Bleibt unverändert wenn der Provider gewechselt wird.

import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt } from './prompt.js'
import { parseGermanDate } from '../dateUtils.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export class AnthropicDirectProvider {
  constructor() {
    this.name = 'anthropic-direct'
    this.region = 'us-east-1'
  }

  async analysiere(text) {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: text }],
    })

    return parseAntwort(msg.content[0]?.text || '{}')
  }
}

function parseAntwort(raw) {
  const cleaned = raw.replace(/```json\n?|```/g, '').trim()
  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Analyse-JSON nicht parsierbar: ${cleaned.slice(0, 120)}`)
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
