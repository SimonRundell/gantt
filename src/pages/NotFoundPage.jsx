import { Link } from 'react-router-dom'

/**
 * Friendly 404 shown for any route that doesn't match.
 * @returns {JSX.Element} the not found page
 */
function NotFoundPage() {
  return (
    <main className="not-found-page">
      <h1>Page not found</h1>
      <p>There is nothing here. Check the link, or start a new chart.</p>
      <Link to="/">Go home</Link>
    </main>
  )
}

export default NotFoundPage
