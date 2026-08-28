# VOID CABINET

Five-game Progressive Web App for Chromebook (or any Chrome browser).

| Game | Type | Controls |
|---|---|---|
| VOID PILOT | Space shooter | A/D or arrows, space/click fire |
| KLONDIKE | Solitaire | Click or drag cards. Double-click to foundations |
| CIPHER | Letter grid | Drag adjacent letters (diagonals count) |
| LATTICE | Sudoku | Arrows + number keys, P for pencil |
| SWEEP | Minesweeper | Click to open, right-click or F to flag |

After the first visit the service worker caches every game so the pack works offline.

## Play locally

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Install on a Chromebook

1. Serve or open the GitHub Pages URL in Chrome (not `file://` if you want install + offline).
2. Chrome menu → Cast, save and share → Install VOID CABINET.
3. Launch from the shelf.

## Publish

See [GITHUB.md](GITHUB.md) for the exact GitHub + GitHub Pages steps, including how to use the zip without Git eating it as a single file.
