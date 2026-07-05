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
- Utrzymac quality gate skanera: wynik podstawowy tylko przy pewnosci >= 80%, reszta do Hunter AI Plus.
- Zbudowac startowy zestaw ok. 50 generowanych butelek AI jako bezpieczny komercyjnie pack wizualny.
- Przygotowac zasady podobienstwa generowanych butelek: rozpoznawalny typ i klimat, bez kopiowania realnych etykiet 1:1.
- Rozszerzac opisy, profile smaku, nos, smak i finisz dla wiekszej liczby pozycji.
- Przygotowac onboarding/tutorial: skan -> odblokowanie -> wishlist -> kolekcja.
- Utrzymac local-first core, ale rozwijac sync po zalogowaniu przez D1.
- Dopracowac stan zalogowania w Profile po podpieciu Register/Sign In do Cloudflare D1.

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
- Rozwijac konto uzytkownika etapami: email/password juz istnieje, Google/Apple pozniej.

## Plan dojscia do pelnoprawnej aplikacji

1. Konta uzytkownikow
   - Rejestracja, logowanie, odzysk hasla i podstawowy profil.
   - Decyzja do podjecia: czy startujemy od email+password, Google/Apple, czy magic link.

2. Backend i baza online
   - Przeniesienie kolekcji, wishlisty, ocen, limitow skanow i historii skanow poza `localStorage`.
   - Kandydaci: Cloudflare Workers + D1/R2/KV albo Firebase/Supabase, do decyzji przed implementacja.

3. Scanner API jako produktowy core
   - Stabilny endpoint: upload zdjecia, rozpoznanie butelki, wynik z bazy tylko przy pewnosci >= 80%, a reszta do Hunter AI Plus.
   - Wprowadzic statusy: `uploaded`, `recognized`, `matched`, `needs_web_search`, `failed`.

4. Synchronizacja danych usera
   - Kolekcja i wishlist maja dzialac po zmianie telefonu.
   - Tryb offline/PWA zostaje, ale dane po zalogowaniu synchronizuja sie z backendem.

5. Pro, reklamy i limity
   - Limit darmowych skanow zostaje kierunkiem produktowym, ale licznik musi byc backendowy po wprowadzeniu kont.
   - Wersja Pro: brak reklam, wiecej skanow, historia, eksport lub zaawansowane AI - zakres do decyzji.

6. Telemetria produktowa
   - Mierzyc skany, trafienia w bazie, porzucenia flow, dodania do kolekcji/wishlisty.
   - Wdrozyc dopiero po domknieciu core UX i po dodaniu zgód/prywatnosci.

7. Production PWA hardening
   - Stabilne wersjonowanie cache, update flow, obsluga bledow offline, monitoring Workera.
   - Testy na telefonach: Android Chrome, iOS Safari/PWA, desktop preview.

8. Store readiness i rynek USA
   - Wrapper Android/iOS, polityka prywatnosci, regulamin, age gate 18+, przygotowanie pod Google Play.
   - Marketingowo utrzymac pierwszy ekran jako aplikacje, nie landing page.

## Plan wdrozenia - kolejnosc prac

1. Domkniecie local-first MVP
   - Doprowadzic Home, Explore, Details, Scan, Collection i Profile do spojnego UX.
   - Naprawic krytyczne bugi skanera, wyswietlania zdjec, kart butelek i cache.
   - Utrzymac zapis kolekcji, wishlisty i ocen w `localStorage`, ale traktowac to jako warstwe tymczasowa.
   - Wynik: aplikacja nadaje sie do pokazow, testow marketingowych i zbierania feedbacku.

2. Kontrakt danych i architektura backendu
   - Spisac minimalne modele: `user`, `bottle`, `scan`, `collection_item`, `wishlist_item`, `rating`, `unlock`, `subscription`.
   - Ustalic, ktore dane zostaja publiczne, ktore prywatne, a ktore wymagaja zgody usera.
   - Wybrac backend: preferowany kierunek to Cloudflare, bo Worker juz istnieje.
   - Przyjac D1 jako docelowa baze SQL dla kont i danych usera, a R2 jako storage zdjec.
   - Wynik: wiemy, co przenosimy z frontu do backendu i jak aplikacja bedzie z tym gadac.

3. Backend foundation
   - Zrobic podstawowe endpointy Workera dla danych usera i skanow.
   - Przygotowac storage: D1 dla danych relacyjnych, R2 dla zdjec, KV/cache dla szybkich lookupow i limitow.
   - Dodac wersjonowanie API oraz podstawowe logowanie bledow.
   - Wynik: backend istnieje, nawet jesli UI nadal dziala lokalnie.

