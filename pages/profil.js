import { useState, useEffect } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

const IMAP_PROVIDERS = [
  { label: 'T-Online', host: 'secureimap.t-online.de' },
  { label: 'Gmail',    host: 'imap.gmail.com' },
  { label: 'iCloud',   host: 'imap.mail.me.com' },
  { label: 'GMX',      host: 'imap.gmx.net' },
  { label: 'Web.de',   host: 'imap.web.de' },
]

const KONTAKT_KATEGORIEN = ['Arzt', 'Anwalt', 'Steuerberater', 'Hausmeister', 'Nachbar', 'Behörde', 'Handwerker', 'Sonstiges']

export default function Profil() {
  const [session, setSession]   = useState(null)
  const [activeTab, setActiveTab] = useState('person')
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState(null)
  const [imapTesting, setImapTesting] = useState(false)

  // Person
  const [vorname, setVorname]       = useState('')
  const [nachname, setNachname]     = useState('')
  const [strasse, setStrasse]       = useState('')
  const [hausnummer, setHausnummer] = useState('')
  const [plz, setPlz]               = useState('')
  const [ort, setOrt]               = useState('')
  const [geburtsdatum, setGeburtsdatum] = useState('')
  const [telefon, setTelefon]       = useState('')
  const [steuerId, setSteuerId]     = useState('')

  // Bank
  const [bankName, setBankName]     = useState('')
  const [iban, setIban]             = useState('')
  const [bic, setBic]               = useState('')

  // IMAP
  const [imapHost, setImapHost]   = useState('secureimap.t-online.de')
  const [imapPort, setImapPort]   = useState(993)
  const [imapUser, setImapUser]   = useState('')
  const [imapPass, setImapPass]   = useState('')
  const [imapSaved, setImapSaved] = useState(false)

  // Mieter
  const [mieter, setMieter]           = useState([])
  const [mVorname, setMVorname]       = useState('')
  const [mNachname, setMNachname]     = useState('')
  const [mEmail, setMEmail]           = useState('')
  const [mTelefon, setMTelefon]       = useState('')
  const [mStrasse, setMStrasse]       = useState('')
  const [mHausnummer, setMHausnummer] = useState('')
  const [mPlz, setMPlz]               = useState('')
  const [mOrt, setMOrt]               = useState('')
  const [mObjekt, setMObjekt]         = useState('')

  // Kontakte
  const [kontakte, setKontakte]   = useState([])
  const [kKat, setKKat]           = useState('Arzt')
  const [kName, setKName]         = useState('')
  const [kOrg, setKOrg]           = useState('')
  const [kEmail, setKEmail]       = useState('')
  const [kTelefon, setKTelefon]   = useState('')
  const [kNotiz, setKNotiz]       = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        loadProfil(session.user.id)
        loadMieter(session.user.id)
        loadImap(session.user.id)
        loadKontakte(session.user.id)
      }
    })
  }, [])

  async function loadProfil(uid) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (!data) return
    setVorname(data.vorname||''); setNachname(data.nachname||'')
    setStrasse(data.strasse||''); setHausnummer(data.hausnummer||'')
    setPlz(data.plz||''); setOrt(data.ort||'')
    setGeburtsdatum(data.geburtsdatum||''); setTelefon(data.telefon||'')
    setSteuerId(data.steuer_id||''); setBankName(data.bank_name||'')
    setIban(data.iban||''); setBic(data.bic||'')
  }
  async function loadMieter(uid) {
    const { data } = await supabase.from('mieter').select('*').eq('user_id', uid).order('nachname')
    setMieter(data||[])
  }
  async function loadImap(uid) {
    const { data } = await supabase.from('imap_settings').select('*').eq('user_id', uid).single()
    if (!data) return
    setImapHost(data.host||'secureimap.t-online.de'); setImapPort(data.port||993)
    setImapUser(data.username||''); setImapPass(data.password_encrypted||'')
    setImapSaved(true)
  }
  async function loadKontakte(uid) {
    const { data } = await supabase.from('kontakte').select('*').eq('user_id', uid).order('name')
    setKontakte(data||[])
  }

  function showMsg(text, err=false) {
    setMsg({ text, err }); setTimeout(()=>setMsg(null), 3000)
  }

  async function saveProfil() {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      vorname, nachname, strasse, hausnummer, plz, ort,
      geburtsdatum: geburtsdatum||null, telefon,
      steuer_id: steuerId, bank_name: bankName, iban, bic,
    }).eq('id', session.user.id)
    showMsg(error?error.message:'Gespeichert', !!error)
    setSaving(false)
  }

  async function saveImap() {
    setSaving(true)
    const { error } = await supabase.from('imap_settings').upsert({
      user_id: session.user.id, host: imapHost, port: imapPort,
      username: imapUser, password_encrypted: imapPass, aktiv: true,
    }, { onConflict:'user_id' })
    if (!error) { setImapSaved(true); showMsg('IMAP gespeichert') }
    else showMsg(error.message, true)
    setSaving(false)
  }

  async function testImap() {
    setImapTesting(true)
    const res = await fetch('/api/imap-test', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ host:imapHost, port:imapPort, username:imapUser, password_encrypted:imapPass }),
    })
    const data = await res.json()
    showMsg(data.ok?`Verbunden — ${data.count} ungelesene Mails`:'Fehler: '+data.error, !data.ok)
    setImapTesting(false)
  }

  async function addMieter() {
    if (!mVorname||!mNachname) return
    const { error } = await supabase.from('mieter').insert({
      user_id: session.user.id, vorname:mVorname, nachname:mNachname,
      email:mEmail, telefon:mTelefon, strasse:mStrasse, hausnummer:mHausnummer,
      plz:mPlz, ort:mOrt, objekt_bezeichnung:mObjekt,
    })
    if (!error) {
      setMVorname(''); setMNachname(''); setMEmail(''); setMTelefon('')
      setMStrasse(''); setMHausnummer(''); setMPlz(''); setMOrt(''); setMObjekt('')
      loadMieter(session.user.id); showMsg('Mieter gespeichert')
    }
  }
  async function deleteMieter(id) {
    if (!confirm('Mieter wirklich löschen?')) return
    await supabase.from('mieter').delete().eq('id', id); loadMieter(session.user.id)
  }

  async function addKontakt() {
    if (!kName) return
    const { error } = await supabase.from('kontakte').insert({
      user_id:session.user.id, kategorie:kKat, name:kName,
      organisation:kOrg, email:kEmail, telefon:kTelefon, notiz:kNotiz,
    })
    if (!error) {
      setKName(''); setKOrg(''); setKEmail(''); setKTelefon(''); setKNotiz('')
      loadKontakte(session.user.id); showMsg('Kontakt gespeichert')
    }
  }
  async function deleteKontakt(id) {
    if (!confirm('Kontakt wirklich löschen?')) return
    await supabase.from('kontakte').delete().eq('id', id); loadKontakte(session.user.id)
  }

  function handleTel(val, setter) { setter(val.replace(/[^\d+\s\-()+]/g,'')) }

  const TABS = [
    { id:'person',   label:'Person' },
    { id:'bank',     label:'Bank' },
    { id:'mieter',   label:'Mieter' },
    { id:'kontakte', label:'Kontakte' },
    { id:'imap',     label:'E-Mail' },
  ]

  return (
    <>
      <Head>
        <title>Profil – PostScout</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
      </Head>
      <div className="shell">

        {/* Header */}
        <header className="top-bar">
          <a href="/" className="back-chip" style={{textDecoration:'none',color:'white'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Zurück
          </a>
          <span className="top-title">Mein Profil</span>
          <div style={{width:60}}/>
        </header>

        <div className="content">

          {/* Tab bar */}
          <div className="tab-bar">
            {TABS.map(t=>(
              <button key={t.id} className={`tab-btn ${activeTab===t.id?'tab-active':''}`} onClick={()=>setActiveTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {msg&&<div className={`msg ${msg.err?'msg-err':'msg-ok'}`}>{msg.text}</div>}

          {/* PERSON */}
          {activeTab==='person'&&(
            <div className="card" style={{padding:'var(--ps-pad-card)'}}>
              <div className="card-title" style={{marginBottom:16}}>Persönliche Daten</div>
              <div className="row2">
                <Field label="Vorname" value={vorname} onChange={setVorname} autoComplete="given-name" placeholder="Max"/>
                <Field label="Nachname" value={nachname} onChange={setNachname} autoComplete="family-name" placeholder="Mustermann"/>
              </div>
              <div className="row21">
                <Field label="Straße" value={strasse} onChange={setStrasse} autoComplete="street-address" placeholder="Musterstraße"/>
                <Field label="Nr." value={hausnummer} onChange={setHausnummer} placeholder="1a"/>
              </div>
              <div className="row12">
                <Field label="PLZ" value={plz} onChange={setPlz} autoComplete="postal-code" inputMode="numeric" placeholder="12345"/>
                <Field label="Ort" value={ort} onChange={setOrt} autoComplete="address-level2" placeholder="Berlin"/>
              </div>
              <Field label="Geburtsdatum" type="date" value={geburtsdatum} onChange={setGeburtsdatum} autoComplete="bday"/>
              <Field label="Telefon" type="tel" value={telefon} onChange={v=>handleTel(v,setTelefon)} autoComplete="tel" inputMode="tel" placeholder="+49 151 …"/>
              <Field label="Steuer-ID" value={steuerId} onChange={setSteuerId} inputMode="numeric" placeholder="11-stellige Steuer-ID"/>
              <Btn loading={saving} onClick={saveProfil} label="Speichern"/>
            </div>
          )}

          {/* BANK */}
          {activeTab==='bank'&&(
            <div className="card" style={{padding:'var(--ps-pad-card)'}}>
              <div className="card-title" style={{marginBottom:16}}>Bankverbindung</div>
              <Field label="Bank / Institut" value={bankName} onChange={setBankName} autoComplete="organization" placeholder="Deutsche Bank"/>
              <Field label="IBAN" value={iban} onChange={setIban} autoComplete="off" placeholder="DE00 …"/>
              <Field label="BIC" value={bic} onChange={setBic} autoComplete="off" placeholder="DEUTDEDB"/>
              <div className="note-box">
                Wird ausschließlich für Anschreiben-Vorlagen verwendet und nicht weitergegeben.
              </div>
              <Btn loading={saving} onClick={saveProfil} label="Speichern"/>
            </div>
          )}

          {/* MIETER */}
          {activeTab==='mieter'&&(
            <div>
              {mieter.map(m=>(
                <div key={m.id} className="card" style={{padding:'var(--ps-pad-card)',marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:15,fontWeight:700,color:'var(--ps-ink)'}}>{m.vorname} {m.nachname}</div>
                      {m.objekt_bezeichnung&&<div className="caption">{m.objekt_bezeichnung}</div>}
                      <div className="caption">{m.strasse} {m.hausnummer}{m.plz?' ·':''} {m.plz} {m.ort}</div>
                      {m.email&&<div className="caption" style={{color:'var(--ps-petrol)'}}>{m.email}</div>}
                      {m.telefon&&<div className="caption">{m.telefon}</div>}
                    </div>
                    <button onClick={()=>deleteMieter(m.id)} className="btn-ghost btn-sm btn-danger">✕</button>
                  </div>
                </div>
              ))}
              <div className="card" style={{padding:'var(--ps-pad-card)'}}>
                <div className="card-title" style={{marginBottom:14}}>Mieter hinzufügen</div>
                <div className="row2">
                  <Field label="Vorname *" value={mVorname} onChange={setMVorname} autoComplete="given-name" placeholder="Max"/>
                  <Field label="Nachname *" value={mNachname} onChange={setMNachname} autoComplete="family-name" placeholder="Muster"/>
                </div>
                <Field label="Objekt / Wohnung" value={mObjekt} onChange={setMObjekt} placeholder="EG links, Musterstr. 1"/>
                <div className="row21">
                  <Field label="Straße" value={mStrasse} onChange={setMStrasse} placeholder="Straße"/>
                  <Field label="Nr." value={mHausnummer} onChange={setMHausnummer} placeholder="1"/>
                </div>
                <div className="row12">
                  <Field label="PLZ" value={mPlz} onChange={setMPlz} inputMode="numeric" placeholder="12345"/>
                  <Field label="Ort" value={mOrt} onChange={setMOrt} placeholder="Berlin"/>
                </div>
                <Field label="E-Mail" type="email" value={mEmail} onChange={setMEmail} inputMode="email" placeholder="mieter@beispiel.de"/>
                <Field label="Telefon" type="tel" value={mTelefon} onChange={v=>handleTel(v,setMTelefon)} inputMode="tel" placeholder="+49 …"/>
                <button className="btn-primary btn-full" onClick={addMieter} disabled={!mVorname||!mNachname} style={{opacity:(!mVorname||!mNachname)?0.4:1}}>
                  Mieter hinzufügen
                </button>
              </div>
            </div>
          )}

          {/* KONTAKTE */}
          {activeTab==='kontakte'&&(
            <div>
              {kontakte.map(k=>(
                <div key={k.id} className="card" style={{padding:'var(--ps-pad-card)',marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                        <span className="cat-badge">{k.kategorie}</span>
                      </div>
                      <div style={{fontSize:15,fontWeight:700,color:'var(--ps-ink)'}}>{k.name}</div>
                      {k.organisation&&<div className="caption">{k.organisation}</div>}
                      {k.email&&<div className="caption" style={{color:'var(--ps-petrol)'}}>{k.email}</div>}
                      {k.telefon&&<div className="caption">{k.telefon}</div>}
                      {k.notiz&&<div className="caption" style={{fontStyle:'italic',marginTop:4}}>{k.notiz}</div>}
                    </div>
                    <button onClick={()=>deleteKontakt(k.id)} className="btn-ghost btn-sm btn-danger">✕</button>
                  </div>
                </div>
              ))}
              <div className="card" style={{padding:'var(--ps-pad-card)'}}>
                <div className="card-title" style={{marginBottom:4}}>Kontakt hinzufügen</div>
                <div className="caption" style={{marginBottom:14}}>Wird automatisch beim Anschreiben-Generator vorgeschlagen.</div>
                <div className="field-wrap">
                  <label className="field-label">Kategorie</label>
                  <select className="field-input" value={kKat} onChange={e=>setKKat(e.target.value)}>
                    {KONTAKT_KATEGORIEN.map(k=><option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <Field label="Name *" value={kName} onChange={setKName} placeholder="Dr. Klaus Hoffmann"/>
                <Field label="Organisation / Praxis" value={kOrg} onChange={setKOrg} placeholder="Praxis Dr. Hoffmann"/>
                <Field label="E-Mail" type="email" value={kEmail} onChange={setKEmail} inputMode="email" placeholder="kontakt@praxis.de"/>
                <Field label="Telefon" type="tel" value={kTelefon} onChange={v=>handleTel(v,setKTelefon)} inputMode="tel" placeholder="+49 208 …"/>
                <Field label="Notiz" value={kNotiz} onChange={setKNotiz} placeholder="Mein Hausarzt seit 2010"/>
                <button className="btn-primary btn-full" onClick={addKontakt} disabled={!kName} style={{opacity:!kName?0.4:1}}>
                  Kontakt hinzufügen
                </button>
              </div>
            </div>
          )}

          {/* IMAP */}
          {activeTab==='imap'&&(
            <div className="card" style={{padding:'var(--ps-pad-card)'}}>
              <div className="card-title" style={{marginBottom:4}}>E-Mail Postfach verbinden</div>
              <div className="caption" style={{marginBottom:16}}>PostScout liest täglich neue Mails automatisch — Anhänge werden ebenfalls gespeichert.</div>

              <div className="provider-grid">
                {IMAP_PROVIDERS.map(p=>(
                  <button key={p.host} className={`provider-btn ${imapHost===p.host?'provider-active':''}`} onClick={()=>setImapHost(p.host)}>
                    {p.label}
                  </button>
                ))}
              </div>

              <Field label="IMAP Server" value={imapHost} onChange={setImapHost} autoCapitalize="none" autoCorrect="off"/>
              <Field label="E-Mail Adresse" type="email" value={imapUser} onChange={setImapUser} autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" placeholder="deine@email.de"/>
              <Field label="App-Passwort" type="password" value={imapPass} onChange={setImapPass} autoComplete="current-password" placeholder="App-Passwort (nicht dein normales)"/>

              <div className="note-box" style={{marginBottom:16}}>
                T-Online: mein.t-online.de → Sicherheit → App-Passwörter<br/>
                Gmail: Google-Konto → Sicherheit → 2FA → App-Passwörter
              </div>

              <div style={{display:'flex',gap:8,marginBottom:imapSaved?12:0}}>
                <button className="btn-secondary" style={{flex:1}} onClick={testImap} disabled={imapTesting||!imapUser||!imapPass}>
                  {imapTesting?'Teste…':'Verbindung testen'}
                </button>
                <button className="btn-primary" style={{flex:1}} onClick={saveImap} disabled={saving||!imapUser||!imapPass}>
                  {saving?'Speichern…':'Speichern'}
                </button>
              </div>

              {imapSaved&&(
                <div className="msg msg-ok">IMAP verbunden — PostScout synct täglich automatisch</div>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap');
        :root {
          --ps-petrol:#1F3A52; --ps-petrol-pressed:#16304A;
          --ps-petrol-tint:#EAF0F4; --ps-petrol-tint-bd:#BBD0DE;
          --ps-bg:#FBFAF8; --ps-surface:#FFFFFF; --ps-subtle:#F4F2EC;
          --ps-ink:#1A1712; --ps-muted:#7C786E; --ps-faint:#9A968B;
          --ps-border:#E0DDD3; --ps-hairline:#EFEDE6;
          --ps-signal:#F97316;
          --ps-overdue:#B3402C; --ps-overdue-bg:#FBEAE7;
          --ps-done:#2E7D46; --ps-done-bg:#E9F0E9;
          --ps-medium:#8A5A12; --ps-medium-bg:#FBF4E6;
          --ps-font:"Figtree",system-ui,-apple-system,sans-serif;
          --ps-r-chip:11px; --ps-r-button:14px; --ps-r-card:16px; --ps-r-sheet:30px;
          --ps-pad-page:24px; --ps-pad-card:16px;
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--ps-font);background:var(--ps-bg);color:var(--ps-ink);-webkit-font-smoothing:antialiased;min-height:100vh}
        input,button,select{font-family:inherit}

        .shell{max-width:430px;margin:0 auto;min-height:100vh;background:var(--ps-bg)}
        .content{padding:16px var(--ps-pad-page) 48px}

        /* Header */
        .top-bar{background:var(--ps-petrol);padding:14px var(--ps-pad-page);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
        .top-title{font-size:17px;font-weight:700;color:#fff;letter-spacing:-0.3px}
        .back-chip{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,0.12);border:none;border-radius:20px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer}

        /* Tabs */
        .tab-bar{display:flex;gap:0;background:var(--ps-subtle);border-radius:var(--ps-r-chip);padding:3px;margin-bottom:16px;overflow-x:auto}
        .tab-btn{flex:1;padding:7px 6px;border-radius:9px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:transparent;color:var(--ps-muted);white-space:nowrap;transition:background 120ms,color 120ms;font-family:inherit}
        .tab-active{background:var(--ps-surface);color:var(--ps-ink);box-shadow:0 1px 3px rgba(0,0,0,0.08)}

        /* Card */
        .card{background:var(--ps-surface);border-radius:var(--ps-r-card);border:1px solid var(--ps-hairline)}
        .card-title{font-size:18px;font-weight:700;color:var(--ps-ink)}

        /* Fields */
        .field-wrap{margin-bottom:12px}
        .field-label{font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--ps-faint);display:block;margin-bottom:6px}
        .field-input{width:100%;padding:11px 13px;border-radius:var(--ps-r-chip);border:1.5px solid var(--ps-border);background:var(--ps-subtle);color:var(--ps-ink);font-size:15px;font-weight:500;transition:border-color 150ms,background 150ms;font-family:inherit}
        .field-input:focus{outline:none;border-color:var(--ps-petrol);background:var(--ps-surface)}

        /* Layout grids */
        .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .row21{display:grid;grid-template-columns:2fr 1fr;gap:10px}
        .row12{display:grid;grid-template-columns:1fr 2fr;gap:10px}

        /* Buttons */
        .btn-primary{display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;border-radius:var(--ps-r-button);border:none;background:var(--ps-petrol);color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:background 120ms;font-family:inherit}
        .btn-primary:hover{background:var(--ps-petrol-pressed)}
        .btn-primary:disabled{opacity:0.45;cursor:not-allowed}
        .btn-full{width:100%;margin-top:4px}
        .btn-secondary{display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;border-radius:var(--ps-r-button);border:1.5px solid var(--ps-border);background:var(--ps-surface);color:var(--ps-ink);font-size:15px;font-weight:600;cursor:pointer;transition:background 120ms;font-family:inherit}
        .btn-secondary:hover{background:var(--ps-subtle)}
        .btn-secondary:disabled{opacity:0.4;cursor:not-allowed}
        .btn-ghost{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:var(--ps-r-chip);border:1px solid var(--ps-border);background:transparent;color:var(--ps-muted);font-size:12px;cursor:pointer;font-weight:500;font-family:inherit}
        .btn-sm{padding:5px 9px;font-size:12px}
        .btn-danger:hover{background:var(--ps-overdue-bg);color:var(--ps-overdue);border-color:#f5c0b6}

        /* Provider grid */
        .provider-grid{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
        .provider-btn{padding:7px 13px;border-radius:var(--ps-r-pill);border:1.5px solid var(--ps-border);background:var(--ps-surface);color:var(--ps-muted);font-size:12px;font-weight:600;cursor:pointer;transition:all 120ms;font-family:inherit}
        .provider-active{background:var(--ps-petrol);color:#fff;border-color:var(--ps-petrol)}

        /* Misc */
        .caption{font-size:13px;color:var(--ps-muted);line-height:1.5}
        .note-box{font-size:12px;color:var(--ps-muted);background:var(--ps-subtle);border-radius:var(--ps-r-chip);padding:10px 12px;line-height:1.6;margin-bottom:14px}
        .cat-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:var(--ps-r-pill);background:var(--ps-petrol-tint);color:var(--ps-petrol)}
        .msg{border-radius:var(--ps-r-chip);padding:10px 13px;font-size:13px;margin-bottom:12px;font-weight:500}
        .msg-err{background:var(--ps-overdue-bg);color:var(--ps-overdue);border:1px solid #f5c0b6}
        .msg-ok{background:var(--ps-done-bg);color:var(--ps-done);border:1px solid #b8d9c0}

        @media(max-width:400px){.row2,.row21,.row12{grid-template-columns:1fr}}
      `}</style>
    </>
  )
}

// Reusable field component – flat state, no focus loss
function Field({ label, value, onChange, type='text', placeholder='', autoComplete, autoCapitalize, autoCorrect, inputMode }) {
  return (
    <div className="field-wrap">
      <label className="field-label">{label}</label>
      <input
        className="field-input" type={type} value={value||''} placeholder={placeholder}
        autoComplete={autoComplete} autoCapitalize={autoCapitalize} autoCorrect={autoCorrect}
        inputMode={inputMode} onChange={e=>onChange(e.target.value)}
      />
    </div>
  )
}

function Btn({ onClick, loading, label }) {
  return (
    <button className="btn-primary btn-full" onClick={onClick} disabled={loading}>
      {loading?'Speichern…':label}
    </button>
  )
}
