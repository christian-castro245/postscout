-- ─────────────────────────────────────────────────────────────────────────────
-- PostScout – Schema Update v2
-- Familienzugang + Reminder Settings
-- Ausführen: SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Familienzugang
create table if not exists familien_zugang (
  id bigint generated always as identity primary key,
  inhaber_id uuid references profiles(id) on delete cascade not null,
  mitglied_id uuid references profiles(id) on delete cascade,
  mitglied_email text,
  berechtigung text default 'abhaken' check (berechtigung in ('lesen','abhaken','notizen')),
  invite_token text unique,
  aktiv boolean default false,
  erstellt_am timestamptz default now()
);

alter table familien_zugang enable row level security;

create policy "Eigener Familienzugang lesen" on familien_zugang
  for select using (auth.uid() = inhaber_id or auth.uid() = mitglied_id);

create policy "Inhaber verwaltet Zugang" on familien_zugang
  for all using (auth.uid() = inhaber_id);

create policy "Mitglied akzeptiert Einladung" on familien_zugang
  for update using (auth.uid() = mitglied_id);

-- 2. Reminder Settings
create table if not exists reminder_settings (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade unique not null,
  aktiv boolean default false,
  frequenz text default 'taeglich' check (frequenz in ('taeglich','2x_woche','woechentlich')),
  uhrzeit_utc int default 7 check (uhrzeit_utc between 0 and 23),
  nur_dringende boolean default false,
  aktualisiert_am timestamptz default now()
);

alter table reminder_settings enable row level security;

create policy "Eigene Reminder-Einstellungen" on reminder_settings
  for all using (auth.uid() = user_id);
