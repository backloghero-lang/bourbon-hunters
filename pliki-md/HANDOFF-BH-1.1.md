# Bourbon Hunters 1.1 - handoff do kolejnego etapu

Aktualizacja: 2026-07-27.

Ten plik ma byc pierwszym kontekstem dla nowego watku Codexa, np. `Przekaz Bourbon Hunter 1.1`.

## Stan nadrzedny 2026-07-27

- Aktualny skaner to przywrocony tryb visual-only: `visual-only-catalog-v3-quality-assets`; OCR jest wylaczony.
- Aktualny katalog skanera: `ttb-olcc-quality-catalog-v9-canonical-products`; aktualny pipeline assetow: `community-catalog-images-v6-highres-cutout`.
- Cache PWA: `bourbon-hunters-v102`.
- Przed aktualnym deployem Workera trzeba uruchomic `agent/d1-migration-v68-whisky-news.sql`.
- Health ma pokazac `news_schema: true`, `news_agent_ready: true`, `local_image_cutout_ready: true` i `news_agent_version: whisky-news-google-grounded-v1`.
- Publiczne newsy sa widoczne na Home oraz w `Profil -> Artykuly`. Jeden dzienny Cron uruchamia agenta tylko w poniedzialki i czwartki.
- Pierwszy odczyt pustego feedu dodaje jednorazowo 6 artykulow startowych. Kazdy wpis znika po 30 dniach od pojawienia sie w aplikacji.
- Lokalna fotografia produktu bez assetu jest najpierw wycinana przez Cloudflare Images i wymaga potwierdzenia. Surowy plik nie jest przechowywany w chmurze.
- Aktualny lokalny pipeline to `local-bottle-cutout-v2-quality-gated`: WebP 960x1280, centrowanie i bramka jakosci odrzucajaca dlonie, uciecia oraz dziury segmentacji.
- Butelki sa powiekszone tylko w szczegolach; miniatury list pozostaja bez zmian.
- Linki newsow otwieraja przegladarke zewnetrzna, a PWA odtwarza widok po ewentualnym przeladowaniu przez Androida.
- Aktualne szczegoly zawsze sa w `pliki-md/HANDOFF.md`; ponizszy blok z 2026-07-23 jest historia architektury sprzed rollbacku OCR.

## Historyczny stan 2026-07-23

- Punkt powrotu przed przebudowa skanera: `backup-before-scanner-v10-6f3605e`.
- Aktualny skaner: `ocr-visual-fusion-catalog-10k-v10-calibrated-moderated`.
- Aktualny katalog obrazow: `community-catalog-images-v5-admin-moderation`.
- Przed deployem Workera trzeba uruchomic `agent/d1-migration-v67-catalog-moderation.sql`.
- Health ma pokazac `catalog_moderation_schema: true` i `catalog_moderation_version: catalog-moderation-orchestrator-admin-v1`.
- User nie publikuje bezposrednio do wspolnego katalogu. Orkiestrator ocenia szkic, admin akceptuje go w `Profil -> Raporty`, a opublikowany wpis jest zablokowany przed nadpisaniem przez userow.
- Agent wizualny dostaje pelne zdjecie, OCR wycinek etykiety, a porownanie z obrazami referencyjnymi uruchamia sie tylko przy bliskich wynikach.
- Test regresji: `scripts/scanner-regression.mjs`; test mobilnego UI: `scripts/ui-smoke.mjs`.
- Cache PWA: `bourbon-hunters-v92`.

Starsze informacje ponizej sa historia sesji. W razie sprzecznosci obowiazuje ten blok i `pliki-md/HANDOFF.md`.

## Jak zaczac nowy watek w Codex

1. Kliknij `Nowy czat`.
2. Zostan w projekcie `Piaskownica Claude`.
3. Pierwszy komunikat wklej mniej wiecej tak:

```text
To jest etap Przekaz Bourbon Hunter 1.1.
Pracujemy w repo:
C:\Program Files (x86)\Sandbox\Piaskownica Claude\bourbon-hunters

Najpierw przeczytaj:
pliki-md/HANDOFF-BH-1.1.md
pliki-md/PROJECT.md
pliki-md/DECISIONS.md
pliki-md/ROADMAP.md
pliki-md/BUGS.md
```

4. Nazwe watku mozesz zmienic z menu `...` przy tytule na gorze.

## Repo i glowne URL-e

- Repo lokalne: `C:\Program Files (x86)\Sandbox\Piaskownica Claude\bourbon-hunters`
- Produkcja GitHub Pages: `https://backloghero-lang.github.io/bourbon-hunters/`
- Launcher testowy: `https://backloghero-lang.github.io/bourbon-hunters/test-index.html`
- Worker Cloudflare: `https://bourbon-hunters.darekmaslyk.workers.dev`
- Health check Workera: `https://bourbon-hunters.darekmaslyk.workers.dev/auth/health`

## Aktualny stan po sesji