4. Konta i migracja danych
   - Wdrozyc logowanie/rejestracje po wybraniu modelu kont.
   - Podpiac gotowe ekrany Register i Sign In do endpointow Workera.
   - Po pierwszym logowaniu zaproponowac przeniesienie danych z `localStorage` do konta.
   - Po zalogowaniu pokazac w sekcji Profile stan konta zamiast CTA Register/Sign In.
   - Wynik: user moze zmienic telefon i nie traci kolekcji.

5. Synchronizacja kolekcji, wishlisty i ocen
   - Przepiac `bh_collection`, `bh_wishlist` i `bh_user_ratings` na API.
   - Zostawic lokalny cache dla PWA/offline, ale backend ma byc zrodlem prawdy po zalogowaniu.
   - Dodac obsluge konfliktow: ostatnia zmiana wygrywa na start.
   - Wynik: kolekcja i oceny sa realna funkcja aplikacji, nie tylko stanem w przegladarce.

6. Produkcyjny scanner API
   - Upload zdjecia do backendu/R2, status skanu i wynik z bazy.
- Najpierw dopasowanie do bazy; ponizej 80% pewnosci nie zgadujemy i kierujemy do Hunter AI Plus.
   - Zapisywac historie skanow oraz statusy: `uploaded`, `recognized`, `matched`, `needs_web_search`, `failed`.
   - Wynik: skaner staje sie produkcyjnym core, a nie tylko frontowym flow.

7. Pro, limity, reklamy i telemetria
   - Wprowadzic backendowy licznik darmowych skanow.
   - Doprecyzowac `Wersja Pro`: brak reklam, wiecej skanow, historia, zaawansowane AI albo pakiet.
   - Dodac minimalna telemetrie: skan start, skan sukces, brak trafienia, dodanie do kolekcji, dodanie do wishlisty.
   - Wynik: zaczynamy mierzyc i monetyzowac produkt bez rozwalania core UX.

8. Store readiness i release mobile
   - Utwardzic PWA: offline, update flow, monitoring, privacy/terms, age gate 18+.
   - Wybrac droge mobilna: PWA -> TWA/Capacitor -> Google Play.
   - Przygotowac materialy pod rynek USA: screenshoty, opis, polityki, onboarding.
   - Wynik: Bourbon Hunters jest gotowe do pierwszego publicznego release'u jako aplikacja.

## Najblizsza kolejnosc robocza

1. Skonczyc local-first MVP i aktualny UX.
2. Ustalic backend i model kont.
3. Spisac kontrakt danych.
4. Postawic backend foundation.
5. Przepiac kolekcje/wishlist/oceny.
6. Uprodukcyjnić skaner.
7. Dodac limity, Pro i telemetrie.
8. Przygotowac wrapper/store.

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
| M8 | Konta + backendowa synchronizacja kolekcji | plan |
| M9 | Pro/reklamy + limity skanow | plan |
| M10 | Store-ready aplikacja mobilna | plan |

## Zasada pracy

- Nie tworzymy nowego projektu od zera.
- Pracujemy w istniejacej strukturze.
- Przy wiekszych zmianach frontu podbijamy cache w `sw.js`.
- Po zmianach sprawdzamy `git diff --check` i `git status --short`.
- Jesli GitHub Pages deploy z `Deploy from a branch` bedzie niestabilny, uzywamy workflow `Deploy Bourbon Hunters Pages` i w Settings -> Pages ustawiamy source na `GitHub Actions`.
## Hunter AI Plus - etap Pro

- [x] Zablokowac zwykly wynik skanera ponizej 80% pewnosci.
- [x] Pokazac kontrolowany ekran `Hunter AI Plus` zamiast losowego trafienia.
- [ ] Dodac paywall/pro entitlement.
- [ ] Dodac storage na zdjecia uzytkownika, rekomendacja: Cloudflare R2.
- [ ] Dodac pipeline obrobki zdjecia do formatu Bourbon Hunters na naszym tle.
- [ ] Dodac kolejke/akceptacje nowych butelek przed publikacja do glownej bazy.
- [ ] Agent AI Plus: dopasowanie z web search, profil general/nose/taste/finish, zapis roboczy.

## Aktualny krok - konta i zapis Cloudflare

- [x] UI Register / Sign In w aplikacji.
- [x] Schemat D1 dla kont, sesji, wishlisty, kolekcji, ocen i historii skanow.
- [x] Endpointy Workera dla rejestracji, logowania i syncu.
- [x] Frontend local-first z synchronizacja po zalogowaniu.
- [x] Podpiac binding `DB` w Cloudflare Worker.
- [x] Wykonac `agent/d1-schema.sql` w Cloudflare D1.
- [x] Wkleic i wdrozyc aktualny `agent/worker.js`.
- [ ] Test: utworzyc konto, dodac butelke do kolekcji, odswiezyc appke i sprawdzic sync.
