# 🎮 Game Boy Collection

Eine selbst gehostete Web-App zur Verwaltung deiner Game Boy Sammlung – mit direkter Integration des **Analog Pocket**. Spielzeiten, Cover-Bilder und Spielstände werden automatisch von der SD-Karte eingelesen.

> Gebaut mit Next.js · TypeScript · Tailwind CSS · Docker

---

## Screenshots

### Spielübersicht
![Spielübersicht](docs/screenshots/overview.png)

Die Hauptansicht zeigt alle Spiele als Kacheln mit Cover-Bild (automatisch aus der Analog Pocket Library), Status-Badge, Bewertung und Spielzeit. Über die Statistik-Tiles oben lässt sich direkt nach Status filtern.

### Spieldetails
![Spieldetails](docs/screenshots/detail.png)

Die Detailseite zeigt Spielzeit, Sessions, zuletzt gespielt und Notizen. Im eingeloggten Modus können alle Felder bearbeitet, ein eigenes Cartridge-Foto hochgeladen und der Ausgeliehen-Status gesetzt werden.

### Spielzeit-Ranking
![Spielzeit](docs/screenshots/playtime.png)

Eine sortierbare Rangliste aller gespielten Titel mit Balkendiagramm, Gesamt- und Durchschnittsspielzeit.

---

## Features

- **Automatischer Import** von der Analog Pocket SD-Karte
  - Spielzeiten und Sessions aus `list.bin` / `playtimes.bin`
  - Cover-Bilder aus der Library (GB · GBC · GBA)
  - Titel-Zuordnung via No-Intro Datenbank (~8 400 Einträge)
- **Spielverwaltung**
  - Status: Spiele ich · Durchgespielt · Besitze ich · Wunschliste
  - Bewertung (1–5 Sterne)
  - Notizen, Kaufpreis, Ausgeliehen-Flag
  - Eigenes Cartridge-Foto hochladbar
- **Filterung & Suche**
  - Freitext-Suche (Titel, Publisher, Genre)
  - Filter nach Status, System, Mindest-Bewertung, Ausgeliehen
  - Klickbare Statistik-Tiles als Schnellfilter
- **Spielzeit-Ansicht** mit Ranking, Sortierung und "Durchgespielt ausblenden"
- **Passwortschutz** – Lesen immer öffentlich, Bearbeiten nur nach Login
- **Docker-ready** – ein einziger `docker compose up`

---

## Voraussetzungen

- Docker & Docker Compose
- Eine **Analog Pocket** SD-Karte (oder Demo-Daten, s. u.)

---

## Setup

### 1. Repository klonen

```bash
git clone https://github.com/dein-user/gameboy-collection.git
cd gameboy-collection
```

### 2. Ordnerstruktur anlegen

```
gameboy-collection/
├── data/                  ← von der App geschrieben (wird angelegt)
│   ├── games.json         ← Spieledatenbank
│   ├── library/           ← konvertierte Cover-PNGs
│   └── cartridges/        ← hochgeladene Cartridge-Fotos
│
├── demodata/              ← nur für lokale Tests ohne echte SD-Karte
│   ├── library/           ← Library/Images/GB|GBC|GBA/*.bin
│   └── playedgames/       ← list.bin + playtimes.bin
│
└── compose.local.yaml
```

> **`data/`** wird vollständig von der App verwaltet. Diesen Ordner regelmäßig sichern.

### 3. SD-Karte einbinden

Öffne `compose.local.yaml` und passe die Volume-Pfade an:

```yaml
volumes:
  - ./data:/app/data                           # App-Daten (Pflicht)
  - /Volumes/POCKET/Library:/library:ro        # Analog Pocket Library
  - /Volumes/POCKET/Memories:/playedgames:ro  # Spielstand-/Zeitdaten
  # - /pfad/zu/roms:/roms:ro                  # Optional: ROM-Sammlung
```

### 4. Passwort setzen

In `compose.local.yaml` unter `environment`:

```yaml
environment:
  - ADMIN_PASSWORD=dein-passwort   # Passwort für den Login-Button
```

