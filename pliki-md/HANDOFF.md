# Bourbon Hunters - handoff do kolejnej karty

Aktualizacja: 2026-07-05.

## Najnowszy handoff

Najnowszy kontekst dla kolejnego etapu jest w `pliki-md/HANDOFF-BH-1.1.md`.
Uzyj go jako pierwszego dokumentu przy starcie watku `Przekaz Bourbon Hunter 1.1`.

## Aktualizacja 2026-07-23 - kanoniczne warianty skanera

- Jack Daniel's Bonded, Jack Daniel's Single Barrel Select i Knob Creek 9 Year maja rozszerzone aliasy zgodne z tekstem etykiet.
- Powielone ogolne rekordy OLCC/TTB sa pomijane tylko podczas rozpoznawania, aby nie powodowaly falszywej niejednoznacznosci.
- Prawdziwe osobne warianty, m.in. Jack Daniel's Rye i Barrel Proof oraz Knob Creek Single Barrel, pozostaja aktywne.
- Oczekiwana wersja Workera: `ocr-visual-fusion-catalog-10k-v9-canonical-labels`.

## Aktualizacja 2026-07-18 - telemetria skanera i raporty

- Migracja `agent/d1-migration-v66-telemetry-reports.sql` dodaje `scanner_runs`, `service_usage_events` i rezerwowa tabele `telemetry_events`.
- Skaner nadaje kazdej probie `scan_id`, zapisuje wynik, czasy, pewnosc i tokeny Gemini bez zdjecia, surowego OCR, tekstu etykiety, emaila i IP.
- Potwierdzenie pierwszej lub drugiej propozycji oraz anulowanie wraca do Workera przez `/telemetry/scan-choice`.
- Administrator ma w profilu widok `Raporty`; endpointy `/admin/reports/*` sa chronione przez `ADMIN_EMAILS` lub `SUPPORT_EMAIL`.
- Surowa telemetria operacyjna ma domyslnie 90 dni retencji i jest czyszczona przez ten sam dzienny Cron.
- Ogolna analityka produktowa pozostaje wylaczona. Szczegoly: `pliki-md/TELEMETRY.md`.
- Cache PWA: `bourbon-hunters-v91`.

## Aktualizacja 2026-07-18 - asset po potwierdzeniu skanu

- Kandydat skanera pobiera opublikowany asset ze wspolnego `catalog_bottles`, nawet gdy dodal go inny user i nie miesci sie juz w liscie ostatnich 24 pozycji.
- Mystery po potwierdzeniu przez zalogowanego usera automatycznie uruchamia Cloudflare Images i tworzy podglad wycietej butelki dopasowany do wybranego `bottle_id`.
- Ekran szczegolow pokazuje ten podglad od razu. Publikacja do wspolnej bazy nadal wymaga osobnego przycisku akceptacji licencji assetu.
- Po publikacji szczegoly przechodza na finalny URL R2, a kolejne skany wszystkich userow widza gotowy obraz.

## Aktualizacja 2026-07-18 - cykl zycia zdjec katalogowych

- Migracja `agent/d1-migration-v65-catalog-data-lifecycle.sql` rozdziela zrodlo, podglad roboczy i finalny asset katalogowy.
- Oryginal trafia do R2 tylko na czas wyciecia butelki i jest usuwany po utworzeniu podgladu. Anulowanie lub ponowienie usuwa pozostale pliki robocze.
- Akceptacja kopiuje podglad do niezaleznego klucza `catalog/published/<bottle_id>/<sha256>.webp`, zapisuje wersje licencji i minimalny dowod zgody.
- Usuniecie konta kasuje dane osobowe oraz lokalny cache, ale odczepia zaakceptowane assety od profilu i zostawia je w katalogu.
- Porzucone podglady sa czyszczone po 24 godzinach przez scheduled handler; w Cloudflare trzeba dodac dzienny Cron Trigger, np. `0 3 * * *`.
- Worker health ma zwracac `catalog_data_schema: true`, `catalog_submission_version: community-catalog-images-v4-confirmed-cutout` i `catalog_license_version: catalog-license-2026-07-18-v1`.
- Cache PWA: `bourbon-hunters-v89`.

## Aktualizacja 2026-07-12 - potwierdzanie wyniku skanera

