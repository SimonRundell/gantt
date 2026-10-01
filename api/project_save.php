<?php
/**
 * PUT /api/project_save.php?id=...
 *
 * Saves a project. Requires a valid edit token in the Authorization:
 * Bearer header and a "revision" in the body matching the revision
 * the caller last loaded (optimistic concurrency). If someone else
 * has saved a newer revision in the meantime, responds 409 with the
 * server's current copy so the caller can offer to keep theirs, use
 * the server's, or download their own version first.
 */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/storage.php';

enforceRateLimit();

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    fail(405, 'Use PUT to save a project.');
}

$config = gcLoadConfig();
$id = $_GET['id'] ?? '';
$existing = readProject($id);

if ($existing === null) {
    fail(404, 'That project could not be found.');
}

if (!verifyToken($existing, bearerToken())) {
    fail(403, 'You need this project\'s edit link to save changes.');
}

$body = readJsonBody();

if (!isset($body['revision']) || !is_int($body['revision'])) {
    fail(400, 'The save request is missing its revision number.');
}

if ($body['revision'] !== $existing['revision']) {
    $publicExisting = $existing;
    unset($publicExisting['editTokenHash']);
    sendJson(409, [
        'error' => 'Someone else saved a newer version of this project.',
        'project' => $publicExisting,
    ]);
}

$now = gmdate('Y-m-d\TH:i:s\Z');
$newDoc = [
    'schemaVersion' => 1,
    'id' => $existing['id'],
    'title' => is_string($body['title'] ?? null) ? $body['title'] : $existing['title'],
    'createdAt' => $existing['createdAt'],
    'updatedAt' => $now,
    'revision' => $existing['revision'] + 1,
    'calendar' => is_array($body['calendar'] ?? null) ? $body['calendar'] : $existing['calendar'],
    'view' => is_array($body['view'] ?? null) ? $body['view'] : $existing['view'],
    'tasks' => is_array($body['tasks'] ?? null) ? $body['tasks'] : $existing['tasks'],
    'dependencies' => is_array($body['dependencies'] ?? null) ? $body['dependencies'] : $existing['dependencies'],
    'editTokenHash' => $existing['editTokenHash'],
];

$problems = validateProjectShape($newDoc, $config);
if ($problems !== []) {
    fail(422, implode(' ', $problems));
}

$bytes = strlen((string) json_encode($newDoc));
if ($bytes > $config['maxProjectBytes']) {
    fail(413, 'This project is larger than this server allows.');
}

writeProject($id, $newDoc);

sendJson(200, [
    'revision' => $newDoc['revision'],
    'updatedAt' => $newDoc['updatedAt'],
]);
