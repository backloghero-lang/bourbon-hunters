# Bourbon Hunters - pytania produktowe

Ten plik trzyma pytania, ktore trzeba rozstrzygnac jako product owner + dev team.

## Odpowiedziane / kierunkowe

- Zdjecia userow moga kiedys zasilac wspolna baze, ale MVP traktuje je jako prywatny element kolekcji i odkrywania.
- Główna mechanika: zakryte butelki odblokowywane przez skan, jak kolekcjonerski indeks.
- Limit 20 skanow zostaje jako kierunek na pozniejsza faze; kandydat: per urzadzenie.
- MVP najpierw bez logowania; konta i telemetria dopiero po core aplikacji.
- Generowane butelki maja isc w klimat/podobienstwo, ale bez kopiowania realnych etykiet 1:1.

## Najwazniejsze na teraz

- Czy generowane butelki maja byc tylko ilustracjami w UI, czy maja tez pomagac w rozpoznawaniu po skanie?
- Czy startowy pack generowanych butelek ma miec ok. 50 pozycji, czy od razu wiecej?
- Czy reklamy po limicie maja byc jedyna monetyzacja, czy przewidujemy premium bez reklam?
- Czy rynek startowy to USA-only, czy PL/EN od poczatku zostaje jako przewaga?
- Jak bardzo mozemy zblizac generowane butelki do realnych marek, zeby zachowac rozpoznawalnosc bez ryzyka prawnego?
- Czy baza opisow ma opisywac realne butelki, czy wprowadzamy tez "inspired by" / kategorie zamiast nazw marek?
- Jaki model kont wybieramy na start: email+password, Google/Apple, magic link, czy kombinacja?
- Jaki backend wybieramy dla danych usera: Cloudflare D1/R2/KV, Firebase, Supabase, czy inny?
- Czy `Wersja Pro` ma oznaczac brak reklam, wiecej skanow, historie skanow, zaawansowana analize AI, czy pakiet tych funkcji?
- Czy limit 20 skanow ma resetowac sie miesiecznie, byc jednorazowy, czy zalezec od reklam?
- Jakie minimalne dane usera zbieramy przy koncie, zeby nie komplikowac prywatnosci i regulaminu?
- Czy kolekcja po zalogowaniu ma miec import danych z obecnego `localStorage`?
- Czy aplikacja mobilna ma isc najpierw jako PWA, potem wrapper, czy od razu przez Capacitor/TWA pod Google Play?
- Jakie zdarzenia telemetrii sa absolutnie potrzebne do decyzji biznesowych, a ktore mozemy pominac w MVP?

## Do wyjasnienia: akceptacja zdjec

Akceptacja nie dotyczy prywatnej kolekcji usera. Chodzi tylko o sytuacje, w ktorej zdjecie usera mialoby trafic do wspolnej/publicznej bazy albo byc widoczne dla innych.

Wtedy trzeba rozstrzygnac:

- czy user wyraza zgode na uzycie zdjecia,
- czy zdjecie nie zawiera danych prywatnych albo niechcianych elementow,
- czy obrobiony asset jest wystarczajaco dobry wizualnie,
- czy publikacja nie robi problemow prawnych lub moderacyjnych.

## Techniczne

- Gdzie trzymamy zdjecia userow po skanie: KV, R2, GitHub, inny storage?
- Czy drugi Worker/agent ma dzialac automatycznie, czy jako kolejka do zatwierdzenia?
- Jak oznaczamy status nowej butelki: surowa, rozpoznana, obrobiona, zatwierdzona, opublikowana?
- Czy widok szczegolow ma zawsze uzywac lokalnego assetu, nawet gdy wynik pochodzi z sieci?
