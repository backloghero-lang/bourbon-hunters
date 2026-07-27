# Bourbon Hunters - pliki projektowe

Ten folder trzyma dokumenty robocze, decyzje, roadmapy i pomocnicze skrypty.

## Najwazniejsze dokumenty

- `PROJECT.md` - wizja produktu i glowne zalozenia.
- `ROADMAP.md` - mapa rozwoju i kolejnosc prac.
- `DECISIONS.md` - decyzje, ktore maja hamowac sprzeczne pomysly.
- `QUESTIONS.md` - pytania produktowe i techniczne.
- `BUGS.md` - backlog bugow.
- `POPRAWKI.md` - lista poprawek do robienia hurtem.
- `HANDOFF.md` - szybki kontekst dla kolejnego watku.
- `HANDOFF-BH-1.1.md` - aktualny handoff do kolejnego etapu projektu.
- `INSTRUKCJA.md` - wdrozenie, Worker, D1 i testowanie.
- `NEWS.md` - feed artykulow, agent, Cron, retencja i diagnostyka.
- `DESIGN.md` - zasady wizualne.
- `MONETYZACJA-I-LIMITY.md` - plan Free/Pro, limity skanow, cena startowa, reklamy i kolejnosc wdrozenia.

## Figma

- `FIGMA-IMPORT-PLUGIN.md` - opis lokalnego pluginu importera.
- `FIGMA-INCOMING-CZYTAJ-MNIE.md` - notatki dla przychodzacych assetow.
- Kod pluginu zostaje w `design/figma-import-plugin/`, bo Figma uzywa tamtego `manifest.json`.

## Skrypty

- `WYSLIJ-NA-GITHUB.bat` - wlasciwy skrypt publikacji.
- `OTWORZ-PLUGIN-FIGMA-ASSETY.bat` - helper do otwarcia folderu pluginu Figmy.
- W glownym katalogu repo zostaly lekkie launchery o tych samych nazwach.

## Aktualne zasady, ktore sa nadrzedne

- Publiczne repo sluzy jako demo/showcase.
- Produkcyjna monetyzacja powinna isc w prywatnym repo.
- Produkcyjny skaner jest obecnie `visual-only`; OCR pozostaje wylaczony po rollbacku.
- User potwierdza jedna lub dwie propozycje przed otwarciem szczegolow; skaner nie pokazuje losowego wyniku.
- Email/password jest podpiete do Cloudflare Worker + D1.
- Google Sign-In jest podpiete przez Cloudflare Worker.
- Feed newsow ma 6 wpisow startowych, odswieza sie w poniedzialek i czwartek i usuwa wpisy po 30 dniach.
- Aktualny etap startowy dla kolejnego watku: `HANDOFF-BH-1.1.md`.
