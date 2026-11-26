$ErrorActionPreference = 'Stop'
$root = Join-Path $env:LOCALAPPDATA 'LumiChats'
$bridge = Join-Path $root 'bridge.cjs'
$pidFile = Join-Path $root 'bridge.pid'
if (Test-Path $pidFile) {
  $old = Get-Process -Id ([int](Get-Content $pidFile)) -ErrorAction SilentlyContinue
  if ($old -and $old.ProcessName -eq 'node') { return }
}
$node = (Get-Content -LiteralPath (Join-Path $root 'node-path.txt')).Trim()
if (!(Test-Path -LiteralPath $node)) { $node = (Get-Command node.exe).Source }
$agent = Start-Process -FilePath $node -ArgumentList ('"'+$bridge+'"') -WorkingDirectory $root -WindowStyle Hidden -PassThru
Set-Content -LiteralPath $pidFile -Value $agent.Id
