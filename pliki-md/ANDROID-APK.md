# Bourbon Hunters na Androidzie

## Gotowy plik demonstracyjny

Lokalny podpisany build release tworzy plik:

`artifacts/Bourbon-Hunters-demo-v0.1.3-release.apk`

Publiczny plik demonstracyjny ma stały adres i jest publikowany razem z GitHub Pages:

`https://backloghero-lang.github.io/bourbon-hunters/downloads/Bourbon-Hunters-demo.apk`

Linki widoczne w README i na stronie pobierania przechodzą przez Worker, który anonimowo zlicza rozpoczęte pobrania. Wynik jest widoczny dla administratora w `Profil -> Raporty`.

Jest to APK release podpisany trwałym kluczem Bourbon Hunters, przeznaczony do testów i prezentacji MVP poza Google Play.

Klucz i dane podpisu są przechowywane wyłącznie lokalnie w `Documents\Bourbon-Hunters-Signing`. Nie wolno ich usuwać ani dodawać do repozytorium. Każda kolejna aktualizacja APK musi używać tego samego klucza.

## Instalacja na telefonie

1. Przenieś APK na telefon.
2. Otwórz plik w telefonie.
3. Zezwól przeglądarce lub menedżerowi plików na instalowanie aplikacji z tego źródła.
4. Wybierz `Zainstaluj`.
5. Po instalacji wyłącz zgodę na instalowanie z nieznanych źródeł, jeżeli nie jest już potrzebna.

Aplikacja demonstracyjna ma interfejs i katalog zapisane wewnątrz APK. Połączenie z internetem jest potrzebne do logowania, synchronizacji konta, skanera, newsów i pozostałych funkcji serwerowych.

Każda zmiana interfejsu przeznaczona dla wersji Android wymaga ponownego uruchomienia skryptu release i instalacji nowszego APK. Skrypt automatycznie buduje lokalną paczkę `mobile-dist`, synchronizuje Capacitor, podpisuje wydanie i aktualizuje publiczny plik pobierania.

## Budowanie kolejnej wersji release

W katalogu projektu uruchom:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-android-release.ps1
```

Skrypt buduje release, wykonuje `zipalign`, podpisuje APK tym samym kluczem, sprawdza podpis i podmienia `downloads/Bourbon-Hunters-demo.apk`.

## Build debug w Android Studio

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
- versionName: `0.1.3-demo`
- versionCode: `4`
- minSdk: `24`
- targetSdk: `35`
- ikona launchera: `assets/brand/android-launcher-source.png`, generowana dla ikon klasycznych i adaptacyjnych przez `scripts/generate-android-launcher-icons.py`

Certyfikat release:

- właściciel: `Bourbon Hunters Demo`;
- algorytm: RSA 3072;
- SHA-256: `97c009fa1791aae8db1abab2321844e6090e44dc0534528a3289cba04451931d`;
- SHA-256 aktualnego APK: `8B6E59E61D50036D89D824B13ADD2053E0E77AB353C94A3845980222420036AF`.

Jeżeli na urządzeniu była wcześniej zainstalowana wersja debug, trzeba ją raz odinstalować przed instalacją release. Następne wydania podpisane tym kluczem będą mogły aktualizować aplikację.
