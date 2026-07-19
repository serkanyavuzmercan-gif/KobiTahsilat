import 'server-only'
import { cariOrtalamaGecikmeGun } from '../gecikme'
import { loadSnapshot } from '../data'
import type { HatirlatmaCari } from '../hatirlatma-data'
import type { MutabakatCari } from '../mutabakat-data'
import { formatPhoneDisplay } from '../phone'
import { isTestCari } from '../test-cariler'
import type { AutomationRunCandidate, OdemeTalepKanal } from './types'

/** Otomatik mutabakat adayları: bakiye ≥ taban, alıcı e-posta seçili, 8 iş günü engeli yok. */
export function collectMutabakatCandidates(
  cariler: MutabakatCari[],
  tabanBakiye: number,
  /** Deneme/önizleme modunda test carilerini de göster (gerçek gönderimde false). */
  includeTest = false
): AutomationRunCandidate[] {
  return cariler.flatMap((cari) => {
    if (!includeTest && isTestCari(cari.cari_kod)) return []
    if (cari.bakiye <= 0.01 || cari.bakiye < tabanBakiye) return []

    let engel: string | null = null
    if (!cari.email) engel = 'E-posta seçilmemiş'
    else if (cari.mutabakat_gonderim_engelli) engel = 'Kısa süre önce gönderildi'

    return [
      {
        tur: 'mutabakat' as const,
        cari_kod: cari.cari_kod,
        firma_adi: cari.firma_adi,
        kanal: 'email' as const,
        ortalama_gecikme_gun: cariOrtalamaGecikmeGun(cari),
        gecikmis_bakiye: cari.gecikmis_bakiye,
        bakiye: cari.bakiye,
        alici: cari.email || null,
        engel,
      },
    ]
  })
}

/** Otomatik ödeme talebi adayları: ort. gecikme ≥ eşik VE gecikmiş ≥ taban; kanal(lar)a göre. */
export function collectOdemeTalepCandidates(
  cariler: HatirlatmaCari[],
  opts: { minGun: number; minTutar: number; kanal: OdemeTalepKanal; includeTest?: boolean }
): AutomationRunCandidate[] {
  const out: AutomationRunCandidate[] = []
  for (const cari of cariler) {
    if (!opts.includeTest && isTestCari(cari.cari_kod)) continue
    const ortalama = cariOrtalamaGecikmeGun(cari)
    if (cari.gecikmis_bakiye < opts.minTutar) continue
    if (ortalama == null || ortalama < opts.minGun) continue

    const base = {
      tur: 'odeme_talebi' as const,
      cari_kod: cari.cari_kod,
      firma_adi: cari.firma_adi,
      ortalama_gecikme_gun: ortalama,
      gecikmis_bakiye: cari.gecikmis_bakiye,
      bakiye: cari.bakiye,
    }
    if (opts.kanal === 'email' || opts.kanal === 'her-ikisi') {
      out.push({
        ...base,
        kanal: 'email',
        alici: cari.email_adresleri[0] || null,
        engel: cari.email_adresleri.length ? null : 'E-posta yok',
      })
    }
    if (opts.kanal === 'whatsapp' || opts.kanal === 'her-ikisi') {
      out.push({
        ...base,
        kanal: 'whatsapp',
        alici: cari.telefon ? formatPhoneDisplay(cari.telefon) : null,
        engel: cari.telefon ? null : 'Telefon yok',
      })
    }
  }
  return out
}

export async function listSnapshotDelaySummary() {
  const snapshot = await loadSnapshot()
  return snapshot.cariler
    .map((cari) => ({
      cari_kod: cari.cari_kod,
      firma_adi: cari.firma_adi,
      ortalama_gecikme_gun: cariOrtalamaGecikmeGun(cari),
      gecikmis_bakiye: cari.gecikmis_bakiye,
    }))
    .filter((item) => item.gecikmis_bakiye > 0.01 && item.ortalama_gecikme_gun != null)
    .sort((a, b) => (b.ortalama_gecikme_gun || 0) - (a.ortalama_gecikme_gun || 0))
}
