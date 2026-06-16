# 🎮 Game Boy Collection

A self-hosted web app to manage your Game Boy cartridge collection — with direct integration of the **Analog Pocket**. Play times, cover art and session data are automatically imported from the SD card.

> Built with Next.js · TypeScript · Tailwind CSS · Docker

---

## Screenshots

### Game Overview
![Game Overview](docs/screenshots/overview.png)

The main view shows all games as cards with cover art (automatically pulled from the Analog Pocket library) or virtual cartridge renders. Status badge, star rating and play time are shown per card. The stat tiles at the top act as quick filters; full search and filter controls are below.

### Game Detail
![Game Detail](docs/screenshots/detail.png)

The detail page shows play time, session count, last played date and notes. A Cartridge / Cover toggle switches between the virtual cartridge view and the Pocket library cover image. When logged in, all fields can be edited, a cartridge photo can be uploaded and the "lent out" flag can be toggled.

### Play Time Ranking
![Play Time](docs/screenshots/playtime.png)

A sortable leaderboard of all played titles with progress bar, total play time and average per game. Sort by play time, name, last played date or system.

---

## Features

- **Automatic import** from the Analog Pocket SD card
  - Play times and sessions from `list.bin` / `playtimes.bin`
  - Cover art from the Library (GB · GBC · GBA)
  - Title matching via No-Intro database (~8,400 entries)
  - Reset protection: if Pocket data is lower than stored, play times are added rather than overwritten
- **Pocket Sync upload** — upload `list.bin` and `playtimes.bin` directly via the web UI (no SD card reader needed)
- **Game management**
  - Status: Playing · Completed · Owned · Wishlist
  - Star rating (1–5)
  - Notes with clickable URLs, purchase price, lent-out flag
  - Custom cartridge photo upload (JPEG, HEIC supported; EXIF rotation applied automatically)
  - Virtual cartridge render with label placed in the cartridge shell
  - Cartridge / Cover toggle on the detail page when both images are available
- **Filtering & search**
  - Full-text search (title, publisher, genre)
  - Filter by status, platform, minimum rating, lent-out
  - Filter state persisted in the URL — navigating back restores the last search
  - Clickable stat tiles as quick filters
- **Play time view** with ranking, sorting and "hide completed" toggle
- **Password protection** — reading is always public, editing requires login
- **Docker-ready** — a single `docker compose up`

---

## Requirements

