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
- Telemetria jest etapem pozniejszym, po dopracowaniu core aplikacji i polityk prywatnosci. Plan zdarzen trzymamy w `TELEMETRY.md`, ale nie wlaczamy zapisu bez osobnej decyzji.
- Limit 20 darmowych skanow traktujemy jako decyzje kierunkowa; sposob liczenia doprecyzujemy pozniej, tymczasowo kandydatem jest limit per urzadzenie.
- Home pokazuje skrot `Moja kolekcja` jako karuzele z tych samych danych, ktore sa w dolnej zakladce `Kolekcja`.
- Widok `Profil` na etapie prototypu pokazuje: Register, Sign In, Articles, Wersja Pro i Ustawienia.
- `Register` i `Sign In` sa podpiete do Cloudflare Worker + D1 dla email/password; Google Sign-In zostaje nieaktywny do kolejnego etapu.
- Login spolecznosciowy na start ograniczamy do Google. Nie dodajemy Facebooka ani Instagrama, zeby nie komplikowac onboardingu i review providerow.
- `Articles` jest miejscem na przyszlego Workera/agenta od newsow i tresci ze swiata whiskey.
- Pelna aplikacja zaczyna sie wtedy, gdy kolekcja, wishlisty, oceny, limity skanow i historia skanow sa zapisywane na backendzie, a nie tylko w `localStorage`.
- `localStorage` zostaje dobry dla MVP/prototypu, ale nie jest docelowym miejscem danych uzytkownika.
- Nie uzywamy pliku `data.db` w repo/GitHub Pages jako produkcyjnej bazy userow. GitHub Pages jest statyczny i nie nadaje sie do bezpiecznego zapisu kont.
- Docelowa baza kont i danych usera: Cloudflare D1, czyli SQL/SQLite-style baza pod Workerem.
- Zdjecia userow i skanow docelowo trzymamy w Cloudflare R2, a nie w D1.
- Zamykany banner `Join Pro` w profilu znika tylko na biezace wejscie w widok. Po ponownym wejsciu w Profil ma wrocic.
- Age gate ma pojawiac sie przed intro. Dopiero potwierdzenie wieku uruchamia intro.
- W podstawowym UI profilu social login ograniczamy do Google jako przyszly etap; Facebook/Instagram nie wchodza do MVP.
- Link sklepu w szczegolach butelki moze zostac, ale nie pokazujemy dodatkowego komunikatu `To moze byc Twoj sklep`.

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
- Skaner uzywa osobnego, lekkiego indeksu `db/catalog/scan-index.json` z 10 000 rekordow.
- Pelne rekordy katalogowe sa w `db/catalog/bottles.json`, a raport jakosci w `db/catalog/quality-report.json`.
- Priorytetem sa prawdziwe nazwy i zdjecia.
- Nie dodajemy fake/mock data, jesli mozna uzyc realnych danych.
- Bardzo drogie butelki byly odfiltrowane wedlug ustalen z poprzedniego etapu.
- Docelowo baza opisow ma rosnac do tysiecy pozycji, nawet jesli warstwa wizualna bedzie stopniowo wymieniana na bezpieczniejsze assety.
- Limit nowych rekordow z potwierdzona cena: maksymalnie 1000 PLN albo 350 USD.
- Fakty identyfikacyjne katalogu 10k pochodza z TTB i OLCC. Profil `style_estimate` jest naszym przewidywanym profilem stylu, a nie potwierdzona nota producenta.
- Rekord bez potwierdzonej ceny ma status `recognition_only`: moze pomagac OCR, ale nie trafia automatycznie do polecanych ani filtrow zakupowych.

## Worker i agenci

