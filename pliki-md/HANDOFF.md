# Bourbon Hunters - handoff do kolejnej karty

Aktualizacja: 2026-07-05.

## Aktualizacja 2026-08-05 - audyt oraz auth hardening

- Pelny audyt jest w `pliki-md/AUDYT-KODU-2026-08-05.md`.
- Punkt powrotu przed zmianami auth: tag `audit-backup-2026-08-05-pre-auth-hardening`, commit `d024fe9`.
- Migracja `agent/d1-migration-v69-auth-hardening.sql` dodaje `email_verified_at`, role D1, tokeny potwierdzenia e-mail i jednorazowe zadania laczenia Google.
- Nowa rejestracja lokalna nie wydaje sesji przed potwierdzeniem e-mail. Link jest wazny 24 godziny.
- Administrator jest rozpoznawany tylko przez aktywny rekord `user_roles`. `ADMIN_EMAILS` i domyslny adres supportu nie nadaja juz uprawnien.
- Google nie laczy kont po samym e-mailu. Przy kolizji wymaga zalogowania haslem i jawnego laczenia z `Moj profil`.
- Usuniecie konta wymaga aktualnego hasla albo swiezej, maksymalnie 10-minutowej sesji Google.
- Publiczny health pokazuje `auth_version: auth-verified-email-roles-google-v4`; pelne `auth_security_schema` jest tylko w `/admin/health`.
- Kolejnosc wdrozenia jest obowiazkowa: backup D1 -> migracja v69 -> jawne nadanie roli admin -> usuniecie starych sesji admina -> GitHub/PWA -> Worker.
- Z README usunieto sekcje `Popular 200`; sam katalog i testy skanera nie zostaly w tej paczce zmienione.

## Aktualizacja 2026-08-05 - Etap 2, XSS i granica API

- `esc()` koduje teraz takze cudzyslow i apostrof, wiec dane dynamiczne nie moga zamknac atrybutu HTML.
- Linki newsow, sklepow, zrodel AI i przekierowan Google przechodza przez allowlisty protokolow i originu Workera.
- Obrazy dopuszczaja tylko HTTP(S), `blob:` oraz ograniczone bitmapowe `data:image`; SVG i `javascript:` sa odrzucane.
- CSP blokuje pluginy, ramki, obce formularze i wszystkie inline event handlery, np. wstrzykniete `onerror`.
- Publiczny `/auth/health` zwraca tylko stan, wersje auth/security i czas. Pelna diagnostyka jest w `/admin/health` i wymaga roli administratora.
- Nieobsluzony blad API zwraca `request_id`, a szczegoly zostaja w logach Workera.
- PWA cache: `bourbon-hunters-v116`. Test `scripts/security-xss-regression.mjs` oraz komplet testow domenowych i 6 testow UI przechodza.
- Generator browse deduplikuje wspolne ID przed liczeniem rodzin; aktualny stan to 257 bourbonow i 491 whisky.

## Najnowszy handoff

Najnowszy kontekst dla kolejnego etapu jest w `pliki-md/HANDOFF-BH-1.1.md`.
Uzyj go jako pierwszego dokumentu przy starcie watku `Przekaz Bourbon Hunter 1.1`.

## Aktualizacja 2026-08-04 - Popular 200

- `db/catalog/popular-200.json` zawiera audytowalna liste 100 popularnych bourbonow i 100 popularnych whisky oparta na raportach sprzedazy oraz aktualnych listach bestsellerow.
- `scripts/sync_popular_200.mjs` laczy jednoznaczne odpowiedniki, zachowuje zdjecia i historyczne ID, dodaje brakujace rekordy oraz przebudowuje indeks tokenow skanera.
- Pelny katalog quality-first ma 1127 kanonicznych produktow. Wszystkie 200 pozycji Popular 200 ma nazwy i aliasy przygotowane pod rozpoznawanie etykiet.
- Test `scripts/test_popular_200.mjs` przechodzi dla 200/200 nazw oraz 177/177 podstawowych aliasow. Regresja skanera nadal osiaga 99,8% top-1 na probce 1000 nazw.
- Worker raportuje `scan_catalog_version: popular-200-2026-v1`; cache PWA to `bourbon-hunters-v109`.
- Wdrozenie wymaga najpierw GitHub Pages, a potem podmiany Workera. Brak migracji D1.

