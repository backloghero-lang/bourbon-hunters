@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   Wysylanie Bourbon Hunters na GitHub (backloghero-lang)
echo ============================================================
echo.
where git >nul 2>nul
if errorlevel 1 (
  echo [BLAD] Nie znaleziono Gita. Zainstaluj najpierw: https://git-scm.com/download/win
  echo Po instalacji zamknij to okno i uruchom plik ponownie.
  echo.
  pause
  exit /b
)
git init
git config user.email "d.maslyk@onet.eu"
git config user.name "backloghero-lang"
git add .
git commit -m "Bourbon Hunters - PWA + REST API (Gemini + Google Search)"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/backloghero-lang/bourbon-hunters.git
echo.
echo Za chwile moze otworzyc sie przegladarka - zaloguj sie na GitHub (backloghero-lang).
echo.
git push -u origin main --force
echo.
echo ============================================================
echo   Jesli wyzej nie ma bledow na czerwono - GOTOWE.
echo   Repo:  https://github.com/backloghero-lang/bourbon-hunters
echo   Pages: https://backloghero-lang.github.io/bourbon-hunters/
echo ============================================================
pause
