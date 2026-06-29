import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ── Icons ──────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20, color = 'currentColor', strokeWidth = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const icons = {
  camera:   'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z',
  x:        'M18 6L6 18M6 6l12 12',
  plus:     'M12 5v14M5 12h14',
  sparkle:  'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM4 17l.75 2.25L7 20l-2.25.75L4 23l-.75-2.25L1 20l2.25-.75L4 17zM20 3l.75 2.25L23 6l-2.25.75L20 9l-.75-2.25L17 6l2.25-.75L20 3z',
  check:    'M20 6L9 17l-5-5',
  warning:  'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
  file:     'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm0 0v6h6',
  loader:   'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',
  home:     'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9zM9 22V12h6v10',
  tasks:    'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  archive:  'M21 8v13H3V8M23 3H1a1 1 0 00-1 1v3a1 1 0 001 1h22a1 1 0 001-1V4a1 1 0 00-1-1zM10 12h4',
  users:    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  upload:   'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
};

// ── Bottom Nav ─────────────────────────────────────────────────────────────
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
      position:'fixed',bottom:0,left:0,right:0,
      background:'#fff',borderTop:'1px solid #E5E7EB',
      display:'flex',zIndex:50,
      paddingBottom:'env(safe-area-inset-bottom)',
    }}>
      {items.map(it => (
        <button key={it.id} onClick={() => router.push(it.path)}
          style={{
            flex:1,display:'flex',flexDirection:'column',alignItems:'center',
            gap:3,padding:'10px 4px 8px',border:'none',background:'none',
            color: active === it.id ? '#1F3A52' : '#9CA3AF',cursor:'pointer',
            fontSize:10,fontFamily:'inherit',fontWeight: active===it.id ? 600 : 400,
          }}>
          <Icon d={it.icon} size={22} />
          {it.label}
        </button>
      ))}
    </nav>
  );
}

