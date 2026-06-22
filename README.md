<p align="center">
  <img src="banner.png" alt="Bourbon Hunters" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/typ-PWA-c8a25a?style=for-the-badge">
  <img src="https://img.shields.io/badge/backend-Cloudflare%20Worker-f38020?style=for-the-badge&logo=cloudflare&logoColor=white">
  <img src="https://img.shields.io/badge/AI-Gemini%202.5%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white">
  <img src="https://img.shields.io/badge/hosting-GitHub%20Pages-181717?style=for-the-badge&logo=github&logoColor=white">
</p>

<h1 align="center">🥃 Bourbon Hunters</h1>
<p align="center"><b>DISCOVER · TRACK · HUNT</b></p>
<p align="center">Aplikacja dla łowców bourbona. Skanuj butelkę — AI oceni stosunek jakości do ceny w gwiazdkach.</p>

---

## 🎯 Co potrafi (dziś)

**Skaner butelek z bazą 108 bourbonów.** Robisz zdjęcie etykiety, a agent **Hunter**:

1. 🔍 rozpoznaje butelkę (Gemini vision),
2. 📚 **najpierw sprawdza lokalną bazę** `db/bourbons.json` — odpowiedź jest natychmiastowa i darmowa,
3. 🌐 jeśli butelki nie ma w bazie → dopiero wtedy pyta sieci, a znalezisko zapisuje jako **nowość** (do późniejszego uzupełnienia o zdjęcie przez agenta cyklicznego).

Dwa tryby (dwa przyciski):

| Przycisk | Co robi |
|---|---|
| ⭐ **Ocena** | gwiazdki **jakość/cena** (5★ = świetna i tania, 1★ = kiepska i droga), profil smaku, cena orient. PLN |
| 🔎 **Analiza AI** | rozbudowany opis + **historia destylarni** z linkami |

Język **dobiera się do telefonu** (PL/EN). Instalowalna PWA, działa offline. Klucz API ukryty w Cloudflare.

## 🗺️ Plan (etapami)

| Etap | Zakres | Status |
|---|---|---|
| A | 🔫 Skaner butelek (zdjęcie → ocena) | ✅ gotowe |
| B | Szkielet nawigacji + ekran HOME (liczniki) | ⏳ |
| C | Moja kolekcja + zapis butelek | ⏳ |
| D | Przeglądaj whisky + szczegóły | ⏳ |
| E | Mapa destylarni, odznaki, notatki | ⏳ |

Pełne notatki projektowe i paleta: `design/DESIGN.md`.

## 🏗️ Architektura

```
[Telefon / PWA]  ──zdjęcie──►  [Cloudflare Worker]  ──►  [Gemini 2.5 Flash + Google Search]
   index.html                     worker.js                rozpoznanie + recenzje + cena
        ▲                            │
        └──── JSON: ocena, opis, źródła ◄──────────────────────────────────────────────┘
```

- **Front:** `index.html` + `manifest.json` + `sw.js` (GitHub Pages).
- **Backend:** `agent/worker.js` — chowa klucz Gemini, woła model z wyszukiwarką, limituje zapytania.
- **Prompt:** `agent/prompt.txt` — edytujesz i commitujesz, Worker sam podciąga.

## 🚀 Uruchomienie

Instrukcja krok po kroku: **`INSTRUKCJA.md`**.

## 🧪 O projekcie

Projekt weekendowy, **vibe-coded z Claude**. — [Dariusz Masłyk](https://www.linkedin.com/in/dariusz-maslyk)

> ⚠️ Ceny i oceny są orientacyjne. Pij odpowiedzialnie. 18+
