# Builds forge-tab.zip for the Chrome Web Store from the extension folder.
# Uses forward slashes inside the zip, which the Web Store expects.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $root 'extension'
$zip  = Join-Path $root 'forge-tab.zip'
if (Test-Path $zip) { Remove-Item $zip }
$archive = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
try {
  Get-ChildItem $src -Recurse -File | ForEach-Object {
    $name = $_.FullName.Substring($src.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $name, 'Optimal') | Out-Null
  }
} finally { $archive.Dispose() }
$v = (Get-Content (Join-Path $src 'manifest.json') -Raw | ConvertFrom-Json).version
Write-Host "Made forge-tab.zip (version $v). Upload it in the Chrome Web Store dashboard."
