import localConfig from '../../.config.json'

/**
 * Frontend runtime settings, loaded from the project root's .config.json
 * at build time (see .config.example.json for the template). Never
 * hard-code the API origin anywhere else in the app.
 * @typedef {object} AppConfig
 * @property {string} apiBase - origin and path of the PHP API, e.g. http://localhost/api
 * @property {number} maxUploadBytes - largest project JSON file accepted on upload
 */

/** @type {AppConfig} */
const config = {
  maxUploadBytes: 1048576,
  ...localConfig,
}

export default config
