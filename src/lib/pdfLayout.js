/**
 * Pure page-layout maths for PDF export: how a captured chart image
 * maps onto one or more physical pages. Deliberately has no
 * dependency on jsPDF or html-to-image, so it can be imported by the
 * export dialog for a live page-count estimate without pulling
 * several hundred kilobytes of PDF/image rendering code into the
 * main bundle just to show a number.
 * @module lib/pdfLayout
 */

/** @type {Record<'a4'|'a3', [number, number]>} page sizes in millimetres, portrait (width, height) */
export const PAGE_SIZES_MM = { a4: [210, 297], a3: [297, 420] }

export const MARGIN_MM = 10
export const HEADER_MM = 8
export const FOOTER_MM = 7
/** @type {number} millimetres per CSS pixel at the usual 96 DPI, used for "actual size" tiling */
export const MM_PER_PX = 25.4 / 96

/** @type {number} longest canvas side most browsers will draw reliably (Firefox and Safari are stricter than Chrome) */
const MAX_CANVAS_SIDE_PX = 16000
/** @type {number} largest canvas area (in pixels) that is safe across browsers */
const MAX_CANVAS_AREA_PX = 100_000_000
/** @type {number} most pages "tile across pages" will ever produce, however large or zoomed-in the chart is - beyond this a PDF stops being something anyone would print or flick through */
export const MAX_TILE_PAGES = 20

/**
 * Picks how many image pixels to render per CSS pixel. Normally 2 for a
 * crisp result, but reduced for very large charts so the canvas stays
 * within browser limits and the whole chart is exported rather than a
 * blank or truncated image.
 * @param {{getBoundingClientRect: () => {width: number, height: number}}} node - the element about to be rasterised
 * @returns {number} the pixel ratio to use, between a small minimum and 2
 */
export function safePixelRatio(node) {
  const { width, height } = node.getBoundingClientRect()
  const bySide = MAX_CANVAS_SIDE_PX / Math.max(width, height, 1)
  const byArea = Math.sqrt(MAX_CANVAS_AREA_PX / Math.max(width * height, 1))
  return Math.max(0.25, Math.min(2, bySide, byArea))
}

/**
 * Works out a page's printable area in millimetres for a page size
 * and orientation.
 * @param {'a4'|'a3'} pageSize - the page size
 * @param {'portrait'|'landscape'} orientation - the page orientation
 * @returns {{pageWidthMm: number, pageHeightMm: number, contentWidthMm: number, contentHeightMm: number}} the page and its printable content area
 */
export function pageContentArea(pageSize, orientation) {
  const [sizeA, sizeB] = PAGE_SIZES_MM[pageSize]
  const pageWidthMm = orientation === 'landscape' ? Math.max(sizeA, sizeB) : Math.min(sizeA, sizeB)
  const pageHeightMm = orientation === 'landscape' ? Math.min(sizeA, sizeB) : Math.max(sizeA, sizeB)
  return {
    pageWidthMm,
    pageHeightMm,
    contentWidthMm: pageWidthMm - MARGIN_MM * 2,
    contentHeightMm: pageHeightMm - MARGIN_MM * 2 - HEADER_MM - FOOTER_MM,
  }
}

/**
 * Works out how many PDF pages a chart will need at a given scale,
 * and the pixel size of one page's worth of content at that scale.
 * @param {number} scale - millimetres per captured pixel
 * @param {number} contentWidthMm - one page's printable width
 * @param {number} contentHeightMm - one page's printable height
 * @param {number} pixelWidth - the captured image's full width in pixels
 * @param {number} pixelHeight - the captured image's full height in pixels
 * @returns {{columns: number, rows: number, totalPages: number, pageContentWidthPx: number, pageContentHeightPx: number}} the resulting page grid
 */
export function pageGridAt(scale, contentWidthMm, contentHeightMm, pixelWidth, pixelHeight) {
  const pageContentWidthPx = contentWidthMm / scale
  const pageContentHeightPx = contentHeightMm / scale
  const columns = Math.max(1, Math.ceil(pixelWidth / pageContentWidthPx))
  const rows = Math.max(1, Math.ceil(pixelHeight / pageContentHeightPx))
  return { columns, rows, totalPages: columns * rows, pageContentWidthPx, pageContentHeightPx }
}

/**
 * Finds a scale no finer than the one requested that keeps the total
 * page count within {@link MAX_TILE_PAGES}. A long or detailed chart
 * (printed "actual size", or at a zoomed-in day view) can otherwise
 * demand dozens or hundreds of pages, which is not something anyone
 * is going to print or read - so once the budget is reached, the
 * scale is backed off a little at a time (each page shows a bit more
 * of the chart, a bit smaller) until the whole thing fits the budget.
 * @param {number} startingScale - the ideal scale (millimetres per captured pixel) before any capping
 * @param {number} contentWidthMm - one page's printable width
 * @param {number} contentHeightMm - one page's printable height
 * @param {number} pixelWidth - the captured image's full width in pixels
 * @param {number} pixelHeight - the captured image's full height in pixels
 * @returns {{scale: number, columns: number, rows: number, totalPages: number, pageContentWidthPx: number, pageContentHeightPx: number}} a scale and its resulting page grid, guaranteed to be at or under the page budget
 */
export function capScaleToPageBudget(startingScale, contentWidthMm, contentHeightMm, pixelWidth, pixelHeight) {
  let scale = startingScale
  let grid = pageGridAt(scale, contentWidthMm, contentHeightMm, pixelWidth, pixelHeight)

  // Scale is millimetres of paper per captured pixel, so a *smaller*
  // scale packs more source pixels onto one page (fewer, bigger-content
  // pages); a larger scale is closer to "actual size" (more, smaller
  // pages). To bring the page count down, scale needs to shrink.
  for (let attempt = 0; attempt < 40 && grid.totalPages > MAX_TILE_PAGES; attempt++) {
    scale *= 0.85
    grid = pageGridAt(scale, contentWidthMm, contentHeightMm, pixelWidth, pixelHeight)
  }

  return { scale, ...grid }
}

/**
 * Estimates how many pages a PDF export will produce, using the same
 * maths as the real export, without rasterising anything. Used for a
 * live preview in the export dialog.
 * @param {object} options
 * @param {{getBoundingClientRect: () => {width: number, height: number}}} options.node - the chart's off-screen, unscrolled export element
 * @param {'a4'|'a3'} options.pageSize - the page size
 * @param {'portrait'|'landscape'} options.orientation - the page orientation
 * @param {'width'|'tile'} options.fit - the fit mode
 * @returns {number} the estimated number of pages
 */
export function estimatePdfPageCount({ node, pageSize, orientation, fit }) {
  const { width: cssWidth, height: cssHeight } = node.getBoundingClientRect()
  if (cssWidth <= 0 || cssHeight <= 0) return 1
  const pixelRatio = safePixelRatio(node)
  const pixelWidth = cssWidth * pixelRatio
  const pixelHeight = cssHeight * pixelRatio
  const { contentWidthMm, contentHeightMm } = pageContentArea(pageSize, orientation)
  const startingScale = fit === 'width' ? contentWidthMm / pixelWidth : MM_PER_PX / pixelRatio
  return capScaleToPageBudget(startingScale, contentWidthMm, contentHeightMm, pixelWidth, pixelHeight).totalPages
}
