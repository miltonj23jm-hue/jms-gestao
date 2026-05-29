@echo off
chcp 65001 >nul
title JMS Gestao - Servidor Local
cd /d "%~dp0"

echo.
echo ========================================
echo  JMS Gestao - Servidor Local
echo ========================================
echo.
echo Iniciando servidor em http://localhost:8000
echo.
echo IMPORTANTE: deixe esta janela ABERTA enquanto usar o sistema.
echo Para encerrar, feche esta janela ou pressione Ctrl+C.
echo.

REM Tenta Python 3
python --version >nul 2>&1
if %errorlevel%==0 (
    echo Usando Python encontrado no PATH...
    start "" "http://localhost:8000/sistema-gestao.html"
    python -m http.server 8000
    goto :eof
)

REM Tenta py launcher
py --version >nul 2>&1
if %errorlevel%==0 (
    echo Usando py launcher...
    start "" "http://localhost:8000/sistema-gestao.html"
    py -m http.server 8000
    goto :eof
)

REM Tenta Node.js
node --version >nul 2>&1
if %errorlevel%==0 (
    echo Usando Node.js (npx serve)...
    start "" "http://localhost:8000/sistema-gestao.html"
    npx --yes serve -l 8000
    goto :eof
)

echo.
echo ERRO: nem Python nem Node.js encontrados.
echo.
echo Instale um dos dois:
echo   - Python: https://www.python.org/downloads/
echo   - Node.js: https://nodejs.org/
echo.
echo Apos instalar, feche esta janela e execute novamente.
echo.
pause
