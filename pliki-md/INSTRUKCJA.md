# 🛠️ Bourbon Hunters — instrukcja uruchomienia (krok po kroku)

## Aktualna zasada deployu - 2026-07-06

Jesli zmieniasz tylko frontend, assety, dokumentacje albo `sw.js`:

1. Uruchom `WYSLIJ-NA-GITHUB.bat`.
2. Poczekaj, az GitHub Pages przejdzie na zielono.
3. W launcherze `test-index.html` kliknij `Odswiez build`.
4. Jesli telefon trzyma stara wersje, kliknij `Wyczysc cache/PWA`.
5. Nie deployuj Workera.

Jesli zmieniasz `agent/worker.js`:

1. Wyslij zmiany repo na GitHub, jesli dotycza tez frontu/docs/bazy.
2. W Cloudflare wklej i zdeployuj aktualny `agent/worker.js`.
3. Sprawdz `https://bourbon-hunters.darekmaslyk.workers.dev/auth/health`.
4. Dopiero potem testuj konta, reset hasla, sync i skaner.

Katalog 10k wymaga, aby repo bylo na GitHubie przed deployem Workera. Jesli w Cloudflare istnieje zmienna `DB_URL`, usun ja albo ustaw na:
`https://raw.githubusercontent.com/backloghero-lang/bourbon-hunters/main/db/catalog/scan-index.json`.
Pozostawiona stara wartosc `DB_URL` nadpisze nowy domyslny adres z kodu Workera.

Aktualny oczekiwany stan Workera:

```json
{
  "ok": true,
  "auth_version": "auth-pbkdf2-100000-google-v3",
  "scan_orchestrator_version": "visual-only-catalog-v3-quality-assets",
  "scan_mode": "visual_only",
  "scan_ocr_enabled": false,
  "scan_catalog_version": "ttb-olcc-quality-catalog-v9-canonical-products",
  "catalog_submission_version": "community-catalog-images-v6-highres-cutout",
  "catalog_moderation_version": "catalog-moderation-orchestrator-admin-v1",
  "catalog_license_version": "catalog-license-2026-07-18-v1",
  "news_agent_version": "whisky-news-google-grounded-v1",
  "local_image_pipeline_version": "local-bottle-cutout-v2-quality-gated",
  "news_retention_days": 30,
  "starter_news_count": 6,
  "pbkdf2_iterations": 100000,
  "d1": true,
  "schema": true,
  "reset_schema": true,
  "profile_schema": true,
  "recommendations_schema": true,
  "identity_schema": true,
  "catalog_schema": true,
  "catalog_data_schema": true,
  "catalog_moderation_schema": true,
  "telemetry_schema": true,
  "news_schema": true,
  "news_agent_ready": true,
  "local_image_cutout_ready": true,
  "cutout_quality_ready": true,
  "image_pipeline_ready": true,
  "email_ready": true,
  "google_ready": true
}
```

Google login wymaga w Cloudflare Worker:

1. Uruchom migracje `agent/d1-migration-v63-google-auth.sql` w D1.
2. W Google Cloud Console utworz OAuth Client typu Web.
3. Authorized redirect URI ustaw na:
   `https://bourbon-hunters.darekmaslyk.workers.dev/auth/google/callback`
4. W Workerze dodaj sekrety:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - opcjonalnie `GOOGLE_STATE_SECRET`
5. Opcjonalnie dodaj zmienna `GOOGLE_REDIRECT_URI`, jesli redirect URI ma byc inne niz domyslny callback Workera.
6. Deploy `agent/worker.js`, potem sprawdz `/auth/health`.

Cykl zycia zdjec katalogowych wymaga:

1. W D1 uruchom `agent/d1-migration-v65-catalog-data-lifecycle.sql`.
2. W D1 uruchom `agent/d1-migration-v66-telemetry-reports.sql`.
3. W D1 uruchom `agent/d1-migration-v67-catalog-moderation.sql`.
4. W D1 uruchom `agent/d1-migration-v68-whisky-news.sql`.
5. Dopiero potem wklej i zdeployuj aktualny `agent/worker.js`.
6. W Workerze pozostaw jeden dzienny Cron Trigger, np. `0 3 * * *`. Czyszczenie dziala codziennie, a newsy tylko w poniedzialek i czwartek.
7. Wyslij frontend na GitHub i odswiez PWA do cache `bourbon-hunters-v102`.
8. Sprawdz pelny health: `https://bourbon-hunters.darekmaslyk.workers.dev/auth/health`.

