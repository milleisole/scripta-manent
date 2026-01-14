@echo off
REM
REM Scripta Manent - Build Script for Windows
REM Creates a distributable release from src/ to dist/
REM

setlocal enabledelayedexpansion

set VERSION=%1

REM Check if version is provided
if "%VERSION%"=="" (
    echo.
    echo Error: Version number required
    echo.
    echo Usage: build.bat ^<version^>
    echo.
    echo Examples:
    echo   build.bat v1.0
    echo   build.bat v1.1
    echo   build.bat v2.0-beta
    echo.
    exit /b 1
)
cd ..
REM Check if src directory exists
if not exist "src" (
    echo.
    echo Error: src\ directory not found
    echo Make sure you're running this script from the project root.
    echo.
    exit /b 1
)

REM Check if version already exists
if exist "dist\%VERSION%" (
    echo.
    echo Warning: dist\%VERSION% already exists
    set /p CONFIRM="Overwrite? (y/N) "
    if /i not "!CONFIRM!"=="y" (
        echo Aborted.
        exit /b 1
    )
    rmdir /s /q "dist\%VERSION%"
)

REM Create dist directory if it doesn't exist
if not exist "dist" mkdir dist

REM Copy src to dist/version
echo.
echo Building Scripta Manent %VERSION%...
echo.

xcopy /e /i /q "src" "dist\%VERSION%"

REM Count files
set FILE_COUNT=0
for /r "dist\%VERSION%" %%f in (*) do set /a FILE_COUNT+=1

echo.
echo Build complete!
echo.
echo   Version:  %VERSION%
echo   Location: dist\%VERSION%\
echo   Files:    %FILE_COUNT%
echo.
echo To test locally (Python):
echo   python -m http.server 8080 -d dist\%VERSION%
echo.
echo To test locally (Node.js):
echo   npx serve dist\%VERSION%
echo.
echo Then open: http://localhost:8080
echo.
echo GitHub Pages URL (after push):
echo   https://milleisole.github.io/scripta-manent/dist/%VERSION%/index.html
echo.

endlocal