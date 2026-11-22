export interface MediaProxyItem {
  id: string | number;
  title: string;
  creator?: string;
  year?: string;
  coverUrl?: string;
  hqCoverUrl?: string;
  fallbackCoverUrl?: string;
  description?: string;
  source: 'imdb' | 'itunes' | 'steam' | 'wikipedia';
}

interface ImdbSuggestionItem {
  id?: string;
  l?: string;
  qid?: string;
  y?: number;
  s?: string;
  i?: {
    imageUrl?: string;
  };
}

interface ImdbSuggestionResponse {
  d?: ImdbSuggestionItem[];
}

interface ItunesSearchItem {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
  shortDescription?: string;
  longDescription?: string;
  kind?: string;
}

interface ItunesSearchResponse {
  results?: ItunesSearchItem[];
}

interface SteamStoreItem {
  id: number;
  name: string;
}

interface SteamStoreResponse {
  items?: SteamStoreItem[];
}

interface WikiSearchResponse {
  query?: {
    search?: { title: string }[];
  };
}

interface WikiSummaryResponse {
  title?: string;
  description?: string;
  extract?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
}

const WIKI_HEADERS = {
  'User-Agent': 'ShelfieApp/1.0 (https://shelfie-app-iota.vercel.app)',
  Accept: 'application/json',
};

function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[™®©:'’"!?.,\-–—/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTokens(value: string): string[] {
  return normalizeMatchText(value)
    .split(' ')
    .filter((t) => t.length > 0);
}

function hasCloseTitleMatch(query: string, candidate: string): boolean {
  const normQ = normalizeMatchText(query);
  const normC = normalizeMatchText(candidate);
  if (!normQ || !normC) return false;
  if (normC === normQ || normC.startsWith(`${normQ} `) || normC.includes(normQ)) {
    return true;
  }

  const qTokens = getTokens(query);
  const cTokens = getTokens(candidate);
  if (qTokens.length < 2 || cTokens.length < qTokens.length) return false;

  // Require query tokens to appear in order within a tight window
  let qIdx = 0;
  let firstMatch = -1;
  let lastMatch = -1;
  for (let i = 0; i < cTokens.length && qIdx < qTokens.length; i += 1) {
    if (cTokens[i] === qTokens[qIdx]) {
      if (firstMatch === -1) firstMatch = i;
      lastMatch = i;
      qIdx += 1;
    }
  }
  return qIdx === qTokens.length && lastMatch - firstMatch <= qTokens.length + 2;
}

async function isValidImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type') ?? '';
    return contentType.startsWith('image/');
  } catch {
    return false;
  }
}

