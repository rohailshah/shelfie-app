import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleMediaSearch } from './api/media';

function mediaDevProxy(): Plugin {
  return {
    name: 'media-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/media', async (req, res) => {
        try {
          const reqUrl = (req as { url?: string }).url ?? '';
          const urlObj = new URL(reqUrl, 'http://localhost');
          const typeParam = urlObj.searchParams.get('type');
          const q = urlObj.searchParams.get('q')?.trim() ?? '';
          res.setHeader('Content-Type', 'application/json');
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
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), mediaDevProxy()],
});