// ── Status Banner ──────────────────────────────────────────────────────────
function StatusBanner({ type, message }) {
  const cfg = {
    error:   { bg:'#FEF2F2', border:'#FCA5A5', color:'#B91C1C', icon: icons.warning },
    success: { bg:'#F0FDF4', border:'#86EFAC', color:'#166534', icon: icons.check },
    info:    { bg:'#EFF6FF', border:'#BFDBFE', color:'#1D4ED8', icon: icons.loader },
  }[type] || {};
  return (
    <div style={{
      background:cfg.bg, border:`1px solid ${cfg.border}`, borderRadius:10,
      padding:'12px 14px', marginBottom:16,
      display:'flex', alignItems:'flex-start', gap:10,
    }}>
      <Icon d={cfg.icon} size={16} color={cfg.color} />
      <p style={{margin:0, fontSize:13, color:cfg.color, lineHeight:1.5}}>{message}</p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function Scannen() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // State
  const [pages, setPages] = useState([]);          // { file, previewUrl, uploadedUrl, hash }
  const [dokumentId, setDokumentId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [debugLog, setDebugLog] = useState([]);

  function log(msg) {
    console.log('[Scannen]', msg);
    setDebugLog(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()} ${msg}`]);
  }

  // ── File handling ──────────────────────────────────────────────────────
  async function addFiles(files) {
    setError(null);
    const newPages = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        setError('Nur Bilder (JPG, PNG) oder PDFs werden unterstützt.');
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      newPages.push({ file, previewUrl, uploadedUrl: null });
    }
    setPages(prev => [...prev, ...newPages]);
  }

  function removePage(idx) {
    setPages(prev => prev.filter((_, i) => i !== idx));
    // If all pages removed, reset the dokumentId
    if (pages.length <= 1) {
      setDokumentId(null);
      setDone(false);
    }
  }

  // ── Upload all pages & create document row ─────────────────────────────
  async function uploadAndPrepare() {
    if (pages.length === 0) {
      setError('Bitte zuerst mindestens ein Foto hinzufügen.');
      return null;
    }

    setUploading(true);
    setError(null);
    log('Upload gestartet...');

    try {
      // 1. Auth check
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return null; }
      log(`User: ${user.id.slice(0,8)}...`);

      // 2. Upload each page to Supabase Storage
      const uploadedUrls = [];
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        if (page.uploadedUrl) {
          uploadedUrls.push(page.uploadedUrl);
          continue;
        }
        const ext = page.file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${Date.now()}_page${i+1}.${ext}`;
        log(`Upload Seite ${i+1}: ${path}`);

        const { error: upErr } = await supabase.storage
          .from('dokumente')
          .upload(path, page.file, { upsert: false });

        if (upErr) {
          log(`Upload-Fehler: ${upErr.message}`);
          throw new Error(`Upload fehlgeschlagen: ${upErr.message}`);
        }

        const { data: urlData } = supabase.storage.from('dokumente').getPublicUrl(path);
        const url = urlData?.publicUrl;
        if (!url) throw new Error('Kein URL nach Upload');
        log(`Upload OK: ${url.slice(-30)}`);
        uploadedUrls.push(url);

        // Update preview state
        setPages(prev => prev.map((p, pi) => pi === i ? { ...p, uploadedUrl: url } : p));
      }

      // 3. Create document row in DB
      log('Dokument-Row anlegen...');
      const { data: dok, error: insertErr } = await supabase
        .from('dokumente')
        .insert({
          user_id: user.id,
          dateiname: pages[0].file.name,
          bild_url: uploadedUrls[0],
          bild_urls: uploadedUrls,
          analysiert: false,
          dringlichkeit: 'Zur Kenntnis',
        })
        .select('id')
        .single();

      if (insertErr) {
        log(`DB Insert Fehler: ${insertErr.message}`);
        throw new Error(`Datenbank-Fehler: ${insertErr.message}`);
      }
      if (!dok?.id) {
        log('Kein ID zurückgekommen!');
        throw new Error('Dokument-ID fehlt nach dem Anlegen');
      }

      log(`Dokument angelegt: ID=${dok.id}`);
      setDokumentId(dok.id);
      return dok.id;

    } catch (err) {
      setError(err.message);
      log(`FEHLER: ${err.message}`);
      return null;
    } finally {
      setUploading(false);
    }
  }

  // ── Analyze ────────────────────────────────────────────────────────────
  async function handleAnalyze() {
    setError(null);

    // Upload first if not done yet
    let docId = dokumentId;
    if (!docId) {
      log('Kein dokumentId — starte Upload...');
      docId = await uploadAndPrepare();
      if (!docId) return; // upload failed, error already set
    }

    log(`Analyse starten für ID: ${docId}`);
    setAnalyzing(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dokumentId: docId }),
      });

      const data = await res.json();

      if (!res.ok) {
        log(`Analyse-API Fehler: ${res.status} ${JSON.stringify(data)}`);
        throw new Error(data.error || `Server-Fehler ${res.status}`);
      }

      log('Analyse erfolgreich!');
      setDone(true);

      // Navigate to aufgaben after short delay
      setTimeout(() => router.push('/aufgaben'), 1500);

    } catch (err) {
      setError(`Analyse fehlgeschlagen: ${err.message}`);
      log(`Analyse FEHLER: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const isLoading = uploading || analyzing;
  const canAnalyze = pages.length > 0 && !isLoading && !done;

  return (
    <>
      <Head>
        <title>Scannen – PostScout</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div style={{
        minHeight:'100dvh',background:'#F8F9FA',
        fontFamily:'Figtree, system-ui, sans-serif',
        paddingBottom:80,
      }}>
        {/* Header */}
        <div style={{
          position:'sticky',top:0,zIndex:40,background:'#1F3A52',
          padding:'12px 16px',
          paddingTop:'calc(12px + env(safe-area-inset-top))',
          display:'flex',alignItems:'center',gap:12,
        }}>
          <button onClick={()=>router.back()} style={{background:'none',border:'none',cursor:'pointer',padding:4}}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <span style={{fontWeight:700,color:'#fff',fontSize:17}}>Brief scannen</span>
        </div>

        <div style={{padding:'20px 16px 0'}}>

          {/* Error */}
          {error && <StatusBanner type="error" message={error} />}

          {/* Success */}
          {done && (
            <StatusBanner type="success"
              message="Analyse abgeschlossen! Aufgaben werden geladen…" />
          )}

          {/* Upload Zone */}
          {!done && (
            <div style={{
              border:'2px dashed #CBD5E1',borderRadius:16,background:'#fff',
              padding:'32px 20px',textAlign:'center',marginBottom:20,
            }}>
              <div style={{
                width:64,height:64,borderRadius:16,background:'#EAF0F6',
                display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',
              }}>
                <Icon d={icons.camera} size={28} color="#1F3A52" />
              </div>
              <p style={{margin:'0 0 4px',fontWeight:700,fontSize:16,color:'#111'}}>
                {pages.length > 0 ? 'Weitere Seite hinzufügen' : 'Foto aufnehmen oder wählen'}
              </p>
              <p style={{margin:'0 0 20px',fontSize:13,color:'#9CA3AF'}}>
                Mehrere Seiten möglich — z.B. Vorder- und Rückseite
              </p>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isLoading}
                  style={{
                    padding:'12px 24px',borderRadius:10,border:'none',
                    background:'#1F3A52',color:'#fff',fontSize:14,fontWeight:600,
                    cursor:'pointer',fontFamily:'inherit',
                  }}>
                  Aufnehmen
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  style={{
                    padding:'12px 24px',borderRadius:10,border:'1px solid #D1D5DB',
                    background:'#fff',color:'#374151',fontSize:14,fontWeight:500,
                    cursor:'pointer',fontFamily:'inherit',
                  }}>
                  Datei wählen
                </button>
              </div>

              {/* Hidden inputs */}
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
                multiple style={{display:'none'}}
                onChange={e => addFiles(e.target.files)} />
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
                multiple style={{display:'none'}}
                onChange={e => addFiles(e.target.files)} />
            </div>
          )}

          {/* Page thumbnails */}
          {pages.length > 0 && (
            <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20}}>
              {pages.map((page, idx) => (
                <div key={idx} style={{position:'relative',width:80,height:90}}>
                  <div style={{
                    width:80,height:80,borderRadius:10,overflow:'hidden',
                    border:'1px solid #E5E7EB',background:'#F9FAFB',
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>
                    {page.previewUrl && page.file.type.startsWith('image/') ? (
                      <img src={page.previewUrl} alt={`Seite ${idx+1}`}
                        style={{width:'100%',height:'100%',objectFit:'cover'}} />
                    ) : (
                      <Icon d={icons.file} size={32} color="#9CA3AF" />
                    )}
                    {/* Upload indicator */}
                    {page.uploadedUrl && (
                      <div style={{
                        position:'absolute',top:4,right:4,
                        background:'#22C55E',borderRadius:'50%',
                        width:16,height:16,display:'flex',alignItems:'center',justifyContent:'center',
                      }}>
                        <Icon d={icons.check} size={10} color="#fff" strokeWidth={2.5} />
                      </div>
                    )}
                  </div>
                  <button onClick={() => removePage(idx)} style={{
                    position:'absolute',top:-6,left:-6,
                    width:22,height:22,borderRadius:'50%',
                    background:'#EF4444',border:'2px solid #fff',cursor:'pointer',
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>
                    <Icon d={icons.x} size={11} color="#fff" strokeWidth={2.5} />
                  </button>
                  <p style={{
                    margin:'4px 0 0',fontSize:10,color:'#6B7280',
                    textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                  }}>
                    {idx+1}. {page.file.name.slice(0,10)}…
                  </p>
                </div>
              ))}

              {/* Add more */}
              {!done && (
                <button onClick={() => fileInputRef.current?.click()} style={{
                  width:80,height:80,borderRadius:10,border:'2px dashed #CBD5E1',
                  background:'#F9FAFB',display:'flex',flexDirection:'column',
                  alignItems:'center',justifyContent:'center',gap:4,
                  cursor:'pointer',color:'#9CA3AF',fontSize:11,
                }}>
                  <Icon d={icons.plus} size={20} color="#9CA3AF" />
                  Seite
                </button>
              )}
            </div>
          )}

          {/* Status info */}
          {uploading && (
            <StatusBanner type="info" message="Fotos werden hochgeladen…" />
          )}
          {analyzing && (
            <StatusBanner type="info" message="KI analysiert das Dokument — das dauert 10–20 Sekunden…" />
          )}
          {dokumentId && !analyzing && !done && (
            <div style={{
              background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:8,
              padding:'8px 12px',marginBottom:12,display:'flex',alignItems:'center',gap:8,
            }}>
              <Icon d={icons.check} size={14} color="#166534" />
              <p style={{margin:0,fontSize:12,color:'#166534'}}>
                Fotos hochgeladen — bereit zur Analyse
              </p>
            </div>
          )}

          {/* Analyze Button */}
          {!done && (
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              style={{
                width:'100%',padding:'16px',borderRadius:14,border:'none',
                background: canAnalyze ? '#1F3A52' : '#CBD5E1',
                color: canAnalyze ? '#fff' : '#9CA3AF',
                fontSize:16,fontWeight:700,fontFamily:'inherit',
                cursor: canAnalyze ? 'pointer' : 'not-allowed',
                display:'flex',alignItems:'center',justifyContent:'center',gap:10,
                transition:'background 0.2s',
              }}>
              {isLoading ? (
                <>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth={2} strokeLinecap="round"
                    style={{animation:'spin 1s linear infinite'}}>
                    <path d={icons.loader}/>
                  </svg>
                  {uploading ? 'Wird hochgeladen…' : 'Wird analysiert…'}
                </>
              ) : (
                <>
                  <Icon d={icons.sparkle} size={18} color={canAnalyze ? '#fff' : '#9CA3AF'} />
                  Brief analysieren
                </>
              )}
            </button>
          )}

          {/* Debug log — nur im Development oder bei Fehler */}
          {(error || process.env.NODE_ENV === 'development') && debugLog.length > 0 && (
            <div style={{
              marginTop:20,background:'#1E1E2E',borderRadius:10,padding:'12px 14px',
              maxHeight:160,overflowY:'auto',
            }}>
              <p style={{margin:'0 0 8px',fontSize:10,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase'}}>
                Debug Log
              </p>
              {debugLog.map((line, i) => (
                <p key={i} style={{margin:'2px 0',fontSize:11,color:'#A6ACCD',fontFamily:'monospace'}}>{line}</p>
              ))}
            </div>
          )}

        </div>
      </div>

      <BottomNav active="scannen" />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
