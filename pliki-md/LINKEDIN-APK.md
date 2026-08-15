# Demo APK na LinkedIn

## Link do publikacji

W poście i sekcji `Polecane` profilu LinkedIn użyj tego adresu:

`https://backloghero-lang.github.io/bourbon-hunters/download.html?source=linkedin`

To publiczna strona z przyciskiem `Pobierz APK`. Parametr `source=linkedin` jest przekazywany do Workera, dlatego rozpoczęte pobrania są widoczne w aplikacji w `Profil -> Raporty`.

Nie wklejaj jako głównego odnośnika surowego pliku `.apk`. Strona pobierania lepiej prezentuje projekt, wyjaśnia instalację spoza Google Play i daje LinkedIn poprawny tytuł, opis oraz miniaturę.

## Publikacja nowej wersji

1. Uruchom `scripts/build-android-release.ps1`.
2. Wyślij zmiany na GitHub i poczekaj na zielony workflow `Deploy Bourbon Hunters Pages`.
3. W Cloudflare wdróż aktualny `agent/worker.js`.
4. Otwórz link LinkedIn w trybie prywatnym i sprawdź przycisk `Pobierz APK`.
5. Sprawdź wzrost licznika w `Profil -> Raporty`.

## Proponowany opis posta

`Bourbon Hunters to moje mobilne MVP do rozpoznawania butelek po etykiecie, budowania kolekcji i odkrywania newsów ze świata whisky. Demo na Androida można pobrać tutaj:`

`https://backloghero-lang.github.io/bourbon-hunters/download.html?source=linkedin`

Dodaj informację, że jest to demonstracyjny APK instalowany poza Google Play i przeznaczony dla pełnoletnich użytkowników.
