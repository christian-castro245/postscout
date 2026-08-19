// lib/ocr/types.js
// OCR-Provider-Interface. Austauschbar: heute server-seitig, später On-Device (Apple Vision / ML Kit).
//
// WICHTIG: Das Flag aufGeraet ist kein kosmetisches Detail.
// Die App darf "Ihr Brief verlässt Ihr Gerät nicht" NUR anzeigen, wenn aufGeraet === true.
// Diese Aussage kommt aus dem Code, nicht aus einem statischen Text.

/**
 * @typedef {Object} OcrErgebnis
 * @property {string} text - Erkannter Text
 * @property {number} konfidenz - Erkennungskonfidenz 0..1
 * @property {string|null} qualitaetswarnung - z.B. "Bild unscharf" oder null
 */

/**
 * @typedef {Object} OcrProvider
 * @property {string} name - Bezeichnung des Providers
 * @property {boolean} aufGeraet - true = Text verlässt das Gerät nicht
 * @property {function(Blob|Buffer): Promise<OcrErgebnis>} erkenne
 */

// Schwellwert: Unter dieser Konfidenz wird nicht analysiert
export const OCR_KONFIDENZ_SCHWELLWERT = 0.6

// Schwellwert: Unter dieser Textlänge (in Zeichen) wird nicht analysiert
export const OCR_TEXTLAENGE_MINIMUM = 50

/**
 * Prüft ob ein OCR-Ergebnis ausreichend Qualität hat für eine Analyse.
 * Wenn nicht, muss der Nutzer das Foto wiederholen.
 * @param {OcrErgebnis} ergebnis
 * @returns {{ ok: boolean, grund: string|null }}
 */
export function pruefeOcrQualitaet(ergebnis) {
  if (!ergebnis) return { ok: false, grund: 'Kein OCR-Ergebnis' }
  if (ergebnis.konfidenz < OCR_KONFIDENZ_SCHWELLWERT) {
    return { ok: false, grund: ergebnis.qualitaetswarnung || 'Bildqualität zu niedrig — bitte Foto wiederholen' }
  }
  if (!ergebnis.text || ergebnis.text.trim().length < OCR_TEXTLAENGE_MINIMUM) {
    return { ok: false, grund: 'Zu wenig Text erkannt — bitte Foto wiederholen' }
  }
  return { ok: true, grund: null }
}
