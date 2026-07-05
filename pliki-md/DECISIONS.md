# Bourbon Hunters - decyzje projektowe

Ten plik trzyma stale ustalenia, zeby nie ginely w dlugich watkach.

## Produkt

- Bourbon Hunters ma byc aplikacja robocza od pierwszego ekranu, bez landing page'a.
- Szybka ocena butelki ma bazowac na lokalnej bazie, gdy to mozliwe.
- Skanowanie etykiety jest glownym use case'em produktu.
- Jesli butelka jest w bazie, pokazujemy wynik natychmiast.
- Jesli dopasowanie ma ponizej 80% pewnosci, podstawowy skaner nie zgaduje i nie pokazuje losowego wyniku.
- Analiza Hunter AI jest osobna funkcja rozszerzona.
- W UI nie pokazujemy nazwy dostawcy AI.
- Produkt ma byc budowany z mysla o pozniejszym Google Play i rynku USA.
- Docelowy model monetyzacji do sprawdzenia: 20 darmowych skanow, potem reklamy lub inny wariant.
- Glowna mechanika kolekcjonerska: czesc butelek jest zakryta, a user odblokowuje je przez skanowanie.
- Produkt ma dawac fun odkrywania podobny do kolekcjonerskiego indeksu.
- MVP pozostaje local-first, ale etap kont i synchronizacji Cloudflare D1 zostal rozpoczety.
- Telemetria jest etapem pozniejszym, po dopracowaniu core aplikacji i polityk prywatnosci.
- Limit 20 darmowych skanow traktujemy jako decyzje kierunkowa; sposob liczenia doprecyzujemy pozniej, tymczasowo kandydatem jest limit per urzadzenie.
- Home pokazuje skrot `Moja kolekcja` jako karuzele z tych samych danych, ktore sa w dolnej zakladce `Kolekcja`.
- Widok `Profil` na etapie prototypu pokazuje: Register, Sign In, Articles, Wersja Pro i Ustawienia.
- `Register` i `Sign In` sa podpiete do Cloudflare Worker + D1 dla email/password; Google Sign-In zostaje nieaktywny do kolejnego etapu.
- `Articles` jest miejscem na przyszlego Workera/agenta od newsow i tresci ze swiata whiskey.
- Pelna aplikacja zaczyna sie wtedy, gdy kolekcja, wishlisty, oceny, limity skanow i historia skanow sa zapisywane na backendzie, a nie tylko w `localStorage`.
- `localStorage` zostaje dobry dla MVP/prototypu, ale nie jest docelowym miejscem danych uzytkownika.
- Nie uzywamy pliku `data.db` w repo/GitHub Pages jako produkcyjnej bazy userow. GitHub Pages jest statyczny i nie nadaje sie do bezpiecznego zapisu kont.
- Docelowa baza kont i danych usera: Cloudflare D1, czyli SQL/SQLite-style baza pod Workerem.
- Zdjecia userow i skanow docelowo trzymamy w Cloudflare R2, a nie w D1.
- Zamykany banner `Join Pro` w profilu znika tylko na biezace wejscie w widok. Po ponownym wejsciu w Profil ma wrocic.

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

- Obecny Worker rozpoznaje nazwe butelki ze zdjecia i sprawdza baze; zwykly wynik wymaga minimum 80% pewnosci.
- Brak pewnego trafienia w bazie prowadzi do stanu Hunter AI Plus; zapis nowych znalezisk wymaga osobnego etapu Pro/storage.
- Docelowo powstanie drugi Worker/agent do obrobki nowych zdjec userow i wdrazania ich do widokow.
- Scanner API ma byc traktowany jako core produktu: baza lokalna/online najpierw, a siec/AI jako funkcja Hunter AI Plus albo analiza dla pewnych trafien.
- Po wdrozeniu kont limit skanow powinien byc liczony po stronie backendu, nie tylko per urzadzenie.

## Guardrails dla zespolu

- Jesli pojawi sie pomysl sprzeczny z powyzszymi decyzjami, Codex ma zatrzymac prace i przypomniec ustalenie przed implementacja.
- Decyzje mozna zmieniac, ale tylko swiadomie: najpierw aktualizacja `DECISIONS.md`, potem kod.
- Nie dodajemy telemetrii przed zamknieciem core flow bez osobnej decyzji; konta email/password sa juz osobnym rozpoczetym etapem D1.
- Nie publikujemy zdjec userow do wspolnej bazy bez osobnej decyzji o zgodach i moderacji.

## Deploy i test

- Produkcja: `https://backloghero-lang.github.io/bourbon-hunters/`.
- Launcher testowy: `https://backloghero-lang.github.io/bourbon-hunters/test-index.html`.
- Po deployu w launcherze: `Odswiez build`.
- Jesli telefon trzyma stara wersje: `Wyczysc cache/PWA`.
- GitHub Pages powinien publikowac aplikacje przez workflow `.github/workflows/deploy-pages.yml`, ktory pakuje tylko pliki produkcyjne do `_site`.
- Nie publikujemy calego roboczego repo jako artifact Pages, bo pakuje design/previews i niepotrzebnie zwieksza artifact.
## 2026-07-05 - Skaner nie zgaduje ponizej 80% pewnosci

- Podstawowy skaner pokazuje wynik z bazy tylko wtedy, gdy laczna pewnosc dopasowania wynosi minimum 80%.
- Przy nizszej pewnosci aplikacja nie pokazuje losowej butelki i nie uruchamia zwyklego wyszukiwania jako wyniku podstawowego.
- Niska pewnosc prowadzi do stanu `Hunter AI Plus`, ktory bedzie osobna funkcja Pro/paywall.
- Hunter AI Plus docelowo ma szukac danych w sieci, uzupelniac profil smaku i zapisac zdjecie/nowa butelke do roboczej bazy.
- Zdjecia uzytkownika wymagaja osobnego etapu storage/obrobki, najlepiej Cloudflare R2 + pipeline do tla Bourbon Hunters.

## 2026-07-05 - Cloudflare D1 jako sync kont uzytkownikow

- Aplikacja zostaje local-first: wishlist, kolekcja i oceny dzialaja od razu w `localStorage`.
- Po rejestracji/logowaniu frontend wysyla lokalny stan do Cloudflare i pobiera stan uzytkownika z D1.
- Worker zapisuje konta, sesje, wishlist, kolekcje, oceny i historie skanow.
- Hasla nie sa zapisywane jawnie; Worker uzywa PBKDF2 SHA-256 i zapisuje tylko hash oraz sol.
- Google Sign-In zostaje jako przycisk UI do pozniejszego podpiecia.
