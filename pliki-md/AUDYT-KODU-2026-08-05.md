# Audyt kodu Bourbon Hunters

**Data:** 5 sierpnia 2026  
**Zakres:** frontend/PWA, Cloudflare Worker, D1, R2, logowanie lokalne i Google, skaner, newsy, telemetria, dokumentacja prawna, testy i proces wdrożenia.

## Ocena zarządcza

Bourbon Hunters jest rozbudowanym i działającym MVP, ale **nie powinien jeszcze zostać publicznie uruchomiony dla nieograniczonej liczby użytkowników**. Powodem jest jedna luka krytyczna w modelu kont administratorów, wysokie ryzyko XSS i przejęcia długiej sesji, możliwe obchodzenie limitów kosztownych operacji skanera oraz braki wymagane przed publikacją aplikacji z treściami użytkowników.

Najważniejszy problem nie dotyczy SQL Injection. Zapytania D1 są w większości poprawnie parametryzowane i podczas audytu nie potwierdzono klasycznego SQL Injection. Najpoważniejsza luka wynika z połączenia nieweryfikowanych adresów e-mail, przypisywania roli administratora na podstawie adresu oraz automatycznego łączenia konta Google z lokalnym kontem o takim samym adresie.

### Ocena obszarów

| Obszar | Ocena | Stan |
|---|---:|---|
| Bezpieczeństwo | 3/10 | Krytyczna poprawka wymagana przed uruchomieniem |
| Prywatność i RODO | 4/10 | Dobre założenia retencji zdjęć, ale brak kompletnej realizacji praw użytkownika |
| Wydajność | 5/10 | Działa przy skali MVP, ryzykowne na słabszych telefonach i przy wzroście ruchu |
| Architektura | 4/10 | Duże monolity i ręczne wdrożenia zwiększają liczbę regresji |
| Testy i CI/CD | 3/10 | Są wartościowe testy domenowe, ale nie są uruchamiane w CI |
| Gotowość Google Play | 3/10 | Brakuje kompletnej moderacji UGC, dokumentów i kontroli wieku przy Google login |

## Status realizacji 5 sierpnia 2026

- Etap 0 zakonczony: zapisano punkt Time Travel D1 oraz tag kodu `audit-backup-2026-08-05-pre-auth-hardening`.
- Etap 1 zakonczony i wdrozony: weryfikacja e-mail, role D1, bezpieczne laczenie Google, reautoryzacja usuwania konta i uniewaznienie sesji administratorow.
- Etap 2 zakonczony i wdrozony: pelne kodowanie atrybutow, allowlista URL i obrazow, CSP, naglowki API, minimalny publiczny health i bezpieczne identyfikatory bledow.
- Etap 3 wdrozony: atomowe budzety D1 obejmuja rozpoznanie, potwierdzenie wymagajace wyciecia, lokalne zdjecie, dodanie assetu do katalogu i analize AI. Admin jest rozpoznawany wylacznie przez role D1.
- Etap 4 zaimplementowany lokalnie: limity auth per konto i IP, limit 16 KB dla JSON, hasla 8-128 znakow, PBKDF2-SHA256 600 000 iteracji i automatyczna migracja starszego skrotu po poprawnym logowaniu. Wymaga migracji D1 v71 przed wdrozeniem Workera.
- `scripts/security-xss-regression.mjs`, testy auth, testy katalogu i skanera oraz 6 testow Playwright przechodza.
- P1-1 jest naprawione. P1-4 zostalo naprawione w czesci dotyczacej health i surowych wyjatkow; optymalizacja publicznych odczytow ocen pozostaje otwarta.
- P1-2 jest naprawione i wdrozone. P1-3 jest naprawione lokalnie i czeka na migracje v71 oraz wdrozenie. Z priorytetow P1 pozostaja: optymalizacja ocen z P1-4 oraz moderacja UGC z P1-5.

## Znaleziska krytyczne

