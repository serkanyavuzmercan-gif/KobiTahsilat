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
| `/cariler` | Arama / min bakiye filtreli cari listesi |
| `/cariler/[kod]` | Cari detay |
| `/api/cariler?q=` | JSON API |

Canlı snapshot: `data/tahsilat_snapshot.json` (Mikro firma **26**).

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

- Evrak kırılımı + vade yaşlandırma (ss FIFO)
- Tahsilat notu / takip durumu
- Auth (Supabase veya basit oturum)
- Telegram / Excel raporu entegrasyonu
