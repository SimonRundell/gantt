import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { slugify } from './downloadFile.js'
import { capScaleToPageBudget, HEADER_MM, MARGIN_MM, MM_PER_PX, pageContentArea, safePixelRatio } from './pdfLayout.js'

export { safePixelRatio }

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
  const dataUrl = await toPng(node, {
    pixelRatio: safePixelRatio(node),
    backgroundColor: '#ffffff',
    cacheBust: true,
  })
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
 * page, then triggers a download. The number of pages is capped (see
 * {@link MAX_TILE_PAGES} in `lib/pdfLayout.js`): a long or detailed
 * chart backs off from "actual size" automatically rather than
 * producing a PDF nobody could use.
 * @param {HTMLElement} node - the element to rasterise
 * @param {object} options
 * @param {string} options.title - the project title, used for the filename and header
 * @param {'a4'|'a3'} options.pageSize - the page size
 * @param {'portrait'|'landscape'} options.orientation - the page orientation
 * @param {'width'|'tile'} options.fit - "width" scales the whole chart to one page's width, tiling vertically as needed; "tile" prints close to actual size across a grid of pages, capped to a sane page count
 * @returns {Promise<void>} resolves once the download has started
 */
export async function exportChartAsPdf(node, { title, pageSize, orientation, fit }) {
  const pixelRatio = safePixelRatio(node)
  const dataUrl = await toPng(node, { pixelRatio, backgroundColor: '#ffffff', cacheBust: true })
  const img = await loadImage(dataUrl)
  const pixelWidth = img.width
  const pixelHeight = img.height

  const { pageWidthMm, pageHeightMm, contentWidthMm, contentHeightMm } = pageContentArea(pageSize, orientation)
  const startingScale = fit === 'width' ? contentWidthMm / pixelWidth : MM_PER_PX / pixelRatio
  const { scale, columns, rows: pageRows, totalPages, pageContentWidthPx, pageContentHeightPx } = capScaleToPageBudget(
    startingScale,
    contentWidthMm,
    contentHeightMm,
    pixelWidth,
    pixelHeight,
  )

  const doc = new jsPDF({ orientation, unit: 'mm', format: pageSize })
  const { iso: dateIso, compact: dateCompact } = todayStamp()
  let pageIndex = 0

  for (let row = 0; row < pageRows; row++) {
    for (let col = 0; col < columns; col++) {
      const sx = Math.round(col * pageContentWidthPx)
      const sy = Math.round(row * pageContentHeightPx)
      // Skip a tile whose top-left corner has already rounded past the
      // captured image's actual edge (possible on the last row/column
      // from floating point rounding) rather than drawing a 0x0 canvas,
      // which produces a data URL jsPDF cannot decode as a PNG.
      if (sx >= pixelWidth || sy >= pixelHeight) continue
      const sw = Math.max(1, Math.min(Math.round(pageContentWidthPx), pixelWidth - sx))
      const sh = Math.max(1, Math.min(Math.round(pageContentHeightPx), pixelHeight - sy))

      if (pageIndex > 0) doc.addPage()

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
