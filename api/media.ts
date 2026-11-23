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
  rank?: number;
  i?: {
    imageUrl?: string;
    width?: number;
    height?: number;
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
      const seenMovies = new Set<string>();
      const movies: (ImdbSuggestionItem & { id: string; l: string })[] = [];

      for (const item of data.d ?? []) {
        if (!item.id || !item.l) continue;
        const isStandardMovie = item.qid === 'movie' || item.qid === 'tvMovie';
        const isNotableVideoMovie =
          item.qid === 'video' &&
          hasCloseTitleMatch(query, item.l) &&
          Boolean(item.i?.imageUrl) &&
          (item.rank ?? Infinity) < 100000 &&
          (!item.i?.width || !item.i?.height || item.i.height > item.i.width);

        if (!isStandardMovie && !isNotableVideoMovie) continue;

        const dedupeKey = `${normalizeMatchText(item.l)}::${item.y ?? ''}`;
        if (seenMovies.has(dedupeKey)) continue;
        seenMovies.add(dedupeKey);
        movies.push(item as ImdbSuggestionItem & { id: string; l: string });
        if (movies.length >= 8) break;
      }

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
      if (!hasCloseTitleMatch(query, cleanTitle)) {
        continue;
      }
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

export interface ComicUnitSpec {
  title: string;
  subtitle?: string;
  unitNumber: number;
  canonicalKey: string;
}

export interface DcCompactCatalogEntry {
  sectionTitle: string;
  title: string;
  linkTarget?: string;
  year?: string;
  pages?: number;
  isbn?: string;
  issueCount: number;
  units: ComicUnitSpec[];
  summary: string;
}

export interface ComicEditionMetaResponse {
  seriesIssueCount?: number;
  seriesUnits?: ComicUnitSpec[];
  compact?: {
    title: string;
    year?: string;
    pages?: number;
    isbn?: string;
    coverUrl?: string;
    hqCoverUrl?: string;
    issueCount: number;
    units: ComicUnitSpec[];
    summary: string;
  } | null;
}

const PRH_PLACEHOLDER_BYTES = 13721;

const WORD_ISSUE_COUNTS: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  'twenty-one': 21,
  'twenty-two': 22,
  'twenty-three': 23,
  'twenty-four': 24,
};

function cleanWikiMarkup(raw: string): string {
  return raw
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''''|'''|''/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u2013|\u2014/g, '–');
}

