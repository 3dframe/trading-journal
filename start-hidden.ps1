$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run dev > `"$root\server\log.txt`" 2>&1" `
    -WorkingDirectory "$root\server" `
    -WindowStyle Hidden

Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run dev > `"$root\client\log.txt`" 2>&1" `
    -WorkingDirectory "$root\client" `
    -WindowStyle Hidden

Write-Output "Servidores arrancados em segundo plano."