Kolejnosc jest wazna: migracje D1 -> Worker -> GitHub/PWA. Bez v67 user nie moze zatwierdzic assetu, a bez v68 feed newsow pozostanie pusty.

Ponizsze starsze sekcje zostaja jako pomoc historyczna, ale w razie sprzecznosci obowiazuje aktualna zasada powyzej.

> ### ⚡ Wersja 2 (baza + 2 tryby) — kolejnosc ma znaczenie
> 1. **Wgraj nowy `agent/worker.js`** do Cloudflare (Edit code → wklej → Deploy).
> 2. **Wypchnij repo na GitHub** (`WYSLIJ-NA-GITHUB.bat`) — frontend czyta `db/bourbons.json`, a Worker indeks `db/catalog/scan-index.json` i `agent/prompt.txt` prosto z repo, wiec do dzialania nowej bazy repo musi byc opublikowane.
> 3. **Dodaj KV** (namespace + binding `DS_KV`) — wlacza zapis "nowosci" i dzienny limit (sekcja 2c nizej).
> 4. Testuj na adresie GitHub Pages (https) — wtedy dziala tez aparat w telefonie.
>
> Bez repo na GitHubie Worker nie widzi bazy i kazda butelka idzie "z sieci" (apka i tak dziala).



Spokojnie, prowadzę Cię za rękę. Cała zabawa to 4 etapy: **klucz → Worker → wklejenie adresu → GitHub Pages**.

---

## ETAP 1 — Darmowy klucz Gemini (5 min)

1. Wejdź na **https://aistudio.google.com** i zaloguj się kontem Google.
2. Kliknij **Get API key** (z lewej) → **Create API key**.
3. Skopiuj klucz (zaczyna się od `AIza...`). **Nigdzie go nie wklejaj na czacie ani do repo** — za chwilę trafi tylko do Cloudflare.

> Limit darmowy: ~15 zapytań/min, ~1500/dzień. W zupełności wystarczy do pokazania na LinkedIn.

---

## ETAP 2 — Backend na Cloudflare Worker (10 min)

