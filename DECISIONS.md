# Bourbon Hunters - decyzje projektowe

Ten plik trzyma stale ustalenia, zeby nie ginely w dlugich watkach.

## Produkt

- Bourbon Hunters ma byc aplikacja robocza od pierwszego ekranu, bez landing page'a.
- Szybka ocena butelki ma bazowac na lokalnej bazie, gdy to mozliwe.
- Skanowanie etykiety jest glownym use case'em produktu.
- Jesli butelka jest w bazie, pokazujemy wynik natychmiast.
- Jesli butelki nie ma w bazie, odpalamy wyszukiwanie informacji w sieci.
- Analiza Hunter AI jest osobna funkcja rozszerzona.
- W UI nie pokazujemy nazwy dostawcy AI.
- Produkt ma byc budowany z mysla o pozniejszym Google Play i rynku USA.
- Docelowy model monetyzacji do sprawdzenia: 20 darmowych skanow, potem reklamy lub inny wariant.
- Glowna mechanika kolekcjonerska: czesc butelek jest zakryta, a user odblokowuje je przez skanowanie.
- Produkt ma dawac fun odkrywania podobny do kolekcjonerskiego indeksu.
- MVP powstaje bez logowania.
- Telemetria i konta sa etapem pozniejszym, po dopracowaniu core aplikacji.
- Limit 20 darmowych skanow traktujemy jako decyzje kierunkowa; sposob liczenia doprecyzujemy pozniej, tymczasowo kandydatem jest limit per urzadzenie.

## Jezyk

- `pl*` z telefonu/przegladarki -> polski.
- Wszystko inne -> angielski.
- Nie pokazujemy widocznego przelacznika jezyka.
- Nazwy wlasne, destylarnie i kategorie stylu nie sa tlumaczone.

## Assety

- Assety produkcyjne trzymamy w repo.
- GitHub Pages publikuje assety dla aplikacji i importera Figmy.
- Figma jest katalogiem wizualnym i miejscem projektowania.
- Nie nakladamy gotowych screenshotow z tekstem pod zywe dane.
- Komercyjnie nie chcemy uzywac cudzych autentycznych zdjec butelek jako glownego assetu produktu.
- Budujemy wlasny styl butelek: generowane AI, podobne klimatem, ale bez kopiowania etykiet 1:1.
- Zdjecia usera moga byc czescia jego kolekcji; aplikacja ma je obrabiac i dopasowywac do UI.
- Generowane butelki na start maja raczej udawac ogolny typ/klimat realnych butelek niz kopiowac konkretna etykiete.
- Jesli zdjecia usera mialyby trafic do wspolnej/publicznej bazy, potrzebna bedzie dodatkowa decyzja o akceptacji i prawach do publikacji.

## Baza bourbonow

- Glowny plik bazy: `db/bourbons.json`.
- Obecny stan bazy: 539 pozycji.
- Priorytetem sa prawdziwe nazwy i zdjecia.
- Nie dodajemy fake/mock data, jesli mozna uzyc realnych danych.
- Bardzo drogie butelki byly odfiltrowane wedlug ustalen z poprzedniego etapu.
- Docelowo baza opisow ma rosnac do tysiecy pozycji, nawet jesli warstwa wizualna bedzie stopniowo wymieniana na bezpieczniejsze assety.

## Worker i agenci

- Obecny Worker rozpoznaje nazwe butelki ze zdjecia, sprawdza baze i dopiero potem uzywa sieci.
- Brak trafienia w bazie moze zapisac nowosc do KV.
- Docelowo powstanie drugi Worker/agent do obrobki nowych zdjec userow i wdrazania ich do widokow.

## Guardrails dla zespolu

- Jesli pojawi sie pomysl sprzeczny z powyzszymi decyzjami, Codex ma zatrzymac prace i przypomniec ustalenie przed implementacja.
- Decyzje mozna zmieniac, ale tylko swiadomie: najpierw aktualizacja `DECISIONS.md`, potem kod.
- Nie dodajemy logowania, kont ani telemetrii przed zamknieciem core flow bez osobnej decyzji.
- Nie publikujemy zdjec userow do wspolnej bazy bez osobnej decyzji o zgodach i moderacji.

## Deploy i test

- Produkcja: `https://backloghero-lang.github.io/bourbon-hunters/`.
- Launcher testowy: `https://backloghero-lang.github.io/bourbon-hunters/test-index.html`.
- Po deployu w launcherze: `Odswiez build`.
- Jesli telefon trzyma stara wersje: `Wyczysc cache/PWA`.
