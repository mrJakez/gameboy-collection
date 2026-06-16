#!/usr/bin/env python3
"""
Analogue Pocket → Game Boy Collection importer.

Reads from POCKET_DATA_DIR (default: ./pocket-data):
  Played Games/list.bin      – game list (titles + CRC32)
  Played Games/playtimes.bin – playtime per CRC32
  Library/Images/GB/*.bin    – 160×144 RGBA cover art
  Library/Images/GBC/*.bin   – 160×144 RGBA cover art
  Library/Images/GBA/*.bin   – 240×160 RGBA cover art

Writes to:
  data/games.json            – merged game database
  data/library-images/       – converted PNG cover images

Run on container startup or manually:
  python3 scripts/import_pocket.py [--pocket-dir /path/to/pocket-data]
"""

import struct
import json
import os
import sys
import argparse
import datetime
from pathlib import Path
from typing import Optional

try:
    from PIL import Image as PILImage
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

PROJECT_ROOT = Path(__file__).parent.parent
DATA_FILE = PROJECT_ROOT / "data" / "games.json"
LIBRARY_DIR = PROJECT_ROOT / "data" / "library-images"

# Platform dimensions
PLATFORM_DIMS = {
    "GB":  (160, 144),
    "GBC": (160, 144),
    "GBA": (240, 160),
}

# Reasonable max playtime (filter out corrupted values if needed)
MAX_SECONDS = 999 * 3600  # 999 hours


def parse_list_bin(path: Path) -> list[dict]:
    """Parse Played Games/list.bin → list of {title, rom_crc, platform}"""
    data = path.read_bytes()
    if data[:4] != b"\x01FAT":
        raise ValueError(f"Unexpected magic in {path}: {data[:5].hex()}")

    # Collect unique non-zero offsets from the FAT table (starts at byte 12)
    seen = set()
    offsets = []
    idx = 12
    while idx + 4 <= len(data):
        off = struct.unpack_from("<I", data, idx)[0]
        if off == 0:
            break
        if off not in seen:
            seen.add(off)
            offsets.append(off)
        idx += 4

    games = []
    for off in offsets:
        if off + 16 > len(data):
            continue
        entry_len  = struct.unpack_from("<I", data, off)[0]
        # hash1 (bytes 4-8) reversed = library image filename key
        lib_crc    = data[off+4:off+8][::-1].hex()
        rom_crc    = data[off+8:off+12].hex()

        # Title: null-terminated string starting at byte 16
        title_start = off + 16
        null_pos = data.index(0, title_start)
        title = data[title_start:null_pos].decode("utf-8", errors="replace")

        # Platform defaults to GB; will be overridden by library image folder lookup
        platform = "GB"

        games.append({
            "title": title,
            "rom_crc": rom_crc,
            "lib_crc": lib_crc,   # key for Library/Images/<platform>/<lib_crc>.bin
            "platform": platform,
            "entry_size": entry_len,
        })

    return games


def parse_playtimes_bin(path: Path) -> dict[str, dict]:
    """Parse Played Games/playtimes.bin → {crc: {seconds, last_played}}"""
    data = path.read_bytes()
    if data[:4] != b"\x01TPP":
        raise ValueError(f"Unexpected magic in {path}: {data[:5].hex()}")

    playtimes = {}
    n_entries = (len(data) - 8) // 12
    for i in range(n_entries):
        base = 8 + i * 12
        crc       = data[base:base+4].hex()
        timestamp = struct.unpack_from("<I", data, base+4)[0]
        raw_secs  = struct.unpack_from("<I", data, base+8)[0]

        # High byte may carry flags (e.g. 0x04000000) – mask them out
        seconds = raw_secs & 0x00FFFFFF

        # Convert unix timestamp to ISO date string
        last_played = None
        if 0 < timestamp < 2_000_000_000:
            try:
                last_played = datetime.datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d")
            except Exception:
                pass

        if seconds <= MAX_SECONDS:
            playtimes[crc] = {
                "seconds": seconds,
                "minutes": seconds // 60,
                "last_played": last_played,
            }

    return playtimes