function slugifySeries(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parseCollectedIssuesWikitext(rawCell: string): {
  units: ComicUnitSpec[];
  summary: string;
} {
  const MAX_UNITS = 120;
  const cleaned = cleanWikiMarkup(rawCell);
  const rawLines = cleaned
    .split(/\r?\n/)
    .map((line) => line.replace(/^\*+\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const units: ComicUnitSpec[] = [];
  const summaryParts: string[] = [];

  for (const line of rawLines) {
    summaryParts.push(line);
    if (units.length >= MAX_UNITS) continue;

    if (!line.includes('#')) {
      units.push({
        title: line,
        unitNumber: units.length + 1,
        canonicalKey: slugifySeries(line) || `story-${units.length + 1}`,
      });
      continue;
    }

    // Rejoin commas inside series names when the segment before ',' contains no '#'
    const rawParts = line.split(',').map((p) => p.trim()).filter(Boolean);
    const clauses: string[] = [];
    for (const part of rawParts) {
      if (clauses.length > 0 && !clauses[clauses.length - 1].includes('#')) {
        clauses[clauses.length - 1] = `${clauses[clauses.length - 1]}, ${part}`;
      } else {
        clauses.push(part);
      }
    }

    let currentBaseSeries = '';

    for (const clause of clauses) {
      if (units.length >= MAX_UNITS) break;
      const hashIdx = clause.indexOf('#');
      if (hashIdx === -1) continue;

      const rawPrefix = clause.slice(0, hashIdx).trim();
      const issueExpr = clause.slice(hashIdx + 1).trim();

      let seriesName = currentBaseSeries;
      if (rawPrefix) {
        if (
          currentBaseSeries &&
          /^(?:annual|special|secret files|giant[- ]size|holiday special)/i.test(
            rawPrefix
          )
        ) {
          seriesName = `${currentBaseSeries} ${rawPrefix}`;
        } else {
          seriesName = rawPrefix;
          currentBaseSeries = rawPrefix;
        }
      }

      if (!seriesName) continue;
      const slug = slugifySeries(seriesName) || 'comic';

      const rangeMatch = issueExpr.match(/^(\d+)\s*[–\-−—]\s*(\d+)/);
      if (rangeMatch) {
        const startNum = Number(rangeMatch[1]);
        const endNum = Number(rangeMatch[2]);
        if (
          Number.isFinite(startNum) &&
          Number.isFinite(endNum) &&
          endNum >= startNum &&
          endNum - startNum <= 120
        ) {
          for (let n = startNum; n <= endNum && units.length < MAX_UNITS; n += 1) {
            units.push({
              title: `${seriesName} #${n}`,
              subtitle: seriesName,
              unitNumber: n,
              canonicalKey: `${slug}:${n}`,
            });
          }
          continue;
        }
      }

      const singleMatch = issueExpr.match(/^(\d+)/);
      if (singleMatch) {
        const num = Number(singleMatch[1]);
        if (Number.isFinite(num)) {
          units.push({
            title: `${seriesName} #${num}`,
            subtitle: seriesName,
            unitNumber: num,
            canonicalKey: `${slug}:${num}`,
          });
        }
      }
    }
  }

  let summary = summaryParts.join(', ');
  if (summary.length > 110) {
    summary = `${summary.slice(0, 107).trimEnd()}…`;
  }

  return { units, summary };
}

export function parseDcCompactCatalogWikitext(
  wikitext: string
): DcCompactCatalogEntry[] {
  const entries: DcCompactCatalogEntry[] = [];
  const sectionBlocks = wikitext.split(/\n===\s*([^=\n]+?)\s*===\r?\n/);

  for (let i = 1; i < sectionBlocks.length; i += 2) {
    const sectionTitle = cleanWikiMarkup(sectionBlocks[i]).trim();
    const sectionBody = sectionBlocks[i + 1] ?? '';
    const rawRows = sectionBody.split(/\n\|-/).slice(1);

    for (const rawRow of rawRows) {
      if (!rawRow.includes('\n|')) continue;
      const cells = rawRow
        .split(/\r?\n\|(?![-}])/)
        .slice(1)
        .map((c) => c.trim());
      if (cells.length < 3) continue;

      const titleCell = cells[0] ?? '';
      const issuesCell = cells[2] ?? '';
      const pagesCell = cells[6] ?? '';
      const pubDateCell = cells[7] ?? '';
      const isbnCell = cells[8] ?? '';

      const linkMatch = titleCell.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
      const linkTarget = linkMatch ? cleanWikiMarkup(linkMatch[1]).trim() : undefined;
      const title = cleanWikiMarkup(titleCell).trim();
      if (!title) continue;

      const { units, summary } = parseCollectedIssuesWikitext(issuesCell);
      if (units.length === 0) continue;

      const pagesMatch = cleanWikiMarkup(pagesCell).match(/\b(\d{2,4})\b/);
      const pages = pagesMatch ? Number(pagesMatch[1]) : undefined;

      const yearMatch = pubDateCell.match(/\b(20\d{2})\b/);
      const year = yearMatch ? yearMatch[1] : undefined;

      const isbnMatch = isbnCell.match(/(\d[\d-]{8,16}[\dX])/i);
      const isbn = isbnMatch
        ? isbnMatch[1].replace(/[^0-9X]/gi, '').toUpperCase()
        : undefined;

      entries.push({
        sectionTitle,
        title,
        linkTarget,
        year,
        pages,
        isbn,
        issueCount: units.length,
        units,
        summary,
      });
    }
  }

  return entries;
}

const COMPACT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let dcCompactCache: {
  entries: DcCompactCatalogEntry[];
  fetchedAt: number;
} | null = null;

async function getDcCompactCatalog(): Promise<DcCompactCatalogEntry[]> {
  if (
    dcCompactCache &&
    Date.now() - dcCompactCache.fetchedAt < COMPACT_CACHE_TTL_MS
  ) {
    return dcCompactCache.entries;
  }

  try {
    const res = await fetch(
      'https://en.wikipedia.org/w/api.php?action=parse&page=DC_Compact_Comics&prop=wikitext&format=json',
      {
        headers: WIKI_HEADERS,
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return dcCompactCache?.entries ?? [];
    const data = (await res.json()) as {
      parse?: { wikitext?: { '*': string } };
    };
    const wikitext = data.parse?.wikitext?.['*'];
    if (!wikitext) return dcCompactCache?.entries ?? [];
    const entries = parseDcCompactCatalogWikitext(wikitext);
    if (entries.length > 0) {
      dcCompactCache = { entries, fetchedAt: Date.now() };
    }
    return entries;
  } catch {
    return dcCompactCache?.entries ?? [];
  }
}

const SERIES_CACHE_TTL_MS = 60 * 60 * 1000;
const seriesIssueCache = new Map<
  string,
  { count: number; pageTitle: string; fetchedAt: number } | { count: null; fetchedAt: number }
>();

function parseIssueCountFromText(text: string): number | null {
  const numMatch = text.match(
    /\b(\d{1,3}|twenty-four|twenty-three|twenty-two|twenty-one|twenty|nineteen|eighteen|seventeen|sixteen|fifteen|fourteen|thirteen|twelve|eleven|ten|nine|eight|seven|six|five|four|three|two)[- ]issue\b/i
  );
  if (numMatch) {
    const token = numMatch[1].toLowerCase();
    const val = WORD_ISSUE_COUNTS[token] ?? Number(token);
    if (Number.isFinite(val) && val >= 2 && val <= 150) {
      return val;
    }
  }
  return null;
}

async function lookupSeriesIssueCount(
  rawTitle: string
): Promise<{ count: number; pageTitle: string } | null> {
  const cleanTitle = rawTitle.trim();
  const cacheKey = normalizeMatchText(cleanTitle);
  if (!cacheKey) return null;

  const cached = seriesIssueCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < SERIES_CACHE_TTL_MS) {
    return cached.count !== null
      ? { count: cached.count, pageTitle: cached.pageTitle }
      : null;
  }

  const isComicText = (text: string): boolean =>
    /\b(comic|graphic novel|issue|miniseries|maxi-series|limited series|story arc|dc comics|marvel|vertigo|image comics)\b/i.test(
      text
    );

  const fetchSummaryForTitle = async (pageTitle: string): Promise<WikiSummaryResponse | null> => {
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
          pageTitle.replace(/ /g, '_')
        )}`,
        { headers: WIKI_HEADERS, signal: AbortSignal.timeout(3500) }
      );
      if (!res.ok) return null;
      return (await res.json()) as WikiSummaryResponse;
    } catch {
      return null;
    }
  };

  let targetPageTitle: string | null = null;
  let summary = await fetchSummaryForTitle(cleanTitle);

  if (summary?.title && isComicText(`${summary.description ?? ''} ${summary.extract ?? ''}`)) {
    targetPageTitle = summary.title;
  } else {
    try {
      const searchRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          `${cleanTitle} comic book`
        )}&srlimit=2&format=json`,
        { headers: WIKI_HEADERS, signal: AbortSignal.timeout(3500) }
      );
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as WikiSearchResponse;
        const hitTitle = searchData.query?.search?.[0]?.title;
        if (hitTitle) {
          const hitSummary = await fetchSummaryForTitle(hitTitle);
          if (
            hitSummary?.title &&
            hasCloseTitleMatch(
              cleanTitle,
              hitSummary.title.replace(/\s*\([^)]+\)\s*$/, '')
            ) &&
            isComicText(`${hitSummary.description ?? ''} ${hitSummary.extract ?? ''}`)
          ) {
            summary = hitSummary;
            targetPageTitle = hitSummary.title;
          }
        }
      }
    } catch {
      // Ignore search failure
    }
  }

  if (!targetPageTitle || !summary) {
    seriesIssueCache.set(cacheKey, { count: null, fetchedAt: Date.now() });
    return null;
  }

  const fromLead = parseIssueCountFromText(summary.extract ?? '');
  if (fromLead !== null) {
    seriesIssueCache.set(cacheKey, {
      count: fromLead,
      pageTitle: targetPageTitle,
      fetchedAt: Date.now(),
    });
    return { count: fromLead, pageTitle: targetPageTitle };
  }

  try {
    const parseRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
        targetPageTitle
      )}&section=0&prop=wikitext&format=json`,
      { headers: WIKI_HEADERS, signal: AbortSignal.timeout(4000) }
    );
    if (parseRes.ok) {
      const parseData = (await parseRes.json()) as {
        parse?: { wikitext?: { '*': string } };
      };
      const wt = parseData.parse?.wikitext?.['*'] ?? '';
      const infoboxMatch = wt.match(
        /\|\s*(?:issues|issue_count|number_of_issues)\s*=\s*(\d{1,3})\b/i
      );
      const count = infoboxMatch
        ? Number(infoboxMatch[1])
        : parseIssueCountFromText(cleanWikiMarkup(wt));
      if (count !== null && Number.isFinite(count) && count >= 2 && count <= 150) {
        seriesIssueCache.set(cacheKey, {
          count,
          pageTitle: targetPageTitle,
          fetchedAt: Date.now(),
        });
        return { count, pageTitle: targetPageTitle };
      }
    }
  } catch {
    // Ignore parse failure
  }

  seriesIssueCache.set(cacheKey, { count: null, fetchedAt: Date.now() });
  return null;
}

export async function resolveIsbnCover(
  rawIsbn: string
): Promise<{ coverUrl: string; hqCoverUrl: string } | null> {
  const clean = rawIsbn.replace(/[^0-9X]/gi, '').toUpperCase();
  if (clean.length < 10 || clean.length > 13) return null;

  try {
    const olMid = `https://covers.openlibrary.org/b/isbn/${clean}-M.jpg?default=false`;
    const olHead = await fetch(olMid, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    });
    if (olHead.ok) {
      return {
        coverUrl: olMid,
        hqCoverUrl: `https://covers.openlibrary.org/b/isbn/${clean}-L.jpg?default=false`,
      };
    }
  } catch {
    // Fall through to Penguin Random House cover check
  }

  try {
    const prhUrl = `https://images.randomhouse.com/cover/${clean}`;
    const prhRes = await fetch(prhUrl, {
      signal: AbortSignal.timeout(4000),
    });
    if (!prhRes.ok) return null;
    const contentType = prhRes.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return null;
    const buf = await prhRes.arrayBuffer();
    if (buf.byteLength !== PRH_PLACEHOLDER_BYTES && buf.byteLength > 14000) {
      const finalUrl = prhRes.url || prhUrl;
      return { coverUrl: finalUrl, hqCoverUrl: finalUrl };
    }
  } catch {
    // Ignore failed cover probe
  }

  return null;
}