- GitHub ma ostatni commit `b178510`; lokalny branch jest jeden commit do przodu.
- Lokalny, jeszcze niewypchniety commit: `23b69fb Split scanner models and report quota limits`.
- Front/PWA po wypchnieciu bedzie na cache `bourbon-hunters-v85`.
- Worker auth zwraca `auth-pbkdf2-100000-google-v3` i `pbkdf2_iterations: 100000`.
- Lokalny Worker oczekujacy na deploy ma scanner `ocr-visual-fusion-catalog-10k-v4-split-models`.
- D1 jest podpiete jako binding `DB`.
- Tabela resetu hasla `password_reset_tokens` jest obecna.
- `email_ready` w `/auth/health` jest `true`, czyli Resend/MAIL_FROM sa skonfigurowane.
- Rejestracja email/password dziala po stronie Workera i zapisuje konto w Cloudflare D1.
- Google Sign-In jest podpiety do Workera i D1.
- Katalog zbudowany ze zrodla 10k ma po deduplikacji i filtrze dostepnosci 9406 rekordow TTB/OLCC i lokalnych.
- Filtr `retail-relevance-2026-v1` usuwa historyczne roczniki, jednorazowe caski/private picks, niepotwierdzone edycje limitowane, ultra-alokowane serie i pozycje mogace przekroczyc 1000 USD.
- R2 `BOTTLE_IMAGES` i Images `IMAGES` sa podpiete; pipeline zdjec jest gotowy.
- Zgloszenie nowej butelki moze zapisac dane oraz zaakceptowany wycinek zdjecia usera.
- Age gate pokazuje sie przed intro i uzywa assetu `assets/brand/age-gate.png`.
- Maile transakcyjne uzywaja logo/headera aplikacji i subtelnej stopki premium.

## Ostatnie poprawki UI

- Na Home karty `Featured`, `Recently added` i `My collection` nie pokazuja juz pomaranczowej destylarni pod nazwa.
- Karty Home pokazuja: nazwa, cena, badge kategorii i przycisk `View/Zobacz`.
- Badge i przycisk na kartach Home maja zblizona szerokosc.
- Nazwy na kartach Home sa twardo ograniczone do trzech linii w kazdej z trzech sekcji.
- Link sklepu w szczegolach butelki zostaje.
- Usunieto dodatkowy przycisk/toast `To moze byc Twoj sklep`.
- Hitbox przyciskow age gate zostal przesuniety pod realne przyciski z assetu.
- `General info` w szczegolach ma roznicowany, krotki opis zamiast powtarzalnego szablonu z destylarnia i proof.

## Zasady deployu

Jesli zmieniasz tylko frontend, `index.html`, assety albo `sw.js`:

1. `WYSLIJ-NA-GITHUB.bat`
2. Poczekaj, az GitHub Pages przejdzie na zielono.
3. W launcherze kliknij `Odswiez build`.
4. Jesli telefon trzyma stara wersje, kliknij `Wyczysc cache/PWA`.
5. Nie deployuj Workera.

Jesli zmieniasz `agent/worker.js`:

1. Najpierw wyslij front/docs na GitHub, jesli byly zmiany.
2. Potem deployuj aktualny `agent/worker.js` w Cloudflare.
3. Sprawdz `/auth/health`.
4. Dopiero potem testuj rejestracje/logowanie/skaner.

## Backend i D1

Glowne pliki:

- `agent/worker.js`
- `agent/d1-schema.sql`
- `agent/d1-migration-v57-auth-age.sql`
- `agent/d1-migration-v60-password-reset.sql`

Wazne endpointy:

- `/auth/health`
- `/auth/register`
- `/auth/login`
- `/auth/logout`
- `/auth/password-reset`
- `/auth/password-update`
- `/me/bootstrap`
- `/me/wishlist`
- `/me/collection`
- `/me/rating`
- `/me/scan`

Aktualne decyzje:

- Hasla: PBKDF2 SHA-256, 100000 iteracji.
- D1 trzyma konta, sesje, wishlist, kolekcje, oceny i historie skanow.
- Zdjecia userow docelowo ida do R2, nie do D1.
- Aplikacja zostaje local-first, ale po zalogowaniu synchronizuje stan do D1.

## Scanner / Hunter

- Podstawowy skaner nie moze zgadywac.
- Wynik z bazy pokazujemy tylko przy pewnosci minimum 80%.
- Visual agent, OCR agent i orchestrator porownuja etykiete z indeksem 10k.
- Dopasowanie wymaga kotwicy marki; sama kategoria typu `American Single Malt` nie moze stworzyc trafienia.
- UI rozroznia niski wynik bazy, niepotwierdzona marke i dwa podobne warianty.
- Jefferson's Straight Bourbon Whiskey jest testem regresji i ma poprawne dopasowanie 100%.
- Wycinane butelki userow sa powiekszone i centrowane; nowe wycinki maja trim pustych marginesow.
- Visual agent zostaje na Gemini 2.5 Flash, a OCR przechodzi na Gemini 2.5 Flash-Lite, zeby rozdzielic obciazenie.
- Darmowy limit Gemini jest wspolny dla projektu. Docelowe limity per user opisuje `MONETYZACJA-I-LIMITY.md`.

