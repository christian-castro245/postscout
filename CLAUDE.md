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

### `headerRight: () => null` in _layout.tsx killt navigation.setOptions()
**Fall:** Hamburger-Menü war in `home.tsx` via `navigation.setOptions({ headerRight: ... })` korrekt gesetzt, aber in `_layout.tsx` stand `headerRight: () => null` beim Home-Screen. Bei jedem Tab-Re-Render hat das Layout den Button überschrieben.
**Fix:** Nie `headerRight: () => null` explizit setzen wenn der Screen den Wert selbst per `setOptions` setzt. Einfach weglassen.
```tsx
// ❌ FALSCH — überschreibt setOptions() aus dem Screen bei jedem Re-Render
<Tabs.Screen name="home" options={{ headerTitle: 'Postklar', headerRight: () => null }} />

// ✅ RICHTIG — Screen setzt headerRight selbst via useNavigation().setOptions()
<Tabs.Screen name="home" options={{ headerTitle: 'Postklar' }} />
```
**Lesson:** `headerRight` nur im `_layout.tsx` setzen ODER nur im Screen via `setOptions` — nie beides, der Layout-Wert gewinnt bei Re-Renders.

### useNavigation().setOptions() in useEffect ist unzuverlässig in Expo Router v5
**Fall:** Hamburger-Menü wurde per `useNavigation().setOptions()` in einem `useEffect` gesetzt. Das feuert erst nach dem ersten Render (async) und kann in bestimmten Situationen nicht ankommen oder überschrieben werden. Button erschien nie im Build.
**Fix:** Stattdessen `<Tabs.Screen options={...}>` direkt im JSX des Screen-Components verwenden. Wird synchron beim Rendern ausgewertet, kein Timing-Problem.
```tsx
// ❌ UNZUVERLÄSSIG — async, kann überschrieben werden
const navigation = useNavigation()
useEffect(() => {
  navigation.setOptions({ headerRight: () => <MenuBtn /> })
}, [navigation])

// ✅ RICHTIG — Expo Router v5 idiomatisch, immer zuverlässig
import { Tabs } from 'expo-router'

return (
  <>
    <Tabs.Screen options={{ headerRight: () => <MenuBtn onPress={() => setMenuOpen(true)} /> }} />
    {/* rest of screen */}
  </>
)
```
**Lesson:** In Expo Router v5 Header-Optionen die Screen-State benötigen immer via `<Tabs.Screen options>` im JSX setzen — nie via `useNavigation().setOptions()` in `useEffect`.

### EAS Build sieht keine lokalen Code-Änderungen
**Lesson:** Jede Codeänderung muss committed + gepusht sein UND ein neuer EAS Build gestartet werden. Änderungen werden im TestFlight-Build erst sichtbar nach `eas build --platform ios --profile production` + `eas submit`. Kein Hot-Reload in Production-Builds.

### Supabase auth — "invalid login credentials" ≠ falsches Projekt
**Fall:** Webapp zeigte "invalid login credentials", obwohl dieselben Credentials in der App funktioniert haben. Root-Cause war einfach das falsche Passwort in der Webapp — nicht ein anderer Supabase-Tenant.
**Diagnosis-Weg:** `query_logs` MCP-Tool auf dem Supabase-Projekt prüfen — wenn fehlgeschlagene Logins dort auftauchen, ist das Projekt korrekt verbunden.
**Lesson:** Bevor Supabase-Verbindungsprobleme vermutet werden, Logs prüfen. Fehlende "Passwort vergessen"-Funktion ist oft der echte Grund.

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
- **KRITISCH: EAS-Umgebungsvariablen müssen VOR dem ersten Production Build gesetzt werden** (siehe Abschnitt unten)

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
- `deploymentTarget` gehört NICHT in app.json bei Managed Workflow — Expo setzt das selbst; führt zu expo doctor Fehler wenn vorhanden
- `owner: "fid3l72"` — von `eas init` gesetzt, muss bleiben

### Xcode 26 / App Store Anforderung (ab April 2026)
Apple verlangt seit 28. April 2026 Xcode 26 für App Store Uploads.
- **SDK 54+**: automatisch abgedeckt (default EAS Image = Xcode 26)
- **SDK 53**: explizit `"image": "macos-sequoia-15.6-xcode-26.2"` setzen — `"image": "latest"` reicht NICHT, nimmt trotzdem Xcode 16
- Kompatibilität hängt von den verwendeten Libraries ab — bei Problemen auf SDK 54 upgraden
- Empfehlung: mittelfristig auf SDK 54 upgraden

eas.json production-Profil muss so aussehen:
```json
"production": {
  "autoIncrement": true,
  "ios": {
    "image": "macos-sequoia-15.6-xcode-26.2"
  }
}
```

