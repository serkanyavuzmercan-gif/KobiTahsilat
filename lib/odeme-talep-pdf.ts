import 'server-only'
import fs from 'fs'
import path from 'path'
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { CariBakiye } from './types'
import { buildOdemeTalepDokum } from './odeme-talep-dokum'

// A4 (pt)
const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 40
const BODY_BOTTOM = 90 // toplamlar + dipnot için ayrılan alt boşluk

const BRAND = rgb(0.06, 0.24, 0.39) // #0f3d64
const RED = rgb(0.72, 0.11, 0.09)
const GREY = rgb(0.4, 0.45, 0.5)
const LINE = rgb(0.85, 0.88, 0.91)
const HEADBG = rgb(0.95, 0.97, 0.99)

// Sütun sağ kenarları (x). Kullanılabilir alan: MARGIN..PAGE_W-MARGIN
const COL = {
  sira: { left: MARGIN, right: MARGIN + 32 },
  belge: { left: MARGIN + 32, right: MARGIN + 32 + 150 },
  faturaTarih: { left: MARGIN + 182, right: MARGIN + 182 + 82 },
  vadeTarih: { left: MARGIN + 264, right: MARGIN + 264 + 82 },
  gecikme: { left: MARGIN + 346, right: MARGIN + 346 + 60 },
  tutar: { left: MARGIN + 406, right: PAGE_W - MARGIN },
}

let regularBytes: Buffer | null = null
let boldBytes: Buffer | null = null
function loadFontBytes() {
  if (!regularBytes) {
    regularBytes = fs.readFileSync(
      path.join(process.cwd(), 'assets/fonts/LiberationSans-Regular.ttf')
    )
  }
  if (!boldBytes) {
    boldBytes = fs.readFileSync(path.join(process.cwd(), 'assets/fonts/LiberationSans-Bold.ttf'))
  }
  return { regularBytes, boldBytes }
}

function trDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

function money(n: number): string {
  const s = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
  return `${s} TL`
}

/** Metni sütun genişliğine sığacak şekilde kısaltır. */
function fit(font: PDFFont, text: string, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return `${cut}…`
}

