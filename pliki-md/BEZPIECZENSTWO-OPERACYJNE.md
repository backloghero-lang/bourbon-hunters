# Bezpieczeństwo operacyjne i prywatność

Ten dokument uzupełnia zabezpieczenia zapisane w kodzie. Nie jest certyfikatem ISO ani opinią prawną.

## Kontrole techniczne

- konta lokalne wymagają potwierdzonego e-maila;
- role administratora i moderatora pochodzą wyłącznie z D1;
- hasła są chronione przez PBKDF2-SHA256 z 600 000 iteracji;
- logowanie, reset hasła i kosztowne operacje skanera mają serwerowe limity;
- Google OAuth używa jednorazowego stanu, dokładnego adresu powrotu i PKCE;
- frontend stosuje CSP, lokalne fonty, allowlistę URL i dokładny CORS;
- komentarze można zgłaszać i moderować, a autorów blokować;
- użytkownik może pobrać eksport JSON i usunąć konto po reautoryzacji;
- pełna data urodzenia nie jest przechowywana po sprawdzeniu pełnoletności;
- źródłowe zdjęcia są usuwane po przygotowaniu assetu, a publikacja D1/R2 ma dziennik idempotencji;
- CI uruchamia testy bezpieczeństwa, domeny, UI oraz CodeQL.

## Czynności właściciela przed publikacją

1. Uzupełnić w polityce nazwę i adres administratora danych, kontakt prywatności oraz podstawy prawne.
2. Spisać listę procesorów: Cloudflare, Google/Gemini, Resend, GitHub i przyszły operator płatności.
3. Zawrzeć wymagane umowy powierzenia i opisać transfery poza EOG.
4. Uzupełnić formularz Google Play Data Safety zgodnie z faktyczną konfiguracją produkcji.
5. Określić SLA moderacji UGC, procedurę odwołań i kontakt do zgłoszeń prawnych.
6. Raz na kwartał sprawdzić role D1, sekrety, retencję, koszty i możliwość odtworzenia backupu.
7. Publikować miniatury artykułów wyłącznie ze źródeł, których warunki pozwalają na taki użytek, albo zastępować je własnym assetem.

## Reakcja na incydent

1. Zablokować zagrożony sekret lub konto i zachować identyfikatory korelacyjne błędów.
2. Określić zakres danych, czas zdarzenia, dotkniętych użytkowników i procesorów.
3. Odtworzyć usługę z ostatniej zweryfikowanej wersji oraz sprawdzić backup D1/R2.
4. Udokumentować decyzję o zawiadomieniu użytkowników i organu nadzorczego.
5. Po naprawie dodać test regresji oraz opisać przyczynę i działanie zapobiegawcze.

## Retencja

- tymczasowe zdjęcia i wersje robocze: do 24 godzin;
- surowa telemetria operacyjna skanera: domyślnie do 90 dni;
- jednorazowe żądania OAuth: do 10 minut, potem czyszczone;
- artykuły: 30 dni;
- zaakceptowane assety katalogowe i minimalny dowód licencji: do czasu wycofania produktu lub podstawy prawnej.