- Obecny Worker rozpoznaje nazwe butelki ze zdjecia i sprawdza baze; zwykly wynik wymaga minimum 80% pewnosci.
- Brak pewnego trafienia w bazie prowadzi do stanu Hunter AI Plus; zapis nowych znalezisk wymaga osobnego etapu Pro/storage.
- Docelowo powstanie drugi Worker/agent do obrobki nowych zdjec userow i wdrazania ich do widokow.
- Scanner API ma byc traktowany jako core produktu: baza lokalna/online najpierw, a siec/AI jako funkcja Hunter AI Plus albo analiza dla pewnych trafien.
- Po wdrozeniu kont limit skanow powinien byc liczony po stronie backendu, nie tylko per urzadzenie.

## 2026-07-18 - Zdjecia katalogowe i usuwanie konta

- Oryginalne zdjecie usera jest plikiem tymczasowym. Po przygotowaniu podgladu wyciecia Worker usuwa je z R2 razem z metadanymi zapisanymi w pliku.
- Podglad roboczy istnieje tylko do decyzji `akceptuj`, `ponow` albo `anuluj`.
- Po akceptacji finalny asset trafia do niezaleznej sciezki `catalog/published/` i nie jest juz technicznie zalezny od konta ani rekordu zgloszenia.
- Uzytkownik udziela szerokiej, niewylacznej i bezterminowej licencji na zaakceptowany asset. Nie opisujemy zwyklego klikniecia jako przeniesienia autorskich praw majatkowych.
- Usuniecie konta usuwa dane osobowe i relacje uzytkownika, ale zachowuje zaakceptowane assety, nieosobowe dane butelki i minimalny niepubliczny dowod zgody.
- Dowod zgody zawiera wersje zasad, czas akceptacji, hash assetu i pseudonimowy hash autora. Nie zawiera oryginalnego zdjecia, emaila ani profilu.

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
- Rejestracja email/password moze wyslac mail powitalny po podpieciu providera Resend przez `RESEND_API_KEY` i `MAIL_FROM`.
- Szablony email sa trzymane w `pliki-md/email-templates/` i zostana podlaczone dopiero po wyborze providera.
- Rejestracja wymaga daty urodzenia. Domyslny prog to 18+, a dla USA mozemy szybko podniesc go zmienna Workera `AGE_GATE_MIN=21`.
- Reset hasla ma endpoint tokenowy, tabele D1 `password_reset_tokens`, ekran ustawienia nowego hasla z linku `?reset=...` i wysylke przez Resend po konfiguracji sekretow Workera.
- Rekomendacja na start dla maili transakcyjnych zostala przyjeta: Resend, bo jest prosty do podpiecia z Cloudflare Workerem. Przed produkcja trzeba dopracowac domene/subdomene i rekordy DNS.

## 2026-07-08 - Model ocen butelek

- W szczegolach butelki nie pokazujemy osobnego duzego panelu `Jakosc / Cena`, bo maly badge na zdjeciu juz pelni role szybkiego skrotu wartosci.
- Szczegoly butelki maja cztery stale kafle: `Proof`, `Cena sugerowana`, `Ocena spolecznosci`, `Twoja ocena`.
- `Twoja ocena` jest pojedynczym glosem usera dla butelki. Worker rozpoznaje usera po tokenie sesji i zapisuje ocene w `user_ratings`.
- `user_ratings` ma klucz `user_id + bottle_id`, wiec zmiana oceny nadpisuje poprzednia ocene tego usera, a nie dodaje nowego glosu.
- `Ocena spolecznosci` jest agregatem z D1 liczonym z ocen wszystkich userow dla `bottle_id`: srednia `AVG(rating)` oraz liczba ocen `COUNT(*)`.
- Po zapisaniu `/me/rating` Worker zwraca swiezy agregat tej butelki, zeby UI po kliknieciu gwiazdki moglo od razu pokazac aktualna srednia.
- Zmiany innych userow pojawiaja sie po kolejnym pobraniu agregatow, np. przy starcie aplikacji, wejsciu w widok/listy albo szczegoly. Nie robimy realtime w MVP.
- Jesli butelka nie ma ocen spolecznosci, UI pokazuje empty state zamiast pustych gwiazdek.

## 2026-07-08 - Profil i znacznik usera

