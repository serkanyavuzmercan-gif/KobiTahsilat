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

## YARIN — canlıya alma kontrol listesi

1. **Env (Vercel, production):** `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT`, `PAYTR_TEST_MODE=true` (önce test).
2. **PayTR panelinde bildirim (callback) URL'i:** `https://finans.hidroteknik.com.tr/api/odeme/paytr-callback`
3. **⚠️ PROTOKOLÜ DOĞRULA (kritik):** `lib/paytr.ts` içindeki `⚠️` işaretli iki hash string'i
   ("Ödeme Linki API" link-create + callback) PayTR'nin **güncel dokümanıyla birebir** karşılaştır.
   Alan sırası / key-salt rolü / endpoint iFrame API'sinden farklı olabilir — **varsayma, doğrula.**
   Callback hash'i fail-closed olduğu için yanlışsa ödeme "ödendi" işaretlenmez (log'da görürsün) —
   sahte ödeme asla geçmez, ama doğru formülü koyana kadar gerçek ödemeler de işlenmez.
4. **Test modunda uçtan uca dene:** panelden küçük tutarlı link → öde → callback geldi mi, `odeme_linkleri.durum='odendi'` oldu mu.
5. **Kanıtlandıktan sonra** `PAYTR_TEST_MODE=false` yap ve (2. faz) ödeme talebi mail/WhatsApp'ına linki göm.

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
