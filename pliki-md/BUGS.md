# Bourbon Hunters - bugi i poprawki

Ten plik jest prostym backlogiem problemow. Nowe rzeczy dopisujemy krotko, bez rozbudowanych opisow.

## Otwarte

### UI / mobile

- Widok szczegolow butelki pokazuje za duze i za bliskie zdjecie; widac biale wyciecia i niedoskonalosci tla.
- W szczegolach trzeba oddalic butelke i poprawic jej stage do czasu prawdziwych PNG/WebP alpha.
- Zweryfikowac pozycje ikon kategorii ze sprite'a `category-cards.png`.
- Dopracowac ekran Odkrywaj na podstawie `reference-pack-v1/explore-screen.png`.
- Po deployu v64 potwierdzic na telefonie, czy hitbox age gate trafia dokladnie w przyciski z assetu.
- Po deployu v65 potwierdzic, czy karty Home nie pokazuja ucietej czwartej linijki nazwy w `Polecane`, `Ostatnio dodane` i `Moja kolekcja`.

### Butelki i zdjecia

- Obecne zdjecia z bialym tlem sa tylko maskowane best effort przez front.
- Zrobic prawdziwe cutouty butelek jako PNG/WebP z alpha.
- Dla zdjec robionych przez usera zaplanowac segmentacje obrazu.
- Docelowo zastapic problematyczne realne zdjecia zestawem generowanych, komercyjnie bezpieczniejszych butelek.
- Ustalic pipeline dla zdjec usera: zapis, obrobka, zatwierdzenie, publikacja w widokach.

### Scanner / Hunter

- Droga przez Workera do dopracowania jako future task.
- Komunikaty bledu maja mowic o Hunterze, nie o nazwie dostawcy AI.
- Upewnic sie, ze user rozumie roznice miedzy szybka ocena z bazy a rozszerzona analiza Hunter AI.

## Zamkniete

- Home: usunieta wyszukiwarka z ekranu startowego.
- Home: usuniety dzwonek i widoczny przelacznik jezyka.
- Home: dodane kropki swipe dla sekcji.
- Scanner: osobny input aparatu i galerii.
- Scanner: retry resetuje zdjecie i odpala aparat.
- Scanner: loader zmieniony na animowana beczke.
- Profile/auth: email/password zapisuje konta w Cloudflare D1.
- Worker: PBKDF2 zmniejszone do 100000 iteracji, zgodnie z limitem Cloudflare.
- Age gate: przeniesiony przed intro i oparty o asset `assets/brand/age-gate.png`.
- Home: usuniety pomaranczowy tekst destylarni z kart `Featured`, `Recently added` i `My collection`.
- Szczegoly: link sklepu zostaje, ale usunieto dodatkowy toast/przycisk `To moze byc Twoj sklep`.
- Szczegoly: `General info` nie uzywa juz masowego szablonu `destylarnia + proof`; opis jest krotszy i roznicowany przez destylarnie, styl, wiek, finisz albo kontekst wydania.
- Szczegoly: przycisk `Wstecz` wraca do poprzedniego ekranu, np. `Kolekcja`, a nie zawsze do `Odkrywaj`.
- Szczegoly: usunieto duzy powielony panel `Jakosc / Cena`; zostaje badge na zdjeciu i cztery kafle danych.
- Oceny: dodano model `Ocena spolecznosci` z agregatu D1 oraz `Twoja ocena` jako pojedynczy glos usera.
- Home: kropki swipe sa aktualizowane takze po zakonczeniu gestu i po doscrollowaniu snap pointu.
- Profil: dodano ekran `Moj profil`, wybor znacznika usera oraz synchronizacje znacznika przez D1.
- Home: sekcja `Polecane` oparta o rekomendacje userow, z osobna lista `Zobacz wszystkie`.
- Szczegoly: dodano dodawanie komentarza/polecenia oraz modal komentarzy userow z badge i ocena.

## Szablon wpisu

```text
### Tytul

- Objaw:
- Gdzie:
- Priorytet:
- Status:
```
