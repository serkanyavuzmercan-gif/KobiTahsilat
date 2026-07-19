-- PayTR ödeme linkleri + callback bildirimleri.
-- merchant_oid UNIQUE = idempotency (PayTR aynı bildirimi tekrar gönderebilir).
-- Satır link OLUŞTURULUNCA yazılır (durum='olusturuldu'); callback bu satırı UPDATE eder → mükerrer satır yok.
-- Supabase MCP / dashboard ile uygulanır (bu repoda numaralı migration YOK).

create table if not exists odeme_linkleri (
  id uuid primary key default gen_random_uuid(),
  merchant_oid text unique not null,
  token text unique not null,               -- kendi kısa linkimizin token'ı (/o/<token>)
  cari_kod text not null,
  firma_adi text,
  tutar_kurus bigint not null,              -- hedeflenen tutar (kuruş)
  editable boolean not null default true,   -- müşteri hosted sayfada tutarı değiştirebilir mi
  email text,
  paytr_url text,                           -- PayTR'nin döndürdüğü ödeme URL'si
  durum text not null default 'olusturuldu',-- olusturuldu | odendi | basarisiz | iptal
  odenen_kurus bigint,                      -- callback total_amount (fiilen tahsil edilen)
  test_mode boolean not null default false,
  olusturan_user_id uuid,
  created_at timestamptz not null default now(),
  odendi_at timestamptz,
  callback_ham jsonb                        -- son callback ham verisi (denetim)
);
create index if not exists odeme_linkleri_cari_idx on odeme_linkleri(cari_kod);
create index if not exists odeme_linkleri_durum_idx on odeme_linkleri(durum);