### P0-1. Możliwe przejęcie konta administratora

**Dowód:**

- [`agent/worker.js`](../agent/worker.js#L282) nadaje uprawnienia administratora na podstawie adresu e-mail z konfiguracji.
- [`agent/worker.js`](../agent/worker.js#L1530) pozwala utworzyć lokalne konto dla dowolnego adresu i od razu wystawia sesję, bez potwierdzenia własności skrzynki.
- [`agent/worker.js`](../agent/worker.js#L1063) automatycznie dołącza tożsamość Google do istniejącego lokalnego użytkownika o tym samym adresie.

**Scenariusz:** atakujący rejestruje wcześniej adres skonfigurowanego administratora. Może otrzymać rolę administratora bez kontroli tej skrzynki. Jeżeli prawdziwy właściciel później użyje Google, jego tożsamość może zostać dołączona do konta, do którego atakujący nadal zna hasło.

**Skutek:** przejęcie moderacji katalogu i newsów, dostęp do raportów administracyjnych oraz trwałe pomieszanie tożsamości.

**Naprawa:**

1. Natychmiast wyłączyć rejestrację lokalną do czasu wdrożenia weryfikacji e-mail.
2. Przenieść role do tabeli ról nadawanych wyłącznie operacyjnie, nigdy na podstawie samego e-maila.
3. Nie łączyć automatycznie kont Google i lokalnych po e-mailu. Łączenie musi wymagać aktywnej sesji i ponownego uwierzytelnienia obu metod.
4. Unieważnić sesje administratorów i sprawdzić istniejące rekordy `users`, `user_identities` i `sessions`.
5. Dodać `email_verified_at` i blokować funkcje konta do czasu potwierdzenia linkiem jednorazowym.

## Znaleziska wysokie

### P1-1. DOM XSS i możliwość kradzieży 30-dniowej sesji

[`index.html`](../index.html#L2619) koduje tylko `&`, `<` i `>`, ale ta funkcja jest używana również wewnątrz atrybutów HTML tworzonych przez `innerHTML`. Nie koduje cudzysłowów. Dane z newsów, odpowiedzi AI i adresów obrazów trafiają m.in. do `href`, `src`, `alt`, `aria-label` i `data-*` w [`index.html`](../index.html#L2972), [`index.html`](../index.html#L3537) oraz [`index.html`](../index.html#L4012).

Token sesji jest przechowywany w `localStorage` w [`index.html`](../index.html#L1787). Udany XSS może więc wykraść token ważny około 30 dni, również dla administratora.

**Naprawa:** budować elementy przez `createElement`, `textContent` i `setAttribute`, walidować protokół/host URL, dodać CSP i Trusted Types. Docelowo przenieść sesję do ciasteczka `Secure`, `HttpOnly`, `SameSite` albo użyć krótkiego access tokenu z bezpiecznym odświeżaniem.

### P1-2. Obejście limitów i kosztowy DoS skanera

W [`agent/worker.js`](../agent/worker.js#L2103) żądanie `mode=rate` z `confirmed_id` omija limit podstawowego skanu, ale nadal może uruchomić wycinanie Cloudflare Images i kontrolę Gemini. Identyfikator gościa pochodzi głównie z kontrolowanego przez klienta `device_id`, więc można go rotować.

Limity oparte o KV są realizowane jako odczyt, a następnie zapis. KV nie zapewnia atomowego licznika i ma opóźnioną spójność, dlatego równoległe żądania mogą przekroczyć limit.

**Naprawa:** każda kosztowna operacja musi zużywać osobny budżet serwerowy. Użyć Cloudflare Rate Limiting, Durable Object albo atomowego licznika D1. Dla gościa łączyć limit IP, urządzenia i krótkiego tokenu wyzwania. Administrator powinien być rozpoznawany przez rolę, nie `DEV_KEY`.

### P1-3. Brak ochrony logowania, rejestracji i resetu hasła

**Status 6 sierpnia 2026:** naprawione lokalnie w Etapie 4; do wdrozenia pozostaje migracja D1 v71 i aktualny Worker.

Endpointy w [`agent/worker.js`](../agent/worker.js#L1530) nie mają skutecznego rate limitu, maksymalnego rozmiaru ciała ani ograniczenia długości hasła. Umożliwia to credential stuffing, spam resetem i kosztowy atak CPU na PBKDF2.

PBKDF2-HMAC-SHA256 ma 100 000 iteracji w [`agent/worker.js`](../agent/worker.js#L32). To mniej niż obecna rekomendacja OWASP dla PBKDF2-HMAC-SHA256. Porównanie skrótu hasła nie jest stałoczasowe.

**Naprawa:** limit per IP i per konto, progresywne opóźnienia, neutralne odpowiedzi antyenumeracyjne, limit rozmiaru JSON, długość hasła 8-128 znaków, stałoczasowe porównanie oraz migracja do Argon2id lub co najmniej aktualnego parametru PBKDF2.

### P1-4. Publiczne kosztowne endpointy

- [`agent/worker.js`](../agent/worker.js#L968) wykonuje do 150 sekwencyjnych zapytań D1 dla jednego odczytu ocen.
- [`agent/worker.js`](../agent/worker.js#L1397) publicznie ujawnia szczegóły wersji, schematów i bindingów oraz wykonuje wiele próbnych zapytań D1.
- [`agent/worker.js`](../agent/worker.js#L2042) zwraca klientowi surowy tekst wyjątku.

**Naprawa:** grupowe `IN (...) GROUP BY`, cache i limity; publiczny health ograniczyć do `ok` i wersji wdrożenia; diagnostykę schować za rolą administratora; błędy mapować na bezpieczne identyfikatory korelacyjne.

### P1-5. Brak moderacji treści użytkowników wymaganej przed Google Play

Aplikacja obsługuje komentarze/rekomendacje użytkowników, ale nie ma kompletnego mechanizmu zgłaszania komentarza, blokowania użytkownika, kolejki moderacyjnej treści ani jasno egzekwowanego regulaminu UGC. Moderacja zdjęć katalogowych nie zastępuje moderacji komentarzy.

**Naprawa:** akceptacja zasad UGC przed publikacją, `Zgłoś`, blokowanie autora, moderacja i odwołanie, log decyzji, ograniczenie spamu oraz SLA reakcji. Jest to warunek publikacyjny, nie opcjonalna funkcja UX.

## Znaleziska średnie

### P2-1. `DEV_KEY` w adresie i pamięci przeglądarki

[`index.html`](../index.html#L3945) pobiera `bhdev` z query string i zapisuje go w `localStorage`, a dokumentacja sugeruje przekazywanie sekretu w URL. Sekret może trafić do historii, logów, zrzutów i nagłówka Referer. Usunąć ten mechanizm i zastąpić rolą serwerową.

### P2-2. Zbyt szeroki CORS i brak nagłówków ochronnych

[`agent/worker.js`](../agent/worker.js#L356) domyślnie dopuszcza `*`. Frontend nie ma skutecznej polityki CSP, Trusted Types, `Referrer-Policy` ani `Permissions-Policy`. Ograniczyć CORS do dokładnych produkcyjnych originów i dodać polityki przeglądarkowe.

### P2-3. Google OAuth pozwala na zbyt szeroki powrót

[`agent/worker.js`](../agent/worker.js#L246) dopuszcza całe pochodzenie GitHub Pages oraz localhost. Ograniczyć do dokładnej ścieżki aplikacji i dodać PKCE. Token przekazywany we fragmencie powinien być jak najszybciej wymieniany na sesję cookie.

### P2-4. Ryzyko pamięci na telefonach

Frontend przechowuje lokalne zdjęcia jako base64, podczas startu pobiera wszystkie rekordy z IndexedDB i trzyma je w pamięci. Skan tworzy jednocześnie kilka kopii obrazu: `FileReader`, pełny bitmap, canvas, JPEG rozpoznawczy i JPEG źródłowy w JSON. Base64 zwiększa rozmiar o około jedną trzecią.

**Naprawa:** przechowywać `Blob`, pobierać zdjęcie po ID, generować osobną miniaturę, zwalniać Object URL, zmniejszać obraz natychmiast po odczycie i wysyłać multipart/binary zamiast JSON base64.

### P2-5. Ciężki i kruchy Service Worker

[`sw.js`](../sw.js#L3) pre-cache'uje 58 plików, około 12,3 MB, w tym zasoby testowe. Jedno brakujące źródło może przerwać całe `cache.addAll`. Runtime cache nie ma limitu ani wygaszania.

**Naprawa:** generowany manifest, cache podstawowej powłoki osobno od dużych zasobów, tolerowanie pojedynczych błędów, limit wpisów i wieku, usunięcie plików testowych z produkcji.

### P2-6. N+1 w D1 i powtarzana kontrola schematu

Oceny wykonują zapytanie per butelka. Telemetria wielokrotnie sprawdza istnienie tych samych tabel podczas jednego skanu. Zgrupować zapytania i cache'ować gotowość schematu per wersja Workera.

### P2-7. Ręczne, niespójne wdrożenia

Worker jest kopiowany ręcznie do Cloudflare, a migracje D1 wykonywane przez wklejanie SQL. Front GitHub Pages może działać z inną wersją API. Brakuje `wrangler.toml`, automatycznego wdrożenia, rejestru migracji i testu zgodności kontraktu.

### P2-8. Monolity i brak granic modułów

`index.html` ma około 4 175 linii i łączy UI, CSS, i18n, logowanie, IndexedDB, skaner, newsy, profil i panel admina. `agent/worker.js` ma około 2 290 linii i łączy auth, OAuth, pocztę, D1, R2, AI, newsy, telemetrię i moderację.

Podział powinien przebiegać według domen: `auth`, `catalog`, `scanner`, `images`, `recommendations`, `news`, `telemetry`, `admin`. Najpierw testy kontraktowe, później ekstrakcja, bez przepisywania całej aplikacji naraz.

### P2-9. Brak reprodukowalnego toolchainu i kontroli CI

Repo nie ma `package.json`, lockfile, konfiguracji lintowania ani SAST. GitHub Actions tylko publikuje stronę. Akcje używają wersji tagowanych zamiast pełnych SHA. Dodać testy, lint, skan sekretów, CodeQL, budżet zasobów i pinowanie akcji.

### P2-10. Niespójne operacje D1 i R2

Publikacja/odrzucenie obrazu oraz usuwanie konta wykonują serię niezależnych zmian w D1 i R2. Awaria pośrodku może zostawić osierocony obraz lub rekord. Dodać idempotency key, jawny stan procesu, retry i zadanie kompensacyjne.

## RODO i prywatność

### P1/P2. Braki przed uruchomieniem

1. Polityka prywatności sama określa się jako wersja robocza. Brakuje pełnej tożsamości administratora danych, podstaw prawnych per cel, procesorów, transferów międzynarodowych, terminów retencji, praw użytkownika i organu nadzorczego.
2. Data urodzenia jest przechowywana, choć do kontroli 18+ może wystarczyć `age_verified_at` i metoda weryfikacji. To narusza zasadę minimalizacji, jeżeli pełna data nie ma osobnego celu.
3. Konto tworzone przez Google otrzymuje potwierdzenie wieku bez rzeczywistego pytania o 18+.
4. Sesje i resety przechowują IP oraz User-Agent, czego polityka nie opisuje wystarczająco.
5. Publiczne rekomendacje ujawniają stabilny UUID użytkownika. Publiczny payload nie powinien go zawierać.
6. `contributor_hash` jest zwykłym SHA-256 stabilnego UUID. To pseudonimizacja, nie anonimizacja. Potrzebne są HMAC, retencja i podstawa prawna.
7. Eksport danych w profilu jest atrapą i nie istnieje endpoint realizujący dostęp/przenoszenie danych.
8. Usunięcie konta słusznie usuwa źródłowe zdjęcia i może zachować zaakceptowany, odpersonalizowany asset butelki, ale wymaga transakcyjnego procesu i opisanej licencji.
9. Google Fonts wysyła żądanie do Google przy starcie. Najprościej hostować fonty lokalnie.
10. Potrzebne są: rejestr czynności, DPIA dla AI/zdjęć, lista procesorów, umowy powierzenia, procedura naruszeń i obsługi żądań osoby.

### Ryzyko autorskie i zaufanie użytkowników

- Newsy hotlinkują obrazy Open Graph ze stron zewnętrznych. Trzeba sprawdzać licencję, używać własnych/generowanych miniaturek albo dozwolonego proxy/cache i zachować atrybucję.
- Dane katalogowe potrzebują pochodzenia, statusu licencji i procedury usunięcia. Fakty nie są tym samym co skopiowane opisy, zdjęcia lub znacząca część cudzej bazy.
- Startowe „opinie użytkowników” są fikcyjne i wyglądają jak prawdziwe rekomendacje społeczności. Należy je usunąć albo jednoznacznie oznaczyć jako redakcyjne/demo oraz wyłączyć ze średnich i rankingów.

## ISO 27001, WCAG i standardy branżowe

### ISO 27001

Sam kod nie może być „zgodny z ISO 27001”. Norma dotyczy całego systemu zarządzania bezpieczeństwem informacji. Projekt nie ma jeszcze udokumentowanego zakresu ISMS, inwentaryzacji aktywów, oceny ryzyka, planu postępowania z ryzykiem, przeglądów dostępów, zarządzania dostawcami, procedury incydentów, testów odtworzenia backupu ani dowodów audytowych. Można przygotować mapę kontroli ISO 27001/27002 i prywatności ISO 27701, ale nie wolno deklarować certyfikacji.

### WCAG 2.2

- [`index.html`](../index.html#L5) wyłącza skalowanie gestem, co utrudnia powiększanie tekstu.
- Brakuje `prefers-reduced-motion` dla intro i animacji.
- Intro ma element `aria-hidden`, który zawiera aktywny przycisk pominięcia.
- Brakuje automatycznych testów klawiatury, fokusu, kontrastu i czytnika ekranu.

### Google Play

Przed publikacją potrzebne są: poprawny formularz Data Safety, publiczna polityka prywatności, działająca moderacja UGC, mechanizmy zgłoszeń i blokowania, spójne ograniczenie wieku oraz prawidłowa deklaracja grupy docelowej. Treść nie może zachęcać nieletnich ani promować nieodpowiedzialnego spożycia alkoholu.

## Wyniki testów

Uruchomiono lokalne skrypty domenowe i testy UI dostępne w repozytorium.

- Wszystkie uruchomione testy domenowe przeszły.
- Naprawiono oczekiwanie kanonicznego rekordu Jefferson's w `scripts/test_catalog_match.mjs`.
- `scripts/ui-taxonomy-smoke.mjs` poprawnie potwierdza brak widocznych liczników kategorii.
- Dodano `scripts/security-xss-regression.mjs`, który sprawdza kodowanie atrybutów, URL, obrazy, OAuth, CSP i bezpieczne błędy Workera.
- Regresja skanera używa głównie syntetycznych etykiet. Wynik około 99,8% nie mierzy zdjęć z telefonu zawierających rękę, tło, refleksy, perspektywę i słabe światło.
- Testy nadal nie są obowiązkową bramką GitHub Actions; ich włączenie do CI pozostaje otwartym zadaniem.

## Mocne strony

1. Zapytania D1 są zwykle przygotowane i bindowane. Nie potwierdzono klasycznego SQL Injection.
2. Tokeny sesji są losowe, a w D1 przechowywany jest ich skrót, nie jawny token.
3. Źródłowe zdjęcia są usuwane po przygotowaniu assetu, co odpowiada deklarowanemu kierunkowi minimalizacji.
4. Telemetria skanera ma retencję i mechanizm czyszczenia.
5. Istnieją testy domenowe skanera, taksonomii i rekomendacji, które można wykorzystać jako bazę CI.
6. Newsroom korzysta z listy dozwolonych źródeł, co jest lepsze niż dowolne pobieranie URL.
7. Repozytorium nie zawiera obecnie wykrytych kluczy API ani kluczy prywatnych.

## Plan napraw

### 0-72 godziny, blokery

1. Zablokować rejestrację lokalną albo wdrożyć obowiązkowe potwierdzenie e-mail.
2. Usunąć rolę admina wyliczaną z adresu i automatyczne łączenie Google po e-mailu.
3. Unieważnić sesje administratorów i skontrolować istniejące tożsamości.
4. Usunąć niebezpieczne `innerHTML` dla danych dynamicznych i wdrożyć kontekstowe kodowanie.
5. Objąć limitem każdą kosztowną operację skanera, także potwierdzenie/wycinanie.
6. Ograniczyć publiczny health i nie zwracać surowych wyjątków.

### Do 7 dni

1. Rate limiting auth, resetu, ocen, health i skanera.
2. Bezpieczne sesje, reautoryzacja przy usuwaniu konta i przegląd OAuth.
3. Grupowe zapytania ocen, cache schematu i ograniczenie danych obrazu w pamięci.
4. CSP, URL allowlist, lokalne fonty i podstawowe nagłówki bezpieczeństwa.
5. Naprawić dwa testy i uruchamiać cały zestaw w GitHub Actions.
6. Dodać zgłaszanie, blokowanie i moderację komentarzy.

### Do 30 dni

1. Modułowy frontend i Worker, wdrażane etapami z testami kontraktowymi.
2. Wrangler, automatyczne wdrożenie Workera, wersjonowane migracje i rollback.
3. Ukończona polityka prywatności, regulamin UGC, Data Safety, DPIA i rejestr procesorów.
4. Eksport danych, kompletna obsługa praw użytkownika i audytowalne usuwanie konta.
5. Monitoring błędów, alerty kosztowe, backup/restore oraz procedura incydentów.
6. Testy realnych zdjęć z urządzeń, wydajności mobilnej, WCAG i bezpieczeństwa API.

## Źródła i kryteria

- [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [RODO, pełny tekst](https://eur-lex.europa.eu/legal-content/EN/TXT/?qid=1618398943851&uri=CELEX%3A32016R0679)
- [Komisja Europejska: informacje wymagane przy zbieraniu danych](https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/principles-gdpr/what-information-must-be-given-individuals-whose-data-collected_en)
- [EDPB: pseudonimizacja](https://www.edpb.europa.eu/news/edpb-adopts-pseudonymisation-guidelines-and-paves-the-way-to-improve-cooperation-with_en)
- [Cloudflare KV: model spójności](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/reference)
- [ISO/IEC 27000 family](https://www.iso.org/standard/iso-iec-27000-family)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Google Play: User Generated Content](https://support.google.com/googleplay/android-developer/answer/17190352)
- [Google Play: Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469)

## Ograniczenia audytu

To był statyczny przegląd repozytorium, lokalne uruchomienie dostępnych testów i analiza przepływów danych. Nie wykonywano destrukcyjnego testu penetracyjnego produkcji, testów kont Cloudflare/Google z uprawnieniami właściciela, analizy konfiguracji DNS/TLS ani formalnej opinii prawnej. Ocena ISO wskazuje gotowość i braki, nie stanowi certyfikacji.
