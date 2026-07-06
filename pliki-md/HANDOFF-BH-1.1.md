# Bourbon Hunters 1.1 - handoff do kolejnego etapu

Aktualizacja: 2026-07-06.

Ten plik ma byc pierwszym kontekstem dla nowego watku Codexa, np. `Przekaz Bourbon Hunter 1.1`.

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

- Front/PWA jest na cache `bourbon-hunters-v65`.
- Worker auth zwraca `auth-pbkdf2-100000-v2` i `pbkdf2_iterations: 100000`.
- D1 jest podpiete jako binding `DB`.
- Tabela resetu hasla `password_reset_tokens` jest obecna.
- `email_ready` w `/auth/health` jest `true`, czyli Resend/MAIL_FROM sa skonfigurowane.
- Rejestracja email/password dziala po stronie Workera i zapisuje konto w Cloudflare D1.
- Google Sign-In jest tylko przyciskiem UI, jeszcze nie jest podpiety.
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
- Ponizej 80% pokazujemy stan Hunter AI Plus.
- Hunter AI Plus bedzie funkcja Pro/paywall: glebsze dopasowanie, web search, profil smaku, zapis nowego znaleziska i obrobka zdjecia.
- Zdjecie usera powinno docelowo trafic na wspolne tlo Bourbon Hunters po pipeline R2/AI/obrobka.

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
