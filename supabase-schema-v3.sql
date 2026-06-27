-- ─────────────────────────────────────────────────────────────────────────────
-- PostScout – Schema v3
-- Personenprofil + Mieter + IMAP Settings
-- Ausführen: Supabase → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Personenprofil erweitern
alter table profiles add column if not exists vorname text;
alter table profiles add column if not exists nachname text;
alter table profiles add column if not exists strasse text;
alter table profiles add column if not exists hausnummer text;
alter table profiles add column if not exists plz text;
alter table profiles add column if not exists ort text;
alter table profiles add column if not exists geburtsdatum date;
alter table profiles add column if not exists steuer_id text;
alter table profiles add column if not exists iban text;
alter table profiles add column if not exists bic text;
alter table profiles add column if not exists bank_name text;
alter table profiles add column if not exists telefon text;

-- 2. Mieter-Kontakte
create table if not exists mieter (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  vorname text not null,
  nachname text not null,
  email text,
  telefon text,
  strasse text,
  hausnummer text,
  plz text,
  ort text,
  objekt_bezeichnung text, -- z.B. "Wohnung EG, Musterstr. 1"
  erstellt_am timestamptz default now()
);

alter table mieter enable row level security;
create policy "Eigene Mieter" on mieter for all using (auth.uid() = user_id);

-- 3. IMAP Settings pro User
create table if not exists imap_settings (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade unique not null,
  host text not null,
  port int default 993,
  username text not null,
  password_encrypted text not null, -- wird verschlüsselt gespeichert
  aktiv boolean default true,
  letzter_sync timestamptz,
  letzter_uid bigint default 0, -- damit keine Mails doppelt verarbeitet werden
  erstellt_am timestamptz default now()
);

alter table imap_settings enable row level security;
create policy "Eigene IMAP Settings" on imap_settings for all using (auth.uid() = user_id);

-- 4. Dokumente: Anhänge und Quelldatei ergänzen
alter table dokumente add column if not exists anhaenge jsonb default '[]';
-- anhaenge: [{ name, storage_path, mime_type, groesse }]
alter table dokumente add column if not exists quelle text default 'scan';
-- quelle: 'scan' | 'imap' | 'email-inbound'
alter table dokumente add column if not exists original_email_path text;
-- storage_path der .eml Originaldatei
