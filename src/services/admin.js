import api from './api.js'

/**
 * Fetches the storage overview: every project on the server (id,
 * title, last updated, revision, task count, file size) and
 * aggregate stats. Requires the admin key configured on the server;
 * a wrong or missing key gets a 403 from the API.
 * @param {string} key - the admin key
 * @returns {Promise<{projects: object[], stats: object}>} the project list and aggregate stats
 */
export async function fetchStorageOverview(key) {
  const response = await api.get('/admin_storage.php', { params: { key } })
  return response.data
}
