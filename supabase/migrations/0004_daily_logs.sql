-- ingym: günlük takip kayıtları (kullanıcı başına gün başına tek satır)
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  trained boolean not null default false,
  weight_kg numeric check (weight_kg is null or weight_kg between 30 and 300),
  notes text not null default '',
  ai_feedback jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists daily_logs_user_date_idx on public.daily_logs (user_id, log_date desc);

alter table public.daily_logs enable row level security;

drop policy if exists "own logs select" on public.daily_logs;
create policy "own logs select" on public.daily_logs
  for select using (auth.uid() = user_id);

drop policy if exists "own logs insert" on public.daily_logs;
create policy "own logs insert" on public.daily_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "own logs update" on public.daily_logs;
create policy "own logs update" on public.daily_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