def _fix_pixel_order(raw: bytes, width: int, height: int) -> bytes:
    """
    Analogue Pocket stores images in column-major order, horizontally mirrored.
    Transform to standard row-major, correct orientation.
    """
    src = raw
    out = bytearray(len(src))
    for y in range(height):
        for x in range(width):
            s = (x * height + y) * 4          # column-major source
            d = (y * width + (width - 1 - x)) * 4  # row-major, flip X
            out[d:d + 4] = src[s:s + 4]
    return bytes(out)


def _write_png_pure(rgba_bytes: bytes, width: int, height: int, path: Path) -> None:
    """Write raw RGBA data as PNG without any dependencies."""
    import zlib

    def chunk(name: bytes, data: bytes) -> bytes:
        c = name + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter: None
        raw.extend(rgba_bytes[y * width * 4: (y + 1) * width * 4])
    compressed = zlib.compress(bytes(raw), 6)

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", compressed))
        f.write(chunk(b"IEND", b""))


def convert_bin_to_png(bin_path: Path, out_path: Path, platform: str) -> bool:
    """Convert Analogue Pocket .bin image to PNG. Returns True on success."""
    data = bin_path.read_bytes()
    if len(data) < 9:
        return False

    width  = struct.unpack_from("<H", data, 4)[0]
    height = struct.unpack_from("<H", data, 6)[0]
    expected = width * height * 4 + 8

    if len(data) != expected:
        w, h = PLATFORM_DIMS.get(platform, (160, 144))
        if len(data) == w * h * 4 + 8:
            width, height = w, h
        else:
            return False

    pixels = _fix_pixel_order(data[8:], width, height)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if HAS_PILLOW:
        try:
            img = PILImage.frombytes("RGBA", (width, height), pixels)
            img.save(out_path, "PNG", optimize=True)
            return True
        except Exception:
            pass

    _write_png_pure(pixels, width, height, out_path)
    return True


def find_library_image(lib_crc: str, library_dir: Path) -> "tuple[Optional[Path], str]":
    """Search Library/Images/<platform>/<lib_crc>.bin. Returns (path, platform) or (None, 'GB')."""
    images = library_dir / "Images"
    for platform in ("GBA", "GBC", "GB"):
        candidate = images / platform / f"{lib_crc}.bin"
        if candidate.exists():
            return candidate, platform
    return None, "GB"


ROM_EXTENSIONS = {".gb", ".gbc", ".gba", ".rom"}
ROM_PLATFORM = {".gb": "GB", ".gbc": "GBC", ".gba": "GBA", ".rom": "GB"}

def scan_roms(roms_dir: Path) -> dict[str, dict]:
    """Scan a ROM directory and return {crc: {title, platform}} mapping."""
    import zlib
    db = {}
    for rom in roms_dir.rglob("*"):
        if rom.suffix.lower() not in ROM_EXTENSIONS:
            continue
        if rom.name.startswith("._"):
            continue
        try:
            data = rom.read_bytes()
            crc = f"{zlib.crc32(data) & 0xFFFFFFFF:08x}"
            platform = ROM_PLATFORM.get(rom.suffix.lower(), "GB")
            db[crc] = {"title": rom.stem, "platform": platform}
        except Exception:
            pass
    return db


DELETED_FILE = PROJECT_ROOT / "data" / "deleted_games.json"

def load_deleted_crcs() -> set:
    if DELETED_FILE.exists():
        return {d["romCrc"] for d in json.loads(DELETED_FILE.read_text()) if d.get("romCrc")}
    return set()

def load_games() -> list[dict]:
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text())
    return []


def save_games(games: list[dict]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(games, indent=2, ensure_ascii=False))


def slugify(title: str) -> str:
    import re
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]", "-", title.lower())).strip("-")


