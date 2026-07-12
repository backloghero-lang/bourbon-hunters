# Bourbon Hunters - monetyzacja i limity

Aktualizacja: 2026-07-12.

Ten dokument zapisuje uzgodniony kierunek. Limity i platnosci opisane ponizej sa planem do wdrozenia, a nie aktualnie dzialajaca funkcja.

## Stan obecny

- Limit Gemini Free jest wspolny dla calego projektu Google Cloud, nie dla kazdego usera.
- W testach projekt dostal limit 20 wywolan Gemini 2.5 Flash dziennie.
- Worker ma tymczasowy limit `DAILY_LIMIT` zapisywany w KV per adres IP; domyslnie 30 prob dziennie.
- Limit per IP nie jest modelem docelowym: wspolne Wi-Fi laczy kilku userow, a zmiana sieci pozwala limit ominac.
- Commit `23b69fb` rozdziela modele: visual agent na Gemini 2.5 Flash, OCR na Gemini 2.5 Flash-Lite.
- Docelowo wlaczamy platny Gemini API i placimy za realne tokeny calego projektu.

## Docelowe plany

### Bez logowania

- 1 podstawowy skan dziennie.
- Limit dodatkowo chroniony przez IP i urzadzenie.
- Brak zapisu historii online.

### Konto Free

- 5 podstawowych skanow dziennie.
- Twardy bezpiecznik: maksymalnie 30 podstawowych skanow miesiecznie.
- Reklamy dopiero po osiagnieciu sensownego ruchu.
- Kolekcja, wishlist, oceny i podstawowa historia synchronizowane z kontem.

### Konto Pro

- 30 podstawowych skanow dziennie.
- Twardy bezpiecznik: maksymalnie 300 podstawowych skanow miesiecznie.
- Maksymalnie 20 rozszerzonych analiz AI z web search miesiecznie.
- Brak reklam.
- Pelniejsza historia i funkcje premium rozwijane etapami.

### Zasady naliczania

- Licznik jest backendowy i przypisany do `user_id`, nigdy tylko do frontendu.
- Proba jest rezerwowana przed wywolaniem AI, zeby chronic budzet.
- Blad techniczny `429`, `500` lub `503` nie powinien zabierac limitu usera.
- Brak dopasowania po poprawnym wykonaniu agentow liczy sie jako skan, bo koszt AI zostal poniesiony.
- Dodatkowy rate limit per IP pozostaje jako ochrona przed multi-account abuse.
- Konto wlasciciela/DEV moze miec kontrolowane zwolnienie z limitu.

## Cena startowa

- Rekomendowana cena premierowa: 8,99 zl miesiecznie.
- Cena promocyjna obowiazuje przez pierwsze 6 miesiecy od premiery.
- Po okresie startowym cena dla nowych userow: 11,99-12,99 zl miesiecznie.
- Wariant do decyzji: dotychczasowi subskrybenci zachowuja 8,99 zl przez dodatkowy okres jako plan zalozycielski.
- 7,99 zl jest mozliwe, ale daje bardzo mala rezerwe przy maksymalnym wykorzystaniu limitow.

## Szacunek kosztu

- Podstawowy skan visual + OCR: planistycznie ok. 0,004-0,008 zl.
- Do budzetu przyjmujemy srednio 0,006 zl za podstawowy skan do czasu zebrania realnej telemetrii tokenow.
- Rozszerzona analiza z web search ma osobny licznik, bo moze byc wyraznie drozsza.
- Na malej skali Workers, D1, R2 i Images powinny miescic sie w darmowych progach Cloudflare.
- Przed publicznym startem ustawiamy globalny miesieczny bezpiecznik kosztowy i alerty.

## Reklamy

- Ponizej 1000 MAU nie wdrazamy AdMob: przychod jest zbyt maly w stosunku do pogorszenia UX.
- Przy 1000-3000 MAU przygotowujemy media kit i szukamy pierwszego bezposredniego partnera z legalnej kategorii.
- Około 5000 MAU mozna uruchomic AdMob tylko w planie Free jako wypelnienie.
- Około 10000 MAU zaczynamy rozmowy z wiekszymi partnerami i agencjami.
- W Polsce reklama mocnych alkoholi jest prawnie ograniczona. Bez opinii prawnej nie sprzedajemy reklam marek bourbonu ani sklepow z mocnym alkoholem.
- Bezpieczniejsze kategorie: szklo, karafki, meble kolekcjonerskie, ksiazki, akcesoria barowe, gastronomia i edukacja.

## Dane potrzebne reklamodawcy

- MAU i DAU, nie sama liczba rejestracji.
- Liczba sesji i skanow miesiecznie.
- Kraje i jezyki userow.
- Dodania do kolekcji/wishlisty i aktywnosc ocen.
- Retencja 7/30 dni.
- Klikniecia w legalne formaty partnerskie.

## Plan implementacji

1. Wypchnac commit `23b69fb` i wdrozyc Worker `v4-split-models`.
2. Dodac migracje D1 dla planu, entitlementow i licznikow dziennych/miesiecznych.
3. Zmienic limit KV per IP na licznik D1 per `user_id`, zostawiajac IP jako ochrone dodatkowa.
4. Dodac endpoint zwracajacy plan i pozostale skany.
5. Pokazac licznik w Profilu i przy skanerze oraz dodac paywall po wykorzystaniu limitu.
6. Podpiac Google Play Billing i webhook weryfikujacy subskrypcje po stronie Workera.
7. Dodac pomiar realnych tokenow/kosztu skanu oraz globalny limit budzetu.
8. Reklamy wdrazac dopiero po osiagnieciu minimum ok. 5000 MAU albo pozyskaniu bezposredniego legalnego partnera.

## Decyzje jeszcze otwarte

- Czy plan zalozycielski 8,99 zl zostaje bezterminowo, czy tylko przez 12 miesiecy.
- Czy Pro ma 300 skanow miesiecznie, czy pakiet odnawia sie tez przez dokupienie skanow.
- Dokladny zakres historii i eksportu Pro.
- Dostawca platnosci dla PWA przed wydaniem wersji Google Play.
- Finalna opinia prawna dotyczaca reklam i partnerstw w Polsce.
