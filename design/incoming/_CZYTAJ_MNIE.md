# 📥 Wrzutnia komponentów z Claude Design

Wrzucaj tutaj gotowe makiety/komponenty, a ja je podstawię do aplikacji.

## Jak nazywać pliki (po ekranie)
- splash.*      → ekran wejściowy (animacja spalania logo)
- logo.svg      → samo logo Bourbon Hunters (wektor)
- home.*        → ekran główny
- detail.*      → szczegóły butelki
- collection.*  → kolekcja
- profile.*     → profil
(np. `splash.html`, `home.html`, `logo.svg`)

## Jakie formaty są dla mnie najlepsze
- **Logo i ikony** → `SVG` (wektor). Najlepsze do animacji „spalania" i ostre na każdym ekranie.
- **Ekrany/komponenty** → `HTML+CSS` w jednym pliku **albo** `React/JSX`. Podstawię 1:1.
- **Tła, zdjęcia, tekstury** → `PNG`/`JPG`/`WebP`.
- **Gotowa animacja** → najlepiej `SVG + CSS` lub `Lottie (.json)`. Ostateczność: `MP4`/`GIF`.

## Wskazówka do splashu (spalanie logo)
Jeśli dasz mi **logo jako SVG**, mogę sam zbudować animację „spalania" w CSS/JS
i płynne przejście do ekranu głównego — wtedy wystarczy samo logo + ewentualnie
kierunek (kolor ognia, czas trwania). Jeśli masz gotową animację — też ją podstawię.

## Paleta (dla spójności)
tło #100c08 / #1c150e · złoto #c8a25a / #dcb877 / #e8cd93 · tekst #ece2d1 · linie #3c2c1a