- Po zalogowaniu user ma osobny ekran `Moj profil` dostepny z zakladki Profil.
- Wybrany znacznik profilu jest zapisywany local-first w `localStorage`, a po zalogowaniu synchronizowany z Workerem przez `/me/profile`.
- Worker zapisuje znacznik w D1 w tabeli `user_profiles` pod kluczem `user_id`, wiec zmiana znacznika nadpisuje profil tego usera zamiast tworzyc kolejne wpisy.
- W MVP znaczniki sa statycznym zestawem 10 ikon z `assets/profile-badges`; oryginalne mockupy zostaja jako material zrodlowy.
- Ten sam znacznik bedzie uzywany pozniej przy komentarzach i rekomendacjach uzytkownikow, zeby komentarz mial czytelna tozsamosc autora bez publikowania wiekszej ilosci danych profilu.

## 2026-07-08 - Polecenia i komentarze userow

- Sekcja `Polecane` na Home nie jest juz statyczna; ma pokazywac butelki polecone przez userow.
- Polecenie sklada sie z `bottle_id`, oceny 1-5, komentarza, usera i jego znacznika profilu.
- Worker zapisuje polecenia w D1 w tabeli `bottle_recommendations` pod kluczem `user_id + bottle_id`, wiec user moze aktualizowac swoje polecenie tej samej butelki bez duplikatow.
- Publiczne `GET /recommendations` zasila Home, liste `Zobacz wszystkie` oraz komentarze w szczegolach butelki.
- Prywatne `POST /me/recommendation` wymaga tokenu sesji, zapisuje polecenie i jednoczesnie aktualizuje ocene usera w `user_ratings`.
- W MVP feed nie jest realtime; odswieza sie przy pobraniu widoku, po wejsciu w szczegoly albo po zapisaniu polecenia.

## 2026-07-11 - Google OAuth

- Google login dziala przez Cloudflare Worker, nie bezposrednio z frontu.
- Front kieruje na `/auth/google/start`, Worker wymienia `code` na token Google po stronie serwera i wraca do PWA z tokenem sesji Bourbon Hunters w URL hash.
- D1 ma tabele `auth_identities`, ktora laczy `provider + provider_user_id` z `user_id`, zeby kolejne logowania Google aktualizowaly ta sama osobe.
- Historyczna decyzja o automatycznym laczeniu po e-mailu zostala wycofana 2026-08-05 ze wzgledow bezpieczenstwa.
- Health Workera powinien pokazywac aktualna wersje auth, `identity_schema: true` i `google_ready: true` po konfiguracji sekretow Google.

## 2026-08-05 - weryfikacja e-mail, role i jawne laczenie Google

- Rola administratora jest przechowywana w `user_roles`, nie jest wyliczana z adresu e-mail ani `SUPPORT_EMAIL`.
- Nowe konto lokalne pozostaje nieaktywne do klikniecia jednorazowego linku e-mail waznego 24 godziny.
- Zweryfikowany profil Google tworzy nowe konto tylko wtedy, gdy adres nie nalezy do istniejacego uzytkownika.
- Kolizja z kontem haslowym zwraca `google_account_exists_unlinked`. Uzytkownik loguje sie haslem i jawnie uruchamia laczenie Google w profilu.
- Laczenie Google ma podpisany state oraz jednorazowy, 10-minutowy rekord `auth_link_requests` zwiazany z aktywna sesja.
- Usuniecie konta wymaga ponownego podania hasla albo swiezej sesji Google.
- Wymagana migracja: `agent/d1-migration-v69-auth-hardening.sql`.

## 2026-07-11 - Scanner OCR + visual orchestrator

