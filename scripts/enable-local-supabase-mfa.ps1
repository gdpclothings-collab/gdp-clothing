# Configure local Supabase TOTP without replacing the CLI-generated config.
# Run from the repository: powershell -ExecutionPolicy Bypass -File scripts/enable-local-supabase-mfa.ps1
$ErrorActionPreference = 'Stop'
$path = Join-Path (Split-Path $PSScriptRoot -Parent) 'supabase/config.toml'
if (-not (Test-Path -LiteralPath $path)) {
  throw "Local Supabase configuration missing: $path. Run 'npx.cmd supabase init' first."
}
$original = [System.IO.File]::ReadAllText($path)
$header = '(?m)^\s*\[auth\.mfa\.totp\]\s*(?:\r?\n|$)'
$matches = [regex]::Matches($original, $header)
if ($matches.Count -gt 1) { throw 'Duplicate [auth.mfa.totp] sections. Resolve manually before updating.' }
$block = "[auth.mfa.totp]`r`nenroll_enabled = true`r`nverify_enabled = true`r`n"
if ($matches.Count -eq 0) {
  $updated = $original.TrimEnd() + "`r`n`r`n" + $block
} else {
  $section = '(?ms)^\s*\[auth\.mfa\.totp\]\s*\r?\n(?<body>.*?)(?=^\s*\[|\z)'
  $updated = [regex]::Replace($original, $section, [System.Text.RegularExpressions.MatchEvaluator]{
    param($m)
    $body = $m.Groups['body'].Value
    $body = [regex]::Replace($body, '(?m)^\s*(enroll_enabled|verify_enabled)\s*=.*(?:\r?\n|$)', '')
    return $block + $body
  }, 1)
}
if ($updated -eq $original) {
  Write-Host 'Local TOTP already enabled. No changes required.'
  exit 0
}
Copy-Item -LiteralPath $path -Destination ($path + '.backup') -Force
[System.IO.File]::WriteAllText($path, $updated, [System.Text.UTF8Encoding]::new($false))
Write-Host 'Local Supabase TOTP enrollment and verification enabled.'
Write-Host 'Restart local Supabase with: npx.cmd supabase stop ; npx.cmd supabase start'
