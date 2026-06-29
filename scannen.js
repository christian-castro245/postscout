import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const Icon = ({ d, size = 20, color = 'currentColor', strokeWidth = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const icons = {
  camera:  'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z',
  x:       'M18 6L6 18M6 6l12 12',
  plus:    'M12 5v14M5 12h14',
  sparkle: 'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z',
  check:   'M20 6L9 17l-5-5',
  warning: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
  file:    'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm0 0v6h6',
  tasks:   'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  archive: 'M21 8v13H3V8M23 3H1a1 1 0 00-1 1v3a1 1 0 001 1h22a1 1 0 001-1V4a1 1 0 00-1-1zM10 12h4',
  users:   'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  upload:  'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
  back:    'M19 12H5M12 5l-7 7 7 7',
  flip:    'M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15',
};

function BottomNav({ active }) {
  const router = useRouter();
  const items = [
    { id: 'aufgaben', label: 'Aufgaben', icon: icons.tasks,   path: '/aufgaben' },
    { id: 'scannen',  label: 'Scannen',  icon: icons.camera,  path: '/scannen' },
    { id: 'archiv',   label: 'Archiv',   icon: icons.archive, path: '/archiv' },
    { id: 'familie',  label: 'Familie',  icon: icons.users,   path: '/familie' },
    { id: 'export',   label: 'Export',   icon: icons.upload,  path: '/export' },
  ];
  return (
    <nav style={{ position:'fixed', bottom:0, left:0, right:0, background:'#fff',
      borderTop:'1px solid #E5E7EB', display:'flex', zIndex:50,
      paddingBottom:'env(safe-area-inset-bottom)' }}>
      {items.map(it => (
        <button key={it.id} onClick={() => router.push(it.path)} style={{
          flex:1, display:'flex', flexDirection:'column', alignItems:'center',
          gap:3, padding:'10px 4px 8px', border:'none', background:'none',
          color: active === it.id ? '#1F3A52' : '#9CA3AF', cursor:'pointer',
          fontSize:10, fontFamily:'inherit', fontWeight: active===it.id ? 600 : 400 }}>
          <Icon d={it.icon} size={22} />
          {it.label}
        </button>
      ))}
    </nav>
  );
}

// ── Kamera-Viewer mit Dokument-Erkennung ───────────────────────────────────
//
// Strategie: Wir nutzen getUserMedia für den Live-Stream.
// Dokument-Erkennung: Wir analysieren jeden Frame mit einem <canvas>-Offscreen.
// Heuristik: Wir messen den Kontrast zwischen dem Innenbereich des Rahmens
// und dem Außenbereich. Wenn das Dokument hell und der Hintergrund dunkler ist
// (oder umgekehrt, z.B. weißes Papier auf dunklem Tisch), steigt der Kontrast-
// Score → Rahmen wird grün. Einfach, robust, kein ML nötig.

function CameraScanner({ onCapture, onClose }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const [detected,  setDetected]  = useState(false); // grüner Rahmen
  const [facingMode,setFacingMode]= useState('environment');
  const [ready,     setReady]     = useState(false);
  const [error,     setError]     = useState(null);

  // Kamera starten
  const startCamera = useCallback(async (mode) => {
    // Alten Stream stoppen
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setReady(false);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setReady(true);
      }
    } catch (err) {
      setError('Kamera nicht verfügbar: ' + err.message);
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [facingMode, startCamera]);

  // Dokument-Erkennung: läuft als requestAnimationFrame-Loop
  useEffect(() => {
    if (!ready) return;

    let frameCount = 0;
    function analyze() {
      rafRef.current = requestAnimationFrame(analyze);
      frameCount++;
      // Nur jeden 10. Frame analysieren (ca. 6fps bei 60fps Display)
      if (frameCount % 10 !== 0) return;

      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const W = 160, H = 120; // Kleine Auflösung für Performance
      canvas.width  = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, W, H);

      // Innerer Bereich (60% × 70% des Frames — das ist wo das Dokument sein soll)
      const ix = Math.floor(W * 0.20), iy = Math.floor(H * 0.15);
      const iw = Math.floor(W * 0.60), ih = Math.floor(H * 0.70);

      const innerData = ctx.getImageData(ix, iy, iw, ih).data;
      const fullData  = ctx.getImageData(0,  0,  W,  H).data;

      function avgBrightness(data) {
        let sum = 0, n = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          // Luminance
          sum += 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        }
        return sum / n;
      }

      const innerBright = avgBrightness(innerData);
      const fullBright  = avgBrightness(fullData);
      // Wenn Innen deutlich heller als Gesamt → weißes Papier erkannt
      // Schwellenwert: >18 Punkte Unterschied
      const contrast = Math.abs(innerBright - fullBright);
      setDetected(contrast > 18);
    }

    rafRef.current = requestAnimationFrame(analyze);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [ready]);

  // Foto aufnehmen
  function capture() {
    const video  = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const previewUrl = URL.createObjectURL(blob);
      onCapture({ file, previewUrl });
    }, 'image/jpeg', 0.92);
  }

  // Farbe des Rahmens
  const borderColor  = detected ? '#22C55E' : 'rgba(255,255,255,0.5)';
  const cornerColor  = detected ? '#22C55E' : 'rgba(255,255,255,0.85)';
  const cornerGlow   = detected ? '0 0 12px rgba(34,197,94,0.8)' : 'none';
  const labelText    = detected ? 'Dokument erkannt — Aufnehmen!' : 'Dokument in den Rahmen legen';
  const labelBg      = detected ? 'rgba(34,197,94,0.9)' : 'rgba(0,0,0,0.55)';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#000',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Video */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/* Offscreen canvas für Analyse */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Abdunklung außerhalb des Rahmens */}
        {ready && (
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            viewBox="0 0 100 100" preserveAspectRatio="none"
          >
            <defs>
              <mask id="docmask">
                <rect width="100" height="100" fill="white" />
                <rect x="10" y="15" width="80" height="70" rx="2" fill="black" />
              </mask>
            </defs>
            <rect width="100" height="100" fill="rgba(0,0,0,0.45)" mask="url(#docmask)" />
          </svg>
        )}

        {/* Dokument-Rahmen */}
        {ready && (
          <div style={{
            position: 'absolute',
            left: '10%', top: '15%', right: '10%', bottom: '15%',
            borderRadius: 8,
            border: `2px solid ${borderColor}`,
            transition: 'border-color 0.25s ease',
            pointerEvents: 'none',
          }}>
            {/* Ecken */}
            {[
              { top: -2, left: -2, borderTop: `3px solid ${cornerColor}`, borderLeft: `3px solid ${cornerColor}`, borderRadius: '4px 0 0 0', boxShadow: cornerGlow },
              { top: -2, right: -2, borderTop: `3px solid ${cornerColor}`, borderRight: `3px solid ${cornerColor}`, borderRadius: '0 4px 0 0', boxShadow: cornerGlow },
              { bottom: -2, left: -2, borderBottom: `3px solid ${cornerColor}`, borderLeft: `3px solid ${cornerColor}`, borderRadius: '0 0 0 4px', boxShadow: cornerGlow },
              { bottom: -2, right: -2, borderBottom: `3px solid ${cornerColor}`, borderRight: `3px solid ${cornerColor}`, borderRadius: '0 0 4px 0', boxShadow: cornerGlow },
            ].map((style, i) => (
              <div key={i} style={{
                position: 'absolute', width: 24, height: 24,
                transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
                ...style,
              }} />
            ))}

            {/* Grüner Haken bei Erkennung */}
            {detected && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(34,197,94,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'popIn 0.2s ease',
              }}>
                <Icon d={icons.check} size={28} color="#22C55E" strokeWidth={2.5} />
              </div>
            )}
          </div>
        )}

        {/* Label */}
        {ready && (
          <div style={{
            position: 'absolute', bottom: '12%', left: '50%',
            transform: 'translateX(-50%)',
            background: labelBg,
            color: '#fff', fontSize: 13, fontWeight: 600,
            padding: '6px 16px', borderRadius: 20,
            whiteSpace: 'nowrap',
            transition: 'background 0.25s ease',
            fontFamily: 'Figtree, system-ui, sans-serif',
          }}>
            {labelText}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 24,
          }}>
            <div style={{
              background: '#FEF2F2', borderRadius: 12, padding: '20px 24px',
              textAlign: 'center', color: '#B91C1C', fontSize: 14,
            }}>
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        background: '#111',
        paddingBottom: 'env(safe-area-inset-bottom)',
        padding: '20px 32px calc(20px + env(safe-area-inset-bottom))',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Schließen */}
        <button onClick={onClose} style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <Icon d={icons.x} size={22} color="#fff" />
        </button>

        {/* Auslöser */}
        <button onClick={capture} disabled={!ready} style={{
          width: 72, height: 72, borderRadius: '50%',
          background: detected ? '#22C55E' : '#fff',
          border: `4px solid ${detected ? '#16A34A' : 'rgba(255,255,255,0.4)'}`,
          cursor: ready ? 'pointer' : 'not-allowed',
          transition: 'background 0.25s ease, border-color 0.25s ease',
          boxShadow: detected ? '0 0 20px rgba(34,197,94,0.6)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {detected && <Icon d={icons.check} size={28} color="#fff" strokeWidth={2.5} />}
        </button>

        {/* Kamera wechseln */}
        <button
          onClick={() => setFacingMode(m => m === 'environment' ? 'user' : 'environment')}
          style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
          <Icon d={icons.flip} size={22} color="#fff" />
        </button>
      </div>

      <style>{`
        @keyframes popIn {
          from { transform: translate(-50%,-50%) scale(0.5); opacity:0; }
          to   { transform: translate(-50%,-50%) scale(1);   opacity:1; }
        }
      `}</style>
    </div>
  );
}

