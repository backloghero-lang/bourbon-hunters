# Bourbon Hunters - newsy i agent artykulow

Feed jest widoczny na ekranie glownym oraz w `Profil -> Artykuly`. Dostep wymaga zalogowania.

## Harmonogram

- Jeden Cron uruchamia Workera codziennie o `03:00 UTC` (`0 3 * * *`).
- Nowe wydania powstaja w poniedzialek i czwartek.
- Kazde wydanie ma maksymalnie 3 artykuly.
- Codzienne uruchomienie odzyskuje niedokonczone wydanie, wiec awaria w poniedzialek lub czwartek nie blokuje feedu do nastepnego tygodnia.
- Artykul jest usuwany 30 dni po dodaniu do aplikacji.

## Dozwolone zrodla

Agent korzysta wylacznie z redakcji branzowych:

- Whisky Advocate
- Whisky Magazine
- The Whiskey Wash
- Breaking Bourbon

Konkurencyjne aplikacje, w tym Distiller, nie sa dozwolonym zrodlem. Worker odrzuca ich adresy i usuwa wczesniejsze wpisy Distiller podczas czyszczenia feedu.

## Jak dziala agent

1. Worker pobiera strony dzialow redakcyjnych bezposrednio ze zrodel.
2. Z HTML/RSS wyciaga adresy artykulow z allowlisty.
3. Pobiera metadane artykulu i sprawdza canonical URL, zrodlo, tytul oraz date.
4. Odrzuca duplikaty juz zapisane w D1.
5. Gemini moze uporzadkowac kandydatow i przygotowac krotkie streszczenia PL/EN.
6. Gdy Gemini ma limit `429` albo jest niedostepne, Worker nadal publikuje zweryfikowane artykuly, uzywajac bezpiecznego streszczenia awaryjnego. AI nie jest juz potrzebne do znalezienia linku.

W D1 zapisujemy wylacznie metadane, krotkie streszczenie i link do wydawcy. Nie kopiujemy pelnej tresci artykulu.

## Tabele i endpointy

Migracja `agent/d1-migration-v68-whisky-news.sql` tworzy:

- `news_articles` - opublikowane metadane artykulow;
- `news_agent_runs` - historia przebiegow, liczba kandydatow, publikacji i bledy.

Endpointy:

- `GET /news` - feed dla zalogowanego uzytkownika;
- `GET /news/image/:id` - bezpieczne proxy miniatury z tygodniowym cache w R2 i fallbackiem po stronie aplikacji;
- `POST /admin/news/refresh` - reczne pobranie biezacego wydania przez administratora.

## Wersja i diagnostyka

Aktualna wersja agenta:

```text
whisky-news-source-first-v4-cached-thumbnails
```

Po wdrozeniu:

1. Otworz `Profil -> Raporty`.
2. Sprawdz `news_schema: true` i wersje agenta.
3. Kliknij `Pobierz 3 najnowsze artykuly`, aby ponowic nieudane wydanie.
4. W `news_agent_runs` oczekuj `status = completed` i `articles_added > 0`.

`news_agent_ready` zalezy od schematu D1. Brak Gemini nie blokuje publikacji, poniewaz dziala tryb awaryjny.

## Testy

```powershell
node scripts/news-agent-regression.mjs
node scripts/ui-news-scroll-smoke.mjs
```

Test regresji potwierdza allowliste, blokade Distiller, odkrywanie linkow ze stron zrodlowych, 6 wpisow startowych i 30-dniowa retencje.
