@echo off
rem Serve o app na rede local para abrir no celular (PC e celular na mesma rede Wi-Fi). Feche esta janela para parar.
cd /d "%~dp0"
echo.
echo No celular, abra no navegador um destes enderecos:
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127|169)' } | ForEach-Object { '    http://' + $_.IPAddress + ':8765/' }"
echo.
echo Se o Windows perguntar sobre o firewall, permita em "Redes privadas".
echo.
python -m http.server 8765