### 2a. Stwórz Workera
1. Wejdź na **https://dash.cloudflare.com** i załóż darmowe konto (albo zaloguj się).
2. Z lewej menu: **Workers & Pages** → **Create** → **Create Worker**.
3. Nazwij go np. `bourbon-hunters` → **Deploy** (na razie z domyślnym kodem „Hello World").
4. Kliknij **Edit code**. Skasuj całą zawartość edytora i **wklej w całości** plik `agent/worker.js` z tego projektu.
5. Kliknij **Deploy** (prawy górny róg).

### 2b. Dodaj klucz jako sekret
1. Wróć do strony Workera → zakładka **Settings** → **Variables and Secrets**.
2. **Add** → typ **Secret** → nazwa: `GEMINI_API_KEY`, wartość: Twój klucz `AIza...` → **Save and deploy**.
3. (Opcjonalnie, Twoje obejście limitu) Dodaj drugi sekret `DEV_KEY` z dowolnym hasłem, np. `dariusz123`.

### 2c. (Opcjonalnie) Limit zapytań na osobę
Żeby ktoś nie „przepalił" Twojego darmowego limitu Gemini:
1. **Workers & Pages** → po lewej **KV** → **Create namespace**, nazwa np. `BOURBON_KV`.
2. Wróć do Workera → **Settings** → **Bindings** → **Add** → **KV namespace**:
   - Variable name (dokładnie): `DS_KV`
   - KV namespace: `BOURBON_KV` → **Deploy**.

Domyślnie: 20 skanów/dzień na adres IP. Zmienisz zmienną `DAILY_LIMIT`.

### 2d. Skopiuj adres Workera
Na stronie Workera zobaczysz adres typu **`https://bourbon-hunters.twojnick.workers.dev`** — skopiuj go.

---

## ETAP 3 — Połącz front z backendem (1 min)

1. Otwórz plik **`index.html`** w Notatniku (albo VS Code).
2. Na górze sekcji `<script>` znajdź:
   ```js
   const WORKER_URL = "";
   ```
3. Wklej między cudzysłowy adres Workera:
   ```js
   const WORKER_URL = "https://bourbon-hunters.twojnick.workers.dev";
   ```
4. Zapisz plik.

> ⚠️ Ważne: w pliku `agent/worker.js` zmienna `ALLOW_ORIGIN` domyślnie wpuszcza wszystkich (`*`).
> Gdy już znasz adres GitHub Pages (Etap 4), warto w Cloudflare dodać zmienną `ALLOW_ORIGIN`
> = `https://backloghero-lang.github.io` — wtedy z Workera korzysta tylko Twoja apka.

---

## ETAP 4 — Hosting na GitHub Pages (5 min)

1. Kliknij dwukrotnie **`WYSLIJ-NA-GITHUB.bat`** (w folderze projektu).
   - Jeśli nie masz Gita: zainstaluj z https://git-scm.com/download/win i uruchom plik ponownie.
   - Przy pierwszym razie przeglądarka poprosi o zalogowanie do GitHub (`backloghero-lang`).
2. Wejdź na **https://github.com/backloghero-lang/bourbon-hunters** → zakładka **Settings** → **Pages**.
3. W **Branch** wybierz `main`, folder `/ (root)` → **Save**.
4. Po ~1 min apka będzie pod: **https://backloghero-lang.github.io/bourbon-hunters/**

---

## ✅ Test

1. Otwórz adres GitHub Pages **na telefonie**.
2. Menu przeglądarki → **„Dodaj do ekranu głównego"** → na pulpicie pojawi się ikona 🥃.
3. Zrób zdjęcie dowolnej butelki whisky → **Oceń butelkę**.
4. Tryb bez limitu (dla Ciebie): otwórz raz adres z `?bhdev=TwojeHaslo` (to samo co `DEV_KEY`), np.
   `https://backloghero-lang.github.io/bourbon-hunters/?bhdev=dariusz123` — zapamięta się w telefonie.

## 🔧 Strojenie (zmienne w Cloudflare, bez ruszania kodu)

| Zmienna | Domyślnie | Co robi |
|---|---|---|
| `MODEL` | `gemini-2.5-flash` | model Gemini |
| `TEMPERATURE` | `0.4` | „kreatywność" (niżej = pewniej) |
| `MAX_TOKENS` | `1800` | maks. długość odpowiedzi |
| `DAILY_LIMIT` | `20` | skanów/dzień na IP (wymaga KV) |
| `ALLOW_ORIGIN` | `*` | kto może wołać Worker (wpisz adres Pages) |

Prompt (zachowanie AI) edytujesz w `agent/prompt.txt`, commitujesz — Worker sam podciągnie zmiany.

---
Coś nie działa? Skopiuj komunikat błędu i wróć do nowego wątku Claude. 🙂
## ETAP 5 - Konta i zapis danych w Cloudflare D1

Frontend ma gotowe Register / Sign In i sync danych. Zapis dziala dopiero wtedy, gdy D1 jest utworzone, schema wykonana, binding `DB` podpiety do Workera i aktualny `agent/worker.js` wdrozony.

1. Cloudflare Dashboard -> **Workers & Pages** -> **D1 SQL Database** -> **Create database**.
2. Nazwa bazy: `bourbon-hunters-db`.
3. Otworz baze -> **Console** i wykonaj caly plik `agent/d1-schema.sql`.
4. Wroc do Workera `bourbon-hunters` -> **Settings** -> **Bindings** -> **Add binding** -> **D1 database**:
   - Variable name: `DB`
   - Database: `bourbon-hunters-db`
5. Kliknij **Save and deploy**.
6. W Worker's **Edit code** wklej aktualny `agent/worker.js` i kliknij **Deploy**.

Co zapisuje sie w D1:
- konto: email, username, hash hasla, sesje,
- wishlist,
- moja kolekcja,
- oceny uzytkownika,
- historia skanow z wynikiem rozpoznania.

Hasla nie sa zapisywane jawnie. Worker zapisuje hash PBKDF2 i token sesji jako hash.

## Wdrożenie kategorii Whisky

Ta zmiana dotyczy GitHub Pages. Nie wymaga podmiany Workera, migracji D1 ani zmian w Cloudflare.

1. Uruchom `WYSLIJ-NA-GITHUB.bat`.
2. Poczekaj na zielony wynik GitHub Actions.
3. Na telefonie otwórz `test-index.html`.
4. Kliknij `Odśwież build`; jeśli stary układ nadal jest widoczny, użyj `Wyczyść cache/PWA`.
5. Sprawdź na Home kafel Whisky z liczbą pozycji.
6. Wejdź w Whisky i sprawdź filtry Scotch, Irish, Japanese, Rye i pozostałe.

Aktualny cache: `bourbon-hunters-v102`.

## Wdrozenie newsow, poprawionych gestow i lokalnego wycinania zdjec

Ta paczka wymaga migracji D1, Workera i GitHub Pages.

1. Otworz Cloudflare -> D1 -> `bourbon-hunters-db` -> Console.
2. Wklej i uruchom caly plik `agent/d1-migration-v68-whisky-news.sql`.
3. W Workerze `bourbon-hunters` zastap kod aktualnym `agent/worker.js` i kliknij `Deploy`.
4. Nie tworz drugiego Cron Triggera. Istniejacy dzienny Cron wystarczy; Worker sam sprawdza poniedzialek i czwartek.
5. Otworz `https://bourbon-hunters.darekmaslyk.workers.dev/auth/health`.
6. Sprawdz `news_schema: true`, `news_agent_ready: true`, `local_image_cutout_ready: true` oraz `news_agent_version: whisky-news-google-grounded-v1`.
7. Uruchom `WYSLIJ-NA-GITHUB.bat` i poczekaj na zielone GitHub Actions.
8. Na telefonie otworz `test-index.html`, kliknij `Wyczysc cache/PWA`, a potem `Odswiez build`.
9. Aby nie czekac do dnia publikacji, wejdz jako admin w `Profil -> Raporty` i kliknij `Pobierz 3 najnowsze artykuly`.
10. Sprawdz trzy rzeczy: pionowy scroll rozpoczęty na karcie Home, trzy newsy na Home oraz podglad wycietej butelki przed zapisaniem lokalnego zdjecia.

Endpoint `/news` jest publiczny. Agent zapisuje w D1 tylko metadane, krotkie streszczenia i zewnetrzny URL miniatury; nie kopiuje tresci artykulu ani obrazu do R2.
Przy pustej tabeli pierwszy odczyt `/news` zapisuje jednorazowo 6 wpisow startowych. Dzienny Cron usuwa artykuly po 30 dniach od `created_at`. Ponowne uruchamianie migracji v68 nie jest potrzebne.

## Wdrozenie skanera visual-only i skonsolidowanego katalogu

Ta zmiana wymaga aktualizacji GitHub Pages i Workera. Nie wymaga migracji D1 ani recznego czyszczenia danych userow.

1. Uruchom `WYSLIJ-NA-GITHUB.bat` i poczekaj na zielone GitHub Actions.
   Git musi byc pierwszy, bo Worker pobiera z repo aktualny `db/catalog/scan-index.json`.
2. W Cloudflare otworz Worker `bourbon-hunters` -> `Edit code`.
3. Zastap caly kod zawartoscia pliku `agent/worker.js`.
4. Kliknij `Deploy`.
5. Otworz `https://bourbon-hunters.darekmaslyk.workers.dev/auth/health`.
6. Sprawdz, czy `scan_orchestrator_version` ma wartosc:
   `visual-only-catalog-v3-quality-assets`.
   `scan_catalog_version` ma byc `ttb-olcc-quality-catalog-v9-canonical-products`.
   `catalog_submission_version` ma byc `community-catalog-images-v6-highres-cutout`.
   Dodatkowo `scan_mode` ma byc `visual_only`, a `scan_ocr_enabled` ma byc `false`.
7. Na telefonie otworz `test-index.html`, kliknij `Wyczysc cache/PWA`, a potem `Odswiez build`.
8. Zeskanuj `Jack Daniel's Bonded`, `Knob Creek 9` i jeden wariant `Single Barrel`.
9. Nie dodawaj zmiennej `OCR_MODEL`; skaner jej nie uzywa.
10. Sprawdz pojedynczy wynik bez assetu: ekran ma pytac `Czy to ta butelka?`, a po potwierdzeniu szczegoly maja pokazac wycieta butelke.

Potwierdzenie kandydata nie uruchamia drugiego skanu Gemini i nie pobiera drugiej sztuki z dziennego limitu. Dla rekordu bez gotowego assetu zuzywa jedna transformacje Cloudflare Images, aby przygotowac tymczasowy podglad. Publikacja tego podgladu we wspolnej bazie nadal przechodzi przez zgode usera i moderacje.

Stare identyfikatory z kolekcji, wishlist i ocen sa automatycznie przenoszone na produkty kanoniczne. Nie wykonuj recznych aktualizacji D1.
