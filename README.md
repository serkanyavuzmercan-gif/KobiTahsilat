# KobiTahsilat

Web tabanlı **tahsilat takip** programı. Veri modeli ve işaret kuralları Hidroteknik `ss`
(Satış+Servis) reposundaki mevcut yapıdan alınmıştır.

## Hızlı başlangıç

```bash
npm install
npm run dev
```

Aç: http://localhost:3000

### Windows (PowerShell)

```powershell
cd KobiTahsilat          # repoyu klonladığınız klasör
.\scripts\setup-local.ps1  # ilk kurulum (npm install + .env.local)
notepad .env.local         # Supabase anahtarlarını yapıştırın
npm run dev
```

`.env.local` yoksa: `Copy-Item env.example .env.local`

**Sık hatalar**

| Hata | Çözüm |
|------|--------|
| `npm is not recognized` | [Node.js LTS](https://nodejs.org) kurun, PowerShell'i yeniden açın |
| `next is not recognized` | Önce `npm install` çalıştırın |
| `EADDRINUSE :::3000` | Port dolu: `npx kill-port 3000` veya başka terminalde çalışan dev'i kapatın |
| `running scripts is disabled` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Giriş yapılamıyor / 503 | `.env.local` içinde `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` dolu olmalı |
| Sayfa açılıyor ama veri yok | `data/tahsilat_snapshot.json` repoda gelir; Mikro için `npm run sync:mikro` |

Geliştirme için Vercel deploy şart değil; yerelde `npm run dev` yeterli. Canlı test için deploy isteyin.

## Ne var?

| Sayfa | Açıklama |
|-------|----------|
| `/` | Toplam alacak özeti + en yüksek bakiyeler |
| `/cariler` | Arama / min bakiye filtreli cari ve gecikmiş bakiye listesi |
| `/cariler/[kod]` | Açık faturalar, vade tarihleri, FIFO ve yaşlandırma |
| `/mutabakat` | Cari e-posta kontrolü ve mutabakat yönetimi |
| `/mutabakat/ayarlar` | Gönderici e-posta bağlantıları (kullanıcı başına) |
| `/mutabakat/[kod]` | Firmaya özel mutabakat e-postası önizlemesi ve gönderimi |
| `/hatirlatma` | WhatsApp ödeme hatırlatması listesi |
| `/hatirlatma/[kod]` | Mesaj önizleme, telefon düzenleme ve gönderim |
| `/api/cariler?q=` | JSON API |

**Veri kaynağı: canlı Supabase.** Bakiye, açık evrak ve yaşlandırma doğrudan
`vade_takip_tahsilat` (açık alacak evrakları, günlük Mikro sync) + `cariler` (firma,
e-posta, telefon, vade) tablolarından okunur (`lib/data.ts`). En güncel `snapshot_tarihi`
otomatik seçilir; sonuç 60 sn bellek önbelleğinde tutulur. Servis rolü anahtarı tanımlı
değilse veya sorgu boş dönerse `data/tahsilat_snapshot.json` yedeğine düşülür (anahtarsız
yerel `npm run dev` de çalışsın diye). `npm run sync:mikro` bu yedeği tazeler; canlı
tabloları ise ss reposundaki Mikro sync cron'u besler.

Vade ve yaşlandırma motoru MikRapor'daki doğrulanmış kuralları kullanır:
`cha_vade → ödeme planı → evrak tarihi`; açık kalemler FIFO ile hesaplanır. Bakiye>0 =
alacağımız; `128.*`, ŞAHLAN (`120.01.0001`) ve AYGÜN SARI (`120.01.4249`) Mikro sync
tarafında hariç tutulur.

Mikro `CARI_HESAPLAR.cari_EMail` alanındaki adresler cari koduyla eşleştirilir.
Mutabakat modülü Resend üzerinden gönderim yapar. Kullanıcılar `/mutabakat/ayarlar`
ekranından kendi gönderici e-posta adreslerini bağlar; önizleme ekranında seçilen adres
`From` olarak kullanılır. Sistem varsayılanı `MAIL_FROM` env değişkenidir.

İlk kurulumda gönderici kayıtları mevcut `mail_gonderim_log` tablosunda tutulur; ayrı tablo
gerekmez. İsteğe bağlı gelişmiş şema için `docs/sql/mutabakat_gonderici_hesaplari.sql`
dosyası mevcuttur.

Gönderimi kapatmak için `MUTABAKAT_SEND_ENABLED=false` tanımlayın.

**WhatsApp hatırlatma** (`/hatirlatma`): Mutabakat değil, kibar ödeme hatırlatması.
Telefonlar Mikro/SS cari kartından veya manuel girişle gelir. Gönderim geçmişi tarih ve
sayım olarak tutulur. Canlı gönderim için Meta WhatsApp Cloud API gerekir:
`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_SEND_ENABLED=true`.
Telefon zenginleştirme: `npm run enrich:phones`

Mutabakat bağlantıları 30 gün geçerli HMAC token ile korunur. “Fark / itiraz” yanıtında müşteri
yazılı açıklama ve en fazla 4 MB PNG/JPG/WEBP ekran görüntüsü iletebilir; bildirim yapılandırılmış
Hidroteknik iç adresine e-posta ve ek olarak gönderilir.

Eksik e-posta adresleri `npm run enrich:emails` ile SS cari kartları, eski teklifler, servis
kayıtları ve Gmail/IMAP'ten Supabase'e alınmış teklif yazışmalarından aranır. Cari koduna doğrudan
bağlı kayıtlar gönderime hazır olabilir; yalnız firma adı/domain ile bulunan Gmail adresleri
personel onayına kadar **aday** kalır.

Mutabakat ekranında kullanıcı cari e-postasını düzenleyip kaydedebilir. Düzenleme hem ortak
`cariler.email` alanına hem de append-only override geçmişine yazılır; sonraki mutabakat
önizlemelerinde bu adres önceliklidir. Daha önce gönderilmiş mutabakatların son tarihi ve toplam
gönderim sayısı yalnız oturum açmış personele gösterilir.

Gmail adayları yalnız e-posta görünen adı/domaini firma adıyla güçlü biçimde örtüşüyorsa
gösterilir. Kullanıcı adayı seçip kaydettiğinde veya × ile reddettiğinde öneri kalıcı olarak
kaldırılır. Son mutabakat gönderiminden itibaren Türkiye resmî tatilleri ve hafta sonları hariç
8 iş günü dolmadan tekrar gönderim engellenir.

## Giriş

Uygulama `ss` ile aynı Supabase Auth projesini kullanır. Kullanıcı adı otomatik olarak
`@hidroteknik.com.tr` alan adına tamamlanır. Giriş için personel kaydının `aktif=true` ve
`erisim_servis=true` olması gerekir.

## Mikro'dan yenile

```bash
cp env.example .env.local   # MIKRO_* doldur
npm run sync:mikro
```

## ss ile ilişki

Detay: [`docs/SS-KAYNAK-YAPI.md`](docs/SS-KAYNAK-YAPI.md)

- Açık bakiye: `CARI_HESAP_HAREKETLERI` net (borç − alacak), TL (`× cha_d_kur`)
- **bakiye > 0** → tahsilat (alacağımız)
- Hariç: `128.*`, `120.01.0001` (ŞAHLAN), `120.01.4249` (AYGÜN SARI)
- Hedef şema (ss): `vade_takip_tahsilat`, `cari_bakiye_gunluk`, `cariler`

## Sonraki özellikler

- Tahsilat notu / takip durumu
- Tahsilat bildirim otomasyonu
- Telegram / Excel raporu entegrasyonu
