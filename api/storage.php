<?php
/**
 * Shared storage helpers: config loading, project file paths, atomic
 * reads and writes, token checking and small response helpers. Every
 * endpoint builds on these rather than touching the filesystem or
 * $_SERVER directly.
 */

/** @var array<string,mixed>|null cached config, loaded once per request */
$GLOBALS['gcConfig'] = null;

/**
 * Loads api/.config.json once per request and caches it.
 *
 * @return array<string,mixed> the backend configuration
 */
function gcLoadConfig(): array
{
    if ($GLOBALS['gcConfig'] !== null) {
        return $GLOBALS['gcConfig'];
    }

    $path = __DIR__ . '/.config.json';
    $defaults = [
        'dataDir' => 'data',
        'maxProjectBytes' => 1048576,
        'maxTasks' => 1000,
        'allowedOrigins' => [],
        'rateLimitPerMinute' => 60,
        'retentionDays' => 365,
        // Empty by default: the storage overview page (admin_storage.php)
        // always refuses when this is unset, rather than falling back to
        // an unprotected view. Set a long random string to turn it on.
        'adminKey' => '',
    ];

    if (!is_file($path)) {
        $GLOBALS['gcConfig'] = $defaults;
        return $defaults;
    }

    $raw = file_get_contents($path);
    $decoded = json_decode((string) $raw, true);
    if (!is_array($decoded)) {
        $decoded = [];
    }

    $GLOBALS['gcConfig'] = array_merge($defaults, $decoded);
    return $GLOBALS['gcConfig'];
}

/**
 * Sends a JSON response with the given HTTP status and stops execution.
 *
 * @param int $status HTTP status code
 * @param mixed $payload value to encode as the response body
 * @return never
 */
function sendJson(int $status, mixed $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit();
}

/**
 * Sends a JSON error response in the shape { "error": message } and stops.
 *
 * @param int $status HTTP status code
 * @param string $message plain English error message
 * @return never
 */
function fail(int $status, string $message): never
{
    sendJson($status, ['error' => $message]);
}

/**
 * Validates a project id and builds its on-disk path. Rejects anything
 * that is not exactly 16 characters of A-Z a-z 0-9 _ - , which also
 * rules out path traversal (no slashes or dots are possible).
 *
 * @param string $id the project id from the request
 * @return string absolute path to the project's JSON file
 */
function projectPath(string $id): string
{
    if (!preg_match('/^[A-Za-z0-9_-]{16}$/', $id)) {
        fail(400, 'That project link looks wrong.');
    }

    $config = gcLoadConfig();
    $dataDir = __DIR__ . '/' . $config['dataDir'];

    return $dataDir . '/' . $id . '.json';
}

/**
 * Reads and decodes a project file.
 *
 * @param string $id the project id
 * @return array<string,mixed>|null the decoded project, or null if it does not exist
 */
function readProject(string $id): ?array
{
    $path = projectPath($id);
    if (!is_file($path)) {
        return null;
    }

    $raw = file_get_contents($path);
    $decoded = json_decode((string) $raw, true);

    return is_array($decoded) ? $decoded : null;
}

/**
 * Writes a project file atomically: write to a temp file in the same
 * folder, lock it, then rename over the destination. Rename is atomic
 * on the same filesystem, so a reader never sees a half-written file.
 *
 * @param string $id the project id
 * @param array<string,mixed> $doc the full project document to write
 * @return void
 */
function writeProject(string $id, array $doc): void
{
    $path = projectPath($id);
    $dir = dirname($path);

    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }

    $tmpPath = $dir . '/.' . basename($path) . '.' . bin2hex(random_bytes(4)) . '.tmp';
    $json = json_encode($doc, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

    $handle = fopen($tmpPath, 'wb');
    if ($handle === false) {
        fail(500, 'Could not save the project right now.');
    }

    flock($handle, LOCK_EX);
    fwrite($handle, $json);
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);

    if (!rename($tmpPath, $path)) {
        @unlink($tmpPath);
        fail(500, 'Could not save the project right now.');
    }
}

/**
 * Checks a presented edit token against the hash stored in the project
 * document, using a constant-time comparison.
 *
 * @param array<string,mixed> $doc the project document, including editTokenHash
 * @param string|null $token the token presented by the client, or null
 * @return bool true when the token is present and matches
 */
function verifyToken(array $doc, ?string $token): bool
{
    if ($token === null || $token === '') {
        return false;
    }

    $hash = $doc['editTokenHash'] ?? null;
    if (!is_string($hash) || $hash === '') {
        return false;
    }

    return hash_equals($hash, hash('sha256', $token));
}

/**
 * Reads the bearer token from the Authorization header, if present.
 *
 * @return string|null the token, or null when no bearer token was sent
 */
function bearerToken(): ?string
{
    // Apache often drops the Authorization header before PHP sees it, so
    // check the rewritten and redirected variants as well (see .htaccess).
    $header = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? '';
    if ($header === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp($name, 'Authorization') === 0) {
                $header = $value;
                break;
            }
        }
    }
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
        return trim($matches[1]);
    }

    return null;
}

/**
 * Generates a new 16 character URL-safe project id.
 *
 * @return string the new id
 */
function generateProjectId(): string
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    $id = '';
    $bytes = random_bytes(16);
    for ($i = 0; $i < 16; $i++) {
        $id .= $alphabet[ord($bytes[$i]) % strlen($alphabet)];
    }

    return $id;
}

/**
 * Generates a new 32 character random edit token (returned once, never stored raw).
 *
 * @return string the new edit token
 */
function generateEditToken(): string
{
    return bin2hex(random_bytes(16));
}

