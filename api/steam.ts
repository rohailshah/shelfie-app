interface SteamStoreItem {
  id: number;
  name: string;
  tiny_image?: string;
}

interface SteamStoreResponse {
  items?: SteamStoreItem[];
}

export default async function handler(
  req: { query?: Record<string, string | string[] | undefined> },
  res: {
    status: (code: number) => { json: (body: unknown) => void };
    setHeader: (name: string, value: string) => void;
  }
) {
  const rawQ = req.query?.q;
  const q = Array.isArray(rawQ) ? rawQ[0] : rawQ;

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (!q || !q.trim()) {
    res.status(200).json({ items: [] });
    return;
  }

  try {
    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
      q.trim()
    )}&l=english&cc=US`;

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      res.status(200).json({ items: [] });
      return;
    }

    const data = (await response.json()) as SteamStoreResponse;
    const items = (data.items ?? []).slice(0, 6).map((item) => ({
      id: item.id,
      name: item.name,
      coverUrl: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${item.id}/library_600x900.jpg`,
      fallbackUrl: item.tiny_image ?? '',
    }));

    res.status(200).json({ items });
  } catch {
    res.status(200).json({ items: [] });
  }
}