def convert_full_library(library_dir: Path, dry_run: bool = False) -> tuple[int, int]:
    """Convert all .bin images in Library/Images to PNG. Returns (converted, skipped)."""
    images_root = library_dir / "Images"
    if not images_root.exists():
        return 0, 0

    converted = 0
    skipped = 0
    all_bins = []
    for platform_dir in sorted(images_root.iterdir()):
        if not platform_dir.is_dir():
            continue
        platform = platform_dir.name
        if platform not in PLATFORM_DIMS:
            continue  # skip e.g. GG (Game Gear)
        for bin_file in sorted(platform_dir.iterdir()):
            if bin_file.suffix == ".bin":
                all_bins.append((bin_file, platform))

    total = len(all_bins)
    for i, (bin_file, platform) in enumerate(all_bins, 1):
        lib_crc = bin_file.stem
        out_png = LIBRARY_DIR / f"{lib_crc}.png"
        if out_png.exists():
            skipped += 1
            continue
        if not dry_run:
            ok = convert_bin_to_png(bin_file, out_png, platform)
            if ok:
                converted += 1
                if converted % 100 == 0 or converted <= 5:
                    print(f"   [{i:>5}/{total}] 🖼  {lib_crc}.png ({platform})")
        else:
            converted += 1  # count what would be converted

    return converted, skipped


GAME_DB_FILE = PROJECT_ROOT / "data" / "game_db.json"

def load_game_db() -> dict:
    """Load the bundled No-Intro game database (CRC → {title, platform})."""
    if GAME_DB_FILE.exists():
        return json.loads(GAME_DB_FILE.read_text())
    return {}


