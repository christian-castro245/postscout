#!/usr/bin/env node
// scripts/compare-providers.js
// Vergleichsskript: Schickt denselben Text durch mehrere Provider und
// schreibt die Ergebnisse nebeneinander in eine Datei.
// Nur als Skript — nicht in der App verwendet.
// Zweck: Qualität von IONOS/Mistral gegen Claude messen, bevor migriert wird.
//
// Verwendung:
//   node scripts/compare-providers.js <textdatei>
//   Ergebnis: compare-result-<timestamp>.json

import { readFileSync, writeFileSync } from 'fs'
import { AnthropicDirectProvider } from '../lib/analyse/anthropicDirect.js'
import { BedrockEuProvider } from '../lib/analyse/bedrockEu.js'

async function main() {
  const textFile = process.argv[2]
  if (!textFile) {
    console.error('Verwendung: node scripts/compare-providers.js <textdatei>')
    process.exit(1)
  }

  const text = readFileSync(textFile, 'utf-8')
  const providers = []

  if (process.env.ANTHROPIC_API_KEY) {
    providers.push(new AnthropicDirectProvider())
  }
  if (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION) {
    providers.push(new BedrockEuProvider())
  }

  if (!providers.length) {
    console.error('Keine Provider konfiguriert. ANTHROPIC_API_KEY oder AWS-Credentials setzen.')
    process.exit(1)
  }

  console.log(`Vergleiche ${providers.length} Provider mit Textlänge ${text.length} Zeichen…`)

  const ergebnisse = {}
  for (const provider of providers) {
    console.log(`→ ${provider.name} (${provider.region})…`)
    const start = Date.now()
    try {
      const result = await provider.analysiere(text)
      ergebnisse[provider.name] = {
        region: provider.region,
        dauer_ms: Date.now() - start,
        ergebnis: result,
        fehler: null,
      }
      console.log(`  ✓ ${Date.now() - start}ms — Konfidenz: ${result.konfidenz?.gesamt}`)
    } catch (err) {
      ergebnisse[provider.name] = {
        region: provider.region,
        dauer_ms: Date.now() - start,
        ergebnis: null,
        fehler: err.message,
      }
      console.error(`  ✗ Fehler: ${err.message}`)
    }
  }

  const outFile = `compare-result-${Date.now()}.json`
  writeFileSync(outFile, JSON.stringify(ergebnisse, null, 2), 'utf-8')
  console.log(`\nErgebnis gespeichert: ${outFile}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
