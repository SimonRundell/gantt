import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { slugify } from './downloadFile.js'

/** @type {Record<'a4'|'a3', [number, number]>} page sizes in millimetres, portrait (width, height) */
const PAGE_SIZES_MM = { a4: [210, 297], a3: [297, 420] }

const MARGIN_MM = 10
const HEADER_MM = 8
const FOOTER_MM = 7
/** @type {number} millimetres per CSS pixel at the usual 96 DPI, used for "actual size" tiling */
const MM_PER_PX = 25.4 / 96

/** @type {number} longest canvas side most browsers will draw reliably (Firefox and Safari are stricter than Chrome) */
const MAX_CANVAS_SIDE_PX = 16000
/** @type {number} largest canvas area (in pixels) that is safe across browsers */
const MAX_CANVAS_AREA_PX = 100_000_000

/**
 * Picks how many image pixels to render per CSS pixel. Normally 2 for a
 * crisp result, but reduced for very large charts so the canvas stays
 * within browser limits and the whole chart is exported rather than a
 * blank or truncated image.
 * @param {HTMLElement} node - the element about to be rasterised
 * @returns {number} the pixel ratio to use, between a small minimum and 2
 */
export function safePixelRatio(node) {
  const { width, height } = node.getBoundingClientRect()
  const bySide = MAX_CANVAS_SIDE_PX / Math.max(width, height, 1)
  const byArea = Math.sqrt(MAX_CANVAS_AREA_PX / Math.max(width * height, 1))
  return Math.max(0.25, Math.min(2, bySide, byArea))
}

/**
 * Loads a data URL into an Image element, so its pixel dimensions and
 * pixels can be read via canvas.
 * @param {string} dataUrl - the image data URL
 * @returns {Promise<HTMLImageElement>} resolves once the image has loaded
 */
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

/**
 * Builds today's date stamp for filenames and PDF headers.
 * @returns {{iso: string, compact: string}} today's date as an ISO string and as yyyymmdd
 */
function todayStamp() {
  const iso = new Date().toISOString().slice(0, 10)
  return { iso, compact: iso.replace(/-/g, '') }
}

/**
 * Rasterises a DOM node (the whole chart, rendered off-screen at full
 * size with no scrolling) into a PNG and triggers a download.
 * @param {HTMLElement} node - the element to rasterise
 * @param {string} title - the project title, used for the filename
 * @returns {Promise<void>} resolves once the download has started
 */
export async function exportChartAsPng(node, title) {
  const dataUrl = await toPng(node, { pixelRatio: safePixelRatio(node), backgroundColor: '#ffffff', cacheBust: true })
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `${slugify(title)}-${todayStamp().compact}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Rasterises a DOM node and lays it out across one or more PDF pages,
 * with a title/date header and a page-number/licence footer on every
 * page, then triggers a download.
 * @param {HTMLElement} node - the element to rasterise
 * @param {object} options
 * @param {string} options.title - the project title, used for the filename and header
 * @param {'a4'|'a3'} options.pageSize - the page size
 * @param {'portrait'|'landscape'} options.orientation - the page orientation
 * @param {'width'|'tile'} options.fit - "width" scales the whole chart to one page's width, tiling vertically as needed; "tile" prints near actual size across a grid of pages
 * @returns {Promise<void>} resolves once the download has started
 */
export async function exportChartAsPdf(node, { title, pageSize, orientation, fit }) {
  const pixelRatio = safePixelRatio(node)
  const dataUrl = await toPng(node, { pixelRatio, backgroundColor: '#ffffff', cacheBust: true })
  const img = await loadImage(dataUrl)
  const pixelWidth = img.width
  const pixelHeight = img.height

  const [sizeA, sizeB] = PAGE_SIZES_MM[pageSize]
  const pageWidthMm = orientation === 'landscape' ? Math.max(sizeA, sizeB) : Math.min(sizeA, sizeB)
  const pageHeightMm = orientation === 'landscape' ? Math.min(sizeA, sizeB) : Math.max(sizeA, sizeB)
  const contentWidthMm = pageWidthMm - MARGIN_MM * 2
  const contentHeightMm = pageHeightMm - MARGIN_MM * 2 - HEADER_MM - FOOTER_MM

  const scale = fit === 'width' ? contentWidthMm / pixelWidth : MM_PER_PX / pixelRatio
  const pageContentWidthPx = contentWidthMm / scale
  const pageContentHeightPx = contentHeightMm / scale

  const columns = Math.max(1, Math.ceil(pixelWidth / pageContentWidthPx))
  const pageRows = Math.max(1, Math.ceil(pixelHeight / pageContentHeightPx))
  const totalPages = columns * pageRows

  const doc = new jsPDF({ orientation, unit: 'mm', format: pageSize })
  const { iso: dateIso, compact: dateCompact } = todayStamp()
  let pageIndex = 0

  for (let row = 0; row < pageRows; row++) {
    for (let col = 0; col < columns; col++) {
      if (pageIndex > 0) doc.addPage()

      const sx = col * pageContentWidthPx
      const sy = row * pageContentHeightPx
      const sw = Math.min(pageContentWidthPx, pixelWidth - sx)
      const sh = Math.min(pageContentHeightPx, pixelHeight - sy)

      const tileCanvas = document.createElement('canvas')
      tileCanvas.width = sw
      tileCanvas.height = sh
      tileCanvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)

      doc.setFontSize(10)
      doc.text(`${title} - exported ${dateIso}`, MARGIN_MM, MARGIN_MM)
      doc.addImage(tileCanvas.toDataURL('image/png'), 'PNG', MARGIN_MM, MARGIN_MM + HEADER_MM, sw * scale, sh * scale)

      pageIndex++
      doc.setFontSize(8)
      doc.text(`Page ${pageIndex} of ${totalPages}`, MARGIN_MM, pageHeightMm - MARGIN_MM + 3)
      doc.text('CC BY-NC-SA 4.0', pageWidthMm - MARGIN_MM - 25, pageHeightMm - MARGIN_MM + 3)
    }
  }

  doc.save(`${slugify(title)}-${dateCompact}.pdf`)
}