## Aktualizacja 2026-07-27 - pelne assety szczegolow, news auth i profil wood

### Doprecyzowanie UI skanera 2026-08-04

- Karta potwierdzenia trafienia pokazuje teraz kategorie/odmiane oraz moc jako proof i ABV.
- Przyciski dodania butelki do katalogu lub kolekcji oraz akceptacji assetu maja wspolny butelkowo-zielony styl `btn-bottle`.
- Cache PWA: `bourbon-hunters-v109`.

- `bottleImageHtml` rozdziela teraz zrodla: listy uzywaja `thumb`, a szczegoly i wynik skanu preferuja pelny `image`. Naprawia to male butelki bez powiekszania miniaturek na listach.
- Angel's Envy Port Finish ma nowy wysokiej rozdzielczosci, przezroczysty asset katalogowy przygotowany na podstawie poprzedniego obrazu. Pozostale dobre assety nie zostaly zmienione.
- Sekcja newsow jest dostepna dopiero po zalogowaniu. Guest widzi zamkniety teaser i modal z wyborami `Rejestracja` oraz `Logowanie`.
- `GET /news` wymaga poprawnej sesji Bearer; blokada nie jest tylko elementem frontendu. Health potwierdza to polem `news_auth_required: true`.
- Belki w `Profil` i `Moj profil` korzystaja z wygenerowanej tekstury jasnego debu w jodelke, przechodzacego w lekko opalone i weglowe drewno: `assets/brand/profile-herringbone-burnt-v1.webp`. CSS ma dodatkowy awaryjny wzor desek, gdyby asset nie zostal pobrany.
- README zostal przebudowany na produktowa prezentacje funkcji i zawiera slot oraz 7-scenowy scenariusz filmu happy path.
- Historyczny cache poprzedniego etapu: `bourbon-hunters-v104`.
- Brak migracji D1. Wymagany jest deploy Workera oraz GitHub Pages.

## Aktualizacja 2026-07-27 - szczegoly butelki, zewnetrzne artykuly i cutout QA

- Butelka jest powiekszona tylko w widoku szczegolow i wyniku skanu. Rozmiary miniaturek na listach nie zostaly zmienione.
- Kontener szczegolow ma responsywna wysokosc 500-680 px, a asset zajmuje do 98% dostepnej przestrzeni bez sztucznego skalowania i obcinania korka.
- Link artykulu jest otwierany poza PWA. Przed wyjsciem aplikacja zapisuje widok i scroll w `sessionStorage`; jesli Android przeladuje PWA, stan jest odtwarzany bez ponownego intro i bramki wieku.
- `local-bottle-cutout-v2-quality-gated` usuwa tlo, przycina przezroczysty margines, centruje obiekt na przezroczystym canvasie 960x1280 i zapisuje WebP quality 92.
- Gemini wykonuje dodatkowa kontrole gotowego wyciecia. Ujecia z dlonia, ucinajace korek lub podstawe, z dziurami segmentacji albo wieloma obiektami zwracaja `422 cutout_quality` i prosbe o ponowne zdjecie.
- Health pokazuje `local_image_pipeline_version: local-bottle-cutout-v2-quality-gated` oraz `cutout_quality_ready: true`, gdy sa podpiete `IMAGES` i `GEMINI_API_KEY`.
- Historyczny cache tego etapu: `bourbon-hunters-v102`.
- Ten etap nie wymaga migracji D1. Wymaga deployu Workera i publikacji frontendu.

## Aktualizacja 2026-07-27 - newsy, gesty i lokalne wycinanie zdjec

