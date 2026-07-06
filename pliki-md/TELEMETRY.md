# Bourbon Hunters - plan podstawowej telemetrii

Cel: przygotowac prosty, prywatnosciowy model zdarzen, ktory mozemy wlaczyc dopiero po domknieciu kont, polityk prywatnosci i zgody/analityki w aplikacji.

## Zasady

- Telemetria domyslnie jest wylaczona.
- Nie wysylamy hasel, daty urodzenia, pelnych zdjec butelek ani surowych danych osobowych.
- User identyfikowany jest przez `user_id` tylko po zalogowaniu; dla gosci uzywamy losowego `device_id`.
- Dane eventow maja byc krotkie: nazwa zdarzenia, czas, wersja aplikacji, jezyk, platforma, kilka parametrow.
- Zdjecia i wyniki AI to osobny temat storage/moderacji, nie podstawowa telemetria.

## Minimalne eventy MVP

| Event | Kiedy | Parametry |
|---|---|---|
| `app_open` | start aplikacji | `app_version`, `lang`, `source` |
| `age_gate_confirmed` | potwierdzenie wieku | `min_age` |
| `register_success` | konto utworzone | `provider=email` |
| `login_success` | logowanie udane | `provider=email` |
| `scan_started` | start skanu | `mode=rate/analyze` |
| `scan_matched` | trafienie >= 80% | `confidence`, `bottle_id`, `source=db` |
| `scan_low_confidence` | wynik ponizej progu | `confidence`, `threshold=0.8` |
| `wishlist_add` | dodanie do wishlisty | `bottle_id` |
| `collection_add` | dodanie do kolekcji | `bottle_id` |
| `rating_set` | user wystawil ocene | `bottle_id`, `rating` |
| `pro_click` | klik w Pro / AI Plus | `surface` |
| `ad_slot_seen` | przyszly slot reklamowy widoczny | `surface`, `slot_id` |

## Proponowana implementacja

1. Worker dostaje endpoint `POST /telemetry`.
2. Zmienna Workera `TELEMETRY_ENABLED=1` wlacza zapis.
3. D1 dostaje tabele `telemetry_events`.
4. Front ma helper `trackEvent(name, props)`, ktory nic nie robi, dopoki telemetry nie jest wlaczone.
5. Po wlaczeniu eventy ida batchowane albo pojedynczo, bez blokowania UI.

## Minimalna tabela D1 na pozniej

```sql
CREATE TABLE telemetry_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  device_id TEXT,
  event_name TEXT NOT NULL,
  event_json TEXT,
  app_version TEXT,
  lang TEXT,
  platform TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_telemetry_event_name ON telemetry_events(event_name, created_at);
CREATE INDEX idx_telemetry_user ON telemetry_events(user_id, created_at);
```

## Moment wlaczenia

Wlaczamy dopiero wtedy, gdy:

- dziala rejestracja, logowanie, reset hasla i podstawowy profil,
- privacy policy opisuje analityke,
- jest decyzja, czy potrzebujemy osobnej zgody na analytics,
- mamy dashboard albo przynajmniej zapytania SQL, z ktorych faktycznie bedziemy korzystac.
