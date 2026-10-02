/** @type {Record<string, string>} SVG path data (24x24 grid, stroked) for each named icon */
const ICON_PATHS = {
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  plus: 'M12 5v14M5 12h14',
  milestone: 'M12 3l9 9-9 9-9-9z',
  group: 'M3 7h7l2 2h9v10H3z',
  outdent: 'M20 5H10M20 12H10M20 19H10M7 8l-4 4 4 4',
  indent: 'M20 5H10M20 12H10M20 19H10M3 8l4 4-4 4',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M5 12l7 7 7-7',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  today: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M12 14v3',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 9l5-5 5 5M5 20h14',
  share:
    'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01',
  print: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
  help: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01',
  route:
    'M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 17h6a4 4 0 0 0 0-8h-2a4 4 0 0 1 0-4h6',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  rocket:
    'M5 15c-1 1-2 4-2 6 2 0 5-1 6-2M14 5c3-2 6-2 7-2 0 1 0 4-2 7l-6 6-5-5zM9 10 5 9l3-3h4M14 15l1 4 3-3v-4',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  panel: 'M4 5h16v14H4zM15 5v14',
  columns: 'M4 5h16v14H4zM9 5v14M15 5v14',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  users: 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-2a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
}

/**
 * A small decorative line icon. Always hidden from screen readers, so
 * the button or link it sits in must carry its own text or aria-label.
 * @param {object} props
 * @param {keyof typeof ICON_PATHS} props.name - which icon to draw
 * @returns {JSX.Element|null} the icon, or null for an unknown name
 */
function Icon({ name }) {
  const path = ICON_PATHS[name]
  if (!path) return null
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={path} />
    </svg>
  )
}

export default Icon