- Po kazdym pewnym skanie frontend pokazuje 1-2 kandydatow obok siebie. Szczegoly sa widoczne dopiero po wyborze i potwierdzeniu usera.
- Najlepszy kandydat musi osiagnac skonfigurowany prog (domyslnie 80%). Slabszy wynik nadal prosi o wyrazniejsze zdjecie.
- Wynik 80-89,99% daje jedna propozycje. Dwie propozycje pojawiaja sie tylko wtedy, gdy oba najlepsze wyniki maja co najmniej 90%. Trzeci kandydat nigdy nie jest pokazywany.
- Potwierdzony identyfikator jest przekazywany do analizy AI, wiec Worker nie wykonuje ponownego zgadywania wariantu.
- Zalogowany admin jest zwolniony z limitu aplikacji/KV. Nie omija to zewnetrznego limitu projektu Gemini.
- Cache PWA: `bourbon-hunters-v88`.
- Punkty powrotu Git: `backup-pre-ocr-636617a` (stan sprzed OCR) oraz `backup-before-scan-confirmation-d0f60ed` (stan przed tym flow).


## Aktualizacja 2026-07-05

- Zwykly skaner nie zgaduje ponizej 80% pewnosci dopasowania.
- Slabe trafienie pokazuje stan `Hunter AI Plus`, bez losowej butelki z bazy.
- Hunter AI Plus jest planowana funkcja Pro/paywall: glebsze dopasowanie, web search, profil smaku i zapis nowego znaleziska.
- Rejestracja i logowanie email/password sa podpiete do Workera i D1.
- Google Sign-In jest tylko przyciskiem UI i nie dziala do kolejnego etapu.
- Wishlist, kolekcja, oceny i historia skanow maja sync przez D1 po zalogowaniu, ale aplikacja pozostaje local-first.
- Dokumenty projektowe przeniesione sa do folderu `pliki-md/`.

## Cel projektu

`Bourbon Hunters` to PWA/mobile-web do wyszukiwania, katalogowania i oznaczania bourbonĂłw. Priorytetem jest aplikacja wyglÄ…dajÄ…ca premium na telefonie, z bazÄ… butelek, wishlistÄ…, kolekcjÄ… i skanerem etykiet wspieranym przez Hunter AI.

## Technologia

- Frontend: statyczne PWA w `index.html`, bez frameworka.
- Service worker: `sw.js`, network-first dla HTML/DB/SW.
- Baza: `db/bourbons.json`.
- Backend/Hunter AI: `agent/worker.js` na Cloudflare Worker.
- Hosting: GitHub Pages, publiczny URL: `https://backloghero-lang.github.io/bourbon-hunters/`.
- Test launcher: `test-index.html`.
- Figma: lokalny plugin importujÄ…cy assety z GitHub Pages: `design/figma-import-plugin`.

## NajwaĹĽniejsze Ĺ›cieĹĽki

- App: `index.html`
- Service worker: `sw.js`
- Dane butelek: `db/bourbons.json`
- DuĹĽe assety 100 butelek: `assets/bourbons/runtime-100/`
- Miniatury list 100 butelek: `assets/bourbons/list-thumbs/`
- Intro: `assets/intro/nowe intro.mp4`
- Assety UI z Figmy: `design/figma-assets/home-pack-v2/`
- Assety skanera: `design/figma-assets/scanner-pack-v1/`
- Lista poprawek: `pliki-md/POPRAWKI.md`

## Aktualny stan aplikacji

- App pokazuje obecnie 100 popularnych butelek z ujednoliconymi assetami.
- `Odkrywaj` i `Kolekcja` uĹĽywajÄ… osobnych miniaturek, ĹĽeby nie pokazywaÄ‡ losowo samych szyjek.
- SzczegĂłĹ‚y uĹĽywajÄ… wiÄ™kszych assetĂłw.
- Intro uĹĽywa `assets/intro/nowe intro.mp4`, startuje od ok. 5 sekundy, ma przycisk `PomiĹ„`.
- Na desktopie intro jest w pionowym kadrze 9:16, a nie na caĹ‚y monitor.
- Gwiazdka/watermark z prawego dolnego rogu intro jest maskowana CSS-em w aplikacji. Nie robimy fizycznej przerĂłbki MP4.
- Audio intro zostaje wyĹ‚Ä…czone na staĹ‚e (`muted`) ze wzglÄ™du na autoplay mobile.
- Parser opisĂłw wyciÄ…ga z opisĂłw pola `nose`, `taste`, `finish`, jeĹ›li wystÄ™pujÄ… w opisie, i usuwa dublowanie z tekstu opisu.
- Gwiazdki w szczegĂłĹ‚ach zostaĹ‚y zmniejszone, a kafle ratingu sÄ… w ukĹ‚adzie 2x2, ĹĽeby nie wyjeĹĽdĹĽaĹ‚y poza ekran.