- Karuzele na Home maja `touch-action: pan-y` i blokade osi dopiero po rozpoznaniu wyraznego gestu poziomego. Pionowy scroll dziala po rozpoczeciu gestu bezposrednio na karcie.
- Endpoint `GET /news` zwraca feed dla zalogowanych uzytkownikow Home i widoku `Profil -> Artykuly`.
- Agent newsow korzysta z Gemini z Google Search, ale akceptuje artykuly tylko z bialej listy: Whisky Advocate, Whisky Magazine, The Whiskey Wash i Distiller.
- Tytul, canonical URL, data i miniatura sa dodatkowo sprawdzane na stronie zrodlowej. Duplikaty canonical URL nie sa publikowane, a agent nigdy nie tworzy wpisu bez prawdziwego artykulu.
- Dzienny Cron pozostaje jeden. W poniedzialek i czwartek Worker dodaje maksymalnie 3 nowe artykuly; w pozostale dni wykonuje tylko dotychczasowe czyszczenie.
- Administrator moze uruchomic pobranie recznie przyciskiem `Pobierz 3 najnowsze artykuly` w `Profil -> Raporty`.
- Pusty feed jest jednorazowo uzupelniany 6 prawdziwymi artykulami startowymi z dozwolonych zrodel. Znacznik `starter-news-v1` zapobiega ponownemu odtwarzaniu ich po wygasnieciu.
- Artykuly sa usuwane przez dzienny Cron po 30 dniach od `created_at`, czyli od momentu pojawienia sie w aplikacji. Health pokazuje `news_retention_days: 30` i `starter_news_count: 6`.
- Migracja `agent/d1-migration-v68-whisky-news.sql` dodaje `news_articles` i `news_agent_runs`.
- Zdjecie dodawane lokalnie do produktu bez assetu przechodzi przez `POST /catalog/local-cutout`: Cloudflare Images usuwa tlo, centruje butelke i zwraca WebP 960x1280.
- Surowe zdjecie nie jest zapisywane w R2 ani D1. Dopiero po potwierdzeniu podgladu gotowy WebP trafia do IndexedDB na danym urzadzeniu.
- Domyslny limit wycinania to 10/dzien na konto lub urzadzenie oraz 40/dzien na IP; admin jest zwolniony. Zmienne: `LOCAL_CUTOUT_DAILY_LIMIT` i `LOCAL_CUTOUT_IP_DAILY_LIMIT`.
- Testy: `scripts/news-agent-regression.mjs`, `scripts/ui-news-scroll-smoke.mjs`, `scripts/ui-local-photo-smoke.mjs`.
- Cache PWA: `bourbon-hunters-v101`.

## Aktualizacja 2026-07-27 - katalog quality-first i czyste assety

- Katalog skanera ma 1028 zweryfikowanych produktow. Po bazowym odrzuceniu 7976 rekordow `recognition_only` usunieto tez pozostale zestawy, RTD i produkty spoza whisky.
- Lekka baza startowa ma 285 produktow. Po klasyfikacji do przegladania aplikacja pokazuje 748 kanonicznych pozycji: 267 Bourbon i 481 Whisky.
- Obowiazuja limity `MAX_RETAIL_USD=500` i `MAX_RETAIL_PLN=1500`.
- `scripts/clean_bottle_assets.mjs` tworzy przezroczyste WebP w `assets/bourbons/clean/`, bez nadpisywania zrodel.
- Aktywne sa tylko obrazy jednej butelki bez pudelek, zestawow, dodatkowych przedmiotow i watermarkow. Pozostale rekordy uzywaja kontrolowanego placeholdera.
- Raport obrazow: `db/catalog/image-quality-report.json`; jawne decyzje: `db/catalog/image-asset-overrides.json`.
- Lekka baza ma 112 aktywnych czystych assetow i 173 placeholdery.
- Nowe skany wysylaja obraz do 1800 px przy JPEG 0.91. Rozpoznawanie dostaje w tym samym wywolaniu kompozycje pelnego zdjecia i zblizenia korpusu/etykiety, a Worker tworzy podglad 960x1280 z oryginalnego kadru.
- Taksonomia `spirit-taxonomy-v2` jest wspolna dla Home, Odkrywaj, Kolekcji, Polecanych i szczegolow. Licznik kafla jest liczony z tej samej listy, ktora otwiera kafel.
- Buffalo Trace standard oraz techniczne receptury/private picki Four Roses Single Barrel sa scalone w kanoniczne produkty; stare ID prowadza przez `id_redirects`.
- Produkt bez oficjalnego assetu pokazuje mystery bottle. W szczegolach user moze przypisac wlasne zdjecie, przechowywane wylacznie lokalnie w IndexedDB danego urzadzenia.
- Worker: `visual-only-catalog-v6-mobile-label-view`; katalog: `ttb-olcc-quality-catalog-v9-canonical-products`; submission: `community-catalog-images-v6-highres-cutout`.
- Odkrywaj, Polecane, Wishlist i Kolekcja korzystaja ze wspolnego renderera filtrow rodziny i stylu.
- `db/catalog/manual-popular-whisky.json` uzupelnia popularne braki katalogu, obecnie m.in. Bushmills oraz kanoniczne warianty Jack Daniel's i Jim Beam.
- Skaner nie pokazuje juz osobnego ekranu potwierdzenia. Najlepsze pewne dopasowanie przechodzi od razu do szczegolow. Dla rekordu bez gotowego assetu Worker najpierw wycina butelke, a szczegoly pokazuja przycisk uzupelnienia katalogu.
- Historyczny cache tego etapu: `bourbon-hunters-v100`.
- Sam etap katalogu nie mial migracji D1; pozniejszy feed newsow wymaga migracji v68.

