# PostScout – Setup & Deployment

Komplette Anleitung: von 0 zum laufenden Vercel-Deployment.

---

## Was du brauchst (Voraussetzungen)

- [Node.js](https://nodejs.org) (v18+)
- [Git](https://git-scm.com)
- [GitHub Account](https://github.com) (kostenlos)
- [Vercel Account](https://vercel.com) (kostenlos)
- [Supabase Account](https://supabase.com) (kostenlos)
- [Anthropic API Key](https://console.anthropic.com) (~$5 Guthaben reicht Monate)

---

## Schritt 1 – Supabase einrichten (5 min)

### 1.1 Projekt anlegen
1. Geh zu [supabase.com](https://supabase.com) → **New Project**
2. Name: `postscout`
3. Region: **eu-central-1** (Frankfurt – DSGVO-konform)
4. Passwort merken (brauchst du selten)
5. Warte ~2 Minuten bis das Projekt bereit ist

### 1.2 Datenbank einrichten
1. Geh zu **SQL Editor** → **New Query**
2. Kopiere den gesamten Inhalt aus `supabase-schema.sql` (liegt im Projekt-Root)
3. Klicke **Run** (grüner Button oben rechts)
4. Erfolgsmeldung sollte erscheinen ✓

### 1.3 Keys kopieren
Geh zu **Project Settings** → **API** und notiere:
- `Project URL` → sieht aus wie `https://abcxyz.supabase.co`
- `anon public` Key → langer String

---

## Schritt 2 – Anthropic API Key (2 min)

1. Geh zu [console.anthropic.com](https://console.anthropic.com)
2. **API Keys** → **Create Key**
3. Key kopieren und sicher aufbewahren (nur einmal sichtbar!)
4. Guthaben aufladen: Settings → Billing → $5–10 reichen für den Start

---

## Schritt 3 – Projekt lokal einrichten (3 min)

```bash
# 1. Dependencies installieren
npm install

# 2. Umgebungsvariablen anlegen
cp .env.local.example .env.local

# 3. .env.local öffnen und Keys eintragen:
```

Öffne `.env.local` und trage deine Keys ein:

```
NEXT_PUBLIC_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=DEIN-ANON-KEY
ANTHROPIC_API_KEY=sk-ant-DEIN-KEY
```

```bash
# 4. Lokal testen
npm run dev
# → App läuft auf http://localhost:3000
```

---

## Schritt 4 – GitHub Repository anlegen (2 min)

```bash
# Im Projekt-Ordner:
git init
git add .
git commit -m "PostScout initial commit"

# Neues GitHub Repo anlegen: github.com → New Repository → postscout
# Dann:
git remote add origin https://github.com/DEIN-USERNAME/postscout.git
git branch -M main
git push -u origin main
```

---

## Schritt 5 – Vercel deployen (3 min)

### 5.1 Projekt importieren
1. Geh zu [vercel.com](https://vercel.com) → **Add New** → **Project**
2. GitHub Repository `postscout` auswählen → **Import**
3. Framework: **Next.js** (wird automatisch erkannt)

### 5.2 Environment Variables eintragen ← WICHTIG
Vor dem Deploy unter **Environment Variables** alle drei eintragen:

| Variable | Wert |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dein-projekt.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dein Supabase Anon Key |
| `ANTHROPIC_API_KEY` | `sk-ant-...` (bleibt serverseitig!) |

### 5.3 Deployen
Klicke **Deploy** → nach ~1 Minute läuft die App unter `postscout.vercel.app` ✓

---

## Schritt 6 – Supabase Auth konfigurieren (1 min)

Damit E-Mail-Bestätigung funktioniert:
1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL**: `https://postscout.vercel.app` (deine Vercel URL)
3. **Redirect URLs**: `https://postscout.vercel.app/**`
4. **Save**

---

## Fertig!

Deine App ist live. Registriere dich, lade einen Brief hoch – fertig.

### Weitere Updates deployen
```bash
git add .
git commit -m "Änderung beschreiben"
git push
# Vercel deployed automatisch bei jedem Push auf main ✓
```

---

## Sicherheit – was du wissen musst

| Was | Wo | Sicher? |
|---|---|---|
| Supabase URL | Frontend (NEXT_PUBLIC_) | ✓ Öffentlich ok |
| Supabase Anon Key | Frontend (NEXT_PUBLIC_) | ✓ Öffentlich ok, RLS schützt Daten |
| **Anthropic API Key** | **Nur Server (kein NEXT_PUBLIC_)** | ✓ **Nie im Browser sichtbar** |

Der Claude API Key wird ausschließlich in `/api/analyze` (serverseitig) verwendet. Kein Nutzer kann ihn auslesen.

---

## Kosten (Übersicht)

| Service | Free Tier | Danach |
|---|---|---|
| Vercel | 100GB Bandwidth/Monat | ab $20/Monat |
| Supabase | 500MB DB, 1GB Storage | ab $25/Monat |
| Anthropic | – | ~$0.003 pro Brief |

Für den Familien-MVP: **komplett kostenlos**.
