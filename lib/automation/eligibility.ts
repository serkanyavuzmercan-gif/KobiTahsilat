import 'server-only'
import { cariOrtalamaGecikmeGun } from '../gecikme'
import { loadSnapshot } from '../data'
import type { HatirlatmaCari } from '../hatirlatma-data'
import type { MutabakatCari } from '../mutabakat-data'
import { formatPhoneDisplay } from '../phone'
import { isTestCari } from '../test-cariler'
import type { AutomationChannel, AutomationRule, AutomationRunCandidate } from './types'

export function matchesDelayRule(
  ortalamaGecikme: number | null,
  minGun: number,
  gecikmisBakiye: number
) {
  if (gecikmisBakiye <= 0.01) return false
  if (ortalamaGecikme == null) return false
  return ortalamaGecikme >= minGun
}

function buildCandidate(
  cari: { cari_kod: string; firma_adi: string; gecikmis_bakiye: number },
  rule: AutomationRule,
  ortalamaGecikme: number,
  alici: string | null,
  engel: string | null
): AutomationRunCandidate {
  return {
    cari_kod: cari.cari_kod,
    firma_adi: cari.firma_adi,
    kanal: rule.kanal,
    kural_id: rule.id,
    ortalama_gecikme_gun: ortalamaGecikme,
    gecikmis_bakiye: cari.gecikmis_bakiye,
    alici,
    engel,
  }
}

export function collectEmailCandidates(
  rule: AutomationRule,
  cariler: MutabakatCari[]
): AutomationRunCandidate[] {
  return cariler.flatMap((cari) => {
    if (isTestCari(cari.cari_kod)) return []
    const ortalama = cariOrtalamaGecikmeGun(cari)
    if (!matchesDelayRule(ortalama, rule.min_ortalama_gecikme_gun, cari.gecikmis_bakiye)) {
      return []
    }

    let engel: string | null = null
    let alici: string | null = cari.email_adresleri[0] || null

    if (!cari.email) engel = 'Doğrulanmış e-posta yok'
    else if (cari.mutabakat_gonderim_engelli) engel = 'E-posta bekleme süresi aktif'

    return [buildCandidate(cari, rule, ortalama!, alici, engel)]
  })
}

export function collectWhatsAppCandidates(
  rule: AutomationRule,
  cariler: HatirlatmaCari[]
): AutomationRunCandidate[] {
  return cariler.flatMap((cari) => {
    if (isTestCari(cari.cari_kod)) return []
    const ortalama = cariOrtalamaGecikmeGun(cari)
    if (!matchesDelayRule(ortalama, rule.min_ortalama_gecikme_gun, cari.gecikmis_bakiye)) {
      return []
    }

    let engel: string | null = null
    const alici = cari.telefon ? formatPhoneDisplay(cari.telefon) : null

    if (!cari.telefon) engel = 'Kayıtlı cep telefonu yok'

    return [buildCandidate(cari, rule, ortalama!, alici, engel)]
  })
}

export function listSnapshotDelaySummary() {
  const snapshot = loadSnapshot()
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
