import axios from 'axios'
import config from './config.js'

/**
 * Pre-configured axios instance pointed at the PHP backend. Every call
 * site should go through this instance rather than constructing URLs
 * by hand, so the API origin stays in one place.
 */
const api = axios.create({
  baseURL: config.apiBase,
})

/**
 * Builds the Authorization header for an edit token, or an empty
 * object when there is no token (read-only requests).
 * @param {string|null|undefined} editToken - the project's edit token
 * @returns {{Authorization?: string}} header fragment to spread into a request config
 */
export function authHeader(editToken) {
  return editToken ? { Authorization: `Bearer ${editToken}` } : {}
}

export default api