- Scanner w Workerze ma dwa lekkie agenty bez web search: `visual agent` rozpoznaje butelke po obrazie, a `OCR agent` czyta tekst etykiety.
- Orchestrator laczy dowody z obu agentow i bazy: nazwe/wariant, OCR raw text, proof, ABV, kategorie oraz zgodnosc visual+OCR.
- Jeden wynik jest zwracany tylko wtedy, gdy laczna pewnosc przekracza prog `MIN_MATCH_CONFIDENCE`, domyslnie 80%.
- OCR nie jest osobnym zrodlem prawdy. Dziala jako dowod podbijajacy albo obnizajacy pewnosc dopasowania.
- Odpowiedz skanera zawiera dodatkowe pole `agents` z trace: `visual`, `ocr` i `orchestrator`, zeby mozna bylo debugowac, czemu butelka zostala dopasowana albo odrzucona.
- `/auth/health` pokazuje `scan_orchestrator_version: ocr-visual-fusion-catalog-10k-v2`, co pomaga sprawdzic, czy Cloudflare ma aktualnego Workera i indeks 10k.
- `/auth/health` pokazuje tez `scan_catalog_version: ttb-olcc-10k-v1`.

## 2026-07-11 - Katalog rozpoznawania 10k

- Importer `scripts/build_catalog_10000.mjs` laczy dotychczasowa baze, publiczny rejestr etykiet TTB i oficjalny cennik OLCC.
- Importer deduplikuje marki/edycje, odrzuca oczywiste zestawy i miniatury oraz wybiera ceny dla butelek 700/750 ml zamiast miniaturek.
- `scripts/validate_catalog.mjs` blokuje publikacje przy zlej liczbie rekordow, duplikatach ID, brakujacych profilach, uszkodzonym kodowaniu albo cenie ponad limit.
- Home nadal pobiera `db/bourbons.json`, aby nie sciagac na telefon pelnego katalogu. Worker pobiera kompaktowy `db/catalog/scan-index.json`.
- Butelka kontrolna OCR: `BULLEIT BOTTLED IN BOND`, ID `bulleit-bottled-in-bond-111-22`, 100 proof, 50% ABV.

## 2026-07-06 - Auth, email i age gate

- Cloudflare D1 jest podpiete do Workera jako binding `DB`.
- Worker health powinien zwracac aktualne `auth_version`, `pbkdf2_iterations: 100000`, `schema: true`, `reset_schema: true` i `email_ready: true`.
- Resend jest wybrany jako provider email na etap MVP/prototypu.
- Maile transakcyjne maja uzywac subtelnych assetow Bourbon Hunters, bez ciezkiego marketingowego layoutu.
- Entry age gate jest osobnym ekranem przed intro, a data urodzenia zostaje dodatkowo wymagana przy rejestracji konta.
- Po zmianie samego frontu nie deployujemy Workera; Worker deployujemy tylko po zmianach w `agent/worker.js`.

## 2026-07-24 - Rollback OCR w skanerze

- Produkcyjny skaner wraca do jednego agenta wizualnego, zgodnie z zachowaniem sprzed commita `38a8582`.
- Nie cofamy calego Workera do starego commita. Zachowujemy aktualne auth, D1, katalog spolecznosci, moderacje, telemetrie i potwierdzanie wyniku.
- Frontend nie tworzy i nie wysyla osobnego wycinka etykiety.
- Worker wykonuje jedno wywolanie `visual_identification`; pola OCR w historycznym schemacie telemetrii pozostaja i otrzymuja wartosc 0.
- Punkt bezpieczenstwa wersji OCR: `backup-before-visual-only-e1e13a5`.
- Wersja health: `visual-only-catalog-v1-pre-ocr-restored`.

## 2026-07-27 - Kanoniczny produkt zamiast etykiety lub rocznika

- Katalog rozroznia produkt od etykiety, rocznika, private pick i nazwy pojedynczej beczki.
- Rocznik lub batch nie tworzy osobnego produktu, jesli nie zmienia faktycznego wariantu, wieku, proofu, kategorii albo sposobu produkcji.
- Michter's 10 Year z kolejnych lat jest jednym produktem. Knob Creek SDBB i nazwy private picks sa jednym produktem Knob Creek 9 Year Single Barrel Reserve.
- Prawdziwe rozne ekspresje, np. bourbon i rye, 9 i 12 lat albo standard i barrel proof, pozostaja osobnymi produktami.
- Stare ID sa przechowywane jako przekierowania i aliasy, aby zachowac kolekcje, wishlisty, oceny oraz historie userow.
- Zasada obowiazuje jednoczesnie lekka baze aplikacji i pelny katalog skanera.

