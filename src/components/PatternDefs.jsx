/**
 * White, 55% opaque - matches `.bar-pattern__marks` in app.css. Set
 * directly on each mark too (not just the class) because
 * `html-to-image` (used for PNG/PDF export) does not apply computed
 * styles to SVG elements, so a class-only colour would be lost and
 * fall back to solid black in the rasterised image.
 */
const MARK_COLOUR = 'rgba(255, 255, 255, 0.55)'

/** @type {Record<string, import('react').ReactNode>} the marks drawn inside each colour's pattern tile, so no two colours share a pattern */
const PATTERN_MARKS = {
  blue: <path d="M-1 9 9 -1M3 11 11 3M-5 5 5 -5" fill="none" />,
  green: (
    <>
      <circle cx="2" cy="2" r="1.1" />
      <circle cx="6" cy="6" r="1.1" />
    </>
  ),
  orange: <path d="M0 2h8M0 6h8" fill="none" />,
  purple: <path d="M0 0 8 8M8 0 0 8" fill="none" />,
  teal: <path d="M2 0v8M6 0v8" fill="none" />,
  red: <path d="M-1 -1 9 9M-5 3 3 11M5 -5 13 3" fill="none" />,
  yellow: (
    <>
      <rect x="0" y="0" width="3" height="3" />
      <rect x="4" y="4" width="3" height="3" />
    </>
  ),
  grey: <path d="M0 6 2 2 4 6 6 2 8 6" fill="none" />,
}

/**
 * SVG pattern definitions, one per task colour. Each bar is overlaid
 * with its colour's pattern, so bars can be told apart without relying
 * on colour alone (a WCAG requirement, and useful on a black and white
 * printout). Include this once inside every chart `<svg>`.
 * @returns {JSX.Element} a `<defs>` element
 */
function PatternDefs() {
  return (
    <defs>
      {Object.entries(PATTERN_MARKS).map(([colour, marks]) => (
        <pattern key={colour} id={`bar-pattern-${colour}`} width="8" height="8" patternUnits="userSpaceOnUse">
          <g className="bar-pattern__marks" fill={MARK_COLOUR} stroke={MARK_COLOUR} strokeWidth="1.3">
            {marks}
          </g>
        </pattern>
      ))}
    </defs>
  )
}

export default PatternDefs
