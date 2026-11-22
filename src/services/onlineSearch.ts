import { Medium, Pillar } from '../engine/types';

export type OnlineSearchCategory =
  | 'all'
  | 'movie'
  | 'tv'
  | 'anime'
  | 'manga'
  | 'comic'
  | 'book'
  | 'game';

export interface OnlineSearchResult {
  id: string;
  title: string;
  subtitle: string;
  medium: Medium;
  pillar: Pillar;
  kindLabel: string;
  year?: string;
  creator?: string;
  coverUrl?: string;
  hqCoverUrl?: string;
  fallbackCoverUrl?: string;
  suggestedUnitCount: number;
  unitPrefix: string;
  unitPlural: string;
  externalSource: 'tvmaze' | 'anilist' | 'imdb' | 'itunes' | 'openlibrary' | 'steam' | 'wikipedia';
  externalId: string | number;
  description?: string;
}

export interface TvSeasonGroup {
  seasonNumber: number;
  episodes: {
    id: number;
    number: number;
    name: string;
    runtime: number | null;
  }[];
}

export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[™®©:'’"!?.,\-–—/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isGoodTitleMatch(query: string, candidate: string): boolean {
  const normQ = normalizeTitle(query);
  const normC = normalizeTitle(candidate);
  if (!normQ || !normC) return false;
  if (normC === normQ || normC.startsWith(`${normQ} `) || normC.includes(normQ)) {
    return true;
  }

  const qTokens = normQ.split(' ').filter((t) => t.length > 0);
  const cTokens = new Set(normC.split(' ').filter((t) => t.length > 0));
  if (qTokens.length === 0) return false;

  const matched = qTokens.filter((t) => cTokens.has(t)).length;
  if (qTokens.length <= 2) {
    return matched === qTokens.length;
  }
  return matched / qTokens.length >= 0.65;
}

function stripHtml(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return cleaned || undefined;
}

async function searchTvMaze(
  query: string,
  signal?: AbortSignal
): Promise<OnlineSearchResult[]> {
  const res = await fetch(
    `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`,
    { signal }
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    show: {
      id: number;
      name: string;
      premiered?: string | null;
      network?: { name: string } | null;
      webChannel?: { name: string } | null;
      image?: { medium?: string; original?: string } | null;
      summary?: string | null;
    };
  }[];

  return data.slice(0, 5).map(({ show }) => {
    const year = show.premiered ? show.premiered.slice(0, 4) : undefined;
    const creator = show.network?.name ?? show.webChannel?.name ?? undefined;
    return {
      id: `tvmaze-${show.id}`,
      title: show.name,
      subtitle: [creator, year].filter(Boolean).join(' · ') || 'TV Series',
      medium: 'tv',
      pillar: 'watch',
      kindLabel: 'TV Series',
      year,
      creator,
      coverUrl: show.image?.medium ?? show.image?.original ?? undefined,
      hqCoverUrl: show.image?.original ?? show.image?.medium ?? undefined,
      fallbackCoverUrl: show.image?.medium ?? undefined,
      suggestedUnitCount: 10,
      unitPrefix: 'Ep. ',
      unitPlural: 'eps',
      externalSource: 'tvmaze',
      externalId: show.id,
      description: stripHtml(show.summary),
    };
  });
}

