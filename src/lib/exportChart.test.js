import { describe, expect, it } from 'vitest'
import { safePixelRatio } from './exportChart.js'

/**
 * Builds a stand-in element that reports a fixed size.
 * @param {number} width - the width in CSS pixels
 * @param {number} height - the height in CSS pixels
 * @returns {HTMLElement} a fake node for safePixelRatio
 */
function nodeOfSize(width, height) {
  return { getBoundingClientRect: () => ({ width, height }) }
}

describe('safePixelRatio', () => {
  it('uses 2x for an ordinary chart', () => {
    expect(safePixelRatio(nodeOfSize(1600, 800))).toBe(2)
  })

  it('reduces the ratio so a 500 task chart stays within canvas limits', () => {
    const ratio = safePixelRatio(nodeOfSize(3000, 16700))
    expect(ratio).toBeLessThan(1)
    expect(16700 * ratio).toBeLessThanOrEqual(16000)
    expect(3000 * 16700 * ratio * ratio).toBeLessThanOrEqual(100_000_000)
  })

  it('never goes below the minimum ratio', () => {
    expect(safePixelRatio(nodeOfSize(500000, 500000))).toBe(0.25)
  })
})
