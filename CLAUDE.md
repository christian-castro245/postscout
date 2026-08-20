# PostScout — Claude Arbeitsgedächtnis

## Projekt-Überblick

PostScout ist eine **mobile-first PWA** für digitales Briefmanagement.
- Next.js Pages Router (kein App Router), max-width 430px Shell
- Supabase (Auth + DB + Storage)
- CSS-in-JS via `<style jsx global>` in `pages/index.js`
- Figtree Font (Google Fonts), Inline-SVG Icons (Lucide-Stil, strokeWidth 1.6)
- Deploy: Push auf `main` → Vercel Produktion automatisch

---

## Design-System & Christian's UI-Vorlieben

### Farben (nicht abweichen)
```
Primär:      #1F3A52  (Petrol)
Pressed:     #16304A
Tint:        #EAF0F4  / Border: #BBD0DE
Hintergrund: #FBFAF8  (Off-White)
Surface:     #FFFFFF
Subtle:      #F4F2EC
Ink:         #1A1712
Muted:       #7C786E
Faint:       #9A968B
Border:      #E0DDD3
Hairline:    #EFEDE6
Signal:      #F97316  (Orange)
Überfällig:  #B3402C / #FBEAE7
Dringend:    #C2410C / #FBF0E8
Mittelfristig: #8A5A12 / #FBF4E6
Erledigt:    #2E7D46 / #E9F0E9
```

