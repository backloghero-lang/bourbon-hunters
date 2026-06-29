# Bourbon Hunters - handoff do kolejnej karty

Aktualizacja: 2026-06-29.

## Cel projektu

`Bourbon Hunters` to PWA/mobile-web do wyszukiwania, katalogowania i oznaczania bourbonów. Priorytetem jest aplikacja wyglądająca premium na telefonie, z bazą butelek, wishlistą, kolekcją i skanerem etykiet wspieranym przez Hunter AI.

## Technologia

- Frontend: statyczne PWA w `index.html`, bez frameworka.
- Service worker: `sw.js`, network-first dla HTML/DB/SW.
- Baza: `db/bourbons.json`.
- Backend/Hunter AI: `agent/worker.js` na Cloudflare Worker.
- Hosting: GitHub Pages, publiczny URL: `https://backloghero-lang.github.io/bourbon-hunters/`.
- Test launcher: `test-index.html`.
- Figma: lokalny plugin importujący assety z GitHub Pages: `design/figma-import-plugin`.

## Najważniejsze ścieżki

- App: `index.html`
- Service worker: `sw.js`
- Dane butelek: `db/bourbons.json`
- Duże assety 100 butelek: `assets/bourbons/runtime-100/`
- Miniatury list 100 butelek: `assets/bourbons/list-thumbs/`
- Intro: `assets/intro/nowe intro.mp4`
- Assety UI z Figmy: `design/figma-assets/home-pack-v2/`
- Assety skanera: `design/figma-assets/scanner-pack-v1/`
- Lista poprawek: `POPRAWKI.md`

## Aktualny stan aplikacji

- App pokazuje obecnie 100 popularnych butelek z ujednoliconymi assetami.
- `Odkrywaj` i `Kolekcja` używają osobnych miniaturek, żeby nie pokazywać losowo samych szyjek.
- Szczegóły używają większych assetów.
- Intro używa `assets/intro/nowe intro.mp4`, startuje od ok. 5 sekundy, ma przycisk `Pomiń`.
- Na desktopie intro jest w pionowym kadrze 9:16, a nie na cały monitor.
- Gwiazdka/watermark z prawego dolnego rogu intro jest maskowana CSS-em w aplikacji. Nie robimy fizycznej przeróbki MP4.
- Audio intro zostaje wyłączone na stałe (`muted`) ze względu na autoplay mobile.
- Parser opisów wyciąga z opisów pola `nose`, `taste`, `finish`, jeśli występują w opisie, i usuwa dublowanie z tekstu opisu.
- Gwiazdki w szczegółach zostały zmniejszone, a kafle ratingu są w układzie 2x2, żeby nie wyjeżdżały poza ekran.

## Lokalizacja PL/EN

Reguła docelowa:

- Jeżeli język telefonu zaczyna się od `pl`, aplikacja ma być po polsku i pokazywać ceny w zł.
- Każdy inny język telefonu = aplikacja po angielsku i ceny w USD.
- Nazwy własne nie są tłumaczone: `Bourbon Hunters`, destylarnie, nazwy alkoholi.

Stan obecny:

- `detectLang()` w `index.html` już wybiera `pl` tylko dla języka urządzenia `pl*`, inaczej `en`.
- `fmtPrice()` preferuje zł dla PL i USD dla EN. Jeżeli brakuje jednej waluty, używa orientacyjnego kursu `PLN_PER_USD = 4.0`.
- Docelowo kurs i tłumaczenia opisów powinny iść przez backend/worker oraz pola typu `desc_pl` / `desc_en`.

## Figma workflow

Po wysłaniu zmian na GitHub:

1. Poczekaj, aż GitHub Pages odświeży assety.
2. Otwórz plik Figma `Bourbon Hunters Asset Pack`.
3. Uruchom lokalny plugin:
   `Plugins -> Development -> Bourbon Hunters Asset Importer`.
4. Plugin ma importować assety z GitHub Pages do istniejącej strony, bez mnożenia nowych stron.
5. Jeżeli Figma pokazuje limit 3 stron, usuń zbędne/dublujące strony i importuj do jednej istniejącej strony.

Uwaga: wcześniejsze próby MCP Figma wpadały w limit planu Starter, więc najpewniejsza ścieżka to ręczne uruchomienie lokalnego pluginu po deployu.

## Backlog zapamiętany

- Worker do zdjęć użytkownika: przy dopracowywaniu skanera backend ma w locie oczyszczać/normalizować zdjęcia usera, usuwać tło i osadzać butelkę na wspólnym tle aplikacji.
- Animacje skanera premium: dopracować pasek skanowania i animację toczącej się beczki podczas oceny / analizy AI.
- Pełne tłumaczenia danych PL/EN przez backend.
- Lepszy kurs walut z backendu zamiast stałej `PLN_PER_USD`.
- Sync Figma po każdym większym paczku assetów.

## Najbliższe kroki

1. Wysłać bieżące zmiany na GitHub.
2. Na telefonie wejść przez `test-index.html`, kliknąć `Odswiez build` i w razie potrzeby `Wyczysc cache/PWA`.
3. Sprawdzić: intro od 5 sekundy, przycisk `Pomiń`, kadr 9:16 na PC, waluty PL/EN, szczegóły butelek i listy.
4. Po deployu uruchomić plugin Figma Asset Importer.

