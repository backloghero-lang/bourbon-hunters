@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ============================================================
echo   Wysylanie Bourbon Hunters na GitHub - lekki tryb
echo ============================================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [BLAD] Nie znaleziono Gita. Zainstaluj najpierw: https://git-scm.com/download/win
  echo.
  pause
  exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo [BLAD] Ten folder nie wyglada jak repo Git.
  echo.
  pause
  exit /b 1
)

git config user.email "d.maslyk@onet.eu"
git config user.name "backloghero-lang"

echo Aktualne zmiany:
git status --short
echo.

git add -A -- index.html sw.js manifest.json test-index.html .nojekyll .github/workflows/deploy-pages.yml README.md WYSLIJ-NA-GITHUB.bat OTWORZ-PLUGIN-FIGMA-ASSETY.bat pliki-md assets/detail/bottle-detail-bg.png assets/brand assets/profile-badges db/bourbons.json db/profiles-runtime.json scripts/generate_runtime_profiles.mjs scripts/validate_profiles.mjs agent/worker.js agent/d1-schema.sql agent/d1-migration-v57-auth-age.sql agent/d1-migration-v60-password-reset.sql agent/d1-migration-v61-user-profile.sql agent/d1-migration-v62-recommendations.sql agent/prompt.txt design/figma-import-plugin/code.js design/figma-import-plugin/manifest.json

git diff --cached --quiet
if not errorlevel 1 (
  echo Brak zmian do wyslania.
  echo.
  pause
  exit /b 0
)

set MSG=Update Bourbon Hunters
git commit -m "%MSG%"
if errorlevel 1 (
  echo.
  echo [BLAD] Commit sie nie udal. Sprawdz komunikat powyzej.
  echo.
  pause
  exit /b 1
)

echo.
echo Wysylam zwykly push bez --force...
git push origin main
if errorlevel 1 (
  echo.
  echo [BLAD] Push sie nie udal. Sprawdz komunikat powyzej.
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   GOTOWE.
echo   Repo:  https://github.com/backloghero-lang/bourbon-hunters
echo   Pages: https://backloghero-lang.github.io/bourbon-hunters/
echo ============================================================
pause
