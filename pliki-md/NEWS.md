# Bourbon Hunters - newsy i agent artykulow

Ten dokument opisuje aktualny feed artykulow widoczny na Home oraz w `Profil -> Artykuly`.

## Jak to dziala

1. Front pobiera publiczny endpoint `GET /news`.
2. Jezeli tabela jest pusta i seed nie byl jeszcze wykonany, Worker zapisuje 6 zweryfikowanych artykulow startowych.
3. Jeden dzienny Cron uruchamia czyszczenie danych.
4. W poniedzialek i czwartek ten sam Cron uruchamia agenta newsow.
5. Agent znajduje do 3 nowych artykulow i zapisuje tylko poprawne, unikalne pozycje.
6. Artykul znika 30 dni po `created_at`, czyli 30 dni po pojawieniu sie w aplikacji.

Nie tworzymy drugiego Cron Triggera. Warunek dnia tygodnia znajduje sie w `scheduled()` Workera.

## Zrodla

Dozwolona lista:

- Whisky Advocate
- Whisky Magazine
- The Whiskey Wash
- Distiller

Agent uzywa Gemini z Google Search, a Worker ponownie sprawdza host, canonical URL, tytul, date i dostepna miniaturke na stronie zrodlowej. Wpis bez prawdziwego URL artykulu nie jest publikowany.

## Dane przechowywane w D1

Migracja: `agent/d1-migration-v68-whisky-news.sql`.

Tabela `news_articles` przechowuje:

- canonical URL i source URL;
- nazwe zrodla;
- tytul;
- krotkie streszczenie PL i EN;
- zewnetrzny URL miniatury;
- date publikacji zrodla;
- `created_at` i `updated_at`;
- status publikacji.

Tabela `news_agent_runs` przechowuje historie uruchomien, liczbe kandydatow, liczbe dodanych artykulow i ewentualny blad.

Pelna tresc artykulu oraz plik miniatury nie sa kopiowane do D1 ani R2. Aplikacja prowadzi czytelnika do oryginalnego wydawcy.

## Seed startowy

Stala `STARTER_NEWS` w `agent/worker.js` zawiera 6 prawdziwych artykulow startowych. Seed:

- uruchamia sie przy pierwszym `GET /news`, jezeli feed jest pusty;
- wykonuje pobranie metadanych rownolegle;
- ma statyczne tytuly i streszczenia awaryjne, gdy wydawca chwilowo nie odpowiada;
- zapisuje marker `starter-news-v1` w `news_agent_runs`;
- nie odtwarza wygaslych wpisow po 30 dniach.

## Harmonogram i retencja

Zalecany Cron:

```text
0 3 * * *
```

To codziennie o 03:00 UTC. Worker:

- codziennie uruchamia `cleanupNews()`;
- w poniedzialek i czwartek uruchamia `refreshWhiskyNews()`;
- usuwa artykuly starsze niz 30 dni;
- zachowuje marker seeda;
- usuwa stare techniczne logi uruchomien po 180 dniach.

## Endpointy

### Publiczny feed

```http
GET /news
```

Odpowiedz zawiera `articles`, `news_ready` i `agent_version`.

### Reczne odswiezenie

```http
POST /admin/news/refresh
Authorization: Bearer <session-token>
```

Endpoint wymaga konta administratora. W aplikacji odpowiada mu przycisk `Pobierz 3 najnowsze artykuly` w `Profil -> Raporty`.

## Wdrozenie

1. W D1 uruchom `agent/d1-migration-v68-whisky-news.sql`, jezeli nie byla jeszcze wykonana.
2. Upewnij sie, ze Worker ma `DB` i `GEMINI_API_KEY`.
3. Zdeployuj aktualny `agent/worker.js`.
4. Pozostaw jeden dzienny Cron Trigger.
5. Otworz `/auth/health`.
6. Sprawdz:

```text
news_schema: true
news_agent_ready: true
news_agent_version: whisky-news-google-grounded-v1
news_retention_days: 30
starter_news_count: 6
```

7. Otworz aplikacje. Pierwsze `GET /news` powinno uzupelnic pusty feed.

## Testy

```powershell
node scripts/news-agent-regression.mjs
node scripts/ui-news-scroll-smoke.mjs
```

Pierwszy test sprawdza allowliste, canonical URL, 6 wpisow startowych i 30-dniowa retencje. Drugi sprawdza Home, ekran artykulow i przewijanie rozpoczete bezposrednio na karcie.

## Diagnostyka

### Sekcja istnieje, ale jest pusta

- Sprawdz `news_schema` w `/auth/health`.
- Sprawdz, czy migracja v68 zostala wykonana na tej samej bazie D1, ktora jest podpieta jako `DB`.
- Otworz `GET /news` bezposrednio.
- Sprawdz logi Workera i ostatni rekord `news_agent_runs`.

### Agent nie dodaje nowych wpisow

- Sprawdz `news_agent_ready`.
- Upewnij sie, ze `GEMINI_API_KEY` jest sekretem Workera `bourbon-hunters`.
- Ten sam canonical URL nie zostanie dodany drugi raz.
- Brak nowych artykulow w pojedynczym przebiegu jest poprawnym wynikiem.

### Telefon pokazuje stary feed lub pusty ekran

- Otworz `test-index.html`.
- Uzyj `Wyczysc cache/PWA`, a potem `Odswiez build`.
- Sprawdz, czy aktywny Service Worker ma cache `bourbon-hunters-v101`.

## Zasady dalszego rozwoju

- Nie publikujemy linku spoza allowlisty bez osobnej decyzji.
- Nie zapisujemy pelnej tresci cudzego artykulu.
- Nie generujemy fikcyjnego newsa ani fikcyjnego URL.
- Zmiana retencji wymaga aktualizacji `NEWS_RETENTION_DAYS`, health, tego dokumentu i testu regresji.
- Zmiana harmonogramu wymaga aktualizacji Workera oraz dokumentacji Cron, ale nie wymaga nowej tabeli D1.
