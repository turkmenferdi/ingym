-- ingym: üretilen spor + diyet planları
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','archived')),
  targets jsonb not null,
  skeleton jsonb not null,
  content jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists plans_user_active_idx on public.plans (user_id, created_at desc);

alter table public.plans enable row level security;

drop policy if exists "own plans select" on public.plans;
create policy "own plans select" on public.plans
  for select using (auth.uid() = user_id);

drop policy if exists "own plans insert" on public.plans;
create policy "own plans insert" on public.plans
  for insert with check (auth.uid() = user_id);

drop policy if exists "own plans update" on public.plans;
create policy "own plans update" on public.plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
