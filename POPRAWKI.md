# 🔧 Lista poprawek (bugi do zrobienia hurtem)

Zasada: zbieramy tutaj, a gdy powiesz "robimy bugi" — lecę z całej listy naraz.

## Otwarte
- [ ] **Animacja spalania (intro) tnie się.** Widać szwy/przeskoki na początku i na końcu animacji. Do zrobienia: płynniejszy start i koniec (brak widocznej krawędzi na 1. i ostatniej klatce), wygładzić sweep maski (możliwe przyczyny: skok wartości gradientu na starcie/finale, ciężki filtr feTurbulence na słabszym GPU). Cel: gładko od pełnego logo do pełnego odsłonięcia.
- [ ] **Pełna dwujęzyczność treści (PL/EN) — droga B przez Worker (Gemini).** Telefon po polsku → całość PL (oprócz nazw własnych: „Bourbon Hunters", destylarnie, nazwy butelek); inny język → całość EN, ceny w $. UI/pola/ceny to mała robota, ale OPISY wymagają obu wersji na każdej butelce (~367 EN→PL + ~151 PL→EN ≈ 500 tłumaczeń). **Plan: jednorazowy batch przez istniejący Cloudflare Worker + Gemini** (tłumacz EN↔PL, zapis `desc_pl`/`desc_en` do bazy) + przełączanie w aplikacji wg języka + podwójna cena (zł/$ po kursie ~4). Do zrobienia później.

## Zrobione
(pusto)