## Ostatnio wykonana praca

1. Dodano flow: skan -> brak rekordu -> uzupelnienie -> wyciecie butelki -> akceptacja -> R2/D1 -> Ostatnio dodane.
2. Usunieto halucynacje kategorii jako nazw butelek i zaostrzono dopasowanie marki/wariantu.
3. Powiekszono i wycentrowano obrazy butelek przygotowane przez agenta.
4. Poprawiono mylacy ekran `95% / prog 80%`: osobno pokazuje odczyt etykiety i wynik bazy.
5. Zdiagnozowano `429 quota exceeded`: darmowy Flash mial 20 wywolan dziennie dla calego projektu.
6. Przygotowano commit `23b69fb`, ktory rozdziela visual i OCR na dwa modele oraz pokazuje prawdziwy komunikat o limicie.

## Najblizszy krok

1. Uzyc `WYSLIJ-NA-GITHUB.bat`; nowe zmiany dokumentacji sa niezatwierdzone, wiec skrypt powinien zobaczyc paczke i wypchnac tez commit `23b69fb`.
2. Poczekac na zielony GitHub Action dla nowego commita.
3. Wkleic aktualny `agent/worker.js` do Cloudflare i kliknac Deploy.
4. Sprawdzic `/auth/health`: oczekiwana wersja `ocr-visual-fusion-catalog-10k-v4-split-models`.
5. Odswiezyc PWA/cache `v85` i ponownie zeskanowac Jefferson's.
6. Migracji D1 dla tej paczki nie ma.

## Co robic w etapie BH 1.1

Priorytet 1: TWA / pelniejsza aplikacja

- Przygotowac PWA pod TWA: manifest, ikony, scope, start URL, update flow.
- Dopisac checklist Google Play/TWA w dokumentacji.
- Nie robic jeszcze Capacitor, chyba ze TWA zacznie blokowac funkcje.

Priorytet 2: konta i profil

- Dopracowac stan zalogowany/niezalogowany w sekcji Profil.
- Po zalogowaniu pokazac dane usera i podstawowy panel konta.
- Przygotowac miejsce na Pro, reklamy i ustawienia.
- Google OAuth zostawic jako osobny etap, nie mieszac z email/password.

Priorytet 3: synchronizacja

- Zweryfikowac end-to-end: rejestracja, login, logout, wishlist, kolekcja, oceny, historia skanow.
- Upewnic sie, ze localStorage i D1 nie walcza ze soba.
- Dla zalogowanego usera D1 ma byc docelowym zrodlem prawdy, localStorage cache/offline.

Priorytet 4: skaner

- Dopolerowac UI skanera i statusy.
- Dopracowac rozroznienie: szybki wynik z bazy vs Hunter AI Plus.
- Zaprojektowac storage zdjec usera w R2.

Priorytet 5: dokumentacja i biznes

- Publiczne repo traktowac jako demo/showcase.
- Komercyjna wersja powinna isc do prywatnego repo.
- Przygotowac material demo dla LinkedIn i rozmow z partnerami/sklepami.

## Rzeczy, ktorych nie robic bez decyzji

- Nie publikowac zdjec userow do wspolnej bazy bez zgody i moderacji.
- Nie dodawac Facebook/Instagram loginu; na start tylko email/password, pozniej Google.
- Nie wrzucac sekretow ani kluczy do repo.
- Nie wlaczac telemetrii bez finalnej decyzji o polityce prywatnosci i zgodach.
- Nie robic losowych wynikow skanera ponizej 80% pewnosci.

## Szybki test po starcie nowego watku

1. `git status --short`
2. Sprawdz `sw.js`, czy cache jest co najmniej `bourbon-hunters-v65`.
3. Otworz `/auth/health` i sprawdz:

```json
{
  "ok": true,
  "auth_version": "auth-pbkdf2-100000-v2",
  "pbkdf2_iterations": 100000,
  "d1": true,
  "schema": true,
  "reset_schema": true,
  "email_ready": true
}
```

4. Test konta robic dopiero po odswiezeniu Pages i cache PWA.

## Kategoria Whisky i filtry

- `spirit-taxonomy.js` jest wspólnym źródłem klasyfikacji rodziny i podtypów.
- Bourbon oraz Whisky są rozdzielone przed zastosowaniem filtrów.
- Kafel Whisky na Home otwiera widok z samymi podfiltrami Whisky.
- `db/catalog/browse-whisky.json` generuje `scripts/build_browse_catalog.mjs`.
- Plik jest ładowany leniwie, więc nie spowalnia pierwszego ekranu.
- Po przebudowie katalogu uruchomić generator browse i test taksonomii.
- Frontend wdraża się przez GitHub Pages; Worker i D1 bez zmian.
- Cache PWA: `bourbon-hunters-v93`.
