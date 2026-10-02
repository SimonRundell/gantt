/**
 * Works out where a dragged row would land, from where the pointer is
 * over the row it is hovering. The top quarter means "before", the
 * bottom quarter means "after", and the middle half means "inside"
 * for a group (or the nearer edge for an ordinary task, which cannot
 * hold other tasks).
 * @module lib/dragReorder
 */

/** @typedef {'before'|'after'|'inside'} DropPosition */

/**
 * @param {number} offsetY - how far down the hovered row the pointer is, in pixels
 * @param {number} height - the hovered row's height in pixels
 * @param {boolean} isGroup - whether the hovered row is a group that can hold tasks
 * @returns {DropPosition} where the dragged row would be placed
 */
export function dropPositionFromOffset(offsetY, height, isGroup) {
  const ratio = height > 0 ? offsetY / height : 0.5
  if (ratio < 0.25) return 'before'
  if (ratio > 0.75) return 'after'
  if (isGroup) return 'inside'
  return ratio < 0.5 ? 'before' : 'after'
}