## 2026-07-27 - Potwierdzenie i asset wyniku skanera

- Jedna propozycja ma pytanie `Czy to ta butelka?`; dwie propozycje zachowuja pytanie mnogie.
- User zawsze potwierdza wynik przed otwarciem szczegolow.
- Potwierdzenie przekazuje wybrane `bottle_id` do Workera. Worker nie zgaduje drugi raz i nie wykonuje drugiego wywolania Gemini.
- Gotowy asset katalogowy ma pierwszenstwo. Jesli go nie ma, Worker tworzy tymczasowy wyciety podglad ze zdjecia skanu przez Cloudflare Images.
- Szczegoly pokazuja ten podglad od razu, ale nie oznacza to automatycznej publikacji we wspolnym katalogu.
- Wspolny asset nadal wymaga zaakceptowanej licencji usera i moderacji admina.
- Gift sety, VAP, twin packi i warianty z dolaczonymi szklankami, podkladkami lub innymi akcesoriami nie sa produktami katalogowymi i sa usuwane z rekordow oraz aliasow.
- Konsolidacja nie jest lista wyjatkow dla wybranych marek. Wspolny klucz produktu obejmuje wszystkie rekordy obu baz.
- Rocznik, batch, numer beczki i private pick sa aliasem produktu; `Edition` i `Series` pozostaja osobnym wariantem, gdy oznaczaja inna ekspresje.
- Z nazwy wyswietlanej usuwamy kategorie powtarzana przez badge, ale zachowujemy `Rye`, `Wheat`, `Corn`, wiek, Bonded, Single Barrel i Cask Strength.
- Historyczna wersja health: `visual-only-catalog-v2-confirmed-cutout`, katalog `ttb-olcc-retail-products-v6`, OCR wylaczony.

## 2026-07-27 - Jakosc katalogu i assetow ponad liczbe rekordow

- Katalog publikowany i indeks skanera zawieraja tylko rekordy `verified`; wpisy `recognition_only` bez ceny i parametrow zostaly usuniete.
- Limit katalogu wynosi 500 USD lub 1500 PLN. Rekord przekraczajacy jeden z limitow nie trafia do lekkiej bazy ani katalogu.
- Aktywny obraz musi byc przezroczystym WebP z `assets/bourbons/clean/` i przedstawiać jedna butelke.
- Nie usuwamy watermarkow ze zdjec zewnetrznych. Obraz z watermarkiem, pudelkiem, zestawem, sama etykieta lub dodatkiem dostaje placeholder do czasu legalnej podmiany.
- Oryginalne pliki pozostaja nietkniete, a decyzje pipeline sa zapisane w raporcie i pliku overrides.
- Aktualna wersja health: `visual-only-catalog-v3-quality-assets`, katalog `ttb-olcc-quality-catalog-v9-canonical-products`, OCR wylaczony.
- `spirit-taxonomy-v2` jest jedynym zrodlem klasyfikacji dla Home, filtrow list, Kolekcji, Polecanych i szczegolow.
- Silna deklaracja produktu (`Rye`, `Wheat Whiskey`, `Malt`, `Tennessee`, kraj pochodzenia lub smak) ma pierwszenstwo przed historycznym polem `type`.
- Licznik kategorii na Home musi byc rowny liczbie rekordow zwracanych przez ten sam filtr po otwarciu kategorii; kontroluje to `scripts/ui-taxonomy-smoke.mjs`.

## 2026-07-27 - Feed newsow i retencja