export async function resolveComicMeta(
  title: string,
  isbn?: string
): Promise<ComicEditionMetaResponse> {
  const cleanTitle = title.trim();
  const cleanQueryIsbn = isbn
    ? isbn.replace(/[^0-9X]/gi, '').toUpperCase()
    : undefined;

  const [catalog, seriesInfo] = await Promise.all([
    getDcCompactCatalog(),
    cleanTitle ? lookupSeriesIssueCount(cleanTitle) : Promise.resolve(null),
  ]);

  let matchedCompact: DcCompactCatalogEntry | undefined;

  if (cleanQueryIsbn) {
    matchedCompact = catalog.find((entry) => entry.isbn === cleanQueryIsbn);
  }

  if (!matchedCompact && cleanTitle) {
    const normQuery = normalizeMatchText(cleanTitle);
    matchedCompact =
      catalog.find((entry) => {
        const candidates = [
          entry.linkTarget,
          entry.title,
          `${entry.sectionTitle} ${entry.title}`,
        ]
          .filter((v): v is string => Boolean(v))
          .map(normalizeMatchText);
        return candidates.some((c) => c === normQuery);
      }) ??
      catalog.find((entry) => {
        const candidates = [
          entry.linkTarget,
          entry.title,
          `${entry.sectionTitle} ${entry.title}`,
        ].filter((v): v is string => Boolean(v));
        return candidates.some((c) => {
          const normC = normalizeMatchText(c);
          return (
            normC.length >= 4 &&
            (normQuery.includes(normC) || normC.includes(normQuery))
          );
        });
      });
  }

  let compactCover: { coverUrl: string; hqCoverUrl: string } | null = null;
  if (matchedCompact?.isbn) {
    compactCover = await resolveIsbnCover(matchedCompact.isbn);
  }

  let seriesUnits: ComicUnitSpec[] | undefined;
  if (seriesInfo) {
    const slug = slugifySeries(cleanTitle) || 'comic';
    seriesUnits = Array.from({ length: seriesInfo.count }, (_, idx) => ({
      title: `${cleanTitle} #${idx + 1}`,
      subtitle: `Issue #${idx + 1}`,
      unitNumber: idx + 1,
      canonicalKey: `${slug}:${idx + 1}`,
    }));
  }

  return {
    ...(seriesInfo
      ? {
          seriesIssueCount: seriesInfo.count,
          seriesUnits,
        }
      : {}),
    compact: matchedCompact
      ? {
          title: matchedCompact.title,
          year: matchedCompact.year,
          pages: matchedCompact.pages,
          isbn: matchedCompact.isbn,
          coverUrl: compactCover?.coverUrl,
          hqCoverUrl: compactCover?.hqCoverUrl,
          issueCount: matchedCompact.issueCount,
          units: matchedCompact.units,
          summary: matchedCompact.summary,
        }
      : null,
  };
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
  const rawIsbn = req.query?.isbn;
  const rawTitle = req.query?.title;
  const typeParam = Array.isArray(rawType) ? rawType[0] : rawType;
  const q = Array.isArray(rawQ) ? rawQ[0] : rawQ;
  const isbn = Array.isArray(rawIsbn) ? rawIsbn[0] : rawIsbn;
  const title = Array.isArray(rawTitle) ? rawTitle[0] : rawTitle;

  if (typeParam === 'comic_meta') {
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    if (!title || !title.trim()) {
      res.status(200).json({ compact: null });
      return;
    }
    try {
      const meta = await resolveComicMeta(title, isbn);
      res.status(200).json(meta);
    } catch {
      res.status(200).json({ compact: null });
    }
    return;
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (typeParam === 'cover') {
    if (!isbn || !isbn.trim()) {
      res.status(200).json({ cover: null });
      return;
    }
    try {
      const cover = await resolveIsbnCover(isbn);
      res.status(200).json({ cover });
    } catch {
      res.status(200).json({ cover: null });
    }
    return;
  }

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
