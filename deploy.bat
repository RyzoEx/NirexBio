@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
if not exist "!GIT_CMD!" set "GIT_CMD=git"

set "MSG=%~1"
if "!MSG!"=="" (
    set /p MSG="Сообщение коммита (Enter = 'Update site'): "
)
if "!MSG!"=="" set "MSG=Update site"

echo [1/2] Добавление файлов и коммит: "!MSG!"...
"!GIT_CMD!" add .
"!GIT_CMD!" commit -m "!MSG!"

echo [2/2] Отправка на хостинг...
"!GIT_CMD!" push

echo [OK] Опубликовано!
