import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import Script from 'next/script'
import { supabase } from '../lib/supabase'

const CATS = {
  'Behörde / Ämter':           { ico: '🏛', bg: '#E6F1FB', text: '#0C447C' },
  'Gesundheit / Krankenkasse': { ico: '❤️', bg: '#FCEBEB', text: '#A32D2D' },
  'Finanzen / Bank':           { ico: '🏦', bg: '#EAF3DE', text: '#27500A' },
  'Versicherung':              { ico: '🛡', bg: '#EEEDFE', text: '#3C3489' },
  'Steuer / Finanzamt':        { ico: '🧾', bg: '#FAEEDA', text: '#633806' },
  'Rechnungen / Mahnungen':    { ico: '📋', bg: '#FAECE7', text: '#712B13' },
  'Sonstiges':                 { ico: '📄', bg: '#F1EFE8', text: '#444441' },
}
const DRING = {
  hoch:    { cls: 'badge-danger',  label: '⚡ Dringend' },
  mittel:  { cls: 'badge-warning', label: '⏳ Mittelfristig' },
  niedrig: { cls: 'badge-success', label: '✓ Kein Zeitdruck' },
}

export default function Home() {
  // ── Auth state ──
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPw, setAuthPw] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMsg, setAuthMsg] = useState(null)

  // ── App state ──
  const [tab, setTab] = useState('scan')
  const [file, setFile] = useState(null)
  const [base64, setBase64] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [scanMsg, setScanMsg] = useState(null)
  const [docs, setDocs] = useState([])
  const [filter, setFilter] = useState('Alle')
  const [exportMsg, setExportMsg] = useState(null)
  const [todos, setTodos] = useState([])
  const fileRef = useRef()

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session)
      if (session) loadDocs()
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleAuth() {
    setAuthLoading(true)
    setAuthMsg(null)
    const fn = authMode === 'login'
      ? supabase.auth.signInWithPassword({ email: authEmail, password: authPw })
      : supabase.auth.signUp({ email: authEmail, password: authPw })
    const { error } = await fn
    if (error) setAuthMsg({ text: error.message, err: true })
    else if (authMode === 'register') setAuthMsg({ text: 'Bestätigungs-E-Mail gesendet – bitte E-Mail prüfen.', err: false })
    setAuthLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setDocs([])
    setResult(null)
  }

  // ── File handling ──
  function processFile(f) {
    setFile(f)
    setScanMsg(null)
    setResult(null)
    setTodos([])
    const reader = new FileReader()
    reader.onload = e => {
      const url = e.target.result
      setBase64(url.split(',')[1])
      if (f.type.startsWith('image/')) setPreviewUrl(url)
      else setPreviewUrl(null)
    }
    reader.readAsDataURL(f)
  }

  function handleDrop(e) {
    e.preventDefault()
    e.currentTarget.classList.remove('over')
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }

  // ── Analyse + Storage upload ──
  async function analyzeDoc() {
    if (!file || !base64) return
    setAnalyzing(true)
    setScanMsg(null)
    setResult(null)
    setTodos([])

    try {
      // 1. Serverseitige Analyse via API Route (Key bleibt sicher)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType: file.type }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Analyse fehlgeschlagen')
      }
      const r = await res.json()

      // 2. Supabase Storage Upload
      const uid = session.user.id
      const storagePath = `${uid}/${Date.now()}_${file.name}`
      const { error: storageErr } = await supabase.storage
        .from('dokumente')
        .upload(storagePath, file, { contentType: file.type, upsert: false })
      if (storageErr) throw new Error('Upload fehlgeschlagen: ' + storageErr.message)

      // 3. DB Insert
      const { error: dbErr } = await supabase.from('dokumente').insert({
        user_id: uid,
        dateiname: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        kategorie: r.kategorie,
        absender: r.absender,
        zusammenfassung: r.zusammenfassung,
        dringlichkeit: r.dringlichkeit,
        frist: parseFrist(r.frist),
        betrag: r.betrag,
        steuerrelevant: r.steuerrelevant,
        jahr: new Date().getFullYear(),
        todos: r.todos || [],
        empfehlungen: r.empfehlungen || [],
      })
      if (dbErr) throw new Error('Datenbank-Fehler: ' + dbErr.message)

      setResult(r)
      setTodos(r.todos || [])
      await loadDocs()

    } catch (e) {
      setScanMsg({ text: e.message, err: true })
    } finally {
      setAnalyzing(false)
    }
  }

  function parseFrist(frist) {
    if (!frist) return null
    const parts = frist.split('.')
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`
    return null
  }

  function toggleTodo(i) {
    setTodos(prev => prev.map((t, idx) => idx === i ? { ...t, erledigt: !t.erledigt } : t))
  }

  // ── Archiv ──
  async function loadDocs() {
    const { data, error } = await supabase
      .from('dokumente')
      .select('*')
      .order('erstellt_am', { ascending: false })
    if (!error) setDocs(data || [])
  }

  async function downloadDoc(path, name) {
    const { data, error } = await supabase.storage.from('dokumente').download(path)
    if (error) { alert('Download fehlgeschlagen: ' + error.message); return }
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  async function deleteDoc(id, path) {
    if (!confirm('Dokument wirklich löschen?')) return
    await supabase.storage.from('dokumente').remove([path])
    await supabase.from('dokumente').delete().eq('id', id)
    await loadDocs()
  }

  // ── Export ──
  function getYear() {
    const sel = document.getElementById('year-sel')
    return sel ? parseInt(sel.value) : new Date().getFullYear()
  }

  function exportCSV(nurSteuer = true) {
    const jahr = getYear()
    const filtered = docs.filter(d =>
      (d.jahr || new Date().getFullYear()) === jahr &&
      (!nurSteuer || d.steuerrelevant || d.kategorie === 'Steuer / Finanzamt')
    )
    if (!filtered.length) { setExportMsg({ text: 'Keine Dokumente für ' + jahr + '.', err: true }); return }
    const header = ['Datum','Absender','Kategorie','Steuerrelevant','Betrag (EUR)','Zusammenfassung','Frist','Datei','Storage-Pfad']
    const rows = filtered.map(d => [
      new Date(d.erstellt_am).toLocaleDateString('de-DE'),
      d.absender || '', d.kategorie,
      d.steuerrelevant ? 'Ja' : 'Nein',
      d.betrag != null ? Number(d.betrag).toFixed(2) : '',
      '"' + (d.zusammenfassung || '').replace(/"/g, "''") + '"',
      d.frist ? new Date(d.frist).toLocaleDateString('de-DE') : '',
      d.dateiname || '', d.storage_path || '',
    ])
    const csv = [header, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `postscout_${nurSteuer ? 'steuer' : 'alle'}_${jahr}.csv`
    a.click()
    setExportMsg({ text: `✓ CSV mit ${filtered.length} Dokument(en) heruntergeladen.`, err: false })
    setTimeout(() => setExportMsg(null), 4000)
  }

  function exportPDF() {
    const jahr = getYear()
    const filtered = docs.filter(d =>
      (d.jahr || new Date().getFullYear()) === jahr &&
      (d.steuerrelevant || d.kategorie === 'Steuer / Finanzamt')
    )
    if (!filtered.length) { setExportMsg({ text: 'Keine steuerrelevanten Dokumente für ' + jahr + '.', err: true }); return }

    const { jsPDF } = window.jspdf
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210, pad = 18; let y = pad

    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(26, 25, 22)
    doc.text('PostScout – Steuerübersicht ' + jahr, pad, y); y += 8
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(120, 120, 120)
    doc.text(`Erstellt: ${new Date().toLocaleDateString('de-DE')} · ${filtered.length} Dokument(e)`, pad, y); y += 9
    doc.setDrawColor(228, 226, 217); doc.setLineWidth(0.3); doc.line(pad, y, W - pad, y); y += 7

    const gesamt = filtered.reduce((s, d) => s + (Number(d.betrag) || 0), 0)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 25, 22)
    doc.text('Gesamtbetrag:', pad, y)
    doc.text(gesamt.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }), W - pad, y, { align: 'right' })
    y += 9; doc.line(pad, y, W - pad, y); y += 7

    filtered.forEach((d, i) => {
      if (y > 260) { doc.addPage(); y = pad }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 25, 22)
      doc.text((i + 1) + '. ' + (d.absender || d.dateiname || 'Unbekannt'), pad, y); y += 5
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90)
      const datum = new Date(d.erstellt_am).toLocaleDateString('de-DE')
      const betragStr = d.betrag != null ? ' · ' + Number(d.betrag).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : ''
      doc.text(d.kategorie + ' · ' + datum + betragStr, pad + 3, y); y += 5
      if (d.zusammenfassung) {
        const lines = doc.splitTextToSize(d.zusammenfassung, W - pad * 2 - 3)
        doc.setTextColor(50, 50, 50); doc.text(lines, pad + 3, y); y += lines.length * 4.5
      }
      if (d.frist) { doc.setTextColor(180, 100, 0); doc.text('Frist: ' + new Date(d.frist).toLocaleDateString('de-DE'), pad + 3, y); y += 5 }
      y += 4; doc.setDrawColor(235, 235, 235); doc.line(pad, y, W - pad, y); y += 6
    })

    doc.save('postscout_steuer_' + jahr + '.pdf')
    setExportMsg({ text: `✓ PDF mit ${filtered.length} Dokument(en) heruntergeladen.`, err: false })
    setTimeout(() => setExportMsg(null), 4000)
  }

  // ── Derived ──
  const filteredDocs = filter === 'Alle' ? docs : docs.filter(d => d.kategorie === filter)
  const jahre = [...new Set(docs.map(d => d.jahr || new Date().getFullYear()))].sort((a, b) => b - a)
  const cat = result ? (CATS[result.kategorie] || CATS['Sonstiges']) : null

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>PostScout – Briefe verstehen</title>
        <meta name="description" content="Briefe fotografieren, verstehen und organisieren" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✉</text></svg>" />
      </Head>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" strategy="lazyOnload" />

      <div className="app">
        {/* ── HEADER ── */}
        <header className="header">
          <div className="logo">
            <div className="logo-icon">✉</div>
            <div>
              <div className="logo-title">PostScout</div>
              <div className="logo-sub">Briefe verstehen – auf einen Blick</div>
            </div>
          </div>
          {session && (
            <button className="user-badge" onClick={signOut}>
              {session.user.email.split('@')[0]} · Abmelden
            </button>
          )}
        </header>

        {/* ── AUTH VIEW ── */}
        {!session && (
          <div className="auth-card">
            <div className="auth-title">{authMode === 'login' ? 'Willkommen' : 'Konto erstellen'}</div>
            <div className="auth-sub">
              {authMode === 'login'
                ? 'Melde dich an, um deine Briefe sicher zu verwalten.'
                : 'Erstelle ein kostenloses Konto für PostScout.'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              <div>
                <label className="input-label">E-Mail</label>
                <input className="input" type="email" value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAuth()}
                  placeholder="name@beispiel.de" />
              </div>
              <div>
                <label className="input-label">Passwort</label>
                <input className="input" type="password" value={authPw}
                  onChange={e => setAuthPw(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAuth()}
                  placeholder="Mindestens 6 Zeichen" />
              </div>
            </div>
            {authMsg && <div className={`msg ${authMsg.err ? 'err' : 'ok'}`}>{authMsg.text}</div>}
            <button className="btn primary full" onClick={handleAuth} disabled={authLoading}>
              {authLoading
                ? <><div className="spinner" /> Bitte warten...</>
                : authMode === 'login' ? 'Anmelden' : 'Registrieren'}
            </button>
            <div className="auth-toggle">
              {authMode === 'login' ? 'Noch kein Konto? ' : 'Bereits registriert? '}
              <a onClick={() => { setAuthMode(m => m === 'login' ? 'register' : 'login'); setAuthMsg(null) }}>
                {authMode === 'login' ? 'Registrieren' : 'Anmelden'}
              </a>
            </div>
          </div>
        )}

        {/* ── APP VIEW ── */}
        {session && (
          <>
            <div className="tabs">
              {[['scan','📷 Scannen'], ['archiv','🗂 Archiv'], ['export','📤 Export']].map(([id, label]) => (
                <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => { setTab(id); if (id==='archiv') loadDocs() }}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── SCAN TAB ── */}
            {tab === 'scan' && (
              <div>
                <div className="label">Brief hochladen</div>
                <div
                  className="upload-zone"
                  onClick={() => fileRef.current.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over') }}
                  onDragLeave={e => e.currentTarget.classList.remove('over')}
                  onDrop={handleDrop}
                >
                  <input ref={fileRef} type="file" accept="image/*,application/pdf"
                    style={{ display: 'none' }} onChange={e => e.target.files[0] && processFile(e.target.files[0])} />
                  {previewUrl && <img src={previewUrl} className="preview-img" alt="Vorschau" />}
                  {!previewUrl && <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>}
                  <div className="upload-title">{file ? file.name : 'Brief oder Foto hochladen'}</div>
                  <div className="upload-hint">
                    {file
                      ? `${Math.round(file.size / 1024)} KB · bereit zur Analyse`
                      : 'Foto, Scan oder PDF – hierher ziehen oder auswählen'}
                  </div>
                  {!file && (
                    <div className="upload-actions">
                      <button className="btn primary" onClick={e => { e.stopPropagation(); fileRef.current.click() }}>📷 Foto</button>
                      <button className="btn" onClick={e => { e.stopPropagation(); fileRef.current.click() }}>📁 Datei</button>
                    </div>
                  )}
                </div>

                {scanMsg && <div className={`msg ${scanMsg.err ? 'err' : 'ok'}`}>{scanMsg.text}</div>}

                <button className="btn primary full" onClick={analyzeDoc} disabled={!file || analyzing}>
                  {analyzing ? <><div className="spinner" /> Wird analysiert...</> : '✨ Brief analysieren'}
                </button>

                {/* ── Result ── */}
                {result && (
                  <div>
                    <div className="label" style={{ marginTop: '.5rem' }}>Analyse</div>

                    <div className="card slide-in">
                      <div className="card-head">
                        <span style={{ fontSize: 17 }}>{cat.ico}</span>
                        <span className="card-title">Zusammenfassung</span>
                        <span className="badge" style={{ background: cat.bg, color: cat.text, borderColor: cat.bg, marginLeft: 'auto' }}>
                          {result.kategorie}
                        </span>
                      </div>
                      <div className="card-body">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          {result.absender && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Von: <strong style={{ color: 'var(--text-2)' }}>{result.absender}</strong></span>}
                          {result.betrag != null && <span className="badge badge-success">💶 {Number(result.betrag).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>}
                          {result.steuerrelevant && <span className="badge badge-steuer">🧾 steuerrelevant</span>}
                          <span className={`badge ${DRING[result.dringlichkeit]?.cls || 'badge-success'}`}>{DRING[result.dringlichkeit]?.label}</span>
                        </div>
                        <p className="card-text">{result.zusammenfassung}</p>
                        {result.frist && <p style={{ fontSize: 12, color: 'var(--warning-text)', marginTop: 8 }}>📅 Frist: {result.frist}</p>}
                        <div className="cloud-badge">☁ In Supabase gespeichert · {file?.name}</div>
                      </div>
                    </div>

                    {todos.length > 0 && (
                      <div className="card slide-in">
                        <div className="card-head"><span>☑</span><span className="card-title">Was zu tun ist</span></div>
                        <div className="card-body">
                          {todos.map((t, i) => (
                            <div key={i} className="todo-row">
                              <div className={`check ${t.erledigt ? 'done' : ''}`} onClick={() => toggleTodo(i)} role="checkbox" aria-checked={t.erledigt} tabIndex={0} onKeyDown={e => e.key===' '&&toggleTodo(i)}>
                                <div className="check-inner" />
                              </div>
                              <div>
                                <div className={`todo-label ${t.erledigt ? 'done' : ''}`}>{t.aufgabe}</div>
                                {t.frist && <div className="todo-frist">📅 Frist: {t.frist}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.empfehlungen?.length > 0 && (
                      <div className="card slide-in">
                        <div className="card-head"><span>💡</span><span className="card-title">Empfehlungen</span></div>
                        <div className="card-body">
                          {result.empfehlungen.map((e, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: i < result.empfehlungen.length-1 ? '0.5px solid var(--border)' : 'none', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                              <span style={{ color: 'var(--accent)', flexShrink: 0 }}>→</span><span>{e}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── ARCHIV TAB ── */}
            {tab === 'archiv' && (
              <div>
                <div className="stat-grid">
                  <div className="stat-cell"><div className="stat-lbl">Dokumente</div><div className="stat-val">{docs.length}</div></div>
                  <div className="stat-cell"><div className="stat-lbl">Steuerrelevant</div><div className="stat-val">{docs.filter(d=>d.steuerrelevant).length}</div></div>
                  <div className="stat-cell"><div className="stat-lbl">Offene Todos</div><div className="stat-val">{docs.reduce((n,d)=>n+(d.todos||[]).filter(t=>!t.erledigt).length,0)}</div></div>
                </div>
                <div className="label">Filter</div>
                <div className="filter-bar">
                  {['Alle', ...Object.keys(CATS)].map(c => (
                    <button key={c} className={`chip ${filter===c?'active':''}`} onClick={() => setFilter(c)}>{c}</button>
                  ))}
                </div>
                {filteredDocs.length === 0
                  ? <div className="empty"><div className="empty-ico">📭</div><p>Noch keine Dokumente.</p></div>
                  : filteredDocs.map(d => {
                    const c = CATS[d.kategorie] || CATS['Sonstiges']
                    return (
                      <div key={d.id} className="doc-row">
                        <div className="doc-icon" style={{ background: c.bg, color: c.text }}>{c.ico}</div>
                        <div className="doc-info">
                          <div className="doc-name">{d.absender || d.dateiname}</div>
                          <div className="doc-meta">
                            {d.kategorie} · {new Date(d.erstellt_am).toLocaleDateString('de-DE')}
                            {d.betrag != null && ' · ' + Number(d.betrag).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                            {d.steuerrelevant && ' · 🧾'}
                          </div>
                        </div>
                        <div className="doc-actions">
                          <button className="icon-btn" onClick={() => downloadDoc(d.storage_path, d.dateiname)} title="Herunterladen">⬇</button>
                          <button className="icon-btn red" onClick={() => deleteDoc(d.id, d.storage_path)} title="Löschen">🗑</button>
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            )}

            {/* ── EXPORT TAB ── */}
            {tab === 'export' && (
              <div>
                <div className="label">Steuerjahr</div>
                <select id="year-sel">
                  {(jahre.length ? jahre : [new Date().getFullYear()]).map(j => <option key={j} value={j}>{j}</option>)}
                </select>
                <div className="export-card">
                  <div className="export-title">🔴 PDF für Steuerberater</div>
                  <div className="export-desc">Alle steuerrelevanten Dokumente des gewählten Jahres – mit Absender, Zusammenfassung, Betrag und Fristen als druckfertiges PDF.</div>
                  <div className="export-btns">
                    <button className="btn primary" onClick={exportPDF}>⬇ PDF herunterladen</button>
                  </div>
                </div>
                <div className="export-card">
                  <div className="export-title">🟢 CSV für Excel / Steuerberater-Software</div>
                  <div className="export-desc">Tabellarische Übersicht aller steuerrelevanten Belege – direkt importierbar in Excel, DATEV oder andere Software.</div>
                  <div className="export-btns">
                    <button className="btn primary" onClick={() => exportCSV(true)}>⬇ Steuer-CSV</button>
                    <button className="btn" onClick={() => exportCSV(false)}>⬇ Alle Kategorien</button>
                  </div>
                </div>
                {exportMsg && <div className={`msg ${exportMsg.err ? 'err' : 'ok'}`}>{exportMsg.text}</div>}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
