// Verbindet sich mit der bestehenden Next.js API auf Vercel
// Alle AI-Analyse-Calls gehen über das Backend — kein API-Key im Client

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://postscout-beige.vercel.app'

export async function analyzeDocument(
  images: { base64: string }[],
  session: { access_token: string }
): Promise<{ ok: boolean; error?: string }> {
  const formData = new FormData()
  images.forEach((img, i) => {
    const byteArray = Uint8Array.from(atob(img.base64), c => c.charCodeAt(0))
    const blob = new Blob([byteArray], { type: 'image/jpeg' })
    formData.append('file', blob as any, `scan_${i}.jpg`)
  })

  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }))
    return { ok: false, error: err.error || `HTTP ${res.status}` }
  }
  return { ok: true }
}

export async function erklaerMir(
  frage: string,
  dokumentId: string,
  session: { access_token: string }
): Promise<{ antwort: string } | { error: string }> {
  const res = await fetch(`${API_BASE}/api/erklaer-mir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ frage, dokument_id: dokumentId }),
  })
  return res.json()
}

export async function generateReply(
  dokumentId: string,
  session: { access_token: string }
): Promise<{ antwort: string } | { error: string }> {
  const res = await fetch(`${API_BASE}/api/generate-reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ dokument_id: dokumentId }),
  })
  return res.json()
}

export async function addNotiz(
  dokumentId: string,
  text: string,
  session: { access_token: string }
): Promise<{ ok: boolean } | { error: string }> {
  const res = await fetch(`${API_BASE}/api/notiz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ dokument_id: dokumentId, text }),
  })
  return res.json()
}

export async function scanOnlySave(
  images: { base64: string }[],
  scanToken: string,
  ownerId: string,
  pageCount: number
): Promise<{ ok: boolean } | { error: string }> {
  const res = await fetch(`${API_BASE}/api/scan-only-save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scanToken, ownerId, images, pageCount }),
  })
  return res.json()
}
