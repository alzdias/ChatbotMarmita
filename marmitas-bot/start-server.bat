@echo off
title Marmitaria Sabor e Arte - Servidor Local
echo Iniciando servidor HTTP local na porta 8080...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
pause
