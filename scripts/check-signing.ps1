<#
.SYNOPSIS
  Checks the release signing setup WITHOUT printing any secret.

.DESCRIPTION
  Reads the four PUJA_RELEASE_* Gradle properties from ~/.gradle/gradle.properties in this process.
  Values are never printed, logged or written to a file. The store password reaches keytool only
  through an environment variable of the keytool child process (-storepass:env).
  Output is OK or FAIL with a reason, the property NAMES involved, and certificate facts.

  Requirements checked (Google Play, developer.android.com/studio/publish/app-signing):
  - the key validity must end after 22 October 2033 (hard FAIL below that; 25+ years recommended)
  - the signing certificate must not be the Android Debug certificate

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\check-signing.ps1
#>

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$gradleProps = Join-Path $env:USERPROFILE '.gradle\gradle.properties'
$required = @(
  'PUJA_RELEASE_STORE_FILE',
  'PUJA_RELEASE_STORE_PASSWORD',
  'PUJA_RELEASE_KEY_ALIAS',
  'PUJA_RELEASE_KEY_PASSWORD'
)
$playMinimumEnd = [datetime]'2033-10-22'
$warnBefore = [datetime]'2035-01-01'

function Fail([string]$reason) {
  Write-Host "FAIL: $reason"
  exit 1
}

if (-not (Test-Path -LiteralPath $gradleProps -PathType Leaf)) {
  Fail "gradle.properties not found in the user .gradle folder."
}

# 1. Read the properties in-process. Values stay in memory only.
$values = @{}
foreach ($line in [System.IO.File]::ReadAllLines($gradleProps)) {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*=(.*)$') {
    $values[$matches[1]] = $matches[2].Trim()
  }
}

# 2. Every property must be present and filled (names only in the message).
$problems = @()
foreach ($name in $required) {
  if (-not $values.ContainsKey($name)) { $problems += "property missing: $name" }
  elseif ([string]::IsNullOrEmpty($values[$name])) { $problems += "property empty: $name" }
  elseif ($values[$name] -eq 'REPLACE_ME') { $problems += "placeholder not filled: $name" }
}
if ($problems.Count -gt 0) { Fail ($problems -join '; ') }

# 3. The keystore file must exist, be readable, and sit outside the repo.
$storeFile = $values['PUJA_RELEASE_STORE_FILE'] -replace '/', '\'
if (-not (Test-Path -LiteralPath $storeFile -PathType Leaf)) {
  Fail "PUJA_RELEASE_STORE_FILE does not point to an existing file."
}
$storeFull = [System.IO.Path]::GetFullPath($storeFile)
$repoFull = [System.IO.Path]::GetFullPath($repoRoot).TrimEnd('\') + '\'
if ($storeFull.StartsWith($repoFull, [StringComparison]::OrdinalIgnoreCase)) {
  Fail "the keystore is inside the repo folder. Move it outside the repo."
}
try {
  $probe = [System.IO.File]::OpenRead($storeFull)
  $probe.Close()
} catch {
  Fail "the keystore file is not readable."
}

# 4. Find keytool: PATH, then JAVA_HOME, then Android Studio's bundled JDK.
$keytool = $null
$cmd = Get-Command keytool -ErrorAction SilentlyContinue
if ($cmd) { $keytool = $cmd.Source }
elseif ($env:JAVA_HOME -and (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\keytool.exe'))) {
  $keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
}
else {
  $jbr = 'C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe'
  if (Test-Path -LiteralPath $jbr) { $keytool = $jbr }
}
if (-not $keytool) { Fail "keytool not found (PATH, JAVA_HOME or Android Studio jbr)." }

# 5. Open the keystore. The password goes only into the child process environment.
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $keytool
$psi.Arguments = '-list -v -keystore "' + $storeFull + '" -alias "' + $values['PUJA_RELEASE_KEY_ALIAS'] + '" -storepass:env PUJA_CHECK_STOREPASS'
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
$psi.EnvironmentVariables['PUJA_CHECK_STOREPASS'] = $values['PUJA_RELEASE_STORE_PASSWORD']
$proc = [System.Diagnostics.Process]::Start($psi)
$stdout = $proc.StandardOutput.ReadToEnd()
$stderr = $proc.StandardError.ReadToEnd()
$proc.WaitForExit()
$text = $stdout + "`n" + $stderr

# 6. Classify failures. Keytool output is never printed.
if ($proc.ExitCode -ne 0) {
  if ($text -match 'tampered|not a keystore|Invalid keystore format|Keystore file does not exist|IOException') {
    Fail "the keystore file is unreadable or not a valid keystore (PUJA_RELEASE_STORE_FILE)."
  }
  if ($text -match 'password was incorrect') {
    Fail "wrong store password (PUJA_RELEASE_STORE_PASSWORD)."
  }
  if ($text -match 'does not exist') {
    Fail "alias not found in the keystore (PUJA_RELEASE_KEY_ALIAS)."
  }
  Fail ("keytool exited with code " + $proc.ExitCode + " (output withheld).")
}

# 7. Read only the facts we report.
$owner = [regex]::Match($text, 'Owner:\s*(.+)').Groups[1].Value.Trim()
$cn = [regex]::Match($owner, 'CN=([^,]+)').Groups[1].Value.Trim()
$untilText = [regex]::Match($text, 'until:\s*(.+)').Groups[1].Value.Trim()
$keyInfo = [regex]::Match($text, 'Subject Public Key Algorithm:\s*(\d+)-bit\s+(\w+)\s+key')
$untilMatch = [regex]::Match($untilText, '^\w{3}\s+(\w{3})\s+(\d{1,2})\s+[\d:]+\s+\S+\s+(\d{4})')
if (-not $untilMatch.Success -or -not $keyInfo.Success) {
  Fail "could not read the certificate validity or key details from keytool."
}
$endDate = [datetime]::ParseExact(
  "$($untilMatch.Groups[1].Value) $($untilMatch.Groups[2].Value) $($untilMatch.Groups[3].Value)",
  'MMM d yyyy',
  [Globalization.CultureInfo]::InvariantCulture
)
$isDebug = ($cn -eq 'Android Debug')

if ($isDebug) { Fail "the certificate is the Android Debug certificate. A release must not use it." }
if ($endDate -le $playMinimumEnd) { Fail ("validity ends " + $endDate.ToString('yyyy-MM-dd') + ", before the Play minimum of 22 Oct 2033.") }

Write-Host "OK: keystore opened with the store password; alias found."
Write-Host "  owner CN: $cn"
Write-Host ("  validity ends: " + $endDate.ToString('yyyy-MM-dd'))
Write-Host ("  key algorithm and size: " + $keyInfo.Groups[2].Value + " " + $keyInfo.Groups[1].Value + "-bit")
Write-Host "  Android Debug certificate: no"
Write-Host "  key password: not tested here (keytool -list cannot check it); Gradle checks it at signing."
if ($endDate -lt $warnBefore) {
  Write-Host ("WARN: validity ends before 2035 (" + $endDate.ToString('yyyy-MM-dd') + "). Play allows it (minimum 22 Oct 2033), but a longer key is recommended.")
}
exit 0