Ohne `ADMIN_PASSWORD` ist die App im öffentlichen Modus (kein Login nötig).

### 5. Starten

```bash
docker compose -f compose.local.yaml up -d
```

Die App ist erreichbar unter **http://localhost:3000**

Beim ersten Start (und bei jeder Neustart) werden automatisch:
1. Die Library-Bilder konvertiert (`.bin` → `.png`)
2. Spielzeiten aus `list.bin` / `playtimes.bin` eingelesen
3. Titel via No-Intro Datenbank zugeordnet

Der Fortschritt ist im Container-Log sichtbar:

```
docker compose -f compose.local.yaml logs -f
```

---

## Konfiguration im Detail

### Volumes

| Mount (Host → Container) | Pflicht | Beschreibung |
|---|---|---|
| `./data:/app/data` | ✅ | Persistente App-Daten (Spieldatenbank, Cover, Fotos) |
| `/pfad/Library:/library:ro` | ✅ | Analog Pocket Library-Ordner mit Cover-Bildern |
| `/pfad/Memories:/playedgames:ro` | ✅ | Enthält `list.bin` und `playtimes.bin` |
| `/pfad/roms:/roms:ro` | ❌ | Optionale ROM-Sammlung für bessere Titelzuordnung |

**Analog Pocket SD-Karte – Ordnerstruktur:**

```
SD-Karte/
├── Library/
│   └── Images/
│       ├── GB/         ← Game Boy Cover (.bin)
│       ├── GBC/        ← Game Boy Color Cover (.bin)
│       └── GBA/        ← Game Boy Advance Cover (.bin)
└── Memories/
    └── playtimes.bin   ← Spielzeiten aller Titel
    (list.bin wird vom Pocket generiert)
```

### Environment-Variablen

| Variable | Standard | Beschreibung |
|---|---|---|
| `ADMIN_PASSWORD` | *(leer)* | Passwort für den Login. Leer = kein Passwortschutz |
| `POCKET_LIBRARY_DIR` | `/library` | Pfad zum Library-Ordner im Container |
| `POCKET_PLAYED_DIR` | `/playedgames` | Pfad zum Spielzeit-Ordner im Container |
| `ROMS_DIR` | `/roms` | Pfad zur ROM-Sammlung (optional) |

### Vollständige `compose.local.yaml`

```yaml
services:
  gameboy-collection:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - /Volumes/POCKET/Library:/library:ro
      - /Volumes/POCKET/Memories:/playedgames:ro
      # - /pfad/zu/roms:/roms:ro
    environment:
      - NODE_ENV=production
      - ADMIN_PASSWORD=dein-passwort
      - POCKET_LIBRARY_DIR=/library
      - POCKET_PLAYED_DIR=/playedgames
      # - ROMS_DIR=/roms
    restart: unless-stopped
```

---

## Demo-Daten (ohne Analog Pocket)

Zum Ausprobieren ohne echte SD-Karte können Demo-Dateien in `demodata/` abgelegt werden:

```
demodata/
├── library/
│   └── Images/
│       ├── GB/     ← *.bin Dateien aus der Pocket Library
│       └── GBC/
└── playedgames/
    ├── list.bin
    └── playtimes.bin
```

Die Pfade in `compose.local.yaml` dann entsprechend auf `./demodata/...` zeigen lassen (bereits so vorkonfiguriert).

---

## Daten sichern

Die gesamte Datenbank liegt in `data/games.json`. Cover-Bilder und Fotos liegen in `data/library/` und `data/cartridges/`. Ein einfaches Backup:

```bash
cp -r data/ data-backup-$(date +%Y%m%d)/
```

---

## Entwicklung

```bash
npm install
cp .env.local.example .env.local   # oder: echo "ADMIN_PASSWORD=dev" > .env.local
npm run dev
```

App läuft unter http://localhost:3000

---

## Tech Stack

- **Next.js 15** (App Router, Standalone Build)
- **TypeScript**
- **Tailwind CSS v4**
- **Python 3** (Import-Script für Analog Pocket Daten)
- **Docker** (Alpine-Image, ~200 MB)
