# serve.ps1 — Starts a simple HTTP server on localhost:8080
# Serves files from the directory where this script is located.

$port = 8080
$root = $PSScriptRoot

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host ""
Write-Host "  Weather App is running at http://localhost:$port" -ForegroundColor Cyan
Write-Host "  Serving files from: $root" -ForegroundColor Gray
Write-Host "  Press Ctrl+C to stop the server." -ForegroundColor Gray
Write-Host ""

# Open the browser automatically
Start-Process "http://localhost:$port"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request  = $context.Request
        $response = $context.Response

        # Resolve the requested path
        $urlPath = $request.Url.AbsolutePath
        if ($urlPath -eq "/") { $urlPath = "/index.html" }

        $filePath = Join-Path $root ($urlPath.TrimStart("/"))

        if (Test-Path $filePath -PathType Leaf) {
            # Determine MIME type
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".ico"  { "image/x-icon" }
                ".svg"  { "image/svg+xml" }
                default { "application/octet-stream" }
            }

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType   = $mime
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode    = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)

            Write-Host "  200  $urlPath" -ForegroundColor Green
        } else {
            # 404
            $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
            $response.ContentType     = "text/plain"
            $response.ContentLength64 = $body.Length
            $response.StatusCode      = 404
            $response.OutputStream.Write($body, 0, $body.Length)

            Write-Host "  404  $urlPath" -ForegroundColor Yellow
        }

        $response.OutputStream.Close()
    }
} finally {
    $listener.Stop()
    Write-Host "Server stopped." -ForegroundColor Gray
}
