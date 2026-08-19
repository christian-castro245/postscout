// lib/analyse/index.js
// Provider-Factory — liest ANALYSE_PROVIDER aus der Umgebung.
// Default: anthropic-direct (bestehendes Verhalten, nichts bricht).
//
// Gültige Werte für ANALYSE_PROVIDER:
//   anthropic-direct  (Standard)
//   bedrock-eu

import { AnthropicDirectProvider } from './anthropicDirect.js'
import { BedrockEuProvider } from './bedrockEu.js'

let _provider = null

export function getAnalyseProvider() {
  if (_provider) return _provider

  const name = (process.env.ANALYSE_PROVIDER || 'anthropic-direct').toLowerCase()

  switch (name) {
    case 'bedrock-eu':
      _provider = new BedrockEuProvider()
      break
    case 'anthropic-direct':
    default:
      _provider = new AnthropicDirectProvider()
      break
  }

  return _provider
}