/**
 * Validates the shape of a project document against the limits in
 * api/.config.json. Checks required keys, types, array sizes, string
 * lengths, allowed enums, ISO date formats and that every dependency
 * references tasks that exist.
 *
 * @param array<string,mixed> $doc the candidate project document
 * @param array<string,mixed> $config the backend configuration
 * @return list<string> a list of plain English problems (empty when valid)
 */
function validateProjectShape(array $doc, array $config): array
{
    $problems = [];

    if (!isset($doc['schemaVersion']) || !is_int($doc['schemaVersion'])) {
        $problems[] = 'The project is missing a schema version.';
    }

    if (!isset($doc['title']) || !is_string($doc['title']) || $doc['title'] === '') {
        $problems[] = 'The project needs a title.';
    } elseif (mb_strlen($doc['title']) > 120) {
        $problems[] = 'The title is too long (120 characters maximum).';
    }

    if (!isset($doc['tasks']) || !is_array($doc['tasks'])) {
        $problems[] = 'The project is missing its task list.';
        return $problems;
    }

    if (count($doc['tasks']) > $config['maxTasks']) {
        $problems[] = 'This chart has more tasks than this server allows (' . $config['maxTasks'] . ' maximum).';
    }

    $taskIds = [];
    foreach ($doc['tasks'] as $task) {
        if (!is_array($task) || !isset($task['id']) || !is_string($task['id'])) {
            $problems[] = 'A task is missing its id.';
            continue;
        }

        $taskIds[$task['id']] = true;

        if (!isset($task['type']) || !in_array($task['type'], ['task', 'group', 'milestone'], true)) {
            $problems[] = "Task '" . ($task['name'] ?? $task['id']) . "' has an unrecognised type.";
        }

        if (!isset($task['name']) || !is_string($task['name'])) {
            $problems[] = "Task '" . $task['id'] . "' is missing a name.";
        } elseif (mb_strlen($task['name']) > 200) {
            $problems[] = "Task '" . $task['name'] . "' has a name that is too long (200 characters maximum).";
        }

        if (isset($task['notes']) && is_string($task['notes']) && mb_strlen($task['notes']) > 2000) {
            $problems[] = "Task '" . $task['name'] . "' has notes that are too long (2000 characters maximum).";
        }

        if (isset($task['start']) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $task['start'])) {
            $problems[] = "Task '" . $task['name'] . "' has a start date that is not in YYYY-MM-DD format.";
        }

        if (isset($task['comments']) && is_array($task['comments'])) {
            foreach ($task['comments'] as $comment) {
                if (!is_array($comment)) {
                    continue;
                }
                if (!isset($comment['author']) || !is_string($comment['author']) || mb_strlen($comment['author']) > 60) {
                    $problems[] = "Task '" . $task['name'] . "' has a comment with an invalid author name (60 characters maximum).";
                }
                if (!isset($comment['text']) || !is_string($comment['text']) || $comment['text'] === '' || mb_strlen($comment['text']) > 1000) {
                    $problems[] = "Task '" . $task['name'] . "' has a comment with invalid text (1000 characters maximum).";
                }
            }
        }
    }

    if (isset($doc['dependencies']) && is_array($doc['dependencies'])) {
        foreach ($doc['dependencies'] as $dep) {
            if (!is_array($dep)) {
                continue;
            }

            if (!in_array($dep['type'] ?? '', ['FS', 'SS', 'FF', 'SF'], true)) {
                $problems[] = 'A dependency has an unrecognised type.';
            }

            if (!isset($taskIds[$dep['from'] ?? '']) || !isset($taskIds[$dep['to'] ?? ''])) {
                $problems[] = 'A dependency refers to a task that does not exist.';
            }
        }
    }

    return $problems;
}

/**
 * Reads and decodes the JSON request body.
 *
 * @return array<string,mixed> the decoded body, or an empty array if it was missing or not valid JSON
 */
function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    $decoded = json_decode((string) $raw, true);
    return is_array($decoded) ? $decoded : [];
}

/**
 * Returns the client's IP address for rate limiting purposes.
 *
 * @return string the client IP, or 'unknown' if it could not be determined
 */
function clientIp(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

/**
 * Enforces a simple per-IP rate limit using a small JSON counter file
 * per address. Each file tracks a one minute window; once the window
 * has passed it resets rather than sliding, which is simple and good
 * enough to stop accidental hammering from a script or a stuck retry
 * loop. Sends a 429 and stops the request if the limit is exceeded.
 *
 * @return void
 */
function enforceRateLimit(): void
{
    $config = gcLoadConfig();
    $limit = (int) ($config['rateLimitPerMinute'] ?? 60);
    if ($limit <= 0) {
        return;
    }

    $dir = __DIR__ . '/' . $config['dataDir'] . '/_rate';
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }

    // Colons show up in IPv6 addresses (e.g. ::1) but are not valid in
    // Windows filenames, so they get replaced along with everything else.
    $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', clientIp());
    $path = $dir . '/' . $safeName . '.json';

    $handle = fopen($path, 'c+');
    if ($handle === false) {
        return; // Fail open: a broken counter should not block real use.
    }

    flock($handle, LOCK_EX);
    $raw = stream_get_contents($handle);
    $state = json_decode((string) $raw, true);
    $now = time();

    if (!is_array($state) || ($now - ($state['windowStart'] ?? 0)) >= 60) {
        $state = ['windowStart' => $now, 'count' => 0];
    }

    $state['count'] = ($state['count'] ?? 0) + 1;

    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($state));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);

    if ($state['count'] > $limit) {
        fail(429, 'Too many requests from this address. Please wait a moment and try again.');
    }
}
