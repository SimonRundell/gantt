import { useEffect, useState } from 'react'

/**
 * CMFloatAd
 *
 * Floating branding banner: hover (or focus) to expand the full contact details.
 * Originally by Simon Rundell, Dept of ITDD, for Exeter College. Restyled here
 * to use classes in src/styles/app.css instead of inline styles, so the whole
 * app keeps to a single stylesheet.
 *
 * @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
 */

/** @type {string} the college logo as a data URL, so the banner needs no extra file */
const CM_LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIkAAAA4CAYAAADJstsZAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyhpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMTM4IDc5LjE1OTgyNCwgMjAxNi8wOS8xNC0wMTowOTowMSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTcgKE1hY2ludG9zaCkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6MTg5NDU4QjA4OUVDMTFFODgxNUFCOEJCRUJBRDg1NUQiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MTg5NDU4QjE4OUVDMTFFODgxNUFCOEJCRUJBRDg1NUQiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDoxODk0NThBRTg5RUMxMUU4ODE1QUI4QkJFQkFEODU1RCIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDoxODk0NThBRjg5RUMxMUU4ODE1QUI4QkJFQkFEODU1RCIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PpCx7RkAAAwTSURBVHja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'

/** @type {number} the year shown in the copyright line, read once when the app loads */
const CURRENT_YEAR = new Date().getFullYear()

/** @type {number} widest viewport (px) treated as a phone-sized screen */
const MOBILE_MAX_WIDTH = 768

/**
 * The floating college banner, fixed to the bottom right of the screen.
 * Hidden when printing.
 * @returns {JSX.Element} the banner
 */
export default function CMFloatAd() {
  const [isHovered, setIsHovered] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    /**
     * Records whether the viewport is currently phone sized.
     * @returns {void}
     */
    const check = () => setIsMobile(window.innerWidth <= MOBILE_MAX_WIDTH)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const className = ['cm-float-ad', isHovered ? 'cm-float-ad--open' : '', isMobile ? 'cm-float-ad--mobile' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <aside
      className={`${className} no-print`}
      aria-label="About this app"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
    >
      <div className="cm-float-ad__content">
        <img alt="Exeter College" src={CM_LOGO} height="40" width="85" className="cm-float-ad__logo" />
        {!isMobile && (
          <span className="cm-float-ad__text">
            &copy; {CURRENT_YEAR} Designed and Created by Simon Rundell, Faculty of Cybersecurity and Digital
            Technologies, Exeter College, Hele Road, Exeter EX4 4JS. | Tel: 01392 400500 | eMail:{' '}
            <a href="mailto:simonrundell@exe-coll.ac.uk">simonrundell@exe-coll.ac.uk</a>
          </span>
        )}
        {isMobile && isHovered && (
          <div className="cm-float-ad__stack">
            <span>&copy; {CURRENT_YEAR} Simon Rundell, Faculty of Cybersecurity and Digital Technologies</span>
            <span>Exeter College, Hele Road, Exeter EX4 4JS.</span>
            <span>Tel: 01392 400500</span>
            <a href="mailto:simonrundell@exe-coll.ac.uk">simonrundell@exe-coll.ac.uk</a>
          </div>
        )}
      </div>
    </aside>
  )
}
