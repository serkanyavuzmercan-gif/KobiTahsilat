-- Mutabakat gönderici e-posta hesapları (kullanıcı başına bağlı gönderen adresler)
-- Supabase SQL Editor'da bir kez çalıştırın.

create table if not exists public.mutabakat_gonderici_hesaplari (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  ad_soyad text,
  varsayilan boolean not null default false,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, email)
);

create index if not exists mutabakat_gonderici_hesaplari_user_id_idx
  on public.mutabakat_gonderici_hesaplari (user_id)
  where aktif = true;

alter table public.mutabakat_gonderici_hesaplari enable row level security;

drop policy if exists "mutabakat_gonderici_select_own" on public.mutabakat_gonderici_hesaplari;
create policy "mutabakat_gonderici_select_own"
  on public.mutabakat_gonderici_hesaplari
  for select
  using (auth.uid() = user_id);

drop policy if exists "mutabakat_gonderici_insert_own" on public.mutabakat_gonderici_hesaplari;
create policy "mutabakat_gonderici_insert_own"
  on public.mutabakat_gonderici_hesaplari
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "mutabakat_gonderici_update_own" on public.mutabakat_gonderici_hesaplari;
create policy "mutabakat_gonderici_update_own"
  on public.mutabakat_gonderici_hesaplari
  for update
  using (auth.uid() = user_id);

-- mail_gonderim_log tablosuna gönderen alanı (yoksa ekler)
alter table public.mail_gonderim_log
  add column if not exists mail_from text;

alter table public.mail_gonderim_log
  add column if not exists gonderen_user_id uuid references auth.users (id);
