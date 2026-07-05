# Bourbon Hunters — notatki projektowe (z makiety)

Hasło: **DISCOVER · TRACK · HUNT**. Klimat: Texas/Kentucky, western, ciemny bourbonowy.

## Paleta
- Tło: `#100c08` / `#1c150e` (prawie czarny brąz)
- Karty: `#241a10` / `#2e2114`
- Akcent złoto/tan: `#c8a25a` / `#dcb877` / `#e8cd93`
- Tekst: `#ece2d1`, przygaszony: `#a08e72`
- Linie/ramki: `#3c2c1a`
- Nagłówki: serif (western), reszta sans-serif.

## Nawigacja (dół ekranu, 5 zakładek)
HOME · BROWSE · COLLECTION · MAP · PROFILE

## Ekrany (etapy do zrobienia)
1. **HOME / Przegląd** — powitanie „Welcome back, Hunter", 3 liczniki (BOTTLES / DISTILLERIES / BADGES), przyciski „Browse Whiskies" + „My Collection".
2. **BROWSE** — wyszukiwarka, filtry (Bourbon / Rye / Tennessee), sekcja FEATURED, kategorie (High Proof, Single Barrel, Small Batch, Limited Edition).
3. **WHISKY DETAILS** — zdjęcie, ORIGIN, TYPE, MASH BILL, ABV, TASTING NOTES, „Add to Collection".
4. **MY COLLECTION** — zakładki BOTTLES / WISHLIST / NOTES, siatka butelek z ocenami, „+ Add Bottle".
5. **DISTILLERY MAP** — mapa Texas/Kentucky, piny destylarni, karta szczegółów.
6. **STATYSTYKI & ODZNAKI** — odznaki za kolekcję i aktywność.
7. **NOTATKI** — własne notatki do butelek.
8. **SKANER BUTELEK** — ✅ ZROBIONE (MVP): zdjęcie → AI → ocena jakość/cena. (W makiecie: „skanuj kod kreskowy" — my robimy mądrzej: rozpoznanie ze zdjęcia + recenzje z sieci.)
9. **SPOŁECZNOŚĆ** — (przyszłość) dzielenie się ocenami.

## Kolejność realizacji (propozycja)
Etap A (ten): Skaner — działa jako samodzielna funkcja.
Etap B: Szkielet nawigacji + HOME (liczniki ze stanu lokalnego).
Etap C: COLLECTION + zapis butelek (localStorage, potem KV/D1 w Workerze).
Etap D: BROWSE + WHISKY DETAILS.
Etap E: MAP, ODZNAKI, NOTATKI.
