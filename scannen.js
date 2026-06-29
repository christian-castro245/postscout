import { useState, useRef } from 'react';
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

// ── PHASEN: idle → uploading → analyzing → done
// dokumentId wird als lokale Variable durch den gesamten Flow gereicht,
// NICHT über React-State (vermeidet async-State-Bug).

export default function Scannen() {
  const router = useRouter();
  const fileRef  = useRef(null);
  const camRef   = useRef(null);

  const [pages,   setPages]   = useState([]); // {file, previewUrl}
  const [phase,   setPhase]   = useState('idle');   // idle|uploading|analyzing|done
  const [error,   setError]   = useState(null);
  const [log,     setLog]     = useState([]);

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

  function removePage(idx) {
    setPages(prev => {
      const next = prev.filter((_, i) => i !== idx);
      return next;
    });
  }

  async function handleAnalyze() {
    if (pages.length === 0) { setError('Bitte zuerst ein Foto hinzufügen.'); return; }
    setError(null);

    // ── 1. AUTH ──────────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    // ── 2. UPLOAD ────────────────────────────────────────────────────────
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

    // ── 3. DB INSERT ─────────────────────────────────────────────────────
    addLog('Dokument in DB anlegen…');
    const { data: dok, error: insertErr } = await supabase
      .from('dokumente')
      .insert({
        user_id:    user.id,
        dateiname:  pages[0].file.name,
        bild_url:   uploadedUrls[0],
        bild_urls:  uploadedUrls,
        analysiert: false,
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

    // dok.id ist jetzt eine echte lokale Variable — kein State-Problem
    const dokumentId = dok.id;
    addLog(`Dokument-ID: ${dokumentId}`);

    // ── 4. ANALYSE ───────────────────────────────────────────────────────
    setPhase('analyzing');
    addLog(`POST /api/analyze mit dokumentId=${dokumentId}`);

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
    addLog(`Analyse-Response: ${analyzeRes.status} ${JSON.stringify(result).slice(0,80)}`);

    if (!analyzeRes.ok) {
      setError(`Analyse fehlgeschlagen (${analyzeRes.status}): ${result.error || 'Unbekannter Fehler'}`);
      setPhase('idle');
      return;
    }

    // ── 5. DONE ──────────────────────────────────────────────────────────
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

      <div style={{ minHeight:'100dvh', background:'#F8F9FA',
        fontFamily:'Figtree, system-ui, sans-serif', paddingBottom:80 }}>

        {/* Header */}
        <div style={{ position:'sticky', top:0, zIndex:40, background:'#1F3A52',
          padding:'12px 16px', paddingTop:'calc(12px + env(safe-area-inset-top))',
          display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => router.back()}
            style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
            <Icon d={icons.back} size={20} color="#fff" />
          </button>
          <span style={{ fontWeight:700, color:'#fff', fontSize:17 }}>Brief scannen</span>
        </div>

        <div style={{ padding:'20px 16px 0' }}>

          {/* Error */}
          {error && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:10,
              padding:'12px 14px', marginBottom:16, display:'flex', gap:10 }}>
              <Icon d={icons.warning} size={16} color="#B91C1C" />
              <p style={{ margin:0, fontSize:13, color:'#B91C1C', lineHeight:1.5 }}>{error}</p>
            </div>
          )}

          {/* Success */}
          {phase === 'done' && (
            <div style={{ background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:10,
              padding:'12px 14px', marginBottom:16, display:'flex', gap:10 }}>
              <Icon d={icons.check} size={16} color="#166534" />
              <p style={{ margin:0, fontSize:13, color:'#166534' }}>
                Analyse abgeschlossen — Aufgaben werden geladen…
              </p>
            </div>
          )}

          {/* Upload zone */}
          {phase !== 'done' && (
            <div style={{ border:'2px dashed #CBD5E1', borderRadius:16, background:'#fff',
              padding:'28px 20px', textAlign:'center', marginBottom:20 }}>
              <div style={{ width:56, height:56, borderRadius:14, background:'#EAF0F6',
                display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                <Icon d={icons.camera} size={26} color="#1F3A52" />
              </div>
              <p style={{ margin:'0 0 4px', fontWeight:700, fontSize:15, color:'#111' }}>
                {pages.length > 0 ? 'Weitere Seite hinzufügen' : 'Foto aufnehmen oder wählen'}
              </p>
              <p style={{ margin:'0 0 18px', fontSize:13, color:'#9CA3AF' }}>
                Mehrere Seiten möglich — z.B. Vorder- und Rückseite
              </p>
              <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                <button onClick={() => camRef.current?.click()} disabled={busy}
                  style={{ padding:'11px 22px', borderRadius:10, border:'none',
                    background: busy ? '#CBD5E1' : '#1F3A52', color:'#fff',
                    fontSize:14, fontWeight:600, cursor: busy ? 'not-allowed' : 'pointer',
                    fontFamily:'inherit' }}>
                  Aufnehmen
                </button>
                <button onClick={() => fileRef.current?.click()} disabled={busy}
                  style={{ padding:'11px 22px', borderRadius:10, border:'1px solid #D1D5DB',
                    background:'#fff', color:'#374151', fontSize:14, fontWeight:500,
                    cursor: busy ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                  Datei wählen
                </button>
              </div>
              <input ref={camRef} type="file" accept="image/*" capture="environment" multiple
                style={{ display:'none' }} onChange={e => addFiles(e.target.files)} />
              <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple
                style={{ display:'none' }} onChange={e => addFiles(e.target.files)} />
            </div>
          )}

          {/* Thumbnails */}
          {pages.length > 0 && (
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:20 }}>
              {pages.map((p, idx) => (
                <div key={idx} style={{ position:'relative', width:80 }}>
                  <div style={{ width:80, height:80, borderRadius:10, overflow:'hidden',
                    border:'1px solid #E5E7EB', background:'#F9FAFB',
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {p.file.type.startsWith('image/') ? (
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
                  <p style={{ margin:'4px 0 0', fontSize:10, color:'#6B7280',
                    textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {idx+1}. {p.file.name.slice(0,12)}
                  </p>
                </div>
              ))}
              {!busy && phase !== 'done' && (
                <button onClick={() => fileRef.current?.click()} style={{
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

          {/* Status */}
          {phase === 'uploading' && (
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10,
              padding:'12px 14px', marginBottom:16 }}>
              <p style={{ margin:0, fontSize:13, color:'#1D4ED8' }}>⏳ Fotos werden hochgeladen…</p>
            </div>
          )}
          {phase === 'analyzing' && (
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10,
              padding:'12px 14px', marginBottom:16 }}>
              <p style={{ margin:0, fontSize:13, color:'#1D4ED8' }}>🔍 KI analysiert das Dokument (10–20 Sek.)…</p>
            </div>
          )}

          {/* Analyze Button */}
          {phase !== 'done' && (
            <button onClick={handleAnalyze} disabled={pages.length === 0 || busy}
              style={{ width:'100%', padding:'16px', borderRadius:14, border:'none',
                background: pages.length > 0 && !busy ? '#1F3A52' : '#CBD5E1',
                color: pages.length > 0 && !busy ? '#fff' : '#9CA3AF',
                fontSize:16, fontWeight:700, fontFamily:'inherit',
                cursor: pages.length > 0 && !busy ? 'pointer' : 'not-allowed',
                display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
              <Icon d={icons.sparkle} size={18} color={pages.length > 0 && !busy ? '#fff' : '#9CA3AF'} />
              {phase === 'uploading' ? 'Wird hochgeladen…'
               : phase === 'analyzing' ? 'Wird analysiert…'
               : 'Brief analysieren'}
            </button>
          )}

          {/* Debug log — immer sichtbar bei Fehler oder wenn Log-Einträge vorhanden */}
          {log.length > 0 && (
            <div style={{ marginTop:16, background:'#1E1E2E', borderRadius:10,
              padding:'10px 14px', maxHeight:180, overflowY:'auto' }}>
              <p style={{ margin:'0 0 6px', fontSize:10, fontWeight:700, color:'#6B7280',
                textTransform:'uppercase', letterSpacing:'0.06em' }}>Debug</p>
              {log.map((l, i) => (
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
