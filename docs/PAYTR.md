# PayTR "Ödeme Al" Entegrasyonu

B2B tahsilat: müşteriye giden ödeme talebine / panelden üretilen **güvenli ödeme linki**. Kart bilgisi
bize hiç değmez — müşteri PayTR hosted sayfasında öder. Manuel mail-order/kart formunun yerini alır.

## Mimari (kurulu — creds bekliyor)

- **`lib/paytr.ts`** — config (env), `paytrYapili()`, `createPaymentLink()`, `verifyCallbackHash()` (fail-closed).
- **`lib/odeme-link.ts`** — merchant_oid/token üretimi, `odeme_linkleri` tablosuna yazma/lookup,
  `recentlyPaidCariKods()` (otomasyon askısı).
- **`app/api/odeme/link`** (auth) — bir cari için PayTR linki üretir, tabloya yazar, kendi kısa linkimizi döner.
- **`app/o/[token]`** — kendi domainimizde kısa link → PayTR'ye 302 (ödendi/iptal ise yönlendirmez).
- **`app/api/odeme/paytr-callback`** — PayTR webhook: `formData` parse, fail-closed hash, idempotent update, düz `"OK"` yanıt.
- **`app/odeme-al` + `components/odeme-al-client.tsx`** — panel "Ödeme Al" sekmesi (cari seç → tutar → link + kopyala).
- **Otomasyon askısı** — `lib/automation/runner.ts`: son 14 günde PayTR'den ödeyen cari, hatırlatma/mutabakattan çıkarılır.
- **Tablo** — `odeme_linkleri` (`docs/sql/paytr_odeme_linkleri.sql`, Supabase'de uygulandı).

Creds yokken her şey **güvenli no-op**: panel "PayTR bağlı değil" der, otomasyon linksiz çalışmaya devam eder.

## Protokol (dev.paytr.com/link-api ile DOĞRULANDI)

- **Create endpoint:** `POST https://www.paytr.com/odeme/api/link/create`
- **link_type:** `collection` (tahsilat). **price KURUŞ** (34,56 TL → `3456`).
- **create hash (collection):** `name+price+currency+max_installment+link_type+lang+email + merchant_salt`
  → `base64(HMAC-SHA256(hashStr, merchant_key))`. **email ZORUNLU** (hash'e girer; cari maili yoksa fallback).
- **merchant_oid create'te YOK** — PayTR ödeme anında üretir; eşleştirme **callback_id** (=bizim token) ile.
- **Callback:** `x-www-form-urlencoded` POST; alanlar `merchant_oid, callback_id, status, total_amount, hash`.
  **hash:** `merchant_oid+merchant_salt+status+total_amount` → base64 HMAC. Yanıt **düz `"OK"`** (yoksa tekrar dener).

## Canlıya alma kontrol listesi

1. **Env (Vercel, production):** `PAYTR_MERCHANT_ID/KEY/SALT` **eklendi** ✓, `PAYTR_TEST_MODE=true` **eklendi** ✓
   (opsiyonel `PAYTR_FALLBACK_EMAIL` — cari maili yoksa collection hash'i için kullanılır).
2. **PayTR panelinde bildirim (callback) URL'i:** `https://finans.hidroteknik.com.tr/api/odeme/paytr-callback` ← **sen ekleyeceksin**
3. **Test modunda uçtan uca dene:** "Ödeme Al" sekmesinden küçük tutarlı link üret → PayTR test kartıyla öde →
   `odeme_linkleri.durum='odendi'` oldu mu bak (callback zinciri kanıtı).
4. **Kanıtlandıktan sonra** `PAYTR_TEST_MODE=false` yap ve (2. faz) ödeme talebi mail/WhatsApp'ına linki göm.

## 2. faz (panel kanıtlandıktan sonra)

- **Ödeme talebi mailine** "Ödeme yapmak için tıklayın" düğmesi (kısa link). `createPaymentLink` doğrudan
  import edilir (cron'da session yok, kendi authlu route'unu fetch etme). Link üretimi **try/catch** —
  hata mevcut linksiz gönderimi bozmamalı.
- **WhatsApp:** Meta'da URL-butonlu YENİ şablon gerekir (mevcut `odeme_talebi_hatirlatma`'ya serbest buton
  eklenemez). Buton tabanı **kendi domainimiz** olmalı (`/o/{{1}}`) — Meta "sabit taban + dinamik ek" kuralı.
  Onay saatler/günler sürebilir; mail kanalı buna bağımlı kalmamalı.

## Açık tasarım kararları

- **Tutar:** varsayılan gecikmiş bakiye; `editable=true` → müşteri hosted sayfada değiştirebilir. Callback'te
  **`total_amount` (fiilen tahsil edilen)** doğruluk kaynağıdır.
- **Ödeme sonrası:** şimdilik sadece loglanır — Mikro'ya tahsilat İŞLENMEZ (kullanıcı kararı). PayTR ayrıca mail atar.
- **Link ömrü/iptal:** durum `odendi`/`iptal` ise `/o/<token>` PayTR'ye yönlendirmez (çift ödeme koruması).
