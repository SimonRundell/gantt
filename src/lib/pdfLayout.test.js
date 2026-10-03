import { describe, expect, it } from 'vitest'
import { capScaleToPageBudget, estimatePdfPageCount, MAX_TILE_PAGES, pageContentArea, pageGridAt } from './pdfLayout.js'

/**
 * Builds a stand-in element that reports a fixed size.
 * @param {number} width - the width in CSS pixels
 * @param {number} height - the height in CSS pixels
 * @returns {HTMLElement} a fake node
 */
function nodeOfSize(width, height) {
  return { getBoundingClientRect: () => ({ width, height }) }
}

describe('pageContentArea', () => {
  it('swaps width and height for portrait vs landscape', () => {
    const landscape = pageContentArea('a4', 'landscape')
    const portrait = pageContentArea('a4', 'portrait')
    expect(landscape.pageWidthMm).toBe(portrait.pageHeightMm)
    expect(landscape.pageHeightMm).toBe(portrait.pageWidthMm)
  })

  it('subtracts margins, header and footer from the printable area', () => {
    const { pageWidthMm, contentWidthMm } = pageContentArea('a4', 'portrait')
    expect(contentWidthMm).toBeLessThan(pageWidthMm)
  })
})

describe('pageGridAt', () => {
  it('fits everything on one page when the content is small enough', () => {
    const grid = pageGridAt(1, 200, 200, 150, 150)
    expect(grid).toEqual({ columns: 1, rows: 1, totalPages: 1, pageContentWidthPx: 200, pageContentHeightPx: 200 })
  })

  it('tiles across multiple pages when the content is bigger than one page', () => {
    const grid = pageGridAt(1, 100, 100, 250, 150)
    expect(grid.columns).toBe(3)
    expect(grid.rows).toBe(2)
    expect(grid.totalPages).toBe(6)
  })
})

describe('capScaleToPageBudget', () => {
  it('leaves the scale alone when already within the page budget', () => {
    const result = capScaleToPageBudget(1, 200, 200, 300, 300)
    expect(result.scale).toBe(1)
    expect(result.totalPages).toBeLessThanOrEqual(MAX_TILE_PAGES)
  })

  it('backs off the scale until a huge chart fits the page budget', () => {
    // Reproduces the real bug this was written for: a ~130 task chart
    // at day zoom, tiled at "actual size" (captured ~15700x6400px),
    // used to demand 11 x 7 = 77 A4 pages.
    const actualSizeScale = 0.1798
    const uncapped = pageGridAt(actualSizeScale, 277, 175, 15721, 6362)
    expect(uncapped.totalPages).toBeGreaterThan(MAX_TILE_PAGES)

    const capped = capScaleToPageBudget(actualSizeScale, 277, 175, 15721, 6362)
    expect(capped.totalPages).toBeLessThanOrEqual(MAX_TILE_PAGES)
    expect(capped.totalPages).toBeGreaterThan(0)
    // A smaller scale packs more source pixels onto each page, so
    // capping to fewer pages means the scale had to shrink.
    expect(capped.scale).toBeLessThan(actualSizeScale)
  })

  it('never returns zero pages even for a tiny chart', () => {
    const result = capScaleToPageBudget(1, 200, 200, 1, 1)
    expect(result.totalPages).toBeGreaterThanOrEqual(1)
  })
})

describe('estimatePdfPageCount', () => {
  it('matches a direct capScaleToPageBudget calculation for the same inputs', () => {
    const node = nodeOfSize(1600, 800)
    const estimate = estimatePdfPageCount({ node, pageSize: 'a4', orientation: 'landscape', fit: 'width' })
    expect(estimate).toBeGreaterThanOrEqual(1)
    expect(estimate).toBeLessThanOrEqual(MAX_TILE_PAGES)
  })

  it('stays within the page budget for a very large, detailed chart', () => {
    const node = nodeOfSize(10680, 4322)
    const estimate = estimatePdfPageCount({ node, pageSize: 'a4', orientation: 'landscape', fit: 'tile' })
    expect(estimate).toBeLessThanOrEqual(MAX_TILE_PAGES)
  })

  it('returns 1 for a zero-sized node rather than dividing by zero', () => {
    const node = nodeOfSize(0, 0)
    expect(estimatePdfPageCount({ node, pageSize: 'a4', orientation: 'landscape', fit: 'tile' })).toBe(1)
  })
})