## Aktualizacja 2026-07-27 - produkty kanoniczne i potwierdzony asset skanera

- Lekka baza aplikacji zostala oczyszczona z rocznikow, private picks, nazw beczek i innych nazw handlowych, ktore nie tworza osobnego produktu.
- `db/bourbons.json` ma 333 kanoniczne produkty zamiast 539 wejsciowych rekordow.
- Pelny katalog skanera ma 9036 produktow zamiast 9406 rekordow wejsciowych.
- Stare identyfikatory nie znikaja z kolekcji userow: 437 przekierowan w pelnym katalogu prowadzi do kanonicznych produktow.
- Te same ogolne reguly obowiazuja wszystkie marki w obu bazach: roczniki, batche, techniczne nazwy OLCC/TTB, private picks, numery beczek i opakowania nie tworza osobnego produktu.
- Nazwa wyswietlana jest czyszczona z koncowych kategorii `Bourbon/Whiskey`; pelna historyczna nazwa zostaje aliasem skanera.
- Prawdziwe ekspresje zachowuja odrebnosc: bourbon/rye, wiek, proof, Bonded, Single Barrel, Cask Strength oraz numery `Edition` i `Series`.
- Gift sety, VAP, twin packi oraz warianty ze szklankami, podkladkami, kubkami, flaskami i cocktail kitami sa usuwane calkowicie, takze z aliasow.
- Przyklad: roczniki Michter's 10 Year sa jednym produktem `Michter's 10 Year Single Barrel Bourbon`.
- Przyklad: Knob Creek SDBB, private picks i nazwy beczek sa jednym produktem `Knob Creek 9 Year Single Barrel Reserve`; prawdziwe inne ekspresje nadal sa osobne.
- Skaner nie ma juz posredniego ekranu wyboru. Pewne dopasowanie otwiera bezposrednio szczegoly, a brak pewnego dopasowania prosi o nowe zdjecie.
- Po potwierdzeniu Worker nie uruchamia ponownie Gemini i nie pobiera drugiego limitu skanu. Dla butelki bez assetu wykonuje wyciecie Cloudflare Images i zwraca tymczasowy podglad do szczegolow.
- Tymczasowy podglad nie jest automatycznie publikowany we wspolnym katalogu. Publikacja nadal wymaga licencji usera i moderacji admina.
- Raport konsolidacji: `db/catalog/product-consolidation-report.json`.
- Skrypt przebudowy: `scripts/consolidate_product_catalog.mjs`.
- Historyczna wersja Workera tego etapu: `visual-only-catalog-v2-confirmed-cutout`.
- Historyczna wersja katalogu tego etapu: `ttb-olcc-retail-products-v6`.
- Historyczny cache PWA tego etapu: `bourbon-hunters-v97`.
- Wdrozenie wymaga GitHub Pages i Workera, ale nie wymaga migracji D1.

## Aktualizacja 2026-07-24 - rollback skanera do jednego agenta wizualnego

- Skaner wykonuje jedno wywolanie Gemini na pelnym zdjeciu.
- Agent wizualny zwraca dokladna nazwe oraz maksymalnie dwie propozycje.
- Nie ma agenta OCR, wycinka etykiety, fuzji wynikow ani dodatkowego porownania obrazow przez Gemini.
- Nazwa jest deterministycznie dopasowywana do aktualnego indeksu 9406 rekordow z uwzglednieniem aliasow.
- Wynik nadal wymaga potwierdzenia usera. Dwie propozycje pojawiaja sie tylko powyzej 90%.
- Zatwierdzone rekordy `catalog_bottles` nadal sa dolaczane do indeksu skanera.
- Nowa migracja `agent/d1-migration-v67-catalog-moderation.sql` dodaje kolejke moderacji. User wysyla szkic, orkiestrator go ocenia, a admin zatwierdza albo odrzuca w widoku `Raporty`.
- Opublikowany rekord katalogowy jest zablokowany przed nadpisaniem przez zwyklego usera.
- Test `scripts/scanner-regression.mjs` uruchamia prawdziwy kod Workera: 99,6% top-1 i top-2 na kontrolnej probce 1000 nazw.
- Bazowa wersja po rollbacku: `visual-only-catalog-v1-pre-ocr-restored`.
- Oczekiwana wersja moderacji: `catalog-moderation-orchestrator-admin-v1`.
- Bazowy cache PWA po rollbacku: `bourbon-hunters-v94`.
- Punkt powrotu do wersji OCR: `backup-before-visual-only-e1e13a5`.
- Historyczny punkt sprzed pierwszego OCR: `backup-pre-ocr-636617a`.

## Aktualizacja 2026-07-23 - bezpieczna deduplikacja katalogu

- Katalog zrodlowy 10000 rekordow zostal oczyszczony do 9934 rekordow kanonicznych.
- Polaczono 66 pewnych duplikatow w 64 grupach. Rozne typy, wiek, proof i warianty pozostaja osobnymi rekordami.
- Stare identyfikatory maja przekierowania w `db/catalog/dedupe-redirects.json`; Worker obsluguje je przy potwierdzaniu wyniku.
- Generator i walidator uzywaja wspolnej logiki `scripts/catalog_identity.mjs`, a audyt po czyszczeniu zwraca 0 bezpiecznych duplikatow.
- Regresja po przebudowie indeksu: 99,3% top-1 i 99,4% top-2 na probce 1000 rekordow.
- Oczekiwana wersja katalogu Workera: `ttb-olcc-10k-deduped-v2`.

## Aktualizacja 2026-07-23 - filtr dostepnosci sklepowej

- Po deduplikacji zastosowano polityke `retail-relevance-2026-v1`; katalog ma teraz 9406 rekordow.
- Usunieto 528 pozycji: 499 niepotwierdzonych etykiet lub wydan kolekcjonerskich oraz 29 starych/ultra-rzadkich listingow.
- Filtr obejmuje historyczne roczniki, stare batche, private/store picks, numerowane caski, niepotwierdzone edycje limitowane, wysokie roczniki kolekcjonerskie i serie ultra-alokowane.
- Jawny limit polityki wynosi 1000 USD. Wczesniejszy, bardziej restrykcyjny limit importu zweryfikowanych cen nadal pozostaje aktywny.
- Raport usunietych rekordow: `db/catalog/retail-filter-report.json`.
- Generator, filtr i walidator korzystaja ze wspolnej polityki `scripts/catalog_retail_policy.mjs`.
- Regresja po filtrze: 99,4% top-1 i 99,4% top-2 na probce 1000 rekordow.
- Bazowa wersja katalogu po filtrze: `ttb-olcc-retail-filtered-v3`.

## Aktualizacja 2026-07-23 - kanoniczne warianty skanera

- Jack Daniel's Bonded, Jack Daniel's Single Barrel Select i Knob Creek 9 Year maja rozszerzone aliasy zgodne z tekstem etykiet.
- Powielone ogolne rekordy OLCC/TTB sa pomijane tylko podczas rozpoznawania, aby nie powodowaly falszywej niejednoznacznosci.
- Prawdziwe osobne warianty, m.in. Jack Daniel's Rye i Barrel Proof oraz Knob Creek Single Barrel, pozostaja aktywne.
- Oczekiwana wersja Workera: `ocr-visual-fusion-catalog-10k-v9-canonical-labels`.

## Aktualizacja 2026-07-18 - telemetria skanera i raporty

- Migracja `agent/d1-migration-v66-telemetry-reports.sql` dodaje `scanner_runs`, `service_usage_events` i rezerwowa tabele `telemetry_events`.
- Skaner nadaje kazdej probie `scan_id`, zapisuje wynik, czasy, pewnosc i tokeny Gemini bez zdjecia, surowego OCR, tekstu etykiety, emaila i IP.
- Potwierdzenie pierwszej lub drugiej propozycji oraz anulowanie wraca do Workera przez `/telemetry/scan-choice`.
- Administrator ma w profilu widok `Raporty`. Historycznie role wyliczano z `ADMIN_EMAILS`/`SUPPORT_EMAIL`; od migracji v69 endpointy `/admin/reports/*` wymagaja aktywnej roli D1 `user_roles.admin`.
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

## Aktualizacja 2026-07-23 - osobna kategoria Whisky

- Home ma osobny kafel `Whisky`; obejmuje rekordy, które nie są bourbonem.
- `Rye Whiskey` jest teraz podfiltrem Whisky, a nie metodą produkcji bourbona.
- Filtry mają dwie warstwy: rodzina `Bourbon / Whisky` i podtypy zależne od rodziny.
- Bourbon: Classic, Small Batch, Single Barrel, Bottled in Bond, Barrel Proof, Wheated, Limited.
- Whisky: Scotch, Irish, Japanese, Rye, American Single Malt, Tennessee, Canadian, Corn & Wheat, American Whiskey, World Whisky, Pozostałe.
- Ten sam podział działa w Odkrywaj, Kolekcji, Wishlist i Polecanych.
- `db/catalog/browse-whisky.json` zawiera 491 widocznych rekordów i ładuje się dopiero po wejściu w Whisky.
- Klasyfikator: `spirit-taxonomy.js`.
- Generator: `scripts/build_browse_catalog.mjs`.
- Asset kafla: `design/figma-assets/home-pack-v2/whisky-world.png`.
- Cache PWA: `bourbon-hunters-v111`.

Po każdej przebudowie głównego katalogu uruchom:

```powershell
node scripts/build_browse_catalog.mjs
node scripts/test_spirit_taxonomy.mjs
```

## Aktualizacja 2026-07-24 - skaner v11

- Worker laczy teraz marke rozpoznana wizualnie z wariantem, wiekiem, proof i ABV odczytanymi przez OCR.
- Slaby, czesciowy OCR nie obniza juz automatycznie poprawnego trafienia wizualnego do 79%.
- OCR domyslnie dziedziczy `OCR_MODEL`, potem `IDENT_MODEL`, a nastepnie `MODEL`. Przy obecnej konfiguracji uzywa `gemini-2.5-flash`.
- Testy regresyjne obejmuja rozdzielone dowody dla `Jack Daniel's Bonded` i `Knob Creek 9`.
- Wersja Workera po wdrozeniu: `ocr-visual-fusion-catalog-10k-v11-split-label-evidence`.

## Aktualizacja 2026-08-05 - skaner mobilny i odpornosc na 503

- Aktualny skaner pozostaje w trybie `visual_only`; OCR jest wylaczony.
- Wersja Workera: `visual-only-catalog-v8-mobile-foreground`.
- Frontend wysyla lekki pelny kadr bez sztywnego cropu. Worker dodatkowo odseparowuje pierwszy plan przez Cloudflare Images i przekazuje modelowi oba widoki tej samej fotografii.
- Dlon, regaly i tlo nie sa podstawa odrzucenia, jezeli glowna etykieta zawiera marke i wariant.
- Wiek jest twardym markerem wariantu: sprzeczne `5/10/12/15/18 Year` obniza wynik ponizej progu pewnego trafienia, niezaleznie od zgodnosci marki.
- Model podstawowy: `gemini-2.5-flash-lite`; zapasowy: `gemini-2.5-flash`.
- Przy przeciazeniu Worker przechodzi od razu do modelu zapasowego, bez dwoch dlugich prob tego samego modelu.
- `429` nie uruchamia fallbacku i pozostaje komunikatem o limicie dostawcy.
- Health pokazuje `scanner_ai_ready`, `scanner_primary_model`, `scanner_fallback_model` i `scanner_mobile_foreground`.
- Test regresyjny: `node scripts/scanner-provider-fallback.mjs`.

## Aktualizacja 2026-08-05 - kuracja kategorii i filtrow

- Z aplikacji i indeksu skanera usunieto whiskey smakowe, likiery whiskey oraz warianty infused/cream.
- Regula obejmuje wszystkie rozpoznane smaki owocowe, deserowe i korzenne, nie tylko Apple i Honey.
- Finisze wynikajace z beczki lub drewna pozostaja w katalogu.
- Ukryte sa grupy `Flavored Whiskey`, `World Whisky` i `Other Whisky`.
- Filtry nie pokazuja opcji `Wszystkie` ani liczby rekordow.
- Na Home kafel `Whisky` jest pierwszy w karuzeli kategorii, bezposrednio przed `Barrel Proof`; kafle kategorii nie pokazuja licznikow.
- Przelaczniki `Bourbon / Whisky` oraz `Lista zyczen / Moja kolekcja` sa wizualnie oddzielone od podkategorii.
- Odtworzenie danych: `node scripts/prune_hidden_spirits.mjs`, potem `node scripts/sync_popular_200.mjs` i `node scripts/build_browse_catalog.mjs`.
- Test: `node scripts/test_catalog_visibility.mjs`.

## Aktualizacja 2026-08-05 - odzyskiwanie wydan newsow i przyciski zdjec

- Agent newsow ma wersje `whisky-news-google-grounded-v2-release-recovery`.
- Poniedzialek i czwartek otwieraja osobne wydanie po trzy artykuly. Dzienny Cron ponawia nieudane wydanie w kolejnych dniach i uzupelnia je do trzech pozycji.
- Artykuly startowe maja osobny `issue_key`, wiec nie blokuja automatycznego wydania.
- Health pokazuje `news_current_release`, `news_article_count` i `news_last_run`.
- Przyciski dodania, zmiany i usuniecia lokalnego zdjecia sa wewnatrz ramki butelki przy jej dolnych rogach.
- Cache PWA: `bourbon-hunters-v114`. Migracja D1 nie jest wymagana.

## Aktualizacja 2026-08-05 - startowy feed Polecanych

- `Polecane` ma 10 startowych butelek z istniejacymi assetami oraz 32 zroznicowane opinie, srednio 3,2 komentarza na butelke.
- Oceny startowe maja 3-5 gwiazdek, z przewaga ocen 4 i 5.
- Kafel agreguje kilka znacznikow osob, a szczegoly pokazuja wszystkie komentarze przypisane do butelki.
- Prawdziwe komentarze z Workera sa wyswietlane przed trescia startowa; dane startowe nie tworza fikcyjnych kont w D1 i nie zmieniaja prawdziwej sredniej spolecznosci.
- Four Roses zastapiono Bushmills 12 Year Old Single Malt z oficjalnym, przezroczystym assetem oraz czterema opiniami.
- Test: `node scripts/starter-recommendations-regression.mjs`.
- Cache PWA: `bourbon-hunters-v114`.


