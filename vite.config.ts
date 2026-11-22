import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function steamDevProxy(): Plugin {
  return {
    name: 'steam-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/steam', async (req, res) => {
        try {
          const reqUrl = (req as { url?: string }).url ?? '';
          const urlObj = new URL(reqUrl, 'http://localhost');
          const q = urlObj.searchParams.get('q')?.trim() ?? '';
          res.setHeader('Content-Type', 'application/json');
          if (!q) {
            res.end(JSON.stringify({ items: [] }));
            return;
          }
          const upstream = await fetch(
            `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
              q
            )}&l=english&cc=US`
          );
          if (!upstream.ok) {
            res.end(JSON.stringify({ items: [] }));
            return;
          }
          const data = (await upstream.json()) as {
            items?: { id: number; name: string; tiny_image?: string }[];
          };
          const items = (data.items ?? []).slice(0, 6).map((item) => ({
            id: item.id,
            name: item.name,
            coverUrl: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${item.id}/library_600x900.jpg`,
            hqCoverUrl: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${item.id}/library_600x900_2x.jpg`,
            fallbackUrl: item.tiny_image ?? '',
          }));
          res.end(JSON.stringify({ items }));
        } catch {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ items: [] }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), steamDevProxy()],
});
