-- ingym: günlük öğün kayıtları (yemek foto tahmininden)
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  name text not null,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  fat_g numeric not null default 0,
  carbs_g numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists meals_user_date_idx on public.meals (user_id, log_date desc);

alter table public.meals enable row level security;

drop policy if exists "own meals select" on public.meals;
create policy "own meals select" on public.meals
  for select using (auth.uid() = user_id);

drop policy if exists "own meals insert" on public.meals;
create policy "own meals insert" on public.meals
  for insert with check (auth.uid() = user_id);

drop policy if exists "own meals delete" on public.meals;
create policy "own meals delete" on public.meals
  for delete using (auth.uid() = user_id);