def enrich_game_db_with_lib_crcs(played_games: list[dict]) -> None:
    """Add libCrc to game_db.json entries based on rom_crc → lib_crc mapping from played games."""
    game_db = load_game_db()
    if not game_db:
        return

    rom_to_lib = {pg["rom_crc"]: pg["lib_crc"] for pg in played_games if pg.get("rom_crc") and pg.get("lib_crc")}
    changed = False
    for rom_crc, lib_crc in rom_to_lib.items():
        if rom_crc in game_db and game_db[rom_crc].get("libCrc") != lib_crc:
            game_db[rom_crc]["libCrc"] = lib_crc
            changed = True

    if changed:
        GAME_DB_FILE.write_text(json.dumps(game_db, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description="Import Analogue Pocket data")
    parser.add_argument("--library-dir", default=str(PROJECT_ROOT / "analogue-pocket-library"),
                        help="Path to the Library folder from the SD card")
    parser.add_argument("--played-dir", default=str(PROJECT_ROOT / "data" / "analogue-pocket-playedgames"),
                        help="Path to the PlayedGames folder (contains list.bin + playtimes.bin)")
    parser.add_argument("--roms-dir", default=None,
                        help="Path to ROM collection (.gb/.gbc/.gba) for title lookup")
    parser.add_argument("--dry-run", action="store_true", help="Don't write any files")
    args = parser.parse_args()

    library_dir = Path(args.library_dir)
    played_dir  = Path(args.played_dir)
    roms_dir    = Path(args.roms_dir) if args.roms_dir else None

    print(f"  Library:     {library_dir}")
    print(f"  PlayedGames: {played_dir}")
    if roms_dir:
        print(f"  ROMs:        {roms_dir}")
    print()

    # --- 1. Parse game list ---
    list_bin      = played_dir / "list.bin"
    playtimes_bin = played_dir / "playtimes.bin"

    if not list_bin.exists():
        print(f"FEHLER: list.bin nicht gefunden: {list_bin}")
        sys.exit(1)

    # --- 0. ROM scan for title database ---
    rom_db = {}
    if roms_dir and roms_dir.exists():
        print("── [0/5] ROMs scannen für Titeldatenbank ─────────────")
        rom_db = scan_roms(roms_dir)
        print(f"   {len(rom_db)} ROMs gescannt")
        print()

    print("── [1/5] Spiele einlesen (list.bin) ──────────────────")
    pocket_games = parse_list_bin(list_bin)
    print(f"   {len(pocket_games)} Spiele in PlayedGames")

    # --- 2. Parse playtimes ---
    print()
    print("── [2/5] Spielzeiten einlesen (playtimes.bin) ────────")
    playtimes = {}
    if playtimes_bin.exists():
        playtimes = parse_playtimes_bin(playtimes_bin)
        total_hours = sum(v["seconds"] for v in playtimes.values()) // 3600
        print(f"   {len(playtimes)} Einträge · {total_hours}h gesamt")
    else:
        print("   playtimes.bin nicht gefunden – übersprungen")

    # --- 3. Convert ALL library images ---
    print()
    n_lib_bins = sum(
        1 for d in (library_dir / "Images").iterdir()
        if d.is_dir() and d.name in PLATFORM_DIMS
        for f in d.iterdir() if f.suffix == ".bin"
    ) if (library_dir / "Images").exists() else 0
    print(f"── [3/5] Library konvertieren ({n_lib_bins} Bilder) ─────────")
    lib_converted, lib_skipped = convert_full_library(library_dir, dry_run=args.dry_run)
    if lib_skipped == n_lib_bins:
        print(f"   Alle {lib_skipped} Bilder bereits vorhanden")
    else:
        print(f"   {lib_converted} konvertiert · {lib_skipped} bereits vorhanden")

    # --- 4. Merge played games into games.json ---
    print()
    print("── [4/5] Spielstand zusammenführen ───────────────────")
    games  = load_games()
    deleted_crcs = load_deleted_crcs()
    added   = 0
    updated = 0
    skipped = 0

    for pg in pocket_games:
        crc      = pg["rom_crc"]
        if crc in deleted_crcs:
            skipped += 1
            continue
        lib_crc  = pg["lib_crc"]
        pt       = playtimes.get(crc, {})
        playtime_mins = pt.get("minutes", 0)

        # Image URL uses lib_crc (consistent with Library filename)
        out_png = LIBRARY_DIR / f"{lib_crc}.png"
        lib_image_url = f"/images/library/{lib_crc}.png" if out_png.exists() else None

        # Detect platform from library folder
        _, detected_platform = find_library_image(lib_crc, library_dir)
        pg["platform"] = detected_platform

        existing = next((g for g in games if g.get("romCrc") == crc), None)
        if existing is None:
            existing = next((g for g in games if g["title"].lower() == pg["title"].lower()), None)

        if existing:
            changed = False
            stored_mins = existing.get("playtime", 0) or 0

            if playtime_mins >= stored_mins:
                # Normal case: Pocket has equal or more time → use Pocket value directly
                if playtime_mins > stored_mins:
                    existing["playtime"] = playtime_mins; changed = True
            else:
                # Reset detected: Pocket shows less time than stored.
                # The Pocket was reset at some point; playtime_mins is time accumulated
                # since the reset. Add it on top of what we already have.
                merged = stored_mins + playtime_mins
                existing["playtime"] = merged; changed = True
                print(f"   ⚠️  Reset erkannt: {pg['title']} "
                      f"(gespeichert {stored_mins}m + Pocket {playtime_mins}m = {merged}m)")

            if lib_image_url and not existing.get("cartridgeImage"):
                existing["libraryImage"] = lib_image_url; changed = True
            if not existing.get("romCrc"):
                existing["romCrc"] = crc; changed = True
            if changed:
                updated += 1
        else:
            slug = slugify(pg["title"])
            while any(g["id"] == slug for g in games):
                slug += "-2"
            games.append({
                "id": slug, "title": pg["title"],
                "developer": "", "publisher": "", "year": 0,
                "platform": pg["platform"], "genre": [],
                "status": "playing" if playtime_mins > 0 else "backlog",
                "cartridgeImage": None, "libraryImage": lib_image_url,
                "coverImage": None, "playtime": playtime_mins,
                "notes": "", "rating": None, "romCrc": crc,
                "pocketData": None, "purchasePrice": None,
            })
            added += 1
            print(f"   ➕ {pg['title']} ({playtime_mins // 60}h{playtime_mins % 60:02d}m)")

    # --- 5. Save ---
    print()
    print("── [5/5] Speichern ───────────────────────────────────")
    if not args.dry_run:
        save_games(games)
        print(f"   games.json  ({len(games)} Einträge)")

        enrich_game_db_with_lib_crcs(pocket_games)
        print(f"   game_db.json  (libCrc für {len(pocket_games)} gespielte Spiele ergänzt)")

    print()
    print("──────────────────────────────────────────────────────")
    print(f"   {n_lib_bins} Library-Bilder  ·  {lib_converted} neu konvertiert")
    print(f"   {len(pocket_games)} gespielte Spiele  ·  {added} neu  ·  {updated} aktualisiert  ·  {skipped} übersprungen (gelöscht)")
    if args.dry_run:
        print("   (dry-run – nichts geschrieben)")
    print("──────────────────────────────────────────────────────")


if __name__ == "__main__":
    main()
