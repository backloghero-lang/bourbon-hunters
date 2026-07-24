# Bourbon Hunters - telemetria skanera i raporty

Status: operacyjna telemetria skanera jest zaimplementowana w migracji D1 v66 i Workerze. Ogolna analityka zachowania uzytkownika pozostaje wylaczona do czasu decyzji o zgodzie analytics.

## Co mierzymy

- jedna proba skanu ma losowy `scan_id`, wynik procesu, czas wykonania i poziomy pewnosci,
- zapisujemy maksymalnie dwa identyfikatory zaproponowanych butelek,
- zapisujemy, czy user zaakceptowal pierwszy wynik, wybral drugi, anulowal albo nie zakonczyl wyboru,
- dla Gemini zapisujemy model, etap, status, liczbe prob, czas i `usageMetadata` z tokenami,
- dla Cloudflare Images zapisujemy jedno wywolanie wyciecia butelki wraz ze statusem i czasem.

Nie zapisujemy w telemetrii zdjecia, tekstu etykiety, komentarza, emaila ani adresu IP. Skaner visual-only nie wykonuje OCR; historyczna kolumna `ocr_confidence` pozostaje dla zgodnosci schematu i zapisuje 0. Losowy identyfikator urzadzenia goscia jest hashowany w Workerze przed zapisem.

## Tabele D1

- `scanner_runs` - przebieg i wynik skanu,
- `service_usage_events` - kosztowe wywolania Gemini i Cloudflare Images,
- `telemetry_events` - rezerwa pod przyszla, opcjonalna analityke produktowa; frontend jeszcze jej nie wysyla.

Migracja: `agent/d1-migration-v66-telemetry-reports.sql`.

## Retencja i usuniecie konta

- domyslna retencja surowych wpisow operacyjnych wynosi 90 dni,
- zmienna `TELEMETRY_RETENTION_DAYS` moze ustawic 7-365 dni,
- dzienny Cron Workera usuwa starsze wpisy,
- usuniecie konta zeruje `user_id` w danych operacyjnych; zagregowane informacje kosztowe i techniczne pozostaja anonimowe.

## Raport administratora

W profilu administratora pojawia sie pozycja `Raporty`. Widok korzysta z chronionego endpointu:

```text
GET /admin/reports/summary?days=30
GET /admin/reports/confusions?days=30&limit=20
```

Dostep ma tylko email z `ADMIN_EMAILS` albo `SUPPORT_EMAIL`. Raport pokazuje wolumen skanow, wyniki, unikalnych userow/urzadzenia, sredni czas, tokeny i wywolania modeli.

`top_choice_acceptance_proxy` nie jest laboratoryjna trafnoscia. To wskaznik oparty na decyzji usera: jaki procent zakonczonych potwierdzen zaakceptowal pierwszy wynik. `alternate_choice_correction_proxy` pokazuje wybor drugiej propozycji.

## Zmienne Workera

- `OPERATIONAL_TELEMETRY_ENABLED=0` awaryjnie wylacza nowy zapis; domyslnie jest wlaczony,
- `TELEMETRY_RETENTION_DAYS=90` ustawia retencje,
- `ADMIN_EMAILS=email1,email2` dodaje administratorow; `SUPPORT_EMAIL` rowniez ma dostep.

## Kolejnosc wdrozenia

1. Uruchom migracje v66 w D1.
2. Zdeployuj `agent/worker.js`.
3. Sprawdz `/auth/health`: `telemetry_schema=true` i `operational_telemetry_ready=true`.
4. Wyslij frontend i odswiez PWA do cache `bourbon-hunters-v92`.
5. Zaloguj sie jako administrator, wykonaj skan, potwierdz wynik i otworz `Profil -> Raporty`.

## Analityka produktowa na pozniej

Eventy typu `app_open`, `pro_click`, `wishlist_add` i ekspozycje reklam nie sa teraz zbierane. Przed ich wlaczeniem trzeba opisac cel, okres retencji i podstawe prawna oraz ustalic, czy aplikacja wymaga osobnej zgody analytics.