async function searchAniList(
  query: string,
  category: OnlineSearchCategory,
  signal?: AbortSignal
): Promise<OnlineSearchResult[]> {
  const typeFilter =
    category === 'anime' ? 'ANIME' : category === 'manga' ? 'MANGA' : undefined;

  const gql = `
    query ($search: String, $type: MediaType) {
      Page(page: 1, perPage: 6) {
        media(search: $search, type: $type, sort: POPULARITY_DESC, isAdult: false) {
          id
          type
          format
          episodes
          chapters
          volumes
          startDate { year }
          title { english romaji }
          coverImage { extraLarge large medium }
          studios(isMain: true) { nodes { name } }
          description(asHtml: false)
        }
      }
    }
  `;

  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: gql,
      variables: {
        search: query,
        ...(typeFilter ? { type: typeFilter } : {}),
      },
    }),
    signal,
  });

  if (!res.ok) return [];

  const json = (await res.json()) as {
    data?: {
      Page?: {
        media?: {
          id: number;
          type: 'ANIME' | 'MANGA';
          format?: string | null;
          episodes?: number | null;
          chapters?: number | null;
          volumes?: number | null;
          startDate?: { year?: number | null } | null;
          title: { english?: string | null; romaji?: string | null };
          coverImage?: { extraLarge?: string | null; large?: string | null; medium?: string | null } | null;
          studios?: { nodes?: { name: string }[] } | null;
          description?: string | null;
        }[];
      };
    };
  };

  const list = json.data?.Page?.media ?? [];
  return list.map((item) => {
    const isAnime = item.type === 'ANIME';
    const title = item.title.english || item.title.romaji || 'Untitled';
    const year = item.startDate?.year ? String(item.startDate.year) : undefined;
    const studio = item.studios?.nodes?.[0]?.name;
    const unitCount = isAnime
      ? item.episodes && item.episodes > 0
        ? Math.min(item.episodes, 2000)
        : 12
      : item.chapters && item.chapters > 0
        ? Math.min(item.chapters, 2000)
        : 12;

    return {
      id: `anilist-${item.id}`,
      title,
      subtitle: isAnime
        ? `${item.episodes ? `${item.episodes} eps` : 'Anime'}${year ? ` · ${year}` : ''}`
        : `${item.chapters ? `${item.chapters} ch` : item.volumes ? `${item.volumes} vols` : 'Manga'}${year ? ` · ${year}` : ''}`,
      medium: isAnime ? 'anime' : 'manga',
      pillar: isAnime ? 'watch' : 'read',
      kindLabel: isAnime ? 'Anime' : 'Manga',
      year,
      creator: studio,
      coverUrl: item.coverImage?.large ?? item.coverImage?.extraLarge ?? item.coverImage?.medium ?? undefined,
      hqCoverUrl: item.coverImage?.extraLarge ?? item.coverImage?.large ?? item.coverImage?.medium ?? undefined,
      fallbackCoverUrl: item.coverImage?.medium ?? undefined,
      suggestedUnitCount: unitCount,
      unitPrefix: isAnime ? 'Ep. ' : 'Ch. ',
      unitPlural: isAnime ? 'eps' : 'ch',
      externalSource: 'anilist',
      externalId: item.id,
      description: stripHtml(item.description),
    };
  });
}

interface MediaProxyResponse {
  items?: {
    id: string | number;
    title: string;
    creator?: string;
    year?: string;
    coverUrl?: string;
    hqCoverUrl?: string;
    fallbackCoverUrl?: string;
    description?: string;
    source: 'imdb' | 'itunes' | 'steam' | 'wikipedia';
  }[];
}

async function searchMovies(
  query: string,
  signal?: AbortSignal
): Promise<OnlineSearchResult[]> {
  const res = await fetch(
    `/api/media?type=movie&q=${encodeURIComponent(query)}`,
    { signal }
  );
  if (!res.ok) return [];

  const data = (await res.json()) as MediaProxyResponse;
  return (data.items ?? []).map((movie) => ({
    id: `${movie.source}-${movie.id}`,
    title: movie.title,
    subtitle: [movie.creator, movie.year].filter(Boolean).join(' · ') || 'Movie',
    medium: 'movie',
    pillar: 'watch',
    kindLabel: 'Movie',
    year: movie.year,
    creator: movie.creator,
    coverUrl: movie.coverUrl,
    hqCoverUrl: movie.hqCoverUrl,
    fallbackCoverUrl: movie.fallbackCoverUrl,
    suggestedUnitCount: 1,
    unitPrefix: 'Part ',
    unitPlural: 'film',
    externalSource: movie.source === 'itunes' ? 'itunes' : 'imdb',
    externalId: movie.id,
    description: movie.description,
  }));
}

async function searchOpenLibrary(
  query: string,
  preferComic: boolean,
  signal?: AbortSignal
): Promise<OnlineSearchResult[]> {
  const searchTerm = preferComic ? `${query} comics` : query;
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(
      searchTerm
    )}&limit=6&fields=key,title,author_name,first_publish_year,cover_i,subject`,
    { signal }
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    docs?: {
      key: string;
      title: string;
      author_name?: string[];
      first_publish_year?: number;
      cover_i?: number;
      subject?: string[];
    }[];
  };

  return (data.docs ?? []).map((doc) => {
    const subjects = (doc.subject ?? []).join(' ').toLowerCase();
    const isComic =
      preferComic ||
      subjects.includes('comic') ||
      subjects.includes('graphic novel');
    const creator = doc.author_name?.[0];
    const year = doc.first_publish_year ? String(doc.first_publish_year) : undefined;
    const coverUrl = doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg?default=false`
      : undefined;
    const hqCoverUrl = doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg?default=false`
      : undefined;

    return {
      id: `ol-${doc.key.replace(/\//g, '_')}`,
      title: doc.title,
      subtitle: [creator, year].filter(Boolean).join(' · ') || (isComic ? 'Comic / Trade' : 'Book'),
      medium: isComic ? 'comic' : 'book',
      pillar: 'read',
      kindLabel: isComic ? 'TPB' : 'Book',
      year,
      creator,
      coverUrl,
      hqCoverUrl,
      fallbackCoverUrl: coverUrl,
      suggestedUnitCount: isComic ? 6 : 3,
      unitPrefix: isComic ? 'Issue #' : 'Part ',
      unitPlural: isComic ? 'issues' : 'parts',
      externalSource: 'openlibrary',
      externalId: doc.key,
    };
  });
}

