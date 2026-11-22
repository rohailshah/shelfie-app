import { ContainerNode } from '../engine/types';
import { isGoodTitleMatch, searchOnlineMedia } from './onlineSearch';

export interface ResolvedCover {
  coverUrl: string;
  hqCoverUrl?: string;
  fallbackCoverUrl?: string;
}

const COVER_CACHE_KEY = 'shelfie_covers_v2';

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
  return container.title
    .split('·')[0]
    .replace(/\([^)]*\)/g, '')
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
      const match = results.find(
        (r) => Boolean(r.coverUrl) && isGoodTitleMatch(query, r.title)
      );
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

  if (signal?.aborted || query.length < 2) return null;

  return fetchWikipediaSummaryCover(query.replace(/\s+/g, '_'), signal);
}
