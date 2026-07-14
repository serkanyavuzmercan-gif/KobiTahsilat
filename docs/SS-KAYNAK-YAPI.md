# ss reposundan alınan tahsilat yapısı

Kaynak: `https://github.com/alperalyaz/ss` (Hidroteknik Satış+Servis, `ss.hidroteknik.com.tr`).

## Veri kaynakları

| Kaynak | Kullanım |
|--------|----------|
| **Mikro ERP** (firma `26`) | Canlı cari bakiye, açık evrak, ödeme planı |
| **Supabase** `ujmtoruicnmgoarwzhwp` | Snapshot tabloları (RLS korumalı) |

## Kritik tablolar (ss / Supabase)

### `cariler`
- `cari_kod`, `firma_adi`, `yetkili_adi`, `telefon`, `email`, `adres`
- `odeme_vadesi`, `vade_gun`, `cari_satis_fk`

### `cari_bakiye_gunluk`
Günlük bakiye snapshot (Mikro → cron `cari-sync`).
- `bakiye` işaretli: **+ = alacağımız**, `yon` = `B`/`A`
- Unique: `(cari_kod, snapshot_tarihi)`

### `vade_takip_tahsilat` / `vade_takip_tediye`
Serkan'ın haftalık vade takip raporunun veri katmanı.
- Kolonlar: `snapshot_tarihi`, `cari_kod`, `firma_adi`, `evrak_no`, `belge_no`,
  `evrak_tarihi`, `vade_tarihi`, `tutar`, `temsilci` (tahsilatta)
- Sync: `lib/vade-takip-sync.ts` + cron `/api/cron/vade-takip-sync`

### `kasa_tahsilat_gunluk`
Günlük kasa tahsilat kalemleri (`nakit` / `banka` / `cek` / `kk` / `virman`).

## İşaret ve hesap kuralları (zorunlu)

ss `docs/VADE-TAKIP-SYNC.md` + `lib/mikro-api.ts` → `getVadeTakipAcikEvraklar`:

1. Kaynak tablo: `CARI_HESAP_HAREKETLERI` (`cha_iptal=0`)
2. TL: `ABS(cha_meblag) × cha_d_kur`; `cha_tip` 0=borç(+), 1=alacak(−)
3. Cari-net + FIFO (eşleme tablosu bu kurulumda boş)
4. Sayfa ayrımı **bakiyeye göre** (cari koduna göre değil): net+ → tahsilat, net− → tediye
5. Hariç: `128.*`, HARIC_CARI = `120.01.0001` (ŞAHLAN), `120.01.4249` (AYGÜN SARI)
6. `cha_vade` çoğu zaman boş → vade = evrak tarihi + ödeme planı günü (`ODEME_PLANLARI` / plan adı)

## KobiTahsilat MVP kapsamı

İlk sürüm **cari net bakiyeleri** ile çalışır (snapshot JSON). Sonraki adımda ss'deki
evrak kırılımı / yaşlandırma aynı SQL+FIFO mantığıyla eklenecek.

## İlk canlı snapshot (örnek üst kalemler)

Çekim anı snapshot dosyasında (`data/tahsilat_snapshot.json`). Örnek üst tahsilat carileri:

| Cari | Firma | Bakiye (yaklaşık) | Vade |
|------|-------|-------------------|------|
| 120.01.0003 | HİDROBARSAN … | 880.904 ₺ | 60 GÜN |
| 120.01.0032 | ELTEKSMAK MAKİNA A.Ş. | 599.037 ₺ | 60 GÜN |
| 120.01.0099 | EGA MAKİNA … | 467.511 ₺ | 90 GÜN |
| 120.01.0284 | BERKAND MAKİNA … | 353.297 ₺ | 90 GÜN |
| 120.01.4126 | DESKİ … | 333.984 ₺ | 30 GÜN |

Toplam (çekim anı): **208 cari · ~7.328.881 ₺** açık alacak.
