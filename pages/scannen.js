import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../lib/supabase';

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
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'rgba(251,250,248,0.97)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid #EFEDE6',
      display: 'flex', zIndex: 100,
      padding: `8px 4px max(20px, env(safe-area-inset-bottom))`,
    }}>
      {items.map(it => {
        const isActive = active === it.id;
        return (
          <button key={it.id} onClick={() => router.push(it.path)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, padding: '2px 4px', border: 'none', background: 'none',
            color: isActive ? '#1F3A52' : '#B0ADA4', cursor: 'pointer',
            fontSize: 10, fontFamily: 'inherit', fontWeight: isActive ? 700 : 500,
            transition: 'color 150ms',
          }}>
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 48, height: 30, borderRadius: 15,
              background: isActive ? '#EAF0F4' : 'transparent',
              transition: 'background 150ms',
            }}>
              <Icon d={it.icon} size={20} />
            </span>
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

function CameraScanner({ onCapture, onClose }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const [detected,   setDetected]   = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [ready,      setReady]      = useState(false);
  const [camError,   setCamError]   = useState(null);

  const startCamera = useCallback(async (mode) => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setReady(false); setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      }
    } catch (err) { setCamError('Kamera nicht verfügbar: ' + err.message); }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [facingMode, startCamera]);

  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    function analyze() {
      rafRef.current = requestAnimationFrame(analyze);
      if (++frame % 10 !== 0) return;
      const video = videoRef.current, canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      const W = 160, H = 120;
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, W, H);
      const ix = Math.floor(W * 0.20), iy = Math.floor(H * 0.15);
      const iw = Math.floor(W * 0.60), ih = Math.floor(H * 0.70);
      const inner = ctx.getImageData(ix, iy, iw, ih).data;
      const full  = ctx.getImageData(0, 0, W, H).data;
      const avg = d => { let s=0,n=d.length/4; for(let i=0;i<d.length;i+=4) s+=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]; return s/n; };
      setDetected(Math.abs(avg(inner) - avg(full)) > 18);
    }
    rafRef.current = requestAnimationFrame(analyze);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [ready]);

  function capture() {
    const video = videoRef.current;
    const c = document.createElement('canvas');
    c.width = video.videoWidth || 1280; c.height = video.videoHeight || 720;
    c.getContext('2d').drawImage(video, 0, 0);
    c.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture({ file, previewUrl: URL.createObjectURL(blob) });
    }, 'image/jpeg', 0.92);
  }

  const green = '#22C55E', white = 'rgba(255,255,255,0.85)';
  const borderCol = detected ? green : 'rgba(255,255,255,0.45)';
  const cornerCol = detected ? green : white;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, background:'#000', display:'flex', flexDirection:'column' }}>
      <div style={{ position:'relative', flex:1, overflow:'hidden' }}>
        <video ref={videoRef} playsInline muted autoPlay style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        <canvas ref={canvasRef} style={{ display:'none' }} />
        {ready && (
          <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}
            viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs><mask id="m"><rect width="100" height="100" fill="white"/>
              <rect x="10" y="15" width="80" height="70" rx="1.5" fill="black"/></mask></defs>
            <rect width="100" height="100" fill="rgba(0,0,0,0.42)" mask="url(#m)"/>
          </svg>
        )}
        {ready && (
          <div style={{ position:'absolute', left:'10%', top:'15%', right:'10%', bottom:'15%',
            border:`2px solid ${borderCol}`, borderRadius:8, pointerEvents:'none', transition:'border-color 0.2s' }}>
            {[
              { top:-2, left:-2,   borderTop:`3px solid ${cornerCol}`, borderLeft:`3px solid ${cornerCol}`,   borderRadius:'5px 0 0 0' },
              { top:-2, right:-2,  borderTop:`3px solid ${cornerCol}`, borderRight:`3px solid ${cornerCol}`,  borderRadius:'0 5px 0 0' },
              { bottom:-2, left:-2,  borderBottom:`3px solid ${cornerCol}`, borderLeft:`3px solid ${cornerCol}`,  borderRadius:'0 0 0 5px' },
              { bottom:-2, right:-2, borderBottom:`3px solid ${cornerCol}`, borderRight:`3px solid ${cornerCol}`, borderRadius:'0 0 5px 0' },
            ].map((s, i) => <div key={i} style={{ position:'absolute', width:28, height:28, transition:'border-color 0.2s', ...s }} />)}
            {detected && (
              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
                width:60, height:60, borderRadius:'50%', background:'rgba(34,197,94,0.18)',
                display:'flex', alignItems:'center', justifyContent:'center', animation:'popIn 0.18s ease' }}>
                <Icon d={icons.check} size={30} color={green} strokeWidth={2.5} />
              </div>
            )}
          </div>
        )}
        {ready && (
          <div style={{ position:'absolute', bottom:'12%', left:'50%', transform:'translateX(-50%)',
            background: detected ? 'rgba(34,197,94,0.92)' : 'rgba(0,0,0,0.55)',
            color:'#fff', fontSize:13, fontWeight:600, padding:'6px 18px', borderRadius:20,
            whiteSpace:'nowrap', transition:'background 0.2s', fontFamily:'Figtree, system-ui, sans-serif' }}>
            {detected ? 'Dokument erkannt — Aufnehmen!' : 'Dokument in den Rahmen legen'}
          </div>
        )}
        {camError && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
            <div style={{ background:'#FEF2F2', borderRadius:12, padding:'20px 24px', textAlign:'center', color:'#B91C1C', fontSize:14 }}>{camError}</div>
          </div>
        )}
      </div>
      <div style={{ background:'#111', display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'20px 40px', paddingBottom:'calc(20px + env(safe-area-inset-bottom))' }}>
        <button onClick={onClose} style={{ width:48, height:48, borderRadius:'50%',
          background:'rgba(255,255,255,0.15)', border:'none', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon d={icons.x} size={22} color="#fff" />
        </button>
        <button onClick={capture} disabled={!ready} style={{
          width:74, height:74, borderRadius:'50%',
          background: detected ? green : '#fff',
          border:`4px solid ${detected ? '#16A34A' : 'rgba(255,255,255,0.35)'}`,
          cursor: ready ? 'pointer' : 'not-allowed', transition:'background 0.2s, border-color 0.2s',
          boxShadow: detected ? '0 0 22px rgba(34,197,94,0.55)' : 'none',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          {detected && <Icon d={icons.check} size={28} color="#fff" strokeWidth={2.5} />}
        </button>
        <button onClick={() => setFacingMode(m => m === 'environment' ? 'user' : 'environment')}
          style={{ width:48, height:48, borderRadius:'50%', background:'rgba(255,255,255,0.15)',
            border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon d={icons.flip} size={22} color="#fff" />
        </button>
      </div>
      <style>{`@keyframes popIn{from{transform:translate(-50%,-50%) scale(0.4);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}`}</style>
    </div>
  );
}

function resolveType(f) {
  if (f.type) return f.type;
  const ext = (f.name || '').split('.').pop().toLowerCase();
  return { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png',
           gif:'image/gif', webp:'image/webp', pdf:'application/pdf' }[ext] || 'application/octet-stream';
}

export default function Scannen() {
  const router  = useRouter();
  const fileRef = useRef(null);

  const [pages,    setPages]    = useState([]);
  const [phase,    setPhase]    = useState('idle');
  const [error,    setError]    = useState(null);
  const [logLines, setLogLines] = useState([]);
  const [showCam,  setShowCam]  = useState(false);
  const [jwt,      setJwt]      = useState(null);

  useEffect(() => {
    async function initAuth() {
      const { data: { session }, error: e1 } = await supabase.auth.getSession();
      addLog(`getSession: ${session ? 'OK token='+session.access_token.slice(0,15)+'…' : 'null'} err=${e1?.message||'–'}`);
      if (session?.access_token) { setJwt(session.access_token); return; }

      const { data: { user }, error: e2 } = await supabase.auth.getUser();
      addLog(`getUser: ${user ? 'OK uid='+user.id.slice(0,8) : 'null'} err=${e2?.message||'–'}`);
      if (!user) { addLog('→ Redirect /'); router.push('/'); return; }

      const { data: { session: s2 } } = await supabase.auth.getSession();
      addLog(`getSession2: ${s2 ? 'OK' : 'null'}`);
      if (s2?.access_token) setJwt(s2.access_token);
      else { addLog('→ Redirect /'); router.push('/'); }
    }
    initAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) setJwt(session.access_token);
      else setJwt(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  function addLog(msg) {
    console.log('[Scannen]', msg);
    setLogLines(prev => [...prev.slice(-29), `${new Date().toLocaleTimeString()} ${msg}`]);
  }

  function addFiles(fileList) {
    setError(null);
    const arr = Array.from(fileList).map(f => ({ file: f, mimeType: resolveType(f) }))
      .filter(({ mimeType }) => mimeType.startsWith('image/') || mimeType === 'application/pdf');
    if (!arr.length) { setError('Nur Bilder oder PDFs erlaubt.'); return; }
    setPages(prev => [...prev, ...arr.map(({ file, mimeType }) => ({
      file, mimeType, previewUrl: URL.createObjectURL(file),
    }))]);
  }

  function removePage(idx) {
    setPages(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleAnalyze() {
    addLog('--- Start ---');
    try {
      if (!pages.length) { setError('Bitte zuerst ein Foto hinzufügen.'); return; }
      setError(null);

      addLog('Prüfe JWT…');
      if (!jwt) {
        addLog('Kein JWT — weiterleiten zu Login');
        setError('Sitzung abgelaufen. Bitte neu einloggen.');
        setTimeout(() => router.push('/'), 1500);
        return;
      }
      addLog(`JWT OK: ${jwt.slice(0, 20)}…`);

      setPhase('uploading');
      addLog(`Baue FormData mit ${pages.length} Datei(en)…`);
      const form = new FormData();
      for (let i = 0; i < pages.length; i++) {
        const { file, mimeType } = pages[i];
        const blob = file.type ? file : new Blob([file], { type: mimeType });
        const filename = file.name || `scan_${Date.now()}_${i}.jpg`;
        form.append('files', blob, filename);
        addLog(`Datei ${i+1}: ${filename} (${(file.size/1024).toFixed(0)}KB, ${mimeType})`);
      }

      setPhase('analyzing');
      addLog('Sende an /api/analyze…');
      let res;
      try {
        res = await fetch('/api/analyze', {
          method:  'POST',
          headers: { 'Authorization': `Bearer ${jwt}` },
          body:    form,
        });
      } catch (fetchErr) {
        addLog(`Netzwerkfehler: ${fetchErr.message}`);
        setError(`Netzwerkfehler: ${fetchErr.message}`);
        setPhase('idle'); return;
      }

      let result = {};
      try { result = await res.json(); } catch {}
      addLog(`HTTP ${res.status} — ${JSON.stringify(result).slice(0, 200)}`);

      if (!res.ok) {
        setError(`Fehler (${res.status}): ${result.error || 'Unbekannt'}`);
        setPhase('idle'); return;
      }

      addLog('✓ Fertig!');
      setPhase('done');
      setTimeout(() => router.push('/aufgaben'), 1200);

    } catch (err) {
      addLog(`UNERWARTETER FEHLER: ${err.message}`);
      setError(`Unerwarteter Fehler: ${err.message}`);
      setPhase('idle');
    }
  }

  const busy = phase === 'uploading' || phase === 'analyzing';

  return (
    <>
      <Head>
        <title>Scannen – PostScout</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      {showCam && (
        <CameraScanner
          onCapture={p => { setPages(prev => [...prev, { ...p, mimeType: 'image/jpeg' }]); setShowCam(false); }}
          onClose={() => setShowCam(false)}
        />
      )}

      <div style={{ minHeight:'100dvh', background:'#F8F9FA',
        fontFamily:'Figtree, system-ui, sans-serif', paddingBottom:80 }}>

        <div style={{ position:'sticky', top:0, zIndex:40, background:'#1F3A52',
          padding:'12px 16px', paddingTop:'calc(12px + env(safe-area-inset-top))',
          display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => router.back()} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
            <Icon d={icons.back} size={20} color="#fff" />
          </button>
          <span style={{ fontWeight:700, color:'#fff', fontSize:17, flex:1 }}>Brief scannen</span>
          <span style={{ fontSize:11, color: jwt ? '#86EFAC' : '#FCA5A5', fontWeight:600 }}>
            {jwt ? '● Session OK' : '● Kein Login'}
          </span>
        </div>

        <div style={{ padding:'20px 16px 0' }}>

          {error && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:10,
              padding:'12px 14px', marginBottom:16, display:'flex', gap:10, alignItems:'flex-start' }}>
              <Icon d={icons.warning} size={16} color="#B91C1C" />
              <p style={{ margin:0, fontSize:13, color:'#B91C1C', lineHeight:1.5 }}>{error}</p>
            </div>
          )}

          {phase === 'done' && (
            <div style={{ background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:10,
              padding:'12px 14px', marginBottom:16, display:'flex', gap:10, alignItems:'center' }}>
              <Icon d={icons.check} size={16} color="#166534" />
              <p style={{ margin:0, fontSize:13, color:'#166534' }}>Analyse abgeschlossen — Aufgaben werden geladen…</p>
            </div>
          )}

          {phase !== 'done' && (
            <div style={{ border:'2px dashed #CBD5E1', borderRadius:16, background:'#fff',
              padding:'28px 20px', textAlign:'center', marginBottom:20 }}>
              <div style={{ width:56, height:56, borderRadius:14, background:'#EAF0F6',
                display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                <Icon d={icons.camera} size={26} color="#1F3A52" />
              </div>
              <p style={{ margin:'0 0 4px', fontWeight:700, fontSize:15, color:'#111' }}>
                {pages.length > 0 ? 'Weitere Seite hinzufügen' : 'Brief fotografieren'}
              </p>
              <p style={{ margin:'0 0 18px', fontSize:13, color:'#9CA3AF' }}>
                Mehrere Seiten möglich — z.B. Vorder- und Rückseite
              </p>
              <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                <button onClick={() => setShowCam(true)} disabled={busy}
                  style={{ padding:'11px 22px', borderRadius:10, border:'none',
                    background: busy ? '#CBD5E1' : '#1F3A52', color:'#fff',
                    fontSize:14, fontWeight:600, cursor: busy ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                  Aufnehmen
                </button>
                <button onClick={() => fileRef.current?.click()} disabled={busy}
                  style={{ padding:'11px 22px', borderRadius:10, border:'1px solid #D1D5DB',
                    background:'#fff', color:'#374151', fontSize:14, fontWeight:500,
                    cursor: busy ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                  Datei wählen
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple
                style={{ display:'none' }} onChange={e => addFiles(e.target.files)} />
            </div>
          )}

          {pages.length > 0 && (
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:20 }}>
              {pages.map((p, idx) => (
                <div key={idx} style={{ position:'relative', width:80 }}>
                  <div style={{ width:80, height:80, borderRadius:10, overflow:'hidden',
                    border:'1px solid #E5E7EB', background:'#F9FAFB',
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {p.mimeType?.startsWith('image/') ? (
                      <img src={p.previewUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    ) : (
                      <Icon d={icons.file} size={30} color="#9CA3AF" />
                    )}
                  </div>
                  {!busy && (
                    <button onClick={() => removePage(idx)} style={{
                      position:'absolute', top:-6, left:-6, width:20, height:20,
                      borderRadius:'50%', background:'#EF4444', border:'2px solid #fff',
                      cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Icon d={icons.x} size={10} color="#fff" strokeWidth={2.5} />
                    </button>
                  )}
                  <p style={{ margin:'4px 0 0', fontSize:10, color:'#6B7280', textAlign:'center',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {idx+1}. {(p.file.name || 'Scan').slice(0, 12)}
                  </p>
                </div>
              ))}
              {!busy && phase !== 'done' && (
                <button onClick={() => setShowCam(true)} style={{
                  width:80, height:80, borderRadius:10, border:'2px dashed #CBD5E1',
                  background:'#F9FAFB', display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center', gap:4,
                  cursor:'pointer', color:'#9CA3AF', fontSize:11 }}>
                  <Icon d={icons.plus} size={18} color="#9CA3AF" />
                  Seite
                </button>
              )}
            </div>
          )}

          {phase === 'uploading' && (
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
              <p style={{ margin:0, fontSize:13, color:'#1D4ED8' }}>Dateien werden hochgeladen…</p>
            </div>
          )}
          {phase === 'analyzing' && (
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
              <p style={{ margin:0, fontSize:13, color:'#1D4ED8' }}>KI analysiert das Dokument (10–20 Sek.)…</p>
            </div>
          )}

          {phase !== 'done' && (
            <button onClick={handleAnalyze} disabled={!pages.length || busy}
              style={{ width:'100%', padding:'16px', borderRadius:14, border:'none',
                background: pages.length && !busy ? '#1F3A52' : '#CBD5E1',
                color: pages.length && !busy ? '#fff' : '#9CA3AF',
                fontSize:16, fontWeight:700, fontFamily:'inherit',
                cursor: pages.length && !busy ? 'pointer' : 'not-allowed',
                display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
              <Icon d={icons.sparkle} size={18} color={pages.length && !busy ? '#fff' : '#9CA3AF'} />
              {phase === 'uploading' ? 'Wird hochgeladen…'
                : phase === 'analyzing' ? 'Wird analysiert…'
                : 'Brief analysieren'}
            </button>
          )}

          {logLines.length > 0 && (
            <div style={{ marginTop:16, background:'#1E1E2E', borderRadius:10,
              padding:'10px 14px', maxHeight:200, overflowY:'auto' }}>
              <p style={{ margin:'0 0 6px', fontSize:10, fontWeight:700, color:'#6B7280',
                textTransform:'uppercase', letterSpacing:'0.06em' }}>Debug</p>
              {logLines.map((l, i) => (
                <p key={i} style={{ margin:'1px 0', fontSize:11, color:'#A6ACCD', fontFamily:'monospace' }}>{l}</p>
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNav active="scannen" />
    </>
  );
}
