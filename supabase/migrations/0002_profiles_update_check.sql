-- ingym: UPDATE politikasına with check ekle (kullanıcı kendi satırının user_id'sini değiştiremesin)
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
