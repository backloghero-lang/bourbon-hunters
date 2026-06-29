# Bourbon Hunters - bugi i poprawki

Ten plik jest prostym backlogiem problemow. Nowe rzeczy dopisujemy krotko, bez rozbudowanych opisow.

## Otwarte

### UI / mobile

- Widok szczegolow butelki pokazuje za duze i za bliskie zdjecie; widac biale wyciecia i niedoskonalosci tla.
- W szczegolach trzeba oddalic butelke i poprawic jej stage do czasu prawdziwych PNG/WebP alpha.
- Sprawdzic, czy kropki swipe na Home wygladaja dobrze na telefonie po deployu.
- Zweryfikowac pozycje ikon kategorii ze sprite'a `category-cards.png`.
- Dopracowac ekran Odkrywaj na podstawie `reference-pack-v1/explore-screen.png`.

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

## Szablon wpisu

```text
### Tytul

- Objaw:
- Gdzie:
- Priorytet:
- Status:
```