### App Store Connect — IDs & Credentials
- ASC App ID: `6803428760`
- Bundle ID: `de.postklar.app`
- API Key: `K5JZ75GXPM` ([Expo] EAS Submit KGT_Z7huNA) — auf EAS Servern gespeichert
- Distribution Cert Serial: `163850FAB84364D3C2AB70167DEFA646` (läuft Aug 2027 ab)
- TestFlight URL: `https://appstoreconnect.apple.com/apps/6803428760/testflight/ios`

### EAS Umgebungsvariablen — PFLICHT vor erstem Build

**.env-Dateien werden NICHT in EAS-Builds übertragen** (gitignored). Ohne diese Variablen stürzt die App sofort beim Start ab.

**Einmalige Einrichtung (lokal in `mobile/`):**
```bash
# Neuer Befehl (eas env:create ist deprecated):
eas env:set --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://pcwzmdrfyilmogmvdwet.supabase.co" --environment production
eas env:set --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjd3ptZHJmeWlsbW9nbXZkd2V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzU0MzgsImV4cCI6MjA5ODA1MTQzOH0.AfPs5b-IgmnWOrBB7rVAmtXSc1X1Yw5o5QGYQXukw60" --environment production
eas env:set --scope project --name EXPO_PUBLIC_API_URL --value "https://postscout-beige.vercel.app" --environment production
```
Danach prüfen: `eas env:list --scope project`

**Wichtig:**
- Bei `eas env:create` (deprecated) → wähle "production" im interaktiven Prompt
- Sichtbarkeit: `plaintext` (nicht secret, da EXPO_PUBLIC_ sowieso im Bundle sichtbar)
- Nach dem Setzen muss ein neuer Build gestartet werden — bestehende Builds laden keine neuen Env Vars
- Diese Variablen sind im EAS-Dashboard unter expo.dev sichtbar und editierbar

**Fehler-Absicherung im Code:**
`mobile/lib/supabase.ts` exportiert `supabaseConfigured: boolean`.
`mobile/app/_layout.tsx` zeigt roter Fehlerscreen statt Crash wenn Variablen fehlen.

### EAS Build & Submit Workflow (vollständig)
```bash
cd ~/postscout/mobile
git pull                               # erst pullen
npx expo install --fix                 # Pakete auf SDK-Version angleichen
git add package.json package-lock.json app.json eas.json
git commit -m "..."
git push

# Preview (Ad-hoc, kein TestFlight, Entwicklermodus auf iPhone nötig):
eas build --platform ios --profile preview

# Production (TestFlight / App Store):
eas build --platform ios --profile production
eas submit --platform ios              # wähle "Select a build from EAS"
```

### Bekannte EAS / Pod Fehler & Fixes

**"Install pods — Unknown error"**  
→ Fast immer falsche Paketversionen. `npx expo install --fix` ausführen.  
→ Root-Ursache: package.json hatte SDK 52-Pakete (React 18, RN 0.76) obwohl expo SDK 53 braucht React 19 + RN 0.79.  
→ Wenn Fehler `ReactAppDependencyProvider`: `newArchEnabled: false` in app.json setzen.

**expo doctor Fehler: "should NOT have additional property 'deploymentTarget'"**  
→ `deploymentTarget` darf NICHT in app.json stehen bei Managed Workflow. Entfernen.

**expo doctor Fehler: "Missing peer dependency expo-constants"**  
→ `npx expo install expo-constants` ausführen.

**App stürzt sofort nach Start ab (keine Fehlermeldung)**
→ Root-Ursache: `EXPO_PUBLIC_SUPABASE_URL` oder `EXPO_PUBLIC_SUPABASE_ANON_KEY` nicht in EAS gesetzt.
→ `.env`-Dateien sind gitignored → kommen NICHT in den EAS-Build.
→ Fix: `eas env:set --scope project --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "..."` (und ANON_KEY + API_URL).
→ Danach zwingend neuen Build starten. Der Code in `lib/supabase.ts` fängt dies jetzt ab: `supabaseConfigured` ist `false` → roter Fehlerscreen statt Crash.

**Apple rejects build: ITMS-90725 SDK version issue**  
→ `"image": "latest"` in eas.json nimmt trotzdem Xcode 16.  
→ Fix: explizit `"image": "macos-sequoia-15.6-xcode-26.2"` in `eas.json production.ios`.

**Merge-Konflikt in app.json nach git stash pop**  
Passiert wenn `eas init` lokal läuft und parallel Änderungen remote gepusht wurden.  
Fix: Conflict-Marker manuell entfernen, beide Seiten mergen, dann:
```bash
git add app.json && git stash drop
```
Wichtig nach Merge behalten: `owner`, `router.origin`, EAS projectId.  
Nicht behalten: `deploymentTarget` (invalid), Conflict-Marker.

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
