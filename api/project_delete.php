<?php
/**
 * DELETE /api/project_delete.php?id=...
 *
 * Permanently removes a project. Requires a valid edit token in the
 * Authorization: Bearer header.
 */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/storage.php';

enforceRateLimit();

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    fail(405, 'Use DELETE to remove a project.');
}

$id = $_GET['id'] ?? '';
$doc = readProject($id);

if ($doc === null) {
    fail(404, 'That project could not be found.');
}

if (!verifyToken($doc, bearerToken())) {
    fail(403, 'You need this project\'s edit link to delete it.');
}

$path = projectPath($id);
if (!unlink($path)) {
    fail(500, 'Could not delete the project right now.');
}

sendJson(200, ['deleted' => true]);
