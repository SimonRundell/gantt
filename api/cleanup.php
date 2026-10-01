<?php
/**
 * Command line only. Deletes project files that have not been updated
 * for longer than retentionDays (see api/.config.json). Refuses to run
 * over the web so a request can never trigger a mass deletion.
 *
 * Run it by hand:
 *   php api/cleanup.php
 *   php api/cleanup.php --dry-run
 *
 * Schedule it with cron (a typical line in a crontab, running once a
 * day just after midnight):
 *   5 0 * * * /usr/bin/php /path/to/gantt-chart/api/cleanup.php >> /path/to/gantt-chart/api/data/cleanup.log 2>&1
 *
 * On Windows under Laragon, use Laragon's own Scheduled Task entry (or
 * the Windows Task Scheduler directly) to run:
 *   C:\laragon\bin\php\php8.3.x\php.exe E:\gantt\api\cleanup.php
 * on whatever schedule suits, for example once a day.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'This script can only be run from the command line.']);
    exit(1);
}

require_once __DIR__ . '/storage.php';

$dryRun = in_array('--dry-run', $argv ?? [], true);
$config = gcLoadConfig();
$dataDir = __DIR__ . '/' . $config['dataDir'];
$retentionSeconds = (int) $config['retentionDays'] * 86400;
$now = time();

$files = glob($dataDir . '/*.json') ?: [];
$removed = 0;
$kept = 0;

foreach ($files as $file) {
    $raw = file_get_contents($file);
    $doc = json_decode((string) $raw, true);
    $updatedAt = is_array($doc) ? ($doc['updatedAt'] ?? null) : null;
    $updatedTimestamp = is_string($updatedAt) ? strtotime($updatedAt) : false;
    $age = $updatedTimestamp !== false ? $now - $updatedTimestamp : $now - filemtime($file);

    if ($age > $retentionSeconds) {
        echo ($dryRun ? '[dry run] would remove ' : 'removing ') . basename($file) . " (last updated " . round($age / 86400) . " days ago)\n";
        if (!$dryRun) {
            unlink($file);
        }
        $removed++;
    } else {
        $kept++;
    }
}

echo "Done. $removed removed, $kept kept.\n";
