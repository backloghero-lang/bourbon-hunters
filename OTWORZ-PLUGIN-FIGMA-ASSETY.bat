@echo off
setlocal
cd /d "%~dp0"
explorer "%cd%\design\figma-import-plugin"
echo.
echo Otworzony zostal folder pluginu Figmy.
echo W Figmie wybierz:
echo Plugins ^> Development ^> Import plugin from manifest...
echo i wskaz:
echo %cd%\design\figma-import-plugin\manifest.json
echo.
pause
