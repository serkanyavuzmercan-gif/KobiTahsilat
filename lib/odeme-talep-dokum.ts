import type { AcikKalem } from './types'

/** Ödeme talebinde tek tek gösterilecek fatura satırı. */
export type OdemeTalepFatura = {
  belge_no: string
  fatura_tarihi: string | null
  vade_tarihi: string | null
  gecikme_gun: number
  tutar: number
}

export type OdemeTalepDokum = {
  /** belge_no dolu, tutar > eşik, vadesi geçmiş faturalar — tarihe göre sıralı. */
  faturalar: OdemeTalepFatura[]
  /** belge_no boş (devir/dekont/banka) VEYA eşik altı küçük kalemlerin toplamı. */
  diger_toplam: number
  diger_adet: number
  /** Vadesi geçmiş tüm kalemlerin toplamı (faturalar + diğer). */
  vadesi_gecen_toplam: number
  /** Carinin genel açık bakiyesi (vadesi gelmemişler dahil). */
  genel_bakiye: number
}

/** 50 TL ve altı kalemler "küsürat" sayılır; tek tek listelenmez, Devir/Diğer'e katılır. */
export const ODEME_TALEP_MIN_TUTAR = 50

/**
 * Vadesi geçmiş açık kalemleri müşteriye gösterilecek fatura dökümüne çevirir.
 * belge_no varsa gerçek e-fatura no'dur → tek tek listelenir. belge_no yoksa (devir,
 * banka tahsilatı, dekont) veya tutar eşik altındaysa "Devir/Diğer" satırında toplanır.
 * Saf fonksiyon: hem istemci (mesaj önizleme) hem sunucu (PDF) tarafında kullanılır.
 */
export function buildOdemeTalepDokum(
  acikKalemler: AcikKalem[],
  genelBakiye: number,
  minTutar: number = ODEME_TALEP_MIN_TUTAR
): OdemeTalepDokum {
  const gecikmisKalemler = acikKalemler.filter((k) => k.gecikme_gun > 0 && k.tutar > 0)

  // Aynı belge_no'ya sahip kalemler tek faturanın (farklı KDV oranlı) satırlarıdır →
  // müşteriye tek fatura olarak, toplanmış göster.
  const faturaMap = new Map<string, OdemeTalepFatura>()
  let digerToplam = 0
  let digerAdet = 0

  for (const kalem of gecikmisKalemler) {
    const belgeNo = (kalem.belge_no || '').trim()
    if (!belgeNo) {
      digerToplam += kalem.tutar
      digerAdet += 1
      continue
    }
    const mevcut = faturaMap.get(belgeNo)
    if (mevcut) {
      mevcut.tutar += kalem.tutar
      mevcut.gecikme_gun = Math.max(mevcut.gecikme_gun, kalem.gecikme_gun)
      if (kalem.vade_tarihi && (!mevcut.vade_tarihi || kalem.vade_tarihi < mevcut.vade_tarihi)) {
        mevcut.vade_tarihi = kalem.vade_tarihi
      }
      if (kalem.evrak_tarihi && (!mevcut.fatura_tarihi || kalem.evrak_tarihi < mevcut.fatura_tarihi)) {
        mevcut.fatura_tarihi = kalem.evrak_tarihi
      }
    } else {
      faturaMap.set(belgeNo, {
        belge_no: belgeNo,
        fatura_tarihi: kalem.evrak_tarihi,
        vade_tarihi: kalem.vade_tarihi,
        gecikme_gun: kalem.gecikme_gun,
        tutar: kalem.tutar,
      })
    }
  }

  // Fatura toplamı eşik altındaysa "Devir/Diğer"e katılır (küsürat faturayı listeleme).
  const faturalar: OdemeTalepFatura[] = []
  for (const fatura of faturaMap.values()) {
    fatura.tutar = Math.round(fatura.tutar * 100) / 100
    if (fatura.tutar > minTutar) {
      faturalar.push(fatura)
    } else {
      digerToplam += fatura.tutar
      digerAdet += 1
    }
  }

  // Tarihe göre (vade tarihi, yoksa fatura tarihi) artan sırala — en eski üstte.
  faturalar.sort((a, b) =>
    (a.vade_tarihi || a.fatura_tarihi || '9999').localeCompare(
      b.vade_tarihi || b.fatura_tarihi || '9999'
    )
  )

  const vadesiGecen =
    faturalar.reduce((sum, f) => sum + f.tutar, 0) + digerToplam

  return {
    faturalar,
    diger_toplam: Math.round(digerToplam * 100) / 100,
    diger_adet: digerAdet,
    vadesi_gecen_toplam: Math.round(vadesiGecen * 100) / 100,
    genel_bakiye: Math.round(genelBakiye * 100) / 100,
  }
}
