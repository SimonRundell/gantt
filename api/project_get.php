<?php
/**
 * GET /api/project_get.php?id=...
 *
 * Returns a project document without its edit token hash. Include a
 * valid edit token in the Authorization: Bearer header to also get
 * canEdit: true; otherwise the project is returned read-only.
 */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/storage.php';

enforceRateLimit();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail(405, 'Use GET to fetch a project.');
}

$id = $_GET['id'] ?? '';
$doc = readProject($id);

if ($doc === null) {
    fail(404, 'That project could not be found.');
}

$canEdit = verifyToken($doc, bearerToken());

$public = $doc;
unset($public['editTokenHash']);
$public['canEdit'] = $canEdit;

sendJson(200, $public);
