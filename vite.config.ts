import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {
  handleMediaSearch,
  resolveComicMeta,
  resolveIsbnCover,
} from './api/media';
import { handleSyncRequest } from './api/sync';

function mediaDevProxy(): Plugin {
  return {
    name: 'media-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/media', async (req, res) => {
        try {
          const reqUrl = (req as { url?: string }).url ?? '';
          const urlObj = new URL(reqUrl, 'http://localhost');
          const typeParam = urlObj.searchParams.get('type');
          res.setHeader('Content-Type', 'application/json');
          if (typeParam === 'comic_meta') {
            const title = urlObj.searchParams.get('title')?.trim() ?? '';
            const isbn = urlObj.searchParams.get('isbn')?.trim() || undefined;
            const meta = title ? await resolveComicMeta(title, isbn) : { compact: null };
            res.end(JSON.stringify(meta));
            return;
          }
          if (typeParam === 'cover') {
            const isbn = urlObj.searchParams.get('isbn')?.trim() ?? '';
            const cover = isbn ? await resolveIsbnCover(isbn) : null;
            res.end(JSON.stringify({ cover }));
            return;
          }
          const q = urlObj.searchParams.get('q')?.trim() ?? '';
          if ((typeParam !== 'movie' && typeParam !== 'game') || !q) {
            res.end(JSON.stringify({ items: [] }));
            return;
          }
          const payload = await handleMediaSearch(typeParam, q);
          res.end(JSON.stringify(payload));
        } catch {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ items: [] }));
        }
      });

      server.middlewares.use('/api/sync', async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json');
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk);
          }
          const bodyText = Buffer.concat(chunks).toString('utf8');
          const rawHeader = req.headers['x-shelfie-sync-code'];
          const syncCode = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
          const result = await handleSyncRequest({
            method: req.method ?? 'GET',
            syncCode,
            bodyText,
          });
          res.statusCode = result.status;
          res.end(JSON.stringify(result.body));
        } catch {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Sync middleware failed' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), mediaDevProxy()],
});
