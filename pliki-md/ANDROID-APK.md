# Bourbon Hunters na Androidzie

## Gotowy plik demonstracyjny

Lokalny build tworzy plik:

`artifacts/Bourbon-Hunters-demo-v0.1.0.apk`

Jest to APK podpisany kluczem debug, przeznaczony do testów i prezentacji MVP. Nie jest to paczka do publikacji w Google Play.

## Instalacja na telefonie

1. Przenieś APK na telefon.
2. Otwórz plik w telefonie.
3. Zezwól przeglądarce lub menedżerowi plików na instalowanie aplikacji z tego źródła.
4. Wybierz `Zainstaluj`.
5. Po instalacji wyłącz zgodę na instalowanie z nieznanych źródeł, jeżeli nie jest już potrzebna.

Aplikacja demonstracyjna wymaga połączenia z internetem, ponieważ otwiera aktualne wydanie produkcyjne Bourbon Hunters.

## Budowanie w Android Studio

1. Otwórz katalog `android` w Android Studio.
2. Ustaw Gradle JDK na JDK 21.
3. Poczekaj na zakończenie synchronizacji Gradle.
4. Wybierz `Build > Build App Bundle(s) / APK(s) > Build APK(s)`.
5. APK znajdziesz w `android/app/build/outputs/apk/debug/app-debug.apk`.

Przed synchronizacją zmian konfiguracji Capacitor uruchom w katalogu głównym:

```powershell
pnpm run android:sync
```

## Parametry wydania demonstracyjnego

- package: `pl.bourbonhunters.app`
- versionName: `0.1.0-demo`
- versionCode: `1`
- minSdk: `24`
- targetSdk: `35`

Do publicznej dystrybucji poza testami należy utworzyć własny trwały klucz podpisujący i zbudować wydanie release. Klucza prywatnego nie wolno dodawać do repozytorium.
