# Bourbon Hunters Asset Importer

Ten lokalny plugin Figmy importuje prawdziwe PNG z GitHub Pages i układa je na jednej stronie:

- `Bourbon Hunters Asset Packs`

Na tej stronie plugin tworzy osobne boardy:

- `Home Asset Pack v1`
- `Scanner Asset Pack v1`
- `Background + Explore References`

## Jak uruchomić

1. Otwórz Figma Desktop albo Figma w przeglądarce.
2. Wejdź w plik `Burbon Hunters Asset Pack v1`.
3. Menu Figma: `Plugins` -> `Development` -> `Import plugin from manifest...`.
4. Wskaż plik:
   `C:\Program Files (x86)\Sandbox\Piaskownica Claude\bourbon-hunters\design\figma-import-plugin\manifest.json`
5. Uruchom:
   `Plugins` -> `Development` -> `Bourbon Hunters Asset Importer`.

Plugin pobiera assety z:

`https://backloghero-lang.github.io/bourbon-hunters/design/figma-assets/asset-pack-v1/`

oraz:

`https://backloghero-lang.github.io/bourbon-hunters/design/figma-assets/scanner-pack-v1/`

oraz:

`https://backloghero-lang.github.io/bourbon-hunters/design/figma-assets/reference-pack-v1/`

## Ważne

- Assety muszą być wcześniej wysłane na GitHub Pages.
- Plugin tworzy albo nadpisuje stronę `Bourbon Hunters Asset Packs`.
- Nie usuwa innych stron w pliku.
