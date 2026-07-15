-- Tahsilat otomasyon ayarları (ileride opsiyonel ayrı tablo)
-- Şu an ayarlar mail_gonderim_log üzerinde ilgili_tip ile tutulur:
--   tahsilat_otomasyon_ayar
--   tahsilat_otomasyon_whatsapp
--   tahsilat_otomasyon_calistirma
--   tahsilat_otomasyon_email
--   tahsilat_otomasyon_whatsapp_gonderim
--
-- Canlı otomasyon için ortam değişkenleri:
--   OTOMATIK_TAHSILAT_ENABLED=true
--   CRON_SECRET=...
--   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
--   RESEND_API_KEY, MAIL_FROM

create table if not exists public.tahsilat_otomasyon_ayarlari (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  otomasyon_aktif boolean not null default false,
  taslak_mod boolean not null default true,
  kurallar jsonb not null default '[]'::jsonb,
  calisma_saati text not null default '09:00',
  sadece_is_gunu boolean not null default true,
  whatsapp_telefon text,
  sesli_arama_durumu text not null default 'gelistirme',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists tahsilat_otomasyon_ayarlari_aktif_idx
  on public.tahsilat_otomasyon_ayarlari (otomasyon_aktif)
  where otomasyon_aktif = true;

alter table public.tahsilat_otomasyon_ayarlari enable row level security;

drop policy if exists "tahsilat_otomasyon_select_own" on public.tahsilat_otomasyon_ayarlari;
create policy "tahsilat_otomasyon_select_own"
  on public.tahsilat_otomasyon_ayarlari
  for select
  using (auth.uid() = user_id);

drop policy if exists "tahsilat_otomasyon_upsert_own" on public.tahsilat_otomasyon_ayarlari;
create policy "tahsilat_otomasyon_upsert_own"
  on public.tahsilat_otomasyon_ayarlari
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