- Docker & Docker Compose
- An **Analog Pocket** SD card (or demo data, see below)

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-user/gameboy-collection.git
cd gameboy-collection
```

### 2. Folder structure

```
gameboy-collection/
├── data/                  ← written by the app (created automatically)
│   ├── games.json         ← game database
│   ├── library/           ← converted cover PNGs
│   └── cartridges/        ← uploaded cartridge photos
│
├── demodata/              ← for local testing without a real SD card
│   ├── library/           ← Library/Images/GB|GBC|GBA/*.bin
│   └── playedgames/       ← list.bin + playtimes.bin
│
└── compose.local.yaml
```

> **`data/`** is fully managed by the app. Back this folder up regularly.

### 3. Mount your SD card

Open `compose.local.yaml` and adjust the volume paths:

```yaml
volumes:
  - ./data:/app/data                           # app data (required)
  - /Volumes/POCKET/Library:/library:ro        # Analog Pocket Library
  - /Volumes/POCKET/Memories:/playedgames:ro  # play time / session data
  # - /path/to/roms:/roms:ro                  # optional: ROM collection
```

### 4. Set a password

In `compose.local.yaml` under `environment`:

```yaml
environment:
  - ADMIN_PASSWORD=your-password   # password for the login button
```

Without `ADMIN_PASSWORD` the app runs in open mode (no login required).

### 5. Start

```bash
docker compose -f compose.local.yaml up -d
```

The app is available at **http://localhost:3000**

On every container start, the app automatically:
1. Converts all library images (`.bin` → `.png`)
2. Imports play times from `list.bin` / `playtimes.bin`
3. Matches titles via the No-Intro database

Progress is visible in the container log:

```bash
docker compose -f compose.local.yaml logs -f
```

---

## Configuration

### Volumes

| Mount (host → container) | Required | Description |
|---|---|---|
| `./data:/app/data` | ✅ | Persistent app data (game database, covers, photos) |
| `/path/Library:/library:ro` | ✅ | Analog Pocket Library folder with cover images |
| `/path/Memories:/playedgames:ro` | ✅ | Contains `list.bin` and `playtimes.bin` |
| `/path/roms:/roms:ro` | ❌ | Optional ROM collection for better title matching |

**Analog Pocket SD card folder structure:**

```
SD card/
├── Library/
│   └── Images/
│       ├── GB/         ← Game Boy covers (.bin)
│       ├── GBC/        ← Game Boy Color covers (.bin)
│       └── GBA/        ← Game Boy Advance covers (.bin)
└── Memories/
    └── playtimes.bin   ← play times for all titles
    (list.bin is generated by the Pocket firmware)
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `ADMIN_PASSWORD` | *(empty)* | Login password. Empty = no password protection |
| `POCKET_LIBRARY_DIR` | `/library` | Path to the Library folder inside the container |
| `POCKET_PLAYED_DIR` | `/playedgames` | Path to the play time folder inside the container |
| `ROMS_DIR` | `/roms` | Path to the ROM collection (optional) |

### Full `compose.local.yaml`

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
      # - /path/to/roms:/roms:ro
    environment:
      - NODE_ENV=production
      - ADMIN_PASSWORD=your-password
      - POCKET_LIBRARY_DIR=/library
      - POCKET_PLAYED_DIR=/playedgames
      # - ROMS_DIR=/roms
    restart: unless-stopped
```

---

## Public Read-Only API

Two unauthenticated endpoints are available for external integrations (e.g. Vestaboard). Both return JSON with `Cache-Control: no-store` and `Access-Control-Allow-Origin: *`.

### `GET /api/public/activity`

Returns a digest of collection activity — useful for displaying what has been recently played or added.

**Response**

```json
{
  "lastSync": {
    "syncedAt": "2026-04-28T14:35:00.000Z",
    "daysAgo": 49
  },
  "newlyAdded": [
    { "id": "tetris", "title": "Tetris", "platform": "GB", "status": "playing", "createdAt": "2026-04-28T14:35:00.000Z" }
  ],
  "recentlyPlayed": [
    { "id": "tetris", "title": "Tetris", "platform": "GB", "status": "playing", "playtime": 320, "rating": 5 }
  ],
  "stats": {
    "totalGames": 42,
    "totalPlaytimeMin": 8430,
    "playing": 3,
    "completed": 18,
    "backlog": 15,
    "wishlist": 6
  }
}
```

- `newlyAdded` — games added since the last Pocket Sync import
- `recentlyPlayed` — top 10 games by total playtime (minutes)
- `lastSync.syncedAt` is `null` if no Pocket Sync has been performed yet

---

### `GET /api/public/games`

Returns the full game collection. Supports optional query parameters for filtering and sorting.

**Query parameters**

| Parameter | Values | Description |
|---|---|---|
| `platform` | `GB` · `GBC` · `GBA` | Filter by platform |
| `status` | `playing` · `completed` · `backlog` · `wishlist` | Filter by status |
| `sort` | `title` (default) · `playtime` · `rating` · `added` | Sort order |

**Response**

```json
{
  "total": 42,
  "games": [
    {
      "id": "tetris",
      "title": "Tetris",
      "platform": "GB",
      "year": 1989,
      "status": "playing",
      "rating": 5,
      "playtime": 320,
      "notes": "",
      "lent": false,
      "purchasePrice": "12.50",
      "romCrc": "46df91ad",
      "createdAt": "2026-04-28T14:35:00.000Z"
    }
  ]
}
```

**Examples**

```bash
# All GBA games sorted by playtime
curl http://localhost:3000/api/public/games?platform=GBA&sort=playtime

# Currently playing games
curl http://localhost:3000/api/public/games?status=playing

# Activity digest for Vestaboard
curl http://localhost:3000/api/public/activity
```

---

## Demo data (without an Analog Pocket)

To try the app without a real SD card, place demo files in `demodata/`:

```
demodata/
├── library/
│   └── Images/
│       ├── GB/     ← *.bin files from the Pocket Library
│       └── GBC/
└── playedgames/
    ├── list.bin
    └── playtimes.bin
```

The paths in `compose.local.yaml` already point to `./demodata/...` by default.

---

## Backup

The entire database lives in `data/games.json`. Cover art and photos are in `data/library/` and `data/cartridges/`. A simple backup:

```bash
cp -r data/ data-backup-$(date +%Y%m%d)/
```

---

## Development

```bash
npm install
echo "ADMIN_PASSWORD=dev" > .env.local
npm run dev
```

App runs at http://localhost:3000

---

## Tech Stack

- **Next.js 15** (App Router, Standalone Build)
- **TypeScript**
- **Tailwind CSS v4**
- **Python 3** (import script for Analog Pocket data)
- **Docker** (Alpine image, ~200 MB)