async function searchMovies(query: string): Promise<MediaProxyItem[]> {
  try {
    const imdbUrl = `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(
      query
    )}.json`;
    const imdbRes = await fetch(imdbUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4500),
    });

    if (imdbRes.ok) {
      const data = (await imdbRes.json()) as ImdbSuggestionResponse;
      const movies = (data.d ?? [])
        .filter(
          (item): item is ImdbSuggestionItem & { id: string; l: string } =>
            Boolean(item.id && item.l && (item.qid === 'movie' || item.qid === 'tvMovie'))
        )
        .slice(0, 8);

      if (movies.length > 0) {
        return movies.map((movie) => {
          const origImg = movie.i?.imageUrl;
          const thumbImg = origImg
            ? origImg.replace(/\._V1_\./, '._V1_UX400_.')
            : undefined;
          return {
            id: movie.id,
            title: movie.l,
            creator: movie.s || undefined,
            year: movie.y ? String(movie.y) : undefined,
            coverUrl: thumbImg,
            hqCoverUrl: origImg,
            fallbackCoverUrl: origImg,
            source: 'imdb',
          };
        });
      }
    }
  } catch {
    // Fall through to iTunes fallback
  }

  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
      query
    )}&country=US&limit=12`;
    const itunesRes = await fetch(itunesUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4500),
    });
    if (!itunesRes.ok) return [];

    const data = (await itunesRes.json()) as ItunesSearchResponse;
    return (data.results ?? [])
      .filter((item) => item.kind === 'feature-movie' && item.trackId && item.trackName)
      .slice(0, 8)
      .map((movie) => ({
        id: movie.trackId as number,
        title: movie.trackName as string,
        creator: movie.artistName || undefined,
        year: movie.releaseDate ? movie.releaseDate.slice(0, 4) : undefined,
        coverUrl: movie.artworkUrl100
          ? movie.artworkUrl100.replace('100x100bb', '600x600bb')
          : undefined,
        hqCoverUrl: movie.artworkUrl100
          ? movie.artworkUrl100.replace('100x100bb', '1200x1200bb')
          : undefined,
        fallbackCoverUrl: movie.artworkUrl100 || undefined,
        description: movie.shortDescription || movie.longDescription || undefined,
        source: 'itunes',
      }));
  } catch {
    return [];
  }
}

async function searchWikipediaGames(query: string): Promise<MediaProxyItem[]> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      `${query} video game`
    )}&srlimit=3&format=json`;
    const searchRes = await fetch(searchUrl, {
      headers: WIKI_HEADERS,
      signal: AbortSignal.timeout(4000),
    });
    if (!searchRes.ok) return [];

    const searchData = (await searchRes.json()) as WikiSearchResponse;
    const titles = (searchData.query?.search ?? []).map((s) => s.title).slice(0, 3);
    if (titles.length === 0) return [];

    const summaries = await Promise.all(
      titles.map(async (rawTitle) => {
        try {
          const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
            rawTitle.replace(/ /g, '_')
          )}`;
          const res = await fetch(sumUrl, {
            headers: WIKI_HEADERS,
            signal: AbortSignal.timeout(3500),
          });
          if (!res.ok) return null;
          return (await res.json()) as WikiSummaryResponse;
        } catch {
          return null;
        }
      })
    );

    const results: MediaProxyItem[] = [];
    for (const summary of summaries) {
      if (!summary?.title) continue;
      const combinedInfo = `${summary.description ?? ''} ${summary.extract ?? ''}`;
      if (
        !/\b(video game|game|rpg|action-adventure|survival horror|shooter|platformer)\b/i.test(
          combinedInfo
        )
      ) {
        continue;
      }

      const cleanTitle = summary.title
        .replace(/\s*\([^)]*game[^)]*\)\s*$/i, '')
        .trim();
      const yearMatch = combinedInfo.match(/\b(19[7-9]\d|20[0-3]\d)\b/);
      const coverUrl = summary.thumbnail?.source ?? summary.originalimage?.source;
      const hqCoverUrl = summary.originalimage?.source ?? coverUrl;

      results.push({
        id: `wiki-${summary.title.replace(/\s+/g, '_')}`,
        title: cleanTitle,
        creator: summary.description || undefined,
        year: yearMatch ? yearMatch[1] : undefined,
        coverUrl,
        hqCoverUrl,
        fallbackCoverUrl: summary.thumbnail?.source,
        description: summary.extract || undefined,
        source: 'wikipedia',
      });
    }

    return results;
  } catch {
    return [];
  }
}

async function searchGames(query: string): Promise<MediaProxyItem[]> {
  let steamRawItems: SteamStoreItem[] = [];
  try {
    const steamUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
      query
    )}&l=english&cc=US`;
    const steamRes = await fetch(steamUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (steamRes.ok) {
      const data = (await steamRes.json()) as SteamStoreResponse;
      steamRawItems = (data.items ?? []).slice(0, 6);
    }
  } catch {
    steamRawItems = [];
  }

  const hasCloseSteam = steamRawItems.some((item) =>
    hasCloseTitleMatch(query, item.name)
  );

  const [steamVerified, wikiItems] = await Promise.all([
    Promise.all(
      steamRawItems.map(async (item): Promise<MediaProxyItem> => {
        const portraitUrl = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${item.id}/library_600x900.jpg`;
        const hqPortraitUrl = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${item.id}/library_600x900_2x.jpg`;
        const headerUrl = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${item.id}/header.jpg`;

        const portraitOk = await isValidImageUrl(portraitUrl);
        if (portraitOk) {
          return {
            id: item.id,
            title: item.name,
            coverUrl: portraitUrl,
            hqCoverUrl: hqPortraitUrl,
            fallbackCoverUrl: headerUrl,
            source: 'steam',
          };
        }

        const headerOk = await isValidImageUrl(headerUrl);
        return {
          id: item.id,
          title: item.name,
          coverUrl: headerOk ? headerUrl : undefined,
          hqCoverUrl: headerOk ? headerUrl : undefined,
          source: 'steam',
        };
      })
    ),
    hasCloseSteam ? Promise.resolve([]) : searchWikipediaGames(query),
  ]);

  const closeWiki = wikiItems.some((item) => hasCloseTitleMatch(query, item.title));
  if (closeWiki) {
    const relevantSteam = steamVerified.filter((item) =>
      hasCloseTitleMatch(query, item.title)
    );
    return [...wikiItems, ...relevantSteam].slice(0, 8);
  }

  return [...steamVerified, ...wikiItems].slice(0, 8);
}

export async function handleMediaSearch(
  type: 'movie' | 'game',
  q: string
): Promise<{ items: MediaProxyItem[] }> {
  const trimmed = q.trim();
  if (!trimmed) {
    return { items: [] };
  }
  const items =
    type === 'movie' ? await searchMovies(trimmed) : await searchGames(trimmed);
  return { items };
}

export default async function handler(
  req: { query?: Record<string, string | string[] | undefined> },
  res: {
    status: (code: number) => { json: (body: unknown) => void };
    setHeader: (name: string, value: string) => void;
  }
) {
  const rawType = req.query?.type;
  const rawQ = req.query?.q;
  const typeParam = Array.isArray(rawType) ? rawType[0] : rawType;
  const q = Array.isArray(rawQ) ? rawQ[0] : rawQ;

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if ((typeParam !== 'movie' && typeParam !== 'game') || !q || !q.trim()) {
    res.status(200).json({ items: [] });
    return;
  }

  try {
    const payload = await handleMediaSearch(typeParam, q);
    res.status(200).json(payload);
  } catch {
    res.status(200).json({ items: [] });
  }
}
