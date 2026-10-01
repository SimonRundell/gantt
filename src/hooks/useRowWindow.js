import { useMemo } from 'react'

/**
 * Works out which row indices are visible within a scrolled region,
 * with a small buffer either side, so a table or timeline with many
 * rows only has to render the ones actually on screen.
 * @param {number} scrollTop - the current vertical scroll offset in pixels
 * @param {number} viewportHeight - the visible height of the scroll region in pixels
 * @param {number} rowCount - the total number of rows
 * @param {number} rowHeight - the height of one row in pixels
 * @returns {{startIndex: number, endIndex: number, topSpacerHeight: number, bottomSpacerHeight: number}} the visible row window
 */
export function useRowWindow(scrollTop, viewportHeight, rowCount, rowHeight) {
  return useMemo(() => {
    const buffer = 6
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer)
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + buffer * 2
    const endIndex = Math.min(rowCount, startIndex + visibleCount)

    return {
      startIndex,
      endIndex,
      topSpacerHeight: startIndex * rowHeight,
      bottomSpacerHeight: Math.max(0, (rowCount - endIndex) * rowHeight),
    }
  }, [scrollTop, viewportHeight, rowCount, rowHeight])
}
