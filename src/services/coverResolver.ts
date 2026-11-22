import { ContainerNode } from '../engine/types';
import { searchOnlineMedia } from './onlineSearch';

export interface ResolvedCover {
  coverUrl: string;
  hqCoverUrl?: string;
  fallbackCoverUrl?: string;
}

const COVER_CACHE_KEY = 'shelfie_covers_v1';

const QUERY_OVERRIDES: Record<string, { search: string; wiki?: string }> = {
  'batman-court-of-owls-tpb': {
    search: 'Batman The Court of Owls',
    wiki: 'Batman:_The_Court_of_Owls',
  },
  'batman-city-of-owls-tpb': {
    search: 'Batman The City of Owls',
    wiki: 'Batman:_The_Court_of_Owls',
  },
  'batman-snyder-omnibus-1': {
    search: 'Batman Scott Snyder',
    wiki: 'Batman:_The_Court_of_Owls',
  },
  'night-of-the-owls-event': {
    search: 'Night of the Owls Batman',
    wiki: 'Night_of_the_Owls',
  },
  'lotr-trilogy': {
    search: 'The Lord of the Rings: The Fellowship of the Ring',
    wiki: 'The_Lord_of_the_Rings_(film_series)',
  },
  'dune-saga': {
    search: 'Dune: Part Two',
    wiki: 'Dune_(2021_film)',
  },
  'spider-verse-saga': {
    search: 'Spider-Man: Across the Spider-Verse',
    wiki: 'Spider-Man:_Across_the_Spider-Verse',
  },
  'severance-s2': {
    search: 'Severance',
    wiki: 'Severance_(TV_series)',
  },
  'aot-final-cour-1': {
    search: 'Attack on Titan Final Season',
    wiki: 'Attack_on_Titan_(TV_series)',
  },
  'aot-complete-final': {
    search: 'Attack on Titan Final Season',
    wiki: 'Attack_on_Titan_(TV_series)',
  },
  'chainsaw-man-saga': {
    search: 'Chainsaw Man',
    wiki: 'Chainsaw_Man',
  },
  'chainsaw-man-vol-1': {
    search: 'Chainsaw Man',
    wiki: 'Chainsaw_Man',
  },
  'chainsaw-man-vol-2': {
    search: 'Chainsaw Man',
    wiki: 'Chainsaw_Man',
  },
  'alan-wake-2': {
    search: 'Alan Wake 2',
    wiki: 'Alan_Wake_2',
  },
  'alan-wake-2-complete': {
    search: 'Alan Wake 2',
    wiki: 'Alan_Wake_2',
  },
  'elden-ring': {
    search: 'Elden Ring',
    wiki: 'Elden_Ring',
  },
  'elden-ring-complete': {
    search: 'Elden Ring Shadow of the Erdtree',
    wiki: 'Elden_Ring:_Shadow_of_the_Erdtree',
  },
  'dune-book-1': {
    search: 'Dune Frank Herbert',
    wiki: 'Dune_(novel)',
  },
  'dune-chronicles': {
    search: 'Dune Frank Herbert',
    wiki: 'Dune_(franchise)',
  },
};

export function loadCoverCache(): Record<string, ResolvedCover> {
  try {
    const raw = window.localStorage.getItem(COVER_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ResolvedCover>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCoverCache(cache: Record<string, ResolvedCover>): void {
  try {
    window.localStorage.setItem(COVER_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota errors
  }
}

function cleanTitleForSearch(container: ContainerNode): string {
  const override = QUERY_OVERRIDES[container.id];
  if (override) return override.search;

  return container.title
    .split('·')[0]
    .replace(/\(Novel\)/gi, '')
    .replace(/\b(Trilogy|Film Collection|Deluxe Edition|Complete Edition|Season \d+)\b/gi, '')
    .trim();
}

async function fetchWikipediaSummaryCover(
  wikiTitle: string,
  signal?: AbortSignal
): Promise<ResolvedCover | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`,
      { signal }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
    };

    const coverUrl = data.thumbnail?.source ?? data.originalimage?.source;
    if (!coverUrl) return null;

    return {
      coverUrl,
      hqCoverUrl: data.originalimage?.source ?? coverUrl,
      fallbackCoverUrl: data.thumbnail?.source,
    };
  } catch {
    return null;
  }
}

export async function resolveCoverForContainer(
  container: ContainerNode,
  signal?: AbortSignal
): Promise<ResolvedCover | null> {
  const query = cleanTitleForSearch(container);

  if (query.length >= 2) {
    try {
      const results = await searchOnlineMedia(query, container.medium, signal);
      const match = results.find((r) => Boolean(r.coverUrl));
      if (match && match.coverUrl) {
        return {
          coverUrl: match.coverUrl,
          hqCoverUrl: match.hqCoverUrl ?? match.coverUrl,
          fallbackCoverUrl: match.fallbackCoverUrl,
        };
      }
    } catch {
      // Fall through to Wikipedia fallback
    }
  }

  if (signal?.aborted) return null;

  const wikiTarget =
    QUERY_OVERRIDES[container.id]?.wiki ?? query.replace(/\s+/g, '_');
  return fetchWikipediaSummaryCover(wikiTarget, signal);
}
