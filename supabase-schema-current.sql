-- PostScout — Aktuelles Datenbank-Schema (Referenz)
-- Dieses Schema ist bereits live in Supabase eingerichtet.
-- Diese Datei dient nur als Dokumentation / Wiederherstellung im Notfall.

-- ── profiles ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  rolle text default 'inhaber',
  vorname text,
  nachname text,
  strasse text,
  hausnummer text,
  plz text,
  ort text,
  geburtsdatum date,
  steuer_id text,
  iban text,
  bic text,
  bank_name text,
  telefon text,
  erstellt_am timestamptz default now()
);

-- ── dokumente ────────────────────────────────────────────────────────────
create table if not exists public.dokumente (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  dateiname text not null,
  storage_path text,
  mime_type text,
  kategorie text default 'scan',
  absender text,
  absender_email text,
  titel text,
  zusammenfassung text,
  dringlichkeit text,
  frist date,
  faelligkeitsdatum date,
  betrag numeric,
  steuerrelevant boolean default false,
  jahr integer,
  todos jsonb default '[]'::jsonb,
  aufgaben jsonb default '[]'::jsonb,
  empfehlungen jsonb default '[]'::jsonb,
  anhaenge jsonb default '[]'::jsonb,
  notizen jsonb default '[]'::jsonb,
  bild_url text,
  bild_urls jsonb default '[]'::jsonb,
  analysiert boolean default false,
  antwort_erforderlich boolean default false,
  quelle text default 'scan',
  original_email_path text,
  inhalts_hash text,
  erstellt_am timestamptz default now()
);

-- ── familien_zugang ──────────────────────────────────────────────────────
create table if not exists public.familien_zugang (
  id bigint generated always as identity primary key,
  inhaber_id uuid not null references public.profiles(id) on delete cascade,
  mitglied_id uuid references public.profiles(id) on delete cascade,
  mitglied_email text,
  berechtigung text default 'abhaken' check (berechtigung in ('lesen','abhaken','notizen')),
  invite_token text unique,
  aktiv boolean default false,
  erstellt_am timestamptz default now()
);

-- ── reminder_settings ────────────────────────────────────────────────────
create table if not exists public.reminder_settings (
  id bigint generated always as identity primary key,
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  aktiv boolean default false,
  frequenz text default 'taeglich' check (frequenz in ('taeglich','2x_woche','woechentlich')),
  uhrzeit_utc integer default 7 check (uhrzeit_utc between 0 and 23),
  nur_dringende boolean default false,
  aktualisiert_am timestamptz default now()
);

-- ── dokument_reminder ────────────────────────────────────────────────────
create table if not exists public.dokument_reminder (
  id bigint generated always as identity primary key,
  dokument_id bigint not null references public.dokumente(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  erinnerung_am date not null,
  text text,
  gesendet boolean default false,
  erstellt_am timestamptz default now()
);

-- ── mieter ───────────────────────────────────────────────────────────────
create table if not exists public.mieter (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vorname text not null,
  nachname text not null,
  email text,
  telefon text,
  strasse text,
  hausnummer text,
  plz text,
  ort text,
  objekt_bezeichnung text,
  erstellt_am timestamptz default now()
);

-- ── imap_settings ────────────────────────────────────────────────────────
create table if not exists public.imap_settings (
  id bigint generated always as identity primary key,
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  host text not null,
  port integer default 993,
  username text not null,
  password_encrypted text not null,
  aktiv boolean default true,
  letzter_sync timestamptz,
  letzter_uid bigint default 0,
  erstellt_am timestamptz default now()
);

-- ── kontakte ─────────────────────────────────────────────────────────────
create table if not exists public.kontakte (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kategorie text default 'Sonstiges',
  name text not null,
  organisation text,
  email text,
  telefon text,
  adresse text,
  notiz text,
  erstellt_am timestamptz default now()
);

-- ── scan_tokens ──────────────────────────────────────────────────────────
-- Tokens für den anonymen Scan-Only-Modus (Familienmitglieder ohne Account).
create table if not exists public.scan_tokens (
  id bigint generated always as identity primary key,
  inhaber_id uuid not null references public.profiles(id) on delete cascade,
  token text unique not null,
  label text default 'Scan-Link',
  aktiv boolean default true,
  erstellt_am timestamptz default now(),
  zuletzt_genutzt timestamptz
);

-- ── RLS Policies ─────────────────────────────────────────────────────────
-- WICHTIG: INSERT-Policies brauchen WITH CHECK, nicht nur USING — sonst
-- schlägt der Insert lautlos fehl (Ursache eines früheren "dokumentId
-- required"-Bugs).

alter table public.dokumente enable row level security;

create policy "dokumente_select" on public.dokumente
  for select to authenticated using (auth.uid() = user_id);

create policy "dokumente_insert" on public.dokumente
  for insert to authenticated with check (auth.uid() = user_id);

create policy "dokumente_update" on public.dokumente
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "dokumente_delete" on public.dokumente
  for delete to authenticated using (auth.uid() = user_id);

-- Storage Bucket "dokumente" muss public=true sein, damit die Analyse-API
-- (Server-seitig, ohne User-Session) die hochgeladenen Bilder per URL laden kann.
-- update storage.buckets set public = true where id = 'dokumente';
