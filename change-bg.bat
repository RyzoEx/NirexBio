@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo ========================================================
echo   BioProfile - Смена фона и публикация одной командой
echo ========================================================

set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
if not exist "!GIT_CMD!" set "GIT_CMD=git"

:: Если передан файл как аргумент: change-bg.bat "C:\путь\к\видео.mp4"
if not "%~1"=="" (
    set "INPUT_FILE=%~1"
    set "EXT=%~x1"

    if /i "!EXT!"==".mp4" (
        echo [1/3] Копирование видео в assets/video.mp4...
        copy /y "!INPUT_FILE!" "assets\video.mp4" >nul
        echo [OK] Видеофон обновлен: assets/video.mp4
    ) else if /i "!EXT!"==".webm" (
        echo [1/3] Копирование видео в assets/video.mp4...
        copy /y "!INPUT_FILE!" "assets\video.mp4" >nul
        echo [OK] Видеофон обновлен: assets/video.mp4
    ) else if /i "!EXT!"==".jpg" (
        echo [1/3] Копирование картинки в assets/background.jpg...
        copy /y "!INPUT_FILE!" "assets\background.jpg" >nul
        echo [OK] Фотофон обновлен: assets/background.jpg
    ) else if /i "!EXT!"==".png" (
        echo [1/3] Копирование картинки в assets/background.jpg...
        copy /y "!INPUT_FILE!" "assets\background.jpg" >nul
        echo [OK] Фотофон обновлен: assets/background.jpg
    ) else if /i "!EXT!"==".gif" (
        echo [1/3] Копирование GIF в assets/background.jpg...
        copy /y "!INPUT_FILE!" "assets\background.jpg" >nul
        echo [OK] GIF-фон обновлен: assets/background.jpg
    ) else (
        echo [!] Неизвестный формат файла. Поддерживаются: .mp4, .webm, .jpg, .png, .gif
        pause
        exit /b 1
    )
) else (
    echo [1/3] Путь к файлу не передан, отправляем текущие изменения в assets...
)

echo [2/3] Создание коммита...
"!GIT_CMD!" add .
set /p COMMIT_MSG="Введи описание коммита (Enter = 'Update background'): "
if "!COMMIT_MSG!"=="" set "COMMIT_MSG=Update background"

"!GIT_CMD!" commit -m "!COMMIT_MSG!"

echo [3/3] Отправка на хостинг (git push)...
"!GIT_CMD!" push

echo.
echo ========================================================
echo   [ГОТОВО!] Изменения отправлены. Хост обновится за 30с!
echo ========================================================
echo.
