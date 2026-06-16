#!/bin/sh
# Container entrypoint: import Pocket data, then start Next.js

LIBRARY_DIR="/analogue-pocket-library"
PLAYED_DIR="/data/analogue-pocket-playedgames"
ROMS_DIR="${ROMS_DIR:-/roms}"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       Game Boy Collection – Start        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

if [ -f "$PLAYED_DIR/list.bin" ]; then
    echo "▶ Analogue Pocket Daten gefunden – starte Import..."
    echo ""
    ROMS_ARG=""
    if [ -d "$ROMS_DIR" ] && [ "$(ls -A "$ROMS_DIR" 2>/dev/null)" ]; then
        ROMS_ARG="--roms-dir $ROMS_DIR"
        echo "  ROMs-Ordner gefunden: $ROMS_DIR"
    fi

    python3 /app/scripts/import_pocket.py \
        --library-dir "$LIBRARY_DIR" \
        --played-dir  "$PLAYED_DIR" \
        $ROMS_ARG
    IMPORT_EXIT=$?
    echo ""
    if [ $IMPORT_EXIT -ne 0 ]; then
        echo "⚠️  Import mit Fehler beendet (Exit $IMPORT_EXIT) – starte trotzdem."
    fi
else
    echo "ℹ️  Kein list.bin in $PLAYED_DIR gefunden – Import übersprungen."
    echo "   Lege list.bin + playtimes.bin in den PlayedGames-Ordner"
    echo "   und starte den Container neu."
fi

echo ""
echo "▶ Starte Next.js..."
echo "  → http://localhost:3000"
echo ""
exec node server.js
