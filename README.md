# KobiTahsilat

Web tabanlı **tahsilat takip** programı. Veri modeli ve işaret kuralları Hidroteknik `ss`
(Satış+Servis) reposundaki mevcut yapıdan alınmıştır.

## Hızlı başlangıç

```bash
npm install
npm run dev
```

Aç: http://localhost:3000

## Ne var?

| Sayfa | Açıklama |
|-------|----------|
| `/` | Toplam alacak özeti + en yüksek bakiyeler |
| `/cariler` | Arama / min bakiye filtreli cari ve gecikmiş bakiye listesi |
| `/cariler/[kod]` | Açık faturalar, vade tarihleri, FIFO ve yaşlandırma |
| `/mutabakat` | Cari e-posta kontrolü ve mutabakat yönetimi |
| `/mutabakat/[kod]` | Firmaya özel mutabakat e-postası önizlemesi |
| `/api/cariler?q=` | JSON API |

Canlı snapshot: `data/tahsilat_snapshot.json` (Mikro firma **26**).

Vade ve yaşlandırma motoru MikRapor'daki doğrulanmış kuralları kullanır:
`cha_vade → ödeme planı → evrak tarihi`; açık kalemler FIFO ile hesaplanır.

Mikro `CARI_HESAPLAR.cari_EMail` alanındaki adresler cari koduyla eşleştirilir.
Mutabakat modülü şu anda güvenli **önizleme modundadır**; kontrol onayına kadar gerçek müşteriye
e-posta göndermez.

Mutabakat bağlantıları 30 gün geçerli HMAC token ile korunur. “Fark / itiraz” yanıtında müşteri
yazılı açıklama ve en fazla 4 MB PNG/JPG/WEBP ekran görüntüsü iletebilir; bildirim yapılandırılmış
Hidroteknik iç adresine e-posta ve ek olarak gönderilir.

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