async function searchGames(
  query: string,
  signal?: AbortSignal
): Promise<OnlineSearchResult[]> {
  const res = await fetch(
    `/api/media?type=game&q=${encodeURIComponent(query)}`,
    { signal }
  );
  if (!res.ok) return [];

  const data = (await res.json()) as MediaProxyResponse;
  return (data.items ?? []).map((game) => ({
    id: `${game.source}-${game.id}`,
    title: game.title,
    subtitle:
      [game.creator, game.year].filter(Boolean).join(' · ') ||
      (game.source === 'steam' ? 'PC / Steam · Chapters or Milestones' : 'Video Game · Chapters or Milestones'),
    medium: 'game',
    pillar: 'play',
    kindLabel: 'Game',
    year: game.year,
    creator: game.creator,
    coverUrl: game.coverUrl,
    hqCoverUrl: game.hqCoverUrl,
    fallbackCoverUrl: game.fallbackCoverUrl,
    suggestedUnitCount: 8,
    unitPrefix: 'Chapter ',
    unitPlural: 'chapters',
    externalSource: game.source === 'wikipedia' ? 'wikipedia' : 'steam',
    externalId: game.id,
    description: game.description,
  }));
}

function scoreResult(item: OnlineSearchResult, query: string): number {
  const queryLower = normalizeTitle(query);
  const titleLower = normalizeTitle(item.title);
  let score = 0;
  if (titleLower === queryLower) score += 120;
  else if (titleLower.startsWith(`${queryLower} `)) score += 75;
  else if (titleLower.includes(queryLower)) score += 45;
  else if (isGoodTitleMatch(query, item.title)) score += 30;
  if (item.coverUrl) score += 15;
  return score;
}

export async function searchOnlineMedia(
  query: string,
  category: OnlineSearchCategory = 'all',
  signal?: AbortSignal
): Promise<OnlineSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const tasks: Promise<OnlineSearchResult[]>[] = [];

  if (category === 'all' || category === 'tv') {
    tasks.push(searchTvMaze(trimmed, signal));
  }
  if (category === 'all' || category === 'anime' || category === 'manga') {
    tasks.push(searchAniList(trimmed, category, signal));
  }
  if (category === 'all' || category === 'movie') {
    tasks.push(searchMovies(trimmed, signal));
  }
  if (category === 'all' || category === 'book' || category === 'comic') {
    tasks.push(searchOpenLibrary(trimmed, category === 'comic', signal));
  }
  if (category === 'all' || category === 'game') {
    tasks.push(searchGames(trimmed, signal));
  }

  const settled = await Promise.allSettled(tasks);
  if (signal?.aborted) return [];

  const combined: OnlineSearchResult[] = [];
  const seen = new Set<string>();

  for (const result of settled) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value) {
      const dedupeKey = `${item.medium}::${normalizeTitle(item.title)}::${item.year ?? ''}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      combined.push(item);
    }
  }

  combined.sort((a, b) => scoreResult(b, trimmed) - scoreResult(a, trimmed));

  return combined.slice(0, 16);
}

export async function fetchTvMazeSeasonsAndEpisodes(
  showId: number | string,
  signal?: AbortSignal
): Promise<TvSeasonGroup[]> {
  const res = await fetch(
    `https://api.tvmaze.com/shows/${encodeURIComponent(String(showId))}/episodes`,
    { signal }
  );
  if (!res.ok) return [];

  const raw = (await res.json()) as {
    id: number;
    season: number;
    number: number | null;
    name: string;
    runtime: number | null;
  }[];

  const bySeason = new Map<number, TvSeasonGroup['episodes']>();
  for (const ep of raw) {
    if (!ep.season || ep.number == null) continue;
    const list = bySeason.get(ep.season) ?? [];
    list.push({
      id: ep.id,
      number: ep.number,
      name: ep.name,
      runtime: ep.runtime,
    });
    bySeason.set(ep.season, list);
  }

  return Array.from(bySeason.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([seasonNumber, episodes]) => ({
      seasonNumber,
      episodes: episodes.sort((a, b) => a.number - b.number),
    }));
}
