import { useEffect, useState } from 'react'

/**
 * Tracks an element's content box size via ResizeObserver, so layout
 * code (row windowing, SVG sizing) can react to the page being
 * resized without polling.
 * @param {import('react').RefObject<HTMLElement>} ref - a ref to the element to measure
 * @returns {{width: number, height: number}} the element's current size
 */
export function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        setSize({ width, height })
      }
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return size
}
