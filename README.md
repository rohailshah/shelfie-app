# Shelfie — Unified Solo Media Tracker

**Live Preview:** https://shelfie-app-iota.vercel.app/

Shelfie is a private, zero-social, Bingers-inspired media tracker for **Watch** (TV, Movies, Anime), **Read** (Comics, Manga, Books), and **Play** (Video Games), powered by an **Atom ↔ Container graph** so progress automatically syncs across editions, volumes, seasons, and collections.

## Layout & Features

- **Floating Bottom Pill Navigation:** Switch effortlessly between **Watch**, **Read**, **Play**, **Search**, and **Journal** in a focused `#09090B` single-column layout.
- **Bingers-Inspired Feed (`src/components/PillarView.tsx`):**
  - **Finished (above queue):** Collapsed by default; recently logged units and finished titles dim and tuck chronologically above `Watch next` / `Read next` / `Play next` with instant `Undo`.
  - **Active Queue (`Watch next` / `Read next` / `Play next`):** Flush left artwork, next unit code & title, progress count, and one-tap circular check button.
  - **Collecting dust:** Stale (>14 days), paused, or backlog items sit neatly below and wake automatically when you log a unit.
- **Atom ↔ Container Sync Engine (`src/engine/graph.ts`):** TV shows default to adding the **Full Show** (or any individual season) with canonical episode IDs (`tvmaze:<id>:s<S>:e<E>`), while manga/comics/movies/games share canonical IDs or custom bundles.
- **Private Journal (`src/components/JournalView.tsx`):** Local editable profile, Watch/Read/Play activity mix & stats, day-grouped **Diary**, **Shelf** ownership filters, **Unlocked** collections, and JSON backup export/import (`shelfie_v2` in `localStorage`).

## Tech Stack

- React 19 + TypeScript (strict)
- Vite 6 + Tailwind CSS v4
- Lucide React icons
- Vitest (unit tests) + Vercel serverless `/api/media` proxy

## Commands

```bash
npm install
npm run dev      # Start Vite dev server with /api/media middleware
npm test         # Run Vitest unit tests
npm run build    # Type-check (src, vite.config.ts, api) and build dist/
```
