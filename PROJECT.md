# Bourbon Hunters - wizja i zalozenia

Ten plik jest centrum prawdy dla kierunku produktu. Ma pomagac kazdemu nowemu watkowi Codexa szybko zrozumiec, czym ma byc aplikacja.

## Misja

Bourbon Hunters to premium PWA do skanowania butelek bourbona. User robi zdjecie etykiety, aplikacja rozpoznaje butelke, sprawdza lokalna baze i od razu pokazuje informacje, jesli jest trafienie.

Projekt ma zamienic ograniczenie komercyjne w mechanike gry: zamiast opierac produkt na cudzych zdjeciach butelek, budujemy sport kolekcjonowania, skanowania i "polowania" na wlasne znaleziska.

Rdzen zabawy ma dzialac jak kolekcjonerski indeks: czesc butelek jest zakryta znakiem zapytania albo sylwetka, a user odblokowuje je przez zakup, znalezienie w sklepie albo zeskanowanie.

## Główne zadania aplikacji

- Skanowanie etykiety butelki.
- Szybka ocena z lokalnej bazy.
- Fallback do wyszukiwania w sieci, jesli butelki nie ma w bazie.
- Przegladanie bazy bourbonow.
- Wyszukiwanie butelek.
- Dodawanie do listy zyczen.
- Oznaczanie upolowanych butelek.
- Budowanie wlasnej kolekcji.
- Osobna, rozszerzona analiza Hunter AI.
- Zapisywanie nowych znalezisk usera do pozniejszej obrobki i dodania do widokow.
- Odblokowywanie butelek w kolekcjonerskim katalogu.

## Zasady produktu

- Pierwszy ekran ma byc aplikacja, nie marketingowy landing page.
- Szybka ocena ma korzystac najpierw z lokalnej bazy.
- Jesli butelka jest w bazie, user dostaje instant info.
- Jesli butelki nie ma w bazie, wlacza sie wyszukiwanie informacji w sieci.
- Hunter AI jest funkcja rozszerzona, wolniejsza i bardziej opisowa.
- User nie widzi nazwy dostawcy AI; w UI uzywamy nazwy Hunter.
- Aplikacja dobiera jezyk z telefonu lub przegladarki: `pl*` -> polski, reszta -> angielski.
- Nie pokazujemy widocznego przelacznika jezyka.
- Nazwy wlasne, destylarnie i kategorie stylu zostaja po angielsku.
- Docelowo produkt ma byc gotowy pod Google Play i akcje marketingowa na USA.
- Na finiszu planowany jest limit darmowych skanow, np. 20, a potem reklamy lub inny model monetyzacji.
- Najpierw budujemy core aplikacji bez logowania.
- Telemetria i konta wchodza dopiero po ustabilizowaniu core flow.

## Styl

- Premium, dark bourbon, copper, emerald.
- Szklo, beczka, ogien, subtelny glow, tekstura/noise.
- Bez jasnych bialych ramek.
- Bez gotowych mockupow jako tla pod dynamiczne dane.
- Dynamiczne karty, listy i butelki renderuje aplikacja.
- Zdjecia butelek maja wygladac jak premium produktowe cutouty, bez widocznych bialych obrysow.

## Zrodla danych i assetow

- Baza: `db/bourbons.json` (obecnie 539 pozycji).
- Zdjecia butelek: `assets/bourbons/`.
- Assety produkcyjne i referencyjne: `design/figma-assets/`.
- Figma jest katalogiem wizualnym i miejscem projektowania, nie zrodlem runtime.

## Dane i prawa do zdjec

- Obecna baza pochodzi ze scrapowania i sluzy jako etap roboczy.
- Komercyjnie nie chcemy opierac produktu na autentycznych zdjeciach cudzych butelek.
- Docelowy zestaw startowy ma uzywac generowanych przez AI butelek podobnych do realnych, ale nie kopiujacych cudzych materialow.
- User bedzie budowal wlasna kolekcje przez skanowanie i zapisywanie swoich zdjec.
- Aplikacja ma obrabiac zdjecia usera tak, zeby pasowaly wizualnie do UI.
- Zdjecia usera moga w przyszlosci zasilac wspolna baze, ale MVP traktuje je przede wszystkim jako element prywatnego odkrywania i kolekcji.

## Przewaga produktu

- Popularne aplikacje czesto skanuja EAN/kod kreskowy.
- Bourbon Hunters ma skanowac etykiete i uzywac AI agentow do szybkiego dopasowania.
- Wartoscia jest szybkie rozpoznanie, kolekcjonowanie i przyjemny "hunt", nie tylko katalog.
- Mechanika zakrytych butelek daje powod, zeby wracac do aplikacji i skanowac realne znaleziska.

## Onboarding

- Na poczatku aplikacji potrzebny bedzie krotki tutorial wyjasniajacy zasade: skanujesz etykiety, odblokowujesz butelki, budujesz kolekcje.
- Tutorial ma tez tlumaczyc, ze czesc wizualizacji jest stylizowana/generowana, a dane o bourbonach sluza szybkiemu rozpoznaniu i ocenie.

## Widok szczegolow

- Szczegoly butelki maja zawierac opis, profil smaku, nos, smak i finisz.
- Obecny widok szczegolow wymaga poprawy zdjec: butelka jest za blisko, widac wyciecia i biale tlo.
- W szczegolach lepiej pokazac butelke z wiekszym oddechem, zeby ukryc niedoskonalosci do czasu prawdziwych cutoutow.
