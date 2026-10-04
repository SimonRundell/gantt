<?php
/**
 * GET /api/admin_storage.php?key=...
 *
 * Lists every project on this server (id, title, last updated,
 * revision, file size) and some aggregate stats, for a teacher
 * checking storage use. Requires the admin key configured as
 * adminKey in api/.config.json: with no key configured, or the wrong
 * one presented, this always refuses - there is no reduced "public"
 * view. Never returns editTokenHash or a project's tasks.
 */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/storage.php';

enforceRateLimit();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail(405, 'Use GET to list projects.');
}

$config = gcLoadConfig();
$adminKey = $config['adminKey'] ?? '';
$presentedKey = $_GET['key'] ?? '';

if (!is_string($adminKey) || $adminKey === '' || !is_string($presentedKey) || $presentedKey === ''
    || !hash_equals($adminKey, $presentedKey)
) {
    fail(403, 'Not authorised.');
}

$dataDir = __DIR__ . '/' . $config['dataDir'];
$projects = [];

foreach (glob($dataDir . '/*.json') ?: [] as $path) {
    $raw = file_get_contents($path);
    $doc = json_decode((string) $raw, true);
    if (!is_array($doc) || !isset($doc['id']) || !is_string($doc['id'])) {
        continue; // Not a readable project file; skip rather than fail the whole listing.
    }

    $projects[] = [
        'id' => $doc['id'],
        'title' => is_string($doc['title'] ?? null) ? $doc['title'] : '(untitled)',
        'updatedAt' => is_string($doc['updatedAt'] ?? null) ? $doc['updatedAt'] : null,
        'revision' => is_int($doc['revision'] ?? null) ? $doc['revision'] : null,
        'taskCount' => is_array($doc['tasks'] ?? null) ? count($doc['tasks']) : 0,
        'bytes' => filesize($path) ?: 0,
    ];
}

usort($projects, fn ($a, $b) => strcmp($b['updatedAt'] ?? '', $a['updatedAt'] ?? ''));

$updatedDates = array_filter(array_column($projects, 'updatedAt'));
$stats = [
    'count' => count($projects),
    'totalBytes' => array_sum(array_column($projects, 'bytes')),
    'oldestUpdatedAt' => $updatedDates === [] ? null : min($updatedDates),
    'newestUpdatedAt' => $updatedDates === [] ? null : max($updatedDates),
];

sendJson(200, ['projects' => $projects, 'stats' => $stats]);