export async function renderOdemeTalepPdf(
  cari: CariBakiye,
  snapshotTarihi: string
): Promise<Uint8Array> {
  const dokum = buildOdemeTalepDokum(cari.acik_kalemler, cari.bakiye)

  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const { regularBytes: reg, boldBytes: bld } = loadFontBytes()
  const font = await pdf.embedFont(reg, { subset: true })
  const bold = await pdf.embedFont(bld, { subset: true })

  let page = pdf.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  const rightText = (p: PDFPage, text: string, rightX: number, yy: number, size: number, f: PDFFont, color = rgb(0.1, 0.13, 0.16)) => {
    const w = f.widthOfTextAtSize(text, size)
    p.drawText(text, { x: rightX - w, y: yy, size, font: f, color })
  }

  // ---- Başlık ----
  page.drawText('HİDROTEKNİK A.Ş.', { x: MARGIN, y: y - 6, size: 16, font: bold, color: BRAND })
  rightText(page, trDate(snapshotTarihi), PAGE_W - MARGIN, y - 6, 10, font, GREY)
  y -= 26
  page.drawText('Vadesi Geçmiş Fatura Dökümü / Ödeme Talebi', {
    x: MARGIN,
    y: y - 6,
    size: 12,
    font: bold,
    color: rgb(0.1, 0.13, 0.16),
  })
  y -= 24
  page.drawText(fit(bold, cari.firma_adi.trim(), 12, PAGE_W - 2 * MARGIN), {
    x: MARGIN,
    y: y - 6,
    size: 12,
    font: bold,
    color: rgb(0.1, 0.13, 0.16),
  })
  y -= 16
  page.drawText(`Cari kod: ${cari.cari_kod}`, { x: MARGIN, y: y - 6, size: 9, font, color: GREY })
  y -= 22

  // ---- Tablo başlığı ----
  const drawTableHead = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - 16,
      width: PAGE_W - 2 * MARGIN,
      height: 18,
      color: HEADBG,
    })
    const hy = y - 12
    const hs = 8.5
    page.drawText('#', { x: COL.sira.left + 3, y: hy, size: hs, font: bold, color: GREY })
    page.drawText('Fatura No', { x: COL.belge.left + 3, y: hy, size: hs, font: bold, color: GREY })
    page.drawText('Fatura Tar.', { x: COL.faturaTarih.left + 3, y: hy, size: hs, font: bold, color: GREY })
    page.drawText('Vade Tar.', { x: COL.vadeTarih.left + 3, y: hy, size: hs, font: bold, color: GREY })
    rightText(page, 'Gecikme', COL.gecikme.right - 3, hy, hs, bold, GREY)
    rightText(page, 'Tutar', COL.tutar.right - 3, hy, hs, bold, GREY)
    y -= 20
  }

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H])
    y = PAGE_H - MARGIN
    drawTableHead()
  }

  drawTableHead()

  // ---- Satırlar ----
  const rowH = 15
  const rs = 8.5
  let sira = 0
  for (const f of dokum.faturalar) {
    if (y - rowH < BODY_BOTTOM) newPage()
    sira += 1
    const ty = y - 10
    page.drawText(String(sira), { x: COL.sira.left + 3, y: ty, size: rs, font, color: GREY })
    page.drawText(fit(font, f.belge_no, rs, COL.belge.right - COL.belge.left - 6), {
      x: COL.belge.left + 3,
      y: ty,
      size: rs,
      font,
      color: rgb(0.1, 0.13, 0.16),
    })
    page.drawText(trDate(f.fatura_tarihi), { x: COL.faturaTarih.left + 3, y: ty, size: rs, font, color: rgb(0.1, 0.13, 0.16) })
    page.drawText(trDate(f.vade_tarihi), { x: COL.vadeTarih.left + 3, y: ty, size: rs, font, color: rgb(0.1, 0.13, 0.16) })
    rightText(page, `${f.gecikme_gun} gün`, COL.gecikme.right - 3, ty, rs, font, RED)
    rightText(page, money(f.tutar), COL.tutar.right - 3, ty, rs, font, rgb(0.1, 0.13, 0.16))
    page.drawLine({
      start: { x: MARGIN, y: y - rowH },
      end: { x: PAGE_W - MARGIN, y: y - rowH },
      thickness: 0.5,
      color: LINE,
    })
    y -= rowH
  }

  // ---- Devir/Diğer satırı ----
  if (dokum.diger_toplam > 0) {
    if (y - rowH < BODY_BOTTOM) newPage()
    const ty = y - 10
    page.drawText(
      `Devir / diğer kalemler (${dokum.diger_adet} adet)`,
      { x: COL.belge.left + 3, y: ty, size: rs, font, color: GREY }
    )
    rightText(page, money(dokum.diger_toplam), COL.tutar.right - 3, ty, rs, font, rgb(0.1, 0.13, 0.16))
    page.drawLine({
      start: { x: MARGIN, y: y - rowH },
      end: { x: PAGE_W - MARGIN, y: y - rowH },
      thickness: 0.5,
      color: LINE,
    })
    y -= rowH
  }

  // ---- Toplamlar ----
  y -= 12
  const boxTop = y
  const boxH = 46
  page.drawRectangle({
    x: MARGIN,
    y: boxTop - boxH,
    width: PAGE_W - 2 * MARGIN,
    height: boxH,
    color: HEADBG,
    borderColor: LINE,
    borderWidth: 0.5,
  })
  page.drawText('Vadesi dolan toplam', { x: MARGIN + 12, y: boxTop - 18, size: 10, font, color: GREY })
  rightText(page, money(dokum.vadesi_gecen_toplam), PAGE_W - MARGIN - 12, boxTop - 18, 12, bold, RED)
  page.drawText('Genel bakiye (vadesi gelmemişler dahil)', { x: MARGIN + 12, y: boxTop - 36, size: 10, font, color: GREY })
  rightText(page, money(dokum.genel_bakiye), PAGE_W - MARGIN - 12, boxTop - 36, 12, bold, BRAND)
  y = boxTop - boxH - 20

  // ---- Dipnot ----
  const notu =
    'Yukarıdaki tutarlar kayıtlarımıza göre vadesi geçmiş açık faturalarınızdır. ' +
    'Ödeme yaptıysanız veya bir hata olduğunu düşünüyorsanız lütfen bizimle iletişime geçin.'
  const words = notu.split(' ')
  let line = ''
  let ny = Math.max(y, 60)
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(test, 8.5) > PAGE_W - 2 * MARGIN) {
      page.drawText(line, { x: MARGIN, y: ny, size: 8.5, font, color: GREY })
      ny -= 12
      line = w
    } else {
      line = test
    }
  }
  if (line) page.drawText(line, { x: MARGIN, y: ny, size: 8.5, font, color: GREY })
  page.drawText('Hidroteknik A.Ş. · info@hidroteknik.com.tr · +90 258 251 40 60', {
    x: MARGIN,
    y: ny - 16,
    size: 8.5,
    font,
    color: BRAND,
  })

  return pdf.save()
}
