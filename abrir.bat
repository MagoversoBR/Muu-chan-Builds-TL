@echo off
rem Abre o Otimizador de Build no navegador (servidor local na porta 8765). Feche esta janela para parar.
cd /d "%~dp0"
start "" http://localhost:8765/
python -m http.server 8765
