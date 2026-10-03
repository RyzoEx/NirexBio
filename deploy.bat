@echo off
set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
if not exist "%GIT_CMD%" set "GIT_CMD=git"

set "MSG=%~1"
if "%MSG%"=="" set /p MSG="Commit message (Enter = Update site): "
if "%MSG%"=="" set "MSG=Update site"

echo [1/2] Adding files and committing: "%MSG%"...
"%GIT_CMD%" add .
"%GIT_CMD%" commit -m "%MSG%"

echo [2/2] Pushing to remote...
"%GIT_CMD%" push

echo [OK] Done!
pause
