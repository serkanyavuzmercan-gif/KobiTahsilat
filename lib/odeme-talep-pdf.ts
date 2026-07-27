import 'server-only'
import fs from 'fs'
import path from 'path'
import { PDFDocument, PDFFont, PDFImage, PDFName, PDFPage, PDFString, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { CariBakiye } from './types'
import { buildOdemeTalepDokum } from './odeme-talep-dokum'

// A4 (pt)
const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 40
const BODY_BOTTOM = 96
const HEADER_H = 88

const BRAND = rgb(0.06, 0.24, 0.39) // #0f3d64
const BRAND_SOFT = rgb(0.72, 0.8, 0.88)
const INK = rgb(0.1, 0.13, 0.16)
const RED = rgb(0.72, 0.11, 0.09)
const RED_SOFT = rgb(0.99, 0.95, 0.95)
const GREY = rgb(0.42, 0.47, 0.52)
const LINE = rgb(0.86, 0.89, 0.92)
const ZEBRA = rgb(0.97, 0.98, 0.99)
const WHITE = rgb(1, 1, 1)

const COL = {
  sira: { left: MARGIN, right: MARGIN + 30 },
  belge: { left: MARGIN + 30, right: MARGIN + 30 + 152 },
  faturaTarih: { left: MARGIN + 182, right: MARGIN + 182 + 82 },
  vadeTarih: { left: MARGIN + 264, right: MARGIN + 264 + 82 },
  gecikme: { left: MARGIN + 346, right: MARGIN + 346 + 60 },
  tutar: { left: MARGIN + 406, right: PAGE_W - MARGIN },
}

let regularBytes: Buffer | null = null
let boldBytes: Buffer | null = null
let logoBytes: Buffer | null = null
function loadAssets() {
  const root = process.cwd()
  if (!regularBytes) regularBytes = fs.readFileSync(path.join(root, 'assets/fonts/LiberationSans-Regular.ttf'))
  if (!boldBytes) boldBytes = fs.readFileSync(path.join(root, 'assets/fonts/LiberationSans-Bold.ttf'))
  if (!logoBytes) {
    try {
      logoBytes = fs.readFileSync(path.join(root, 'assets/hidroteknik-logo.png'))
    } catch {
      logoBytes = null
    }
  }
  return { regularBytes, boldBytes, logoBytes }
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
  snapshotTarihi: string,
  /** Varsa dökümün altına tıklanabilir "Online öde (PayTR)" CTA'sı eklenir. */
  odemeUrl?: string | null
): Promise<Uint8Array> {
  const dokum = buildOdemeTalepDokum(cari.acik_kalemler, cari.bakiye)

  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const { regularBytes: reg, boldBytes: bld, logoBytes: logoBuf } = loadAssets()
  const font = await pdf.embedFont(reg, { subset: true })
  const bold = await pdf.embedFont(bld, { subset: true })
  let logo: PDFImage | null = null
  if (logoBuf) {
    try {
      logo = await pdf.embedPng(logoBuf)
    } catch {
      logo = null
    }
  }

  let page = pdf.addPage([PAGE_W, PAGE_H])
  let y = 0

  const rightText = (
    p: PDFPage,
    text: string,
    rightX: number,
    yy: number,
    size: number,
    f: PDFFont,
    color = INK
  ) => {
    const w = f.widthOfTextAtSize(text, size)
    p.drawText(text, { x: rightX - w, y: yy, size, font: f, color })
  }

  // ---- Markalı üst bant ----
  const drawHeaderBand = (p: PDFPage) => {
    p.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: BRAND })
    p.drawText('Cari Hesap Ödeme Talebi', {
      x: MARGIN,
      y: PAGE_H - 40,
      size: 19,
      font: bold,
      color: WHITE,
    })
    p.drawText('Vadesi geçmiş fatura dökümü', {
      x: MARGIN,
      y: PAGE_H - 60,
      size: 10,
      font,
      color: BRAND_SOFT,
    })
    if (logo) {
      // Logo şeffaf zeminli ve koyu → beyaz kutu üstünde göster.
      const logoH = 30
      const logoW = (logo.width / logo.height) * logoH
      const boxW = logoW + 20
      const boxH = logoH + 16
      const boxX = PAGE_W - MARGIN - boxW
      const boxY = PAGE_H - 20 - boxH
      p.drawRectangle({ x: boxX, y: boxY, width: boxW, height: boxH, color: WHITE })
      p.drawImage(logo, { x: boxX + 10, y: boxY + 8, width: logoW, height: logoH })
    }
  }

  drawHeaderBand(page)
  y = PAGE_H - HEADER_H - 26

  // ---- Firma + tarih ----
  page.drawText(fit(bold, cari.firma_adi.trim(), 13, PAGE_W - 2 * MARGIN - 120), {
    x: MARGIN,
    y,
    size: 13,
    font: bold,
    color: INK,
  })
  rightText(page, trDate(snapshotTarihi), PAGE_W - MARGIN, y, 10, font, GREY)
  y -= 15
  page.drawText(`Cari kod: ${cari.cari_kod}`, { x: MARGIN, y, size: 9, font, color: GREY })
  y -= 22

  page.drawText(
    'Sayın yetkili, kayıtlarımıza göre vadesi geçmiş faturalarınızın dökümü aşağıdadır.',
    { x: MARGIN, y, size: 9.5, font, color: rgb(0.3, 0.34, 0.38) }
  )
  y -= 20

  // ---- Tablo başlığı ----
  const drawTableHead = (p: PDFPage) => {
    p.drawRectangle({
      x: MARGIN,
      y: y - 18,
      width: PAGE_W - 2 * MARGIN,
      height: 20,
      color: BRAND,
    })
    const hy = y - 12.5
    const hs = 8.5
    p.drawText('#', { x: COL.sira.left + 5, y: hy, size: hs, font: bold, color: WHITE })
    p.drawText('Fatura No', { x: COL.belge.left + 4, y: hy, size: hs, font: bold, color: WHITE })
    p.drawText('Fatura Tar.', { x: COL.faturaTarih.left + 4, y: hy, size: hs, font: bold, color: WHITE })
    p.drawText('Vade Tar.', { x: COL.vadeTarih.left + 4, y: hy, size: hs, font: bold, color: WHITE })
    rightText(p, 'Gecikme', COL.gecikme.right - 4, hy, hs, bold, WHITE)
    rightText(p, 'Tutar', COL.tutar.right - 4, hy, hs, bold, WHITE)
    y -= 22
  }

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H])
    y = PAGE_H - MARGIN
    drawTableHead(page)
  }

  drawTableHead(page)

  // ---- Satırlar (zebra) ----
  const rowH = 16
  const rs = 8.5
  let sira = 0
  for (const f of dokum.faturalar) {
    if (y - rowH < BODY_BOTTOM) newPage()
    sira += 1
    if (sira % 2 === 0) {
      page.drawRectangle({
        x: MARGIN,
        y: y - rowH + 2,
        width: PAGE_W - 2 * MARGIN,
        height: rowH,
        color: ZEBRA,
      })
    }
    const ty = y - 11
    page.drawText(String(sira), { x: COL.sira.left + 5, y: ty, size: rs, font, color: GREY })
    page.drawText(fit(font, f.belge_no, rs, COL.belge.right - COL.belge.left - 8), {
      x: COL.belge.left + 4,
      y: ty,
      size: rs,
      font,
      color: INK,
    })
    page.drawText(trDate(f.fatura_tarihi), { x: COL.faturaTarih.left + 4, y: ty, size: rs, font, color: INK })
    page.drawText(trDate(f.vade_tarihi), { x: COL.vadeTarih.left + 4, y: ty, size: rs, font, color: INK })
    rightText(page, `${f.gecikme_gun} gün`, COL.gecikme.right - 4, ty, rs, bold, RED)
    rightText(page, money(f.tutar), COL.tutar.right - 4, ty, rs, font, INK)
    y -= rowH
  }

  // ---- Devir/Diğer ----
  if (dokum.diger_toplam > 0) {
    if (y - rowH < BODY_BOTTOM) newPage()
    const ty = y - 11
    page.drawText(`Devir / diğer kalemler (${dokum.diger_adet} adet)`, {
      x: COL.belge.left + 4,
      y: ty,
      size: rs,
      font,
      color: GREY,
    })
    rightText(page, money(dokum.diger_toplam), COL.tutar.right - 4, ty, rs, font, INK)
    y -= rowH
  }

  // tablo alt çizgisi
  page.drawLine({
    start: { x: MARGIN, y: y + 1 },
    end: { x: PAGE_W - MARGIN, y: y + 1 },
    thickness: 0.7,
    color: LINE,
  })

  // ---- Toplamlar ----
  if (y - 70 < 60) newPage()
  y -= 16
  const boxH = 54
  const boxTop = y
  // Vadesi dolan (kırmızı vurgulu)
  page.drawRectangle({
    x: MARGIN,
    y: boxTop - boxH,
    width: PAGE_W - 2 * MARGIN,
    height: boxH,
    color: WHITE,
    borderColor: LINE,
    borderWidth: 0.8,
  })
  page.drawRectangle({ x: MARGIN, y: boxTop - boxH, width: 4, height: boxH, color: RED })
  page.drawRectangle({
    x: MARGIN,
    y: boxTop - 27,
    width: PAGE_W - 2 * MARGIN,
    height: 27,
    color: RED_SOFT,
  })
  page.drawText('Vadesi dolan toplam', { x: MARGIN + 14, y: boxTop - 19, size: 10.5, font: bold, color: RED })
  rightText(page, money(dokum.vadesi_gecen_toplam), PAGE_W - MARGIN - 14, boxTop - 19, 13, bold, RED)
  page.drawText('Genel bakiye (vadesi gelmemişler dahil)', {
    x: MARGIN + 14,
    y: boxTop - 44,
    size: 10,
    font,
    color: GREY,
  })
  rightText(page, money(dokum.genel_bakiye), PAGE_W - MARGIN - 14, boxTop - 44, 12, bold, BRAND)
  y = boxTop - boxH - 22

  // ---- Online ödeme CTA (tıklanabilir) ---- (hata döküm PDF'ini bozmasın)
  try {
  if (odemeUrl) {
    const SKY = rgb(0.02, 0.52, 0.78)
    const SKY_SOFT = rgb(0.9, 0.96, 1)
    const cH = 40
    const cTop = y
    page.drawRectangle({
      x: MARGIN,
      y: cTop - cH,
      width: PAGE_W - 2 * MARGIN,
      height: cH,
      color: SKY_SOFT,
      borderColor: SKY,
      borderWidth: 1,
    })
    page.drawText('Online öde — kartla güvenli ödeme (PayTR)', {
      x: MARGIN + 14,
      y: cTop - 17,
      size: 11,
      font: bold,
      color: SKY,
    })
    page.drawText(fit(font, odemeUrl, 9, PAGE_W - 2 * MARGIN - 28), {
      x: MARGIN + 14,
      y: cTop - 31,
      size: 9,
      font,
      color: SKY,
    })
    // Kutunun tamamını kaplayan tıklanabilir link (URI action).
    const annot = pdf.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [MARGIN, cTop - cH, PAGE_W - MARGIN, cTop],
      Border: [0, 0, 0],
      A: pdf.context.obj({ Type: 'Action', S: 'URI', URI: PDFString.of(odemeUrl) }),
    })
    page.node.set(PDFName.of('Annots'), pdf.context.obj([pdf.context.register(annot)]))
    y = cTop - cH - 18
  }
  } catch {
    // CTA çizilemezse sessizce atla; döküm yine tam üretilir.
  }

  // ---- Dipnot ----
  const notu =
    'Yukarıdaki tutarlar kayıtlarımıza göre vadesi geçmiş açık faturalarınızdır. Ödeme yaptıysanız ' +
    'veya bir hata olduğunu düşünüyorsanız lütfen bizimle iletişime geçiniz. İlginiz için teşekkür ederiz.'
  let line = ''
  let ny = Math.max(y, 66)
  for (const w of notu.split(' ')) {
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

  page.drawLine({
    start: { x: MARGIN, y: ny - 12 },
    end: { x: PAGE_W - MARGIN, y: ny - 12 },
    thickness: 0.7,
    color: BRAND,
  })
  page.drawText('Hidroteknik A.Ş.', { x: MARGIN, y: ny - 26, size: 9, font: bold, color: BRAND })
  rightText(
    page,
    'info@hidroteknik.com.tr · +90 258 251 40 60',
    PAGE_W - MARGIN,
    ny - 26,
    8.5,
    font,
    GREY
  )

  return pdf.save()
}
