-- ingym: vücut ölçümleri (InBody/tahlil/tartı foto okumasından)
create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_date date not null default current_date,
  weight_kg numeric,
  body_fat_pct numeric,
  muscle_mass_kg numeric,
  summary text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists measurements_user_date_idx on public.measurements (user_id, measured_date desc);

alter table public.measurements enable row level security;

drop policy if exists "own measurements select" on public.measurements;
create policy "own measurements select" on public.measurements
  for select using (auth.uid() = user_id);

drop policy if exists "own measurements insert" on public.measurements;
create policy "own measurements insert" on public.measurements
  for insert with check (auth.uid() = user_id);

drop policy if exists "own measurements delete" on public.measurements;
create policy "own measurements delete" on public.measurements
  for delete using (auth.uid() = user_id);
