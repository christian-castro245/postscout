import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ── States ────────────────────────────────────────────────────────────────────
// idle → camera → capturing → uploading → done → error

export default function ScanOnly() {
  const [state, setState]           = useState('idle') // idle | camera | capturing | uploading | done | error
  const [tokenData, setTokenData]   = useState(null)   // { ownerId, scanToken }
  const [tokenValid, setTokenValid] = useState(null)   // null=checking true/false
  const [pages, setPages]           = useState([])     // captured photos
  const [autoMode, setAutoMode]     = useState(true)
  const [docDetected, setDocDetected] = useState(false)
  const [countdown, setCountdown]   = useState(0)
  const [errorMsg, setErrorMsg]     = useState('')

  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const streamRef   = useRef(null)
  const detectTimer = useRef(null)
  const countTimer  = useRef(null)
  const detecting   = useRef(false)

  // ── Token validation ──────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) { setTokenValid(false); return }
    validateToken(token)
  }, [])

  async function validateToken(token) {
    const { data, error } = await supabaseAnon
      .from('scan_tokens')
      .select('inhaber_id, aktiv')
      .eq('token', token)
      .single()

    if (error || !data || !data.aktiv) {
      setTokenValid(false); return
    }
    setTokenData({ ownerId: data.inhaber_id, scanToken: token })
    setTokenValid(true)
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  async function startCamera() {
    setState('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      if (autoMode) startDetection()
    } catch (e) {
      setErrorMsg('Kamerazugriff verweigert. Bitte Erlaubnis erteilen.')
      setState('error')
    }
  }

  function stopCamera() {
    stopDetection()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  // ── Auto-detection ────────────────────────────────────────────────────────
  function startDetection() {
    detecting.current = true
    detectLoop()
  }

  function stopDetection() {
    detecting.current = false
    clearTimeout(detectTimer.current)
    clearTimeout(countTimer.current)
    setDocDetected(false)
    setCountdown(0)
  }

  function detectLoop() {
    if (!detecting.current) return
    const detected = analyzeFrame()
    setDocDetected(detected)

    if (detected) {
      // Start countdown to auto-capture
      startCountdown()
    } else {
      clearTimeout(countTimer.current)
      setCountdown(0)
    }
    detectTimer.current = setTimeout(detectLoop, 300)
  }

  function analyzeFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return false

    const ctx = canvas.getContext('2d')
    const W = 160, H = 90 // small for performance
    canvas.width = W; canvas.height = H
    ctx.drawImage(video, 0, 0, W, H)

    try {
      const data = ctx.getImageData(0, 0, W, H).data
      // Analyze: look for high contrast edges typical of a document
      let edgeCount = 0
      let totalBrightness = 0

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2]
        const brightness = (r + g + b) / 3
        totalBrightness += brightness

        // Simple edge detection: compare with neighbor
        if (i + 4*W*4 < data.length) {
          const nr = data[i + W*4], ng = data[i+1 + W*4], nb = data[i+2 + W*4]
          const diff = Math.abs(brightness - (nr+ng+nb)/3)
          if (diff > 40) edgeCount++
        }
      }

      const avgBrightness = totalBrightness / (W * H)
      const edgeDensity = edgeCount / (W * H)

      // Document likely present if: bright enough + has edges (text/borders)
      return avgBrightness > 80 && edgeDensity > 0.03 && edgeDensity < 0.4
    } catch { return false }
  }

  function startCountdown() {
    let count = 2
    setCountdown(count)
    function tick() {
      count--
      setCountdown(count)
      if (count <= 0) {
        capturePhoto()
      } else {
        countTimer.current = setTimeout(tick, 700)
      }
    }
    clearTimeout(countTimer.current)
    countTimer.current = setTimeout(tick, 700)
  }

  // ── Capture ───────────────────────────────────────────────────────────────
  function capturePhoto() {
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(80)

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob)
      const reader = new FileReader()
      reader.onload = e => {
        setPages(prev => [...prev, {
          blob,
          previewUrl: url,
          base64: e.target.result.split(',')[1],
        }])
        // Reset detection after capture
        stopDetection()
        setTimeout(() => {
          if (detecting.current === false && streamRef.current) startDetection()
        }, 1500)
      }
      reader.readAsDataURL(blob)
    }, 'image/jpeg', 0.92)
  }

  function removePhoto(idx) {
    setPages(prev => prev.filter((_,i) => i !== idx))
  }

  // ── Upload & Analyze ──────────────────────────────────────────────────────
  async function uploadAndAnalyze() {
    if (!pages.length || !tokenData) return
    setState('uploading')
    stopCamera()

    try {
      const contentParts = pages.map(p => ({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: p.base64 }
      }))
      contentParts.push({ type: 'text', text: pages.length > 1
        ? `Analysiere diese ${pages.length} Seiten als ein Dokument.`
        : 'Analysiere diesen Brief.' })

      // Analyze via dedicated anonymous-scan API (kein dokumentId vorhanden)
      const res = await fetch('/api/analyze-anon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentParts, userId: tokenData.ownerId }),
      })
      if (!res.ok) throw new Error('Analyse fehlgeschlagen')
      const r = await res.json()

      // Upload images to storage
      const ts = Date.now()
      const storagePaths = []
      for (let i = 0; i < pages.length; i++) {
        const path = `${tokenData.ownerId}/scan-only/${ts}_${i}.jpg`
        const { error: se } = await supabaseAnon.storage
          .from('dokumente').upload(path, pages[i].blob, { contentType: 'image/jpeg' })
        if (se) throw new Error('Upload: ' + se.message)
        storagePaths.push(path)
      }

      // Save document using service-role via API route
      const saveRes = await fetch('/api/scan-only-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanToken: tokenData.scanToken,
          ownerId: tokenData.ownerId,
          storagePath: storagePaths[0],
          analysisResult: r,
          pageCount: pages.length,
        }),
      })
      if (!saveRes.ok) throw new Error('Speichern fehlgeschlagen')
      setState('done')
    } catch (e) {
      setErrorMsg(e.message)
      setState('error')
    }
  }

  function reset() {
    setPages([])
    setDocDetected(false)
    setCountdown(0)
    setState('idle')
    stopCamera()
  }

  function addAnotherPage() {
    stopDetection()
    if (autoMode && streamRef.current) {
      setTimeout(() => startDetection(), 500)
    }
  }

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>Brief scannen – PostScout</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
      </Head>

      <div className="wrap">

        {/* Token checking */}
        {tokenValid === null && (
          <div className="center-screen">
            <div className="spinner"/>
            <p className="hint">Wird geprüft…</p>
          </div>
        )}

        {/* Invalid token */}
        {tokenValid === false && (
          <div className="center-screen">
            <div className="big-ico">🔒</div>
            <h1 className="big-title">Link ungültig</h1>
            <p className="hint">Bitte den QR-Code erneut scannen oder die Familie um einen neuen Link bitten.</p>
          </div>
        )}

        {/* IDLE: start screen */}
        {tokenValid && state === 'idle' && (
          <div className="center-screen">
            <div className="logo-row">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="3"/>
                <path d="m2 7 9.1 5.7a1.8 1.8 0 0 0 1.8 0L22 7"/>
              </svg>
              <span className="logo-text">PostScout</span>
            </div>
            <div className="big-ico">📷</div>
            <h1 className="big-title">Brief scannen</h1>
            <p className="hint">Halte den Brief vor die Kamera.<br/>Das Foto wird automatisch aufgenommen.</p>

            <div className="toggle-row">
              <span className="toggle-label">Automatisch auslösen</span>
              <button className={`toggle ${autoMode?'toggle-on':''}`} onClick={()=>setAutoMode(m=>!m)}>
                <div className="knob"/>
              </button>
            </div>

            <button className="big-btn" onClick={startCamera}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Kamera starten
            </button>
          </div>
        )}

        {/* CAMERA: live view */}
        {tokenValid && state === 'camera' && (
          <div className="camera-wrap">
            <video ref={videoRef} className="camera-video" playsInline muted autoPlay/>
            <canvas ref={canvasRef} style={{display:'none'}}/>

            {/* Document detection overlay */}
            <div className={`doc-frame ${docDetected?'doc-frame-detected':''}`}>
              {docDetected && countdown > 0 && (
                <div className="countdown">{countdown}</div>
              )}
            </div>

            {/* Status bar */}
            <div className="cam-status">
              {!docDetected && autoMode && <span className="status-hint">📄 Brief in den Rahmen halten</span>}
              {docDetected && countdown > 0 && <span className="status-hint status-green">✓ Dokument erkannt — Auslösung in {countdown}s</span>}
              {!autoMode && <span className="status-hint">Manuell: Taste drücken</span>}
            </div>

            {/* Page count badge */}
            {pages.length > 0 && (
              <div className="pages-badge">{pages.length} Seite{pages.length!==1?'n':''}</div>
            )}

            {/* Controls */}
            <div className="cam-controls">
              {pages.length > 0 && (
                <button className="ctrl-btn ctrl-done" onClick={uploadAndAnalyze}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  Fertig ({pages.length})
                </button>
              )}
              {!autoMode && (
                <button className="ctrl-btn ctrl-capture" onClick={capturePhoto}>
                  <div className="shutter"/>
                </button>
              )}
              <button className="ctrl-btn ctrl-abort" onClick={reset}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Thumbnail strip */}
            {pages.length > 0 && (
              <div className="thumb-strip">
                {pages.map((p,i) => (
                  <div key={i} className="thumb">
                    <img src={p.previewUrl} className="thumb-img" alt={`Seite ${i+1}`}/>
                    <button className="thumb-remove" onClick={()=>removePhoto(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* UPLOADING */}
        {tokenValid && state === 'uploading' && (
          <div className="center-screen">
            <div className="spinner"/>
            <h1 className="big-title">Wird gesendet…</h1>
            <p className="hint">Der Brief wird analysiert und gespeichert.</p>
          </div>
        )}

        {/* DONE */}
        {tokenValid && state === 'done' && (
          <div className="center-screen">
            <div className="big-ico">✅</div>
            <h1 className="big-title">Erledigt!</h1>
            <p className="hint">Der Brief wurde gespeichert und wird analysiert. Die Familie wurde informiert.</p>
            <button className="big-btn" onClick={reset} style={{background:'#2E7D46'}}>
              Weiteren Brief scannen
            </button>
          </div>
        )}

        {/* ERROR */}
        {state === 'error' && (
          <div className="center-screen">
            <div className="big-ico">⚠️</div>
            <h1 className="big-title">Fehler</h1>
            <p className="hint">{errorMsg}</p>
            <button className="big-btn" onClick={reset}>Nochmal versuchen</button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; font-family: "Figtree", system-ui, sans-serif; background: #1F3A52; color: #fff; -webkit-font-smoothing: antialiased; }

        .wrap { min-height: 100vh; display: flex; flex-direction: column; }

        /* Center screen */
        .center-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 28px; text-align: center; gap: 16px; min-height: 100vh; }
        .logo-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .logo-text { font-size: 20px; font-weight: 800; color: #fff; letter-spacing: -0.3px; }
        .big-ico { font-size: 64px; line-height: 1; }
        .big-title { font-size: 28px; font-weight: 800; color: #fff; letter-spacing: -0.5px; line-height: 1.15; }
        .hint { font-size: 16px; color: rgba(255,255,255,0.6); line-height: 1.6; max-width: 300px; }

        /* Toggle */
        .toggle-row { display: flex; align-items: center; gap: 14px; background: rgba(255,255,255,0.08); border-radius: 14px; padding: 14px 18px; width: 100%; max-width: 320px; }
        .toggle-label { font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.85); flex: 1; }
        .toggle { width: 44px; height: 25px; border-radius: 20px; border: none; background: rgba(255,255,255,0.2); cursor: pointer; position: relative; padding: 0; transition: background 200ms; flex-shrink: 0; }
        .toggle-on { background: #F97316; }
        .knob { width: 19px; height: 19px; border-radius: 50%; background: #fff; position: absolute; top: 3px; left: 3px; transition: transform 200ms; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        .toggle-on .knob { transform: translateX(19px); }

        /* Big button */
        .big-btn { display: flex; align-items: center; gap: 10px; padding: 16px 28px; border-radius: 16px; border: none; background: #F97316; color: #fff; font-size: 17px; font-weight: 700; cursor: pointer; font-family: inherit; transition: opacity 140ms; margin-top: 8px; }
        .big-btn:hover { opacity: 0.9; }

        /* Camera */
        .camera-wrap { position: fixed; inset: 0; background: #000; }
        .camera-video { width: 100%; height: 100%; object-fit: cover; }

        /* Document frame overlay */
        .doc-frame { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -55%); width: 85vw; height: 65vw; max-width: 380px; max-height: 260px; border: 3px solid rgba(255,255,255,0.4); border-radius: 12px; transition: border-color 200ms, box-shadow 200ms; pointer-events: none; }
        .doc-frame-detected { border-color: #4ade80; box-shadow: 0 0 0 4px rgba(74,222,128,0.25); }

        /* Corner marks */
        .doc-frame::before, .doc-frame::after { content: ''; position: absolute; width: 20px; height: 20px; border-color: inherit; border-style: solid; }
        .doc-frame::before { top: -3px; left: -3px; border-width: 3px 0 0 3px; border-radius: 12px 0 0 0; }
        .doc-frame::after { bottom: -3px; right: -3px; border-width: 0 3px 3px 0; border-radius: 0 0 12px 0; }

        /* Countdown */
        .countdown { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 64px; font-weight: 800; color: #4ade80; text-shadow: 0 2px 8px rgba(0,0,0,0.5); line-height: 1; }

        /* Status bar */
        .cam-status { position: absolute; top: max(16px, env(safe-area-inset-top)); left: 0; right: 0; display: flex; justify-content: center; }
        .status-hint { background: rgba(0,0,0,0.55); backdrop-filter: blur(8px); color: #fff; font-size: 14px; font-weight: 600; padding: 8px 16px; border-radius: 20px; }
        .status-green { color: #4ade80; }

        /* Pages badge */
        .pages-badge { position: absolute; top: max(16px, env(safe-area-inset-top)); right: 16px; background: #F97316; color: #fff; font-size: 13px; font-weight: 700; padding: 5px 12px; border-radius: 20px; }

        /* Camera controls */
        .cam-controls { position: absolute; bottom: max(40px, env(safe-area-inset-bottom, 40px)); left: 0; right: 0; display: flex; justify-content: center; align-items: center; gap: 24px; padding: 0 24px; }
        .ctrl-btn { display: flex; align-items: center; gap: 8px; padding: 13px 20px; border-radius: 50px; border: none; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); transition: transform 80ms; }
        .ctrl-btn:active { transform: scale(0.95); }
        .ctrl-done { background: rgba(46,125,70,0.9); color: #fff; }
        .ctrl-abort { background: rgba(255,255,255,0.15); color: #fff; padding: 13px; }
        .ctrl-capture { background: rgba(255,255,255,0.15); color: #fff; border-radius: 50%; width: 70px; height: 70px; justify-content: center; padding: 0; border: 3px solid rgba(255,255,255,0.5); }
        .shutter { width: 50px; height: 50px; border-radius: 50%; background: #fff; }

        /* Thumbnail strip */
        .thumb-strip { position: absolute; bottom: max(120px, calc(env(safe-area-inset-bottom, 40px) + 80px)); left: 0; right: 0; display: flex; gap: 8px; padding: 0 16px; overflow-x: auto; scrollbar-width: none; }
        .thumb-strip::-webkit-scrollbar { display: none; }
        .thumb { position: relative; flex-shrink: 0; }
        .thumb-img { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; border: 2px solid rgba(255,255,255,0.4); }
        .thumb-remove { position: absolute; top: -5px; right: -5px; width: 18px; height: 18px; border-radius: 50%; background: #B3402C; color: #fff; border: none; cursor: pointer; font-size: 9px; display: flex; align-items: center; justify-content: center; }

        /* Spinner */
        .spinner { width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.15); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media(prefers-reduced-motion:reduce) { .spinner { animation-duration: 2s; } .toggle,.knob { transition: none; } }
      `}</style>
    </>
  )
}
