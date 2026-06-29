# Bourbon Hunters - mapa rozwoju

Ten plik sluzy do planowania kolejnych prac. Szczegoly bugow trzymamy w `BUGS.md`, a stale decyzje w `DECISIONS.md`.

## Teraz

- Dopisac do UX zalozenie zakrytych butelek: znak zapytania/sylwetka przed odblokowaniem.
- Poprawic widok szczegolow butelki: oddalic butelke, poprawic stage, ograniczyc widocznosc bialych wyciec.
- Sprawdzic po deployu, czy kropki swipe dobrze wygladaja na telefonie.
- Doprecyzowac ikonki kategorii wycinane ze sprite'a `category-cards.png`.
- Dopracowac karty `Polecane` i `Ostatnio dodane`, jesli mockup ma byc odwzorowany wierniej.
- Przebudowac ekran `Odkrywaj` pod referencje `design/figma-assets/reference-pack-v1/explore-screen.png`.
- Dokonczyc `Collection`: Lista zyczen, Upolowane, Moja kolekcja.
- Upewnic sie, ze dodawanie do wishlisty i kolekcji dziala spojnie z Home, Explore i szczegolami.

## Nastepne

- Ujednolicic listy butelek w Explore i Collection.
- Dodac empty state dla list kolekcji.
- Uporzadkowac lokalizacje PL/EN w calym UI.
- Dodac ceny PLN dla PL oraz USD dla EN/innych jezykow.
- Rozdzielic szybka ocene z bazy od rozszerzonej analizy Hunter AI.
- Zbudowac startowy zestaw ok. 50 generowanych butelek AI jako bezpieczny komercyjnie pack wizualny.
- Przygotowac zasady podobienstwa generowanych butelek: rozpoznawalny typ i klimat, bez kopiowania realnych etykiet 1:1.
- Rozszerzac opisy, profile smaku, nos, smak i finisz dla wiekszej liczby pozycji.
- Przygotowac onboarding/tutorial: skan -> odblokowanie -> wishlist -> kolekcja.
- Zaprojektowac local-first core bez logowania.

## Pozniej

- Zrobic prawdziwe wycinanie tla butelek do PNG/WebP alpha.
- Przygotowac proces batch albo Worker dla segmentacji zdjec.
- Zbudowac drugiego Workera/agenta, ktory bierze nowe zdjecia userow, obrabia je i wdraza do widokow aplikacji.
- Doprowadzic baze opisow do tysiecy pozycji, zeby user prawie zawsze dostal sensowny wynik po skanie.
- Zaprojektowac flow user-generated bottles: skan -> zapis -> obrobka -> widok w kolekcji/bazie.
- Rozwinac historie destylarni, linki i glebsza analize w Hunter AI.
- Rozwazyc mape destylarni, odznaki i notatki.
- Przygotowac produkt pod Google Play i kampanie marketingowa w USA.
- Zaprojektowac monetyzacje: pierwsze 20 skanow free, potem reklamy lub inny model.
- Dodac telemetrie dopiero po ustabilizowaniu core aplikacji.
- Dodac konta dopiero po potwierdzeniu, ze core flow dziala i ma sens produktowy.

## Kamienie milowe

| Etap | Cel | Status |
|---|---|---|
| M1 | Skan etykiety -> lokalna baza -> instant wynik | dziala w Workerze |
| M2 | Fallback do sieci i zapis nowosci | dziala w Workerze, wymaga dopracowania procesu |
| M3 | Spójny Home, Explore, Details, Collection | w toku |
| M4 | Bezpieczny pack generowanych butelek AI | plan |
| M5 | Mechanika zakrytych i odblokowanych butelek | plan |
| M6 | Worker/agent do obrobki zdjec userow | plan |
| M7 | Google Play + USA marketing + monetyzacja | pozniej |

## Zasada pracy

- Nie tworzymy nowego projektu od zera.
- Pracujemy w istniejacej strukturze.
- Przy wiekszych zmianach frontu podbijamy cache w `sw.js`.
- Po zmianach sprawdzamy `git diff --check` i `git status --short`.