- Home oraz `Profil -> Artykuly` korzystaja z jednego publicznego feedu `GET /news`.
- Agent moze publikowac tylko artykuly z allowlisty: Whisky Advocate, Whisky Magazine, The Whiskey Wash i Breaking Bourbon. Konkurencyjne aplikacje, w tym Distiller, sa wykluczone.
- W D1 zapisujemy metadane, krotkie streszczenia PL/EN i zewnetrzny URL miniatury. Nie kopiujemy pelnej tresci ani pliku obrazu wydawcy.
- Pierwszy pusty feed jest jednorazowo uzupelniany 6 zweryfikowanymi artykulami. Marker `starter-news-v1` zapobiega ponownemu seedowaniu po ich wygasnieciu.
- Jeden dzienny Cron wykonuje cleanup codziennie, a pobieranie maksymalnie 3 nowych artykulow tylko w poniedzialek i czwartek.
- Artykuly sa usuwane 30 dni po `created_at`. Canonical URL jest unikalny, wiec ten sam artykul nie wraca jako duplikat.
- Operacyjny opis, endpointy i diagnostyka znajduja sie w `pliki-md/NEWS.md`.

## 2026-08-05 - Etap 2 audytu: kontekstowe renderowanie i prywatny health

- Dynamiczny tekst i atrybuty korzystaja z jednego kodowania obejmujacego `&`, `<`, `>`, cudzyslow i apostrof.
- URL nie jest zwyklym tekstem: linki dopuszczaja tylko HTTP(S), obrazy maja oddzielna allowliste, a OAuth moze przekierowac tylko do originu Workera.
- CSP w wersji statycznej GitHub Pages blokuje `script-src-attr`, `object-src`, `frame-src` i obce formularze. Docelowa ekstrakcja inline JS pozostaje osobnym zadaniem architektonicznym.
- `/auth/health` jest minimalny. Pelna diagnostyka `/admin/health` wymaga aktywnej sesji i roli D1 `admin`.
- Surowe wyjatki nie sa czescia publicznego kontraktu API; klient dostaje bezpieczny kod i `request_id`.
- Test `security-xss-regression.mjs` jest obowiazkowa lokalna regresja tej granicy.

## 2026-08-06 - Etap 3 audytu: atomowe budzety kosztow skanera

- KV nie jest licznikiem kosztownych operacji. Migracja v70 dodaje `scanner_budget_events`, a dopuszczenie kosztu odbywa sie jednym warunkowym INSERT-em D1.
- Budzety `identify`, `cutout` i `analysis` sa rozdzielone. Wycinanie ma wspolny budzet niezaleznie od tego, czy uruchomil je skan, potwierdzenie, lokalne zdjecie czy dodanie assetu do katalogu.
- Limit aktora jest laczony z wyzszym limitem hasha IP. Rotacja `device_id` nie resetuje limitu IP.
- Domysl zwyklego usera/goscia: 5 rozpoznan, 10 wyciec i 3 analizy na UTC day. Rola D1 `admin` ma nielimitowany dostep.
- `DEV_KEY` nie daje juz uprawnien ani obejscia limitu.
- Zdarzenia zawieraja tylko hashe aktora i IP, a dzienny Cron usuwa dane starsze niz 8 dni.
- Test: `scripts/scanner-budget-regression.mjs`.

## 2026-08-06 - Etap 4 audytu i odporny agent newsow

- Auth ma atomowy limit D1 per konto lub token i IP, limit 16 KB dla JSON oraz hasla 8-128 znakow.
- Nowe hasla uzywaja PBKDF2-SHA256 600 000 iteracji. Starszy hash jest podnoszony po poprawnym logowaniu bez resetowania hasla uzytkownika.
- Migracja `v71` musi zostac wykonana przed wdrozeniem Workera.
- Agent newsow odkrywa linki bezposrednio na stronach redakcji. Gemini sluzy tylko do selekcji i streszczenia, a blad lub limit AI nie blokuje publikacji.
- Dozwolone zrodla to Whisky Advocate, Whisky Magazine, The Whiskey Wash i Breaking Bourbon. Konkurencyjne aplikacje, w tym Distiller, sa blokowane.
