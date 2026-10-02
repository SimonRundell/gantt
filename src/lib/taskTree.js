/**
 * Helpers for working with the flat task list as a tree: child
 * lookups, visual row order, and which rows are visible once a
 * collapsed group hides its children.
 * @module lib/taskTree
 */

/**
 * Builds a map from a parent id (or null for top-level tasks) to its
 * children's ids, each list sorted by the child's `order` field.
 * @param {import('./scheduler.js').Task[]} tasks - every task in the project
 * @returns {Map<string|null, string[]>} children ids, keyed by parent id
 */
export function buildChildrenMap(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const map = new Map()

  for (const t of tasks) {
    const key = t.parentId ?? null
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(t.id)
  }

  for (const ids of map.values()) {
    ids.sort((a, b) => byId.get(a).order - byId.get(b).order)
  }

  return map
}

/**
 * Flattens the task tree into the order it should be drawn in, top to
 * bottom, skipping the children of any collapsed group.
 * @param {import('./scheduler.js').Task[]} tasks - every task in the project
 * @returns {{task: import('./scheduler.js').Task, depth: number, hasChildren: boolean}[]} one entry per visible row
 */
export function flattenVisibleRows(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const childrenMap = buildChildrenMap(tasks)
  const rows = []

  /** Appends a task and then its children to the flattened row list. */
  const visit = (id, depth) => {
    const task = byId.get(id)
    if (!task) return
    const childIds = childrenMap.get(id) ?? []
    rows.push({ task, depth, hasChildren: childIds.length > 0 })
    if (task.collapsed) return
    for (const childId of childIds) visit(childId, depth + 1)
  }

  for (const rootId of childrenMap.get(null) ?? []) visit(rootId, 0)
  return rows
}

/**
 * Reassigns every task's `order` field to match a depth-first walk of
 * the tree, so order stays a clean, contiguous sequence after a
 * structural edit (add, delete, reorder, indent or outdent).
 * @param {import('./scheduler.js').Task[]} tasks - every task in the project
 * @returns {import('./scheduler.js').Task[]} a new array with order fields reassigned
 */
export function renumberOrder(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, { ...t }]))
  const childrenMap = buildChildrenMap(tasks)
  let counter = 0

  /** Visits a task and its descendants in order. */
  const visit = (id) => {
    const task = byId.get(id)
    task.order = counter++
    for (const childId of childrenMap.get(id) ?? []) visit(childId)
  }

  for (const rootId of childrenMap.get(null) ?? []) visit(rootId)
  return tasks.map((t) => byId.get(t.id))
}

/**
 * Collects a task's id together with every one of its descendants'
 * ids, used when deleting a group so its children go with it.
 * @param {import('./scheduler.js').Task[]} tasks - every task in the project
 * @param {string} taskId - the id of the task whose subtree is wanted
 * @returns {string[]} the task's id followed by all descendant ids
 */
export function collectSubtreeIds(tasks, taskId) {
  const childrenMap = buildChildrenMap(tasks)
  const result = []

  /** Visits a task and its descendants in order. */
  const visit = (id) => {
    result.push(id)
    for (const childId of childrenMap.get(id) ?? []) visit(childId)
  }

  visit(taskId)
  return result
}
