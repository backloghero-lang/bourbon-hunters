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

git add -A -- index.html spirit-taxonomy.js sw.js manifest.json test-index.html .nojekyll .github/workflows/deploy-pages.yml README.md WYSLIJ-NA-GITHUB.bat OTWORZ-PLUGIN-FIGMA-ASSETY.bat pliki-md regulaminy assets/detail/bottle-detail-bg.png assets/brand assets/profile-badges assets/bourbons/clean "assets/Assety do aplikacji" db/bourbons.json db/profiles-runtime.json db/catalog scripts agent/worker.js agent/d1-schema.sql agent/d1-migration-v57-auth-age.sql agent/d1-migration-v60-password-reset.sql agent/d1-migration-v61-user-profile.sql agent/d1-migration-v62-recommendations.sql agent/d1-migration-v63-google-auth.sql agent/d1-migration-v64-catalog-submissions.sql agent/d1-migration-v65-catalog-data-lifecycle.sql agent/d1-migration-v66-telemetry-reports.sql agent/d1-migration-v67-catalog-moderation.sql agent/d1-migration-v68-whisky-news.sql agent/prompt.txt design/figma-assets/home-pack-v2 design/figma-import-plugin/code.js design/figma-import-plugin/manifest.json

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
