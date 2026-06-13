# Generate one narration WAV per tour step using the built-in Windows SAPI
# voice. Reads narration.json, writes audio/<id>.wav.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$audioDir = Join-Path $here 'audio'
New-Item -ItemType Directory -Force -Path $audioDir | Out-Null

$json = Get-Content (Join-Path $here 'narration.json') -Raw -Encoding UTF8 | ConvertFrom-Json

$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
try { $s.SelectVoice('Microsoft Zira Desktop') } catch { Write-Host 'Zira not found, using default voice' }
$s.Rate = -1   # slightly slower for clarity

foreach ($step in $json) {
  $path = Join-Path $audioDir ($step.id + '.wav')
  $s.SetOutputToWaveFile($path)
  $s.Speak([string]$step.text)
  Write-Host ("  tts " + $step.id)
}
$s.SetOutputToNull()
$s.Dispose()
Write-Host 'TTS done.'
