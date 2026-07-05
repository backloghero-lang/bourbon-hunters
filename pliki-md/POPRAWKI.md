# Lista poprawek (bugi do zrobienia hurtem)

Zasada: zbieramy tutaj, a gdy powiesz "robimy bugi" - lecę z całej listy naraz.

## Otwarte
- [ ] Pełna lokalizacja PL/EN wg języka urządzenia. Reguła docelowa: jeżeli język telefonu zaczyna się od `pl`, aplikacja jest po polsku i pokazuje ceny w zł; każdy inny język telefonu = aplikacja po angielsku i ceny w USD. Nazwy własne zostają bez tłumaczenia: Bourbon Hunters, destylarnie, nazwy alkoholi. UI już wykrywa język urządzenia, ale dane/opisy wymagają docelowo pól `desc_pl`/`desc_en` oraz lepszego kursu z backendu.
- [ ] Synchronizacja Figma po deployu: po kliknięciu "Wyślij na gita" uruchomić w Figmie lokalny plugin `Bourbon Hunters Asset Importer`, aby zaciągnął aktualne assety z GitHub Pages bez tworzenia nowych stron.

## Do zrobienia później (zaplanowane)
- [ ] Oceny użytkownika (własne gwiazdki) - obecnie dodajemy lokalny user rating; później można rozbudować o notatki i synchronizację.
- [ ] Rozbudować dane tasting notes: osobne pola `nose`, `taste`, `finish` w bazie. Teraz UI pokazuje strukturę Nos / Smak / Finisz, ale wiele rekordów ma tylko ogólny `notes` albo opis.
- [ ] Worker do zdjęć użytkownika przy dopracowywaniu skanera: po dodaniu zdjęcia przez usera backend ma w locie oczyścić/znormalizować zdjęcie butelki, usunąć tło i osadzić butelkę na wspólnym tle aplikacji, tak jak assety z bazy.
- [ ] Animacje skanera premium: dopracować pasek skanowania przez butelkę i animację beczki przy ocenie / analizie AI.

## Robione teraz / poprawki z ostatniej sesji
- [x] Kolekcja ma mieć 3 taby: Lista życzeń, Upolowane, Moja kolekcja. Każda zakładka pokazuje listę butelek albo empty state.
- [x] Animacja intro jest za szybka/niestabilna - spowolnić, wygładzić maskę, zmniejszyć chaos płomienia.
- [x] Odkrywaj na telefonie potrafi zostać w starym układzie przez cache - zmienić service worker na network-first dla HTML/JS/DB i podbić wersję.
- [x] Zdjęcia w szczegółach bywają za duże / niewyraźne - jeden stabilny format butelki w całej aplikacji.
- [x] Ocena/opis butelki ma mieć stałe składowe: Nos, Smak, Finisz, Proof, Cena sugerowana, Jakość z bazy, Jakość użytkownika.
- [x] W logo usunąć napis z butelki i zbliżyć sylwetkę butelki do Blanton's.
- [x] Nowe intro działa od ok. 5 sekundy, przycisk "Pomiń" zostaje, desktop pokazuje intro w pionowym kadrze 9:16.
- [x] 100 popularnych butelek ma spójne assety runtime i osobne miniatury list.

## Zrobione
(pusto)

