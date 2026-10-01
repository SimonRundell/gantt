<?php
/**
 * POST /api/project_create.php
 *
 * Creates a new project. The request body may optionally carry a
 * "project" object (title, calendar, view, tasks, dependencies) to
 * seed the new chart from a template or an uploaded file; anything
 * left out falls back to a blank project. Returns the new id, the
 * edit token (shown to the caller once and never stored in the
 * clear), and the project document as saved.
 */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/storage.php';

enforceRateLimit();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'Use POST to create a project.');
}

$config = gcLoadConfig();
$body = readJsonBody();
$seed = is_array($body['project'] ?? null) ? $body['project'] : [];

$now = gmdate('Y-m-d\TH:i:s\Z');
$id = generateProjectId();
$editToken = generateEditToken();

$doc = [
    'schemaVersion' => 1,
    'id' => $id,
    'title' => is_string($seed['title'] ?? null) && $seed['title'] !== '' ? $seed['title'] : 'Untitled project',
    'createdAt' => $now,
    'updatedAt' => $now,
    'revision' => 1,
    'calendar' => is_array($seed['calendar'] ?? null) ? $seed['calendar'] : [
        'workingDays' => [1, 2, 3, 4, 5],
        'nonWorkingDates' => [],
        'weekStartsOn' => 1,
    ],
    'view' => is_array($seed['view'] ?? null) ? $seed['view'] : [
        'zoom' => 'week',
        'showCriticalPath' => false,
        'showBaseline' => false,
        'columns' => ['name', 'start', 'end', 'duration', 'percent', 'assignee'],
    ],
    'tasks' => is_array($seed['tasks'] ?? null) ? $seed['tasks'] : [],
    'dependencies' => is_array($seed['dependencies'] ?? null) ? $seed['dependencies'] : [],
    'editTokenHash' => hash('sha256', $editToken),
];

$problems = validateProjectShape($doc, $config);
if ($problems !== []) {
    fail(422, implode(' ', $problems));
}

$bytes = strlen((string) json_encode($doc));
if ($bytes > $config['maxProjectBytes']) {
    fail(413, 'This project is larger than this server allows.');
}

writeProject($id, $doc);

$public = $doc;
unset($public['editTokenHash']);

sendJson(201, [
    'id' => $id,
    'editToken' => $editToken,
    'project' => $public,
]);