// ── Hauptseite ─────────────────────────────────────────────────────────────
export default function Scannen() {
  const router = useRouter();
  const fileRef = useRef(null);

  const [pages,       setPages]       = useState([]);
  const [phase,       setPhase]       = useState('idle');
  const [error,       setError]       = useState(null);
  const [log,         setLog]         = useState([]);
  const [showCamera,  setShowCamera]  = useState(false);

  function addLog(msg) {
    console.log('[Scannen]', msg);
    setLog(prev => [...prev.slice(-29), `${new Date().toLocaleTimeString()} ${msg}`]);
  }

  function addFiles(fileList) {
    setError(null);
    const arr = Array.from(fileList).filter(f =>
      f.type.startsWith('image/') || f.type === 'application/pdf'
    );
    if (arr.length === 0) { setError('Nur Bilder oder PDFs.'); return; }
    setPages(prev => [...prev, ...arr.map(f => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
    }))]);
  }

  function onCameraCapture(page) {
    setPages(prev => [...prev, page]);
    setShowCamera(false);
  }

  function removePage(idx) {
    setPages(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleAnalyze() {
    if (pages.length === 0) { setError('Bitte zuerst ein Foto hinzufügen.'); return; }
    setError(null);

    // ── Auth ──────────────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    // ── Upload ────────────────────────────────────────────────────────────
    setPhase('uploading');
    addLog('Upload gestartet');
    const uploadedUrls = [];

    for (let i = 0; i < pages.length; i++) {
      const { file } = pages[i];
      const ext  = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${Date.now()}_${i}.${ext}`;
      addLog(`Upload Seite ${i+1}: ${file.name}`);

      const { error: upErr } = await supabase.storage
        .from('dokumente')
        .upload(path, file, { upsert: false });

      if (upErr) {
        addLog(`Upload-Fehler: ${upErr.message}`);
        setError(`Upload fehlgeschlagen: ${upErr.message}`);
        setPhase('idle');
        return;
      }

      const { data: urlData } = supabase.storage.from('dokumente').getPublicUrl(path);
      const url = urlData?.publicUrl;
      if (!url) {
        setError('Kein URL nach Upload — Supabase Storage prüfen.');
        setPhase('idle');
        return;
      }
      addLog(`Upload OK → ${url.slice(-40)}`);
      uploadedUrls.push(url);
    }

    // ── DB Insert ─────────────────────────────────────────────────────────
    addLog('Dokument in DB anlegen…');
    const { data: dok, error: insertErr } = await supabase
      .from('dokumente')
      .insert({
        user_id:       user.id,
        dateiname:     pages[0].file.name,
        bild_url:      uploadedUrls[0],
        bild_urls:     uploadedUrls,
        analysiert:    false,
        dringlichkeit: 'Zur Kenntnis',
      })
      .select('id')
      .single();

    if (insertErr || !dok?.id) {
      const msg = insertErr?.message || 'Kein ID zurück';
      addLog(`DB-Fehler: ${msg}`);
      setError(`Datenbank-Fehler: ${msg}`);
      setPhase('idle');
      return;
    }

    // Lokale const — kein State-Timing-Problem
    const dokumentId = dok.id;
    addLog(`Dokument-ID: ${dokumentId}`);

    // ── Analyse ───────────────────────────────────────────────────────────
    setPhase('analyzing');
    addLog(`POST /api/analyze { dokumentId: ${dokumentId} }`);

    let analyzeRes;
    try {
      analyzeRes = await fetch('/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ dokumentId }),
      });
    } catch (fetchErr) {
      addLog(`fetch-Fehler: ${fetchErr.message}`);
      setError(`Netzwerkfehler: ${fetchErr.message}`);
      setPhase('idle');
      return;
    }

    const result = await analyzeRes.json().catch(() => ({}));
    addLog(`Response: ${analyzeRes.status} ${JSON.stringify(result).slice(0, 80)}`);

    if (!analyzeRes.ok) {
      setError(`Analyse fehlgeschlagen (${analyzeRes.status}): ${result.error || 'Unbekannt'}`);
      setPhase('idle');
      return;
    }

    addLog('Fertig!');
    setPhase('done');
    setTimeout(() => router.push('/aufgaben'), 1200);
  }

  const busy = phase === 'uploading' || phase === 'analyzing';

  return (
    <>
      <Head>
        <title>Scannen – PostScout</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      {/* Kamera-Overlay */}
      {showCamera && (
        <CameraScanner
          onCapture={onCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      <div style={{ minHeight: '100dvh', background: '#F8F9FA',
        fontFamily: 'Figtree, system-ui, sans-serif', paddingBottom: 80 }}>

        {/* Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 40, background: '#1F3A52',
          padding: '12px 16px',
          paddingTop: 'calc(12px + env(safe-area-inset-top))',
          display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Icon d={icons.back} size={20} color="#fff" />
          </button>
          <span style={{ fontWeight: 700, color: '#fff', fontSize: 17 }}>Brief scannen</span>
        </div>

        <div style={{ padding: '20px 16px 0' }}>

          {/* Fehler */}
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10,
              padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10 }}>
              <Icon d={icons.warning} size={16} color="#B91C1C" />
              <p style={{ margin: 0, fontSize: 13, color: '#B91C1C', lineHeight: 1.5 }}>{error}</p>
            </div>
          )}

          {/* Erfolg */}
          {phase === 'done' && (
            <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10,
              padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10 }}>
              <Icon d={icons.check} size={16} color="#166534" />
              <p style={{ margin: 0, fontSize: 13, color: '#166534' }}>
                Analyse abgeschlossen — Aufgaben werden geladen…
              </p>
            </div>
          )}

          {/* Upload-Zone */}
          {phase !== 'done' && (
            <div style={{ border: '2px dashed #CBD5E1', borderRadius: 16, background: '#fff',
              padding: '28px 20px', textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: '#EAF0F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px' }}>
                <Icon d={icons.camera} size={26} color="#1F3A52" />
              </div>
              <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: '#111' }}>
                {pages.length > 0 ? 'Weitere Seite hinzufügen' : 'Brief fotografieren'}
              </p>
              <p style={{ margin: '0 0 18px', fontSize: 13, color: '#9CA3AF' }}>
                Mehrere Seiten möglich — z.B. Vorder- und Rückseite
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                {/* Kamera-Button → öffnet unseren eigenen Scanner */}
                <button onClick={() => setShowCamera(true)} disabled={busy}
                  style={{ padding: '11px 22px', borderRadius: 10, border: 'none',
                    background: busy ? '#CBD5E1' : '#1F3A52', color: '#fff',
                    fontSize: 14, fontWeight: 600,
                    cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  Aufnehmen
                </button>
                {/* Datei wählen → System-Picker */}
                <button onClick={() => fileRef.current?.click()} disabled={busy}
                  style={{ padding: '11px 22px', borderRadius: 10, border: '1px solid #D1D5DB',
                    background: '#fff', color: '#374151', fontSize: 14, fontWeight: 500,
                    cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  Datei wählen
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple
                style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
            </div>
          )}

          {/* Thumbnails */}
          {pages.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              {pages.map((p, idx) => (
                <div key={idx} style={{ position: 'relative', width: 80 }}>
                  <div style={{ width: 80, height: 80, borderRadius: 10, overflow: 'hidden',
                    border: '1px solid #E5E7EB', background: '#F9FAFB',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.file.type.startsWith('image/') ? (
                      <img src={p.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Icon d={icons.file} size={30} color="#9CA3AF" />
                    )}
                  </div>
                  {!busy && (
                    <button onClick={() => removePage(idx)} style={{
                      position: 'absolute', top: -6, left: -6, width: 20, height: 20,
                      borderRadius: '50%', background: '#EF4444', border: '2px solid #fff',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon d={icons.x} size={10} color="#fff" strokeWidth={2.5} />
                    </button>
                  )}
                  <p style={{ margin: '4px 0 0', fontSize: 10, color: '#6B7280',
                    textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {idx + 1}. {p.file.name.slice(0, 12)}
                  </p>
                </div>
              ))}
              {!busy && phase !== 'done' && (
                <button onClick={() => setShowCamera(true)} style={{
                  width: 80, height: 80, borderRadius: 10, border: '2px dashed #CBD5E1',
                  background: '#F9FAFB', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 4,
                  cursor: 'pointer', color: '#9CA3AF', fontSize: 11 }}>
                  <Icon d={icons.plus} size={18} color="#9CA3AF" />
                  Seite
                </button>
              )}
            </div>
          )}

          {/* Status */}
          {phase === 'uploading' && (
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10,
              padding: '12px 14px', marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#1D4ED8' }}>Fotos werden hochgeladen…</p>
            </div>
          )}
          {phase === 'analyzing' && (
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10,
              padding: '12px 14px', marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#1D4ED8' }}>KI analysiert das Dokument (10–20 Sek.)…</p>
            </div>
          )}

          {/* Analyse-Button */}
          {phase !== 'done' && (
            <button onClick={handleAnalyze} disabled={pages.length === 0 || busy}
              style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                background: pages.length > 0 && !busy ? '#1F3A52' : '#CBD5E1',
                color: pages.length > 0 && !busy ? '#fff' : '#9CA3AF',
                fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
                cursor: pages.length > 0 && !busy ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Icon d={icons.sparkle} size={18}
                color={pages.length > 0 && !busy ? '#fff' : '#9CA3AF'} />
              {phase === 'uploading' ? 'Wird hochgeladen…'
                : phase === 'analyzing' ? 'Wird analysiert…'
                : 'Brief analysieren'}
            </button>
          )}

          {/* Debug-Log */}
          {log.length > 0 && (
            <div style={{ marginTop: 16, background: '#1E1E2E', borderRadius: 10,
              padding: '10px 14px', maxHeight: 180, overflowY: 'auto' }}>
              <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#6B7280',
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>Debug</p>
              {log.map((l, i) => (
                <p key={i} style={{ margin: '1px 0', fontSize: 11, color: '#A6ACCD', fontFamily: 'monospace' }}>{l}</p>
              ))}
            </div>
          )}

        </div>
      </div>

      <BottomNav active="scannen" />
    </>
  );
}
