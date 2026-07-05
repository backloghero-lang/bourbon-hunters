# Bourbon Hunters Asset Importer

Lokalny plugin Figmy importuje assety z GitHub Pages i uklada je na jednej stronie:

- `Bourbon Hunters Asset Packs`

Na tej stronie plugin tworzy osobne boardy:

- `Home Asset Pack v1`
- `Scanner Asset Pack v1`
- `Background + Explore References`
- `Home Runtime Pack v2`

## Jak uruchomic

1. Wyslij zmiany na GitHub Pages, zeby assety byly dostepne publicznie.
2. Otworz plik Figmy.
3. Wejdz na strone, ktora moze zostac nadpisana, albo utworz/otworz strone `Bourbon Hunters Asset Packs`.
4. Jezeli plugin nie jest jeszcze dodany:
   `Plugins -> Development -> Import plugin from manifest...`
5. Wskaz plik:
   `C:\Program Files (x86)\Sandbox\Piaskownica Claude\bourbon-hunters\design\figma-import-plugin\manifest.json`
6. Uruchom:
   `Plugins -> Development -> Bourbon Hunters Asset Importer`

## Limit 3 stron w Figma Starter

Plugin nie musi tworzyc nowej strony. Dziala tak:

- jesli istnieje strona `Bourbon Hunters Asset Packs`, plugin ja wyczysci i zaktualizuje;
- jesli jej nie ma, plugin uzyje aktualnie otwartej strony, zmieni jej nazwe i zbuduje boardy tam.

Dzieki temu nie powinien juz pojawiac sie blad o limicie 3 stron.

## Zrodla assetow

Plugin pobiera assety z:

- `https://backloghero-lang.github.io/bourbon-hunters/design/figma-assets/asset-pack-v1/`
- `https://backloghero-lang.github.io/bourbon-hunters/design/figma-assets/scanner-pack-v1/`
- `https://backloghero-lang.github.io/bourbon-hunters/design/figma-assets/reference-pack-v1/`
- `https://backloghero-lang.github.io/bourbon-hunters/design/figma-assets/home-pack-v2/`

## Wazne

- Po kazdej zmianie assetow najpierw zrob deploy na GitHub Pages.
- Potem uruchom plugin ponownie w Figma.
- Plugin nadpisuje tylko jedna strone `Bourbon Hunters Asset Packs`.
- Innych stron w pliku Figmy nie usuwa.
