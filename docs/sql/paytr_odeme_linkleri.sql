-- PayTR ödeme linkleri + callback bildirimleri.
-- Eşleştirme token (=PayTR'ye callback_id olarak gönderilir, callback'te geri döner) üzerinden.
-- merchant_oid'i PayTR ödeme anında üretir → callback'te yazılır (create'te YOK, o yüzden nullable).
-- Satır link OLUŞTURULUNCA yazılır (durum='olusturuldu'); callback bu satırı UPDATE eder → mükerrer satır yok.
-- Supabase MCP / dashboard ile uygulanır (bu repoda numaralı migration YOK).

create table if not exists odeme_linkleri (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,               -- kendi kısa linkimiz (/o/<token>) + PayTR callback_id
  paytr_link_id text,                       -- PayTR create yanıtındaki link id
  merchant_oid text unique,                 -- PayTR ödeme anında üretir; callback'te dolar (nullable)
  cari_kod text not null,
  firma_adi text,
  tutar_kurus bigint not null,              -- hedeflenen tutar (kuruş)
  editable boolean not null default true,   -- müşteri hosted sayfada tutarı değiştirebilir mi (kayıt)
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