## Lokalizacja PL/EN

ReguĹ‚a docelowa:

- JeĹĽeli jÄ™zyk telefonu zaczyna siÄ™ od `pl`, aplikacja ma byÄ‡ po polsku i pokazywaÄ‡ ceny w zĹ‚.
- KaĹĽdy inny jÄ™zyk telefonu = aplikacja po angielsku i ceny w USD.
- Nazwy wĹ‚asne nie sÄ… tĹ‚umaczone: `Bourbon Hunters`, destylarnie, nazwy alkoholi.

Stan obecny:

- `detectLang()` w `index.html` juĹĽ wybiera `pl` tylko dla jÄ™zyka urzÄ…dzenia `pl*`, inaczej `en`.
- `fmtPrice()` preferuje zĹ‚ dla PL i USD dla EN. JeĹĽeli brakuje jednej waluty, uĹĽywa orientacyjnego kursu `PLN_PER_USD = 4.0`.
- Docelowo kurs i tĹ‚umaczenia opisĂłw powinny iĹ›Ä‡ przez backend/worker oraz pola typu `desc_pl` / `desc_en`.

## Figma workflow

Po wysĹ‚aniu zmian na GitHub:

1. Poczekaj, aĹĽ GitHub Pages odĹ›wieĹĽy assety.
2. OtwĂłrz plik Figma `Bourbon Hunters Asset Pack`.
3. Uruchom lokalny plugin:
   `Plugins -> Development -> Bourbon Hunters Asset Importer`.
4. Plugin ma importowaÄ‡ assety z GitHub Pages do istniejÄ…cej strony, bez mnoĹĽenia nowych stron.
5. JeĹĽeli Figma pokazuje limit 3 stron, usuĹ„ zbÄ™dne/dublujÄ…ce strony i importuj do jednej istniejÄ…cej strony.

Uwaga: wczeĹ›niejsze prĂłby MCP Figma wpadaĹ‚y w limit planu Starter, wiÄ™c najpewniejsza Ĺ›cieĹĽka to rÄ™czne uruchomienie lokalnego pluginu po deployu.

## Backlog zapamiÄ™tany

- Worker do zdjÄ™Ä‡ uĹĽytkownika: przy dopracowywaniu skanera backend ma w locie oczyszczaÄ‡/normalizowaÄ‡ zdjÄ™cia usera, usuwaÄ‡ tĹ‚o i osadzaÄ‡ butelkÄ™ na wspĂłlnym tle aplikacji.
- Animacje skanera premium: dopracowaÄ‡ pasek skanowania i animacjÄ™ toczÄ…cej siÄ™ beczki podczas oceny / analizy AI.
- PeĹ‚ne tĹ‚umaczenia danych PL/EN przez backend.
- Lepszy kurs walut z backendu zamiast staĹ‚ej `PLN_PER_USD`.
- Sync Figma po kaĹĽdym wiÄ™kszym paczku assetĂłw.

## NajbliĹĽsze kroki

1. WysĹ‚aÄ‡ bieĹĽÄ…ce zmiany na GitHub.
2. Na telefonie wejĹ›Ä‡ przez `test-index.html`, kliknÄ…Ä‡ `Odswiez build` i w razie potrzeby `Wyczysc cache/PWA`.
3. SprawdziÄ‡: intro od 5 sekundy, przycisk `PomiĹ„`, kadr 9:16 na PC, waluty PL/EN, szczegĂłĹ‚y butelek i listy.
4. Po deployu uruchomiÄ‡ plugin Figma Asset Importer.


