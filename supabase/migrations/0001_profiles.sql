-- ingym: kullanıcı profilleri (onboarding çıktısı)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age int not null check (age between 13 and 100),
  gender text not null check (gender in ('male','female','other')),
  height_cm numeric not null check (height_cm between 100 and 250),
  weight_kg numeric not null check (weight_kg between 30 and 300),
  activity_level text not null check (activity_level in ('sedentary','light','moderate','active','very_active')),
  goal text not null check (goal in ('lose','maintain','gain')),
  experience text not null check (experience in ('beginner','intermediate','advanced')),
  days_per_week int not null check (days_per_week between 1 and 7),
  health_flags jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own profile select" on public.profiles;
create policy "own profile select" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (auth.uid() = user_id);
