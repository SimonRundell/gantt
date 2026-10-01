<?php
/**
 * Shared CORS handling. Must be the first require in every endpoint.
 *
 * Reflects the request Origin back only when it is localhost on any
 * port (for Vite's dev server, which can run on any port) or when it
 * appears in the allowedOrigins list from api/.config.json (for a
 * deployed site). Always sets the JSON content type and answers
 * OPTIONS pre-flight requests directly.
 */

require_once __DIR__ . '/storage.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

/**
 * Checks whether an Origin header is allowed to receive CORS headers.
 *
 * @param string $origin the Origin header sent by the browser
 * @return bool true when the origin should be reflected back
 */
function gcIsAllowedOrigin(string $origin): bool
{
    if ($origin === '') {
        return false;
    }

    if (preg_match('#^https?://localhost(:\d+)?$#i', $origin)
        || preg_match('#^https?://127\.0\.0\.1(:\d+)?$#i', $origin)
    ) {
        return true;
    }

    $config = gcLoadConfig();
    $allowed = $config['allowedOrigins'] ?? [];
    return in_array($origin, $allowed, true);
}

if (gcIsAllowedOrigin($origin)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
