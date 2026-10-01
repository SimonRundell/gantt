import api, { authHeader } from './api.js'

/**
 * Creates a new project on the server, optionally seeded from a
 * template or an uploaded file.
 * @param {object|null} seedProject - a partial project document to seed from, or null for a blank project
 * @returns {Promise<{id: string, editToken: string, project: object}>} the new project's id, edit token and document
 */
export async function createProject(seedProject) {
  const response = await api.post('/project_create.php', seedProject ? { project: seedProject } : {})
  return response.data
}

/**
 * Fetches a project. Supplying the edit token also returns canEdit: true.
 * @param {string} id - the project id
 * @param {string|null} [editToken] - the project's edit token, if known
 * @returns {Promise<object>} the project document, with canEdit set
 */
export async function getProject(id, editToken) {
  const response = await api.get('/project_get.php', {
    params: { id },
    headers: authHeader(editToken),
  })
  return response.data
}

/**
 * Saves a project. Requires the edit token and the revision the
 * caller last loaded, for optimistic concurrency.
 * @param {string} id - the project id
 * @param {string} editToken - the project's edit token
 * @param {object} body - the project fields to save, including the expected `revision`
 * @returns {Promise<object>} the new revision and updatedAt timestamp
 */
export async function saveProject(id, editToken, body) {
  const response = await api.put('/project_save.php', body, {
    params: { id },
    headers: authHeader(editToken),
  })
  return response.data
}

/**
 * Deletes a project permanently.
 * @param {string} id - the project id
 * @param {string} editToken - the project's edit token
 * @returns {Promise<void>} resolves once the project is deleted
 */
export async function deleteProject(id, editToken) {
  await api.delete('/project_delete.php', {
    params: { id },
    headers: authHeader(editToken),
  })
}
