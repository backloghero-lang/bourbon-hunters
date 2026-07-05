# Bourbon Hunters - handoff do kolejnej karty

Aktualizacja: 2026-07-05.


## Aktualizacja 2026-07-05

- Zwykly skaner nie zgaduje ponizej 80% pewnosci dopasowania.
- Slabe trafienie pokazuje stan `Hunter AI Plus`, bez losowej butelki z bazy.
- Hunter AI Plus jest planowana funkcja Pro/paywall: glebsze dopasowanie, web search, profil smaku i zapis nowego znaleziska.
- Rejestracja i logowanie email/password sa podpiete do Workera i D1.
- Google Sign-In jest tylko przyciskiem UI i nie dziala do kolejnego etapu.
- Wishlist, kolekcja, oceny i historia skanow maja sync przez D1 po zalogowaniu, ale aplikacja pozostaje local-first.
- Dokumenty projektowe przeniesione sa do folderu `pliki-md/`.

## Cel projektu

`Bourbon Hunters` to PWA/mobile-web do wyszukiwania, katalogowania i oznaczania bourbonĂłw. Priorytetem jest aplikacja wyglÄ…dajÄ…ca premium na telefonie, z bazÄ… butelek, wishlistÄ…, kolekcjÄ… i skanerem etykiet wspieranym przez Hunter AI.

## Technologia

- Frontend: statyczne PWA w `index.html`, bez frameworka.
- Service worker: `sw.js`, network-first dla HTML/DB/SW.
- Baza: `db/bourbons.json`.
- Backend/Hunter AI: `agent/worker.js` na Cloudflare Worker.
- Hosting: GitHub Pages, publiczny URL: `https://backloghero-lang.github.io/bourbon-hunters/`.
- Test launcher: `test-index.html`.
- Figma: lokalny plugin importujÄ…cy assety z GitHub Pages: `design/figma-import-plugin`.

## NajwaĹĽniejsze Ĺ›cieĹĽki

- App: `index.html`
- Service worker: `sw.js`
- Dane butelek: `db/bourbons.json`
- DuĹĽe assety 100 butelek: `assets/bourbons/runtime-100/`
- Miniatury list 100 butelek: `assets/bourbons/list-thumbs/`
- Intro: `assets/intro/nowe intro.mp4`
- Assety UI z Figmy: `design/figma-assets/home-pack-v2/`
- Assety skanera: `design/figma-assets/scanner-pack-v1/`
- Lista poprawek: `pliki-md/POPRAWKI.md`

## Aktualny stan aplikacji

- App pokazuje obecnie 100 popularnych butelek z ujednoliconymi assetami.
- `Odkrywaj` i `Kolekcja` uĹĽywajÄ… osobnych miniaturek, ĹĽeby nie pokazywaÄ‡ losowo samych szyjek.
- SzczegĂłĹ‚y uĹĽywajÄ… wiÄ™kszych assetĂłw.
- Intro uĹĽywa `assets/intro/nowe intro.mp4`, startuje od ok. 5 sekundy, ma przycisk `PomiĹ„`.
- Na desktopie intro jest w pionowym kadrze 9:16, a nie na caĹ‚y monitor.
- Gwiazdka/watermark z prawego dolnego rogu intro jest maskowana CSS-em w aplikacji. Nie robimy fizycznej przerĂłbki MP4.
- Audio intro zostaje wyĹ‚Ä…czone na staĹ‚e (`muted`) ze wzglÄ™du na autoplay mobile.
- Parser opisĂłw wyciÄ…ga z opisĂłw pola `nose`, `taste`, `finish`, jeĹ›li wystÄ™pujÄ… w opisie, i usuwa dublowanie z tekstu opisu.
- Gwiazdki w szczegĂłĹ‚ach zostaĹ‚y zmniejszone, a kafle ratingu sÄ… w ukĹ‚adzie 2x2, ĹĽeby nie wyjeĹĽdĹĽaĹ‚y poza ekran.

## Lokalizacja PL/EN

ReguĹ‚a docelowa:

- JeĹĽeli jÄ™zyk telefonu zaczyna siÄ™ od `pl`, aplikacja ma byÄ‡ po polsku i pokazywaÄ‡ ceny w zĹ‚.
- KaĹĽdy inny jÄ™zyk telefonu = aplikacja po angielsku i ceny w USD.
- Nazwy wĹ‚asne nie sÄ… tĹ‚umaczone: `Bourbon Hunters`, destylarnie, nazwy alkoholi.

Stan obecny:

- `detectLang()` w `index.html` juĹĽ wybiera `pl` tylko dla jÄ™zyka urzÄ…dzenia `pl*`, inaczej `en`.
- `fmtPrice()` preferuje zĹ‚ dla PL i USD dla EN. JeĹĽeli brakuje jednej waluty, uĹĽywa orientacyjnego kursu `PLN_PER_USD = 4.0`.
- Docelowo kurs i tĹ‚umaczenia opisĂłw powinny iĹ›Ä‡ przez backend/worker oraz pola typu `desc_pl` / `desc_en`.

## Figma workflow

Po wysĹ‚aniu zmian na GitHub:

1. Poczekaj, aĹĽ GitHub Pages odĹ›wieĹĽy assety.
2. OtwĂłrz plik Figma `Bourbon Hunters Asset Pack`.
3. Uruchom lokalny plugin:
   `Plugins -> Development -> Bourbon Hunters Asset Importer`.
4. Plugin ma importowaÄ‡ assety z GitHub Pages do istniejÄ…cej strony, bez mnoĹĽenia nowych stron.
5. JeĹĽeli Figma pokazuje limit 3 stron, usuĹ„ zbÄ™dne/dublujÄ…ce strony i importuj do jednej istniejÄ…cej strony.

Uwaga: wczeĹ›niejsze prĂłby MCP Figma wpadaĹ‚y w limit planu Starter, wiÄ™c najpewniejsza Ĺ›cieĹĽka to rÄ™czne uruchomienie lokalnego pluginu po deployu.

## Backlog zapamiÄ™tany

- Worker do zdjÄ™Ä‡ uĹĽytkownika: przy dopracowywaniu skanera backend ma w locie oczyszczaÄ‡/normalizowaÄ‡ zdjÄ™cia usera, usuwaÄ‡ tĹ‚o i osadzaÄ‡ butelkÄ™ na wspĂłlnym tle aplikacji.
- Animacje skanera premium: dopracowaÄ‡ pasek skanowania i animacjÄ™ toczÄ…cej siÄ™ beczki podczas oceny / analizy AI.
- PeĹ‚ne tĹ‚umaczenia danych PL/EN przez backend.
- Lepszy kurs walut z backendu zamiast staĹ‚ej `PLN_PER_USD`.
- Sync Figma po kaĹĽdym wiÄ™kszym paczku assetĂłw.

## NajbliĹĽsze kroki

1. WysĹ‚aÄ‡ bieĹĽÄ…ce zmiany na GitHub.
2. Na telefonie wejĹ›Ä‡ przez `test-index.html`, kliknÄ…Ä‡ `Odswiez build` i w razie potrzeby `Wyczysc cache/PWA`.
3. SprawdziÄ‡: intro od 5 sekundy, przycisk `PomiĹ„`, kadr 9:16 na PC, waluty PL/EN, szczegĂłĹ‚y butelek i listy.
4. Po deployu uruchomiÄ‡ plugin Figma Asset Importer.