### Stil-Prinzipien
- **Leicht und aufgeräumt** — großzügige Abstände, keine überladenen Screens
- **Karten** (border-radius 16px, 1px solid #EFEDE6, leichter box-shadow)
- **Bottom Sheet Modals** (niemals Center-Modals auf Mobile)
- **Glass-Morphism Bottom Nav**: `rgba(251,250,248,0.97)`, backdrop-filter blur(20px), active pill in Petrol-Tint
- **Collapsible Sections** für nicht-dringende Inhalte (Mittelfristig + Zur Kenntnis collapsed by default)
- **Hamburger-Menü** (≡) nur für sekundäre Features (Archiv, Familie, Kontakte, Export, Profil)
- **Transitions**: 120–350ms, niemals > 400ms
- **Keine Emojis in Code oder Commit-Messages** — nur in Kategorien/UI-Labels wenn nötig
- **Keine Kommentare** im Code außer bei nicht-offensichtlichem Warum

### Sprache
- **Gesamte App auf Deutsch** — alle Labels, Meldungen, Fehler, Buttons
- Direkte, knappe Sprache (kein "Bitte warten Sie…", lieber "Wird geladen…")

### Typografie-Regeln
- Overline: 11px, weight 700, letter-spacing 0.1em, uppercase, color #B6B2A6
- Caption: 13px, weight 500, color #7C786E
- Card-Title: 15px, weight 700
- Body: 14–15px, weight 500

---

## Architektur-Wissen

### Seiten
- `pages/index.js` — Haupt-App (1400+ Zeilen), alle Views über `view` State
- `pages/profil.js` — Profil-Seite, eigene Route `/profil`
- `pages/aufgaben.js` — Dedizierte Aufgaben-Seite
- `pages/scannen.js` — Dedizierter Scanner

### State-Pattern in index.js
```js
const [view, setView] = useState('home')
// Views: 'home', 'scan', 'archiv', 'familie', 'export', 'todos'
const isOwner = !ownerView   // false wenn User als Familienmitglied fremden Account sieht
const canEdit = !ownerView || myPermission === 'abhaken' || myPermission === 'notizen'
```

### Profil/Name-Logik (hinzugefügt)
```js
// Greeting-Logik:
// anrede='du'             → "Guten Tag, {vorname}"
// anrede='Herr'/'Frau' + nachname → "Guten Tag, Herr/Frau {nachname}"
// anrede='Herr'/'Frau', kein nachname → "Guten Tag, {vorname}"
// Fallback wenn kein Profil: email.split('@')[0]
```

### Supabase-Tabellen (relevant)
- `profiles`: id, vorname, nachname, anrede (neu!), strasse, plz, ort, geburtsdatum, telefon, steuer_id, bank_name, iban, bic
- `dokumente`: user_id, absender, kategorie, dringlichkeit, todos (jsonb), zusammenfassung, betrag, frist, steuerrelevant, storage_path, quelle
- `familien_zugang`: inhaber_id, mitglied_id, mitglied_email, berechtigung, aktiv, invite_token
- `scan_tokens`: inhaber_id, token, label, aktiv
- `reminder_settings`: user_id, frequenz, uhrzeit_utc, nur_dringende, aktiv
- `kontakte`: user_id, kategorie, name, organisation, email, telefon, notiz

---

## Bekannte Bugs — noch offen

### 1. signOut() setzt Profil-State nicht zurück
**Problem:** `profVorname`, `profNachname`, `profAnrede` werden bei Logout nicht geleert.
**Folge:** Nach Logout und Re-Login mit anderem Account kurzes Aufblitzen des alten Namens.
**Fix:**
```js
async function signOut() {
  await supabase.auth.signOut()
  setDocs([]); setAllTodos([]); setPhotos([]); setFamilyMembers([])
  setOwnerView(null); setView('home')
  setProfVorname(''); setProfNachname(''); setProfAnrede('du')  // ← fehlt noch
}
```

### 2. profil.js sendInvite verschickt keine E-Mail
**Problem:** Die neue `sendInvite`-Funktion in `profil.js` (Freigaben-Tab) schreibt nur in `familien_zugang`, ruft aber `/api/invite` nicht auf.
**Folge:** Eingeladene Person bekommt keine E-Mail.
**Fix:** Nach DB-Insert `fetch('/api/invite', {...})` analog zu `index.js` ergänzen.

### 3. Neue User sehen Email-Prefix statt Namen
**Problem:** `loadMyProfile` gibt bei fehlendem `profiles`-Eintrag nichts zurück. Das passiert bei Neu-Registrierung bevor das Profil ausgefüllt wurde.
**Fix:** Nach Registration einen leeren `profiles`-Eintrag anlegen, oder Onboarding-Hinweis im Dashboard zeigen wenn `profVorname === ''`.

---

## Gemachte Fehler — nie wieder

### React-Anti-Pattern: Komponente in IIFE in JSX definieren
```jsx
// ❌ FALSCH — gemacht bei der Kamera-Overlay
{cameraOpen && (() => {
  const Corner = ({ top }) => <div>...</div>
  return <div><Corner top={0}/></div>
})()}

// ✅ RICHTIG — Computed-Werte aus JSX rausziehen, Markup direkt inlinen
const camColor = scanQuality === 'good' ? '#22c55e' : '...'
// Dann Corner-Marker direkt als 4× wiederholtes JSX inline
```

### CSS-Positionierungsfehler bei dynamisch gesetzten Inline-Styles
```jsx
// ❌ FALSCH — Konflikt: left:0 IMMER gesetzt, dann nochmal dynamisch
<div style={{ left:0, [isRight?'right':'left']: 0 }}/>
// → für rechte Ecken: { left:0, right:0 } → Element streckt sich voll

// ✅ RICHTIG — Vollständige spread-Logik ohne Konflikte
<div style={{ ...(isRight ? {right:0} : {left:0}), width:22, height:3 }}/>
```

### Feature-Scope beim Refactoring falsch interpretiert
**Fall:** Hamburger-Menü „Familie" → erst in „Familienfreigabe" umbenannt und auf `/profil#freigaben` verlinkt. User wollte aber: gleicher Name, gleicher Inhalt wie Footer-Tab.
**Lesson:** Wenn User sagt „gleiches wie X", immer nachfragen OB Name und Ziel identisch sein sollen, nicht interpretieren.

### Invitation-Flow beim Umzug von Index → Profil vergessen
**Fall:** `sendInvite` aus `index.js` nach `profil.js` kopiert, aber den `/api/invite`-API-Call vergessen. Nur DB-Teil kopiert.
**Lesson:** Bei Funktions-Umzug zwischen Dateien immer alle Side-Effects (API-Calls, state-Updates, loadXxx-Calls) checken.

### State nicht bei signOut zurückgesetzt
**Lesson:** Jedes neue `useState` muss in `signOut()` explizit auf den Default-Wert zurückgesetzt werden.

---

## Kommunikations-Stil (Christian's Präferenzen)

- **Kurz und direkt** — keine langen Einleitungen, kein Nacherzählen was man tut
- **Keine Bestätigungen** wie "Natürlich! Ich werde jetzt..." — einfach machen
- **Am Ende**: 2 Sätze was geändert wurde und was als nächstes kommen könnte
- **Fehler ehrlich benennen** — er schätzt direkte Bug-Reports mehr als Beschönigung
- **Deployment immer zu main** pushen (Vercel deployt automatisch)
- **Branch-Pattern**: Feature auf `claude/...`-Branch, dann Fast-Forward-Merge nach main
- **Sprache mit Claude**: Deutsch — Code, Commits und Variablennamen auf Englisch
- **Commit-Messages auf Englisch**, präzise, mit `feat:` / `fix:` Prefix

---

## Mobile App (Expo / EAS) — Architektur & Wissen

### Stack
- Expo SDK 53 · React Native 0.79 · React 19 · Expo Router 5
- Datei: `mobile/` — eigenständiges npm-Projekt mit eigenem `package.json`
- EAS Build für iOS TestFlight (Managed Workflow, kein `ios/`-Ordner im Repo)
- EAS Project: `@fid3l72/postklar`, Bundle ID: `de.postklar.app`, Team: `865WV2UH4Z`
- Supabase-Credentials: in `mobile/.env` (nicht committed), EXPO_PUBLIC_ Prefix

### Kritische Versionsregeln (nie manuell ändern)
```
react:              19.0.0        ← SDK 53, NICHT 18.x
react-native:       0.79.x        ← SDK 53, NICHT 0.76.x
expo-router:        ~5.x          ← SDK 53, NICHT 4.x
```
**Nach JEDER Paketänderung in `mobile/`:** `npx expo install --fix` ausführen.  
Nie `react`, `react-native` oder `expo-router` manuell pinnen ohne `expo install --fix`.

### app.json Pflicht-Felder
```json
{
  "expo": {
    "newArchEnabled": false,
    "ios": {
      "deploymentTarget": "15.1",
      "supportsTablet": true
    },
    "orientation": "default",
    "owner": "fid3l72",
    "extra": {
      "eas": { "projectId": "b6e8fb5e-e092-4308-8ba3-bb4f74e3b35a" },
      "router": { "origin": false }
    }
  }
}
```
- `newArchEnabled: false` — verhindert `ReactAppDependencyProvider`-Pod-Fehler
- `deploymentTarget: "15.1"` — React Native 0.76+ Minimum, ohne es schlägt CocoaPods lautlos fehl
- `owner: "fid3l72"` — von `eas init` gesetzt, muss bleiben

### Xcode 26 / App Store Anforderung (ab April 2026)
Apple verlangt seit 28. April 2026 Xcode 26 für App Store Uploads.
- **SDK 54+**: automatisch abgedeckt (default EAS Image = Xcode 26)
- **SDK 53**: `"image": "macos-sequoia-15.6-xcode-26.2"` in `eas.json` unter `production.ios` setzen
- Kompatibilität hängt von den verwendeten Libraries ab — bei Problemen auf SDK 54 upgraden
- Empfehlung: mittelfristig auf SDK 54 upgraden

```json
"production": {
  "autoIncrement": true,
  "ios": {
    "image": "macos-sequoia-15.6-xcode-26.2"
  }
}
```

### EAS Build Workflow
```bash
cd ~/postscout/mobile
git pull                          # erst pullen
npx expo install --fix            # falls package.json geändert
git add package.json package-lock.json app.json
git commit -m "..."
git push
eas build --platform ios --profile preview
```

### Bekannte EAS / Pod Fehler & Fixes

**"Install pods — Unknown error"**  
→ Fast immer Paketversionen falsch. `npx expo install --fix` ausführen.  
→ Wenn Fehler `ReactAppDependencyProvider`: `newArchEnabled: false` in app.json.  
→ Wenn Fehler `deploymentTarget`-Konflikt: `"deploymentTarget": "15.1"` in ios-Block.

**Merge-Konflikt in app.json nach git stash pop**  
Passiert wenn `eas init` lokal läuft und parallel Änderungen remote gepusht wurden.  
Fix: Conflict-Marker manuell entfernen, beide Seiten mergen (upstream + stash), dann:
```bash
git add app.json && git stash drop
```
Wichtig: `owner`, `router.origin`, EAS projectId und `deploymentTarget` alle behalten.

**Versionen die `eas init` lokal hinzufügt (gehören in app.json)**
- `"owner": "fid3l72"`
- `"extra.router": { "origin": false }`
- `"extra.eas.projectId": "b6e8fb5e-e092-4308-8ba3-bb4f74e3b35a"`

---

## Next.js / Vercel — Bekannte Fallen

### `serverExternalPackages` ist Next.js 15 Syntax
In diesem Projekt läuft **Next.js 14.2.x**. Die korrekte Methode um ein Paket vom webpack-Bundling auszuschließen:
```js
// next.config.js — RICHTIG für Next.js 14:
webpack: (config, { isServer }) => {
  if (isServer) {
    config.externals = [...(Array.isArray(config.externals) ? config.externals : []), '@aws-sdk/client-bedrock-runtime']
  }
  return config
}

// FALSCH — serverExternalPackages existiert erst in Next.js 15:
// serverExternalPackages: ['@aws-sdk/client-bedrock-runtime']
```

### `@aws-sdk/client-bedrock-runtime` muss in dependencies stehen
Das Paket ist in `lib/analyse/bedrockEu.js` per `await import(...)` geladen.  
Webpack externalisiert es (wird nicht gebundelt), aber Vercel braucht es in `node_modules`.  
→ `package.json` (Root): `"@aws-sdk/client-bedrock-runtime": "^3.700.0"` muss drin stehen.

---

## Offene To-Dos (aus Diskussion bekannt)

- [ ] Bug: signOut() Profil-State nicht zurückgesetzt
- [ ] Bug: profil.js sendInvite schickt keine E-Mail
- [ ] Bug: Neue User sehen Email-Prefix statt Namen (kein Profil-Eintrag)
- [ ] Feature: Fälligkeits-Kalender (Todos mit Frist in Kalender-Ansicht)
- [ ] Feature: Erinnerungen-Übersicht als eigene Seite
- [ ] Feature: Onboarding-Flow nach Registrierung (Name/Anrede sofort setzen)
- [ ] Feature: Push Notifications (Web Push API) für dringende Todos
