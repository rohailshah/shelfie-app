# Shelfie — Unified Media Tracker

**Live Preview:** https://shelfie-app-iota.vercel.app/

Shelfie is a local-first media tracker for **Watch** (TV, Movies, Anime), **Read** (Comics, Manga, Books), and **Play** (Games), built around an **Atom ↔ Container graph** so progress stays synced across editions, volumes, and collections.

## Key Features

- **Atom ↔ Container Sync Engine (`src/engine/graph.ts`):** Log an episode, chapter, issue, film, or game milestone once and every overlapping collection, omnibus, volume, or edition updates automatically via deterministic canonical IDs or custom bundles.
- **Dimmed `Finished` Tray Above `Up Next`:** Inspired by Bingers—recently logged units and completed titles dim and tuck into a collapsible `Finished` drawer directly above `Up Next`, keeping your active board uncluttered while preserving quick Undo.
- **Live Multi-Source Search (`api/media.ts` & `src/services/onlineSearch.ts`):** Search TVMaze (with per-season episode lists), AniList (anime & manga), IMDb / iTunes (movies), OpenLibrary (books & comics), and Steam + Wikipedia (PC & console games) with fullscreen HQ poster inspection.
- **Separated Ownership Shelf:** Track `Owned · Physical`, `Owned · Digital`, `Backlog`, and `Wishlist` independently from reading/watching progress, alongside implicitly unlocked collections.
- **Local-First Persistence & JSON Backup:** All data stays in `localStorage` (`shelfie_v2`) with one-click JSON export and import in **Journal**.

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
