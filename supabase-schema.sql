-- ─────────────────────────────────────────────────────────────────────────────
-- PostScout – Supabase Schema
-- ─────────────────────────────────────────────────────────────────────────────
-- Ausführen: supabase.com → Dein Projekt → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Profile (wird automatisch bei Registrierung angelegt)
create table if not exists profiles (
  id uuid references auth.users primary key,
  name text,
  rolle text default 'inhaber',
  erstellt_am timestamptz default now()
);

-- 2. Dokumente (Kern-Tabelle)
create table if not exists dokumente (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  dateiname text not null,
  storage_path text not null,
  mime_type text,
  kategorie text not null,
  absender text,
  zusammenfassung text,
  dringlichkeit text check (dringlichkeit in ('hoch','mittel','niedrig')),
  frist date,
  betrag numeric(10,2),
  steuerrelevant boolean default false,
  jahr int,
  todos jsonb default '[]',
  empfehlungen jsonb default '[]',
  erstellt_am timestamptz default now()
);

-- 3. Storage Bucket
insert into storage.buckets (id, name, public)
values ('dokumente', 'dokumente', false)
on conflict (id) do nothing;

-- 4. Row Level Security
alter table profiles enable row level security;
alter table dokumente enable row level security;

drop policy if exists "Eigenes Profil" on profiles;
create policy "Eigenes Profil" on profiles
  for all using (auth.uid() = id);

drop policy if exists "Eigene Dokumente" on dokumente;
create policy "Eigene Dokumente" on dokumente
  for all using (auth.uid() = user_id);

drop policy if exists "Eigener Storage" on storage.objects;
create policy "Eigener Storage" on storage.objects
  for all using (
    bucket_id = 'dokumente'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 5. Trigger: Profil automatisch bei Registrierung anlegen
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
