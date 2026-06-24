# Lista poprawek (bugi do zrobienia hurtem)

Zasada: zbieramy tutaj, a gdy powiesz "robimy bugi" - lecę z całej listy naraz.

## Otwarte
- [ ] Pełna dwujęzyczność treści (PL/EN) - droga B przez Worker (Gemini). Telefon po polsku -> całość PL (oprócz nazw własnych: Bourbon Hunters, destylarnie, nazwy butelek); inny język -> całość EN, ceny w $. Plan: jednorazowy batch przez istniejący Cloudflare Worker + Gemini, zapis `desc_pl`/`desc_en` do bazy + przełączanie w aplikacji wg języka + podwójna cena (zł/$ po kursie). Do zrobienia później.
- [ ] Nowe kolory i ikony kategorii z Claude Design. Czekamy na kod ikon/kolorystyki, potem podmiana obecnych emoji/kolorów.
- [ ] Logo: docelowo butelka bardziej jak Blanton's. Usunąć napis z etykiety butelki, zostawić nazwę na łuku odznaki.

## Do zrobienia później (zaplanowane)
- [ ] Oceny użytkownika (własne gwiazdki) - obecnie dodajemy lokalny user rating; później można rozbudować o notatki i synchronizację.
- [ ] Rozbudować dane tasting notes: osobne pola `nose`, `taste`, `finish` w bazie. Teraz UI pokazuje strukturę Nos / Smak / Finisz, ale wiele rekordów ma tylko ogólny `notes` albo opis.

## Robione teraz / poprawki z ostatniej sesji
- [x] Kolekcja ma mieć 3 taby: Lista życzeń, Upolowane, Moja kolekcja. Każda zakładka pokazuje listę butelek albo empty state.
- [x] Animacja intro jest za szybka/niestabilna - spowolnić, wygładzić maskę, zmniejszyć chaos płomienia.
- [x] Odkrywaj na telefonie potrafi zostać w starym układzie przez cache - zmienić service worker na network-first dla HTML/JS/DB i podbić wersję.
- [x] Zdjęcia w szczegółach bywają za duże / niewyraźne - jeden stabilny format butelki w całej aplikacji.
- [x] Ocena/opis butelki ma mieć stałe składowe: Nos, Smak, Finisz, Proof, Cena sugerowana, Jakość z bazy, Jakość użytkownika.
- [x] W logo usunąć napis z butelki i zbliżyć sylwetkę butelki do Blanton's.

## Zrobione
(pusto)

