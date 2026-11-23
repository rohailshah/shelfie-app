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

export interface OpenLibraryDoc {
  key: string;
  title: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  subject?: string[];
  publisher?: string[];
  edition_count?: number;
  number_of_pages_median?: number;
}

export interface OpenLibraryWorkSummary {
  key: string;
  title: string;
  subtitle?: string;
  year?: number;
  coverId?: number;
  publishers?: string[];
  editionCount?: number;
  pages?: number;
}

export interface OpenLibraryRawEdition {
  title?: string;
  subtitle?: string;
  physical_format?: string;
  publishers?: string[];
  publish_date?: string;
  covers?: number[];
  number_of_pages?: number;
  languages?: { key: string }[];
}

export interface ComicEditionOption {
  id: string;
  label: string;
  shortBadge: string;
  description: string;
  coverUrl?: string;
  hqCoverUrl?: string;
  fallbackCoverUrl?: string;
  year?: string;
  suggestedUnitCount?: number;
  startUnit?: number;
  suggestedShelf?: 'owned_digital' | 'owned_physical';
  isVerified?: boolean;
  titleSuffix?: string;
}

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
  externalSource:
    | 'tvmaze'
    | 'anilist'
    | 'imdb'
    | 'itunes'
    | 'openlibrary'
    | 'steam'
    | 'wikipedia';
  externalId: string | number;
  description?: string;
  canonicalWorkKey?: string;
  relatedWorkKeys?: string[];
  relatedDocs?: OpenLibraryWorkSummary[];
  publisher?: string;
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

const UPPER_TOKENS = new Set([
  'DC',
  'USA',
  'UK',
  'FBI',
  'CIA',
  'NYC',
  'LA',
  'TPB',
  'HC',
  'TV',
  'II',
  'III',
  'IV',
  'VI',
  'VII',
  'VIII',
  'IX',
  'XI',
  'XII',
]);

const MINOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'in',
  'nor',
  'of',
  'on',
  'or',
  'per',
  'the',
  'to',
  'vs',
  'via',
  'with',
]);

const COMIC_PUBLISHER_RE =
  /\b(dc comics|d\.c\. comics|dc|marvel|image comics|dark horse|vertigo|idw|boom!?\s*studios?|valiant|dynamite|oni press|wildstorm|top cow|aftershock|titan comics|panini|ecc ediciones|ovni press|planeta de\s*agostini|viz media|kodansha|yen press|seven seas|fantagraphics|drawn\s*&\s*quarterly|first second|humanoids|archie comics)\b/i;

const DC_PUBLISHER_RE = /\b(dc comics|d\.c\. comics|dc|vertigo|wildstorm)\b/i;

const EDITION_SUBTITLE_RE =
  /(\b|\()(edition|compact|deluxe|absolute|omnibus|hardcover|paperback|tpb|trade|collected|complete|compendium|box\s*set|anniversary|special|vol(?:ume)?\.?\s*\d+|book\s*\d+)/i;

const LEADING_EDITION_PREFIX_RE =
  /^(?:the\s+)?(?:absolute|complete|deluxe|omnibus|compendium|ultimate|definitive|essential|showcase\s+presents|dc\s+compact(?:\s+comics)?)\s+/i;

const TRAILING_EDITION_SUFFIX_RE =
  /(?:(?:\s*[-:,(\[]\s*|\s+)(?:vol(?:ume)?\.?\s*0*\d+|v\.?\s*0*\d+|book\s*\d+|part\s*\d+|#\d+(?:\s*[-–]\s*\d+)?|tpb|hc|hardcover|paperback|omnibus|compendium|deluxe(?:\s+edition)?|absolute(?:\s+edition)?|dc\s+compact(?:\s+comics)?(?:\s+edition)?|compact(?:\s+comics)?(?:\s+edition)?|complete(?:\s+edition|\s+collection)?|collector'?s?\s+edition|anniversary\s+edition|edition|box\s*set)[).\]\s]*|\s+0[1-9])$/i;

const COMIC_QUALIFIER_RE =
  /\b(absolute|omnibus|tpb|dc compact|compact comics|compendium|graphic novel)\b/i;

const VOLUME_MATCH_RE = /\bvol(?:ume)?\.?\s*0*(\d+)\b/i;

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

function formatSingleWordSegment(segment: string, forceCap: boolean): string {
  const match = segment.match(/^([("'\[“‘]*)(.+?)([)"'\]”’.,:;!?]*)$/);
  if (!match) return segment;

  const [, lead, core, trail] = match;
  if (!core) return segment;

  const upper = core.toUpperCase();
  if (UPPER_TOKENS.has(upper) || /^[A-Z](?:\.[A-Z])+\.?$/.test(core)) {
    return `${lead}${upper}${trail}`;
  }

  if (/^(?:O'[A-Z]|Mc[A-Z]|i[A-Z])/.test(core)) {
    return `${lead}${core}${trail}`;
  }

  const lower = core.toLowerCase();
  if (!forceCap && MINOR_WORDS.has(lower)) {
    return `${lead}${lower}${trail}`;
  }

  return `${lead}${core.charAt(0).toUpperCase()}${lower.slice(1)}${trail}`;
}

export function formatDisplayTitle(raw: string): string {
  const normalized = raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bvol\.?\s*0*(\d+)\b/gi, (_, num: string) => `Vol. ${Number(num)}`);

  if (!normalized) return '';

  const tokens = normalized.split(' ');
  let afterSeparator = true;

  return tokens
    .map((token, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === tokens.length - 1;
      const forceCap = isFirst || isLast || afterSeparator;

      const segments = token.split('-');
      const formatted = segments
        .map((seg, segIdx) => {
          if (!seg) return seg;
          const segForceCap =
            forceCap || segIdx === segments.length - 1 || segments.length > 1;
          return formatSingleWordSegment(seg, segForceCap);
        })
        .join('-');

      afterSeparator = /[:—–-][)"'\]”’]*$/.test(token);
      return formatted;
    })
    .join(' ');
}

export function isEditionSubtitle(subtitle?: string): boolean {
  if (!subtitle) return false;
  return EDITION_SUBTITLE_RE.test(subtitle);
}

export function extractCanonicalWorkBase(title: string): string {
  let current = title.trim().replace(/\s+/g, ' ');
  if (!current) return '';

  for (let pass = 0; pass < 4; pass += 1) {
    const before = current;

    const withoutPrefix = current.replace(LEADING_EDITION_PREFIX_RE, '').trim();
    if (withoutPrefix.length >= 2) {
      current = withoutPrefix;
    }

    const withoutSuffix = current.replace(TRAILING_EDITION_SUFFIX_RE, '').trim();
    if (withoutSuffix.length >= 2) {
      current = withoutSuffix;
    }

    const withoutDangling = current.replace(/[-:,(\[\s]+$/, '').trim();
    if (withoutDangling.length >= 2) {
      current = withoutDangling;
    }

    if (current === before) break;
  }

  return current;
}

export function isComicPublisher(publishers?: string[]): boolean {
  if (!publishers || publishers.length === 0) return false;
  return publishers.some((pub) => COMIC_PUBLISHER_RE.test(pub));
}

export function isDcPublisher(publisher?: string, publishers?: string[]): boolean {
  if (publisher && DC_PUBLISHER_RE.test(publisher)) return true;
  if (!publishers || publishers.length === 0) return false;
  return publishers.some((pub) => DC_PUBLISHER_RE.test(pub));
}

function buildOpenLibraryCoverUrls(coverId?: number): {
  coverUrl?: string;
  hqCoverUrl?: string;
  fallbackCoverUrl?: string;
} {
  if (!coverId || coverId <= 0) return {};
  const coverUrl = `https://covers.openlibrary.org/b/id/${coverId}-M.jpg?default=false`;
  const hqCoverUrl = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`;
  return {
    coverUrl,
    hqCoverUrl,
    fallbackCoverUrl: coverUrl,
  };
}

function scoreBaseTitleCandidate(rawBase: string, combinedRaw: string): number {
  let score = 0;
  if (rawBase.includes('-')) score += 20;
  if (rawBase.includes(':')) score += 10;
  if (!VOLUME_MATCH_RE.test(combinedRaw) && !COMIC_QUALIFIER_RE.test(combinedRaw)) {
    score += 15;
  }
  if (rawBase === combinedRaw.trim()) score += 5;
  return score;
}

function scoreDocAsPrimary(doc: OpenLibraryDoc): number {
  let score = 0;
  if (doc.cover_i) score += 40;
  if (
    !VOLUME_MATCH_RE.test(doc.title) &&
    !/\s+0[1-9]$/.test(doc.title.trim()) &&
    !COMIC_QUALIFIER_RE.test(doc.title)
  ) {
    score += 20;
  }
  score += Math.min(25, (doc.edition_count ?? 0) * 3);
  if (isComicPublisher(doc.publisher)) score += 10;
  return score;
}

interface MergedOpenLibraryGroup {
  normBase: string;
  normAuthor: string;
  creator?: string;
  docs: OpenLibraryDoc[];
  bestDisplayTitle: string;
  bestTitleScore: number;
}

export function groupOpenLibraryDocs(
  docs: OpenLibraryDoc[],
  preferComic: boolean
): OnlineSearchResult[] {
  const groups: MergedOpenLibraryGroup[] = [];

  for (const doc of docs) {
    const cleanSubtitle =
      doc.subtitle &&
      !isEditionSubtitle(doc.subtitle) &&
      !normalizeTitle(doc.title).includes(normalizeTitle(doc.subtitle))
        ? doc.subtitle.trim()
        : undefined;

    const combinedRaw = cleanSubtitle ? `${doc.title.trim()}: ${cleanSubtitle}` : doc.title.trim();
    const extracted = extractCanonicalWorkBase(combinedRaw);
    const displayCandidate = formatDisplayTitle(extracted || combinedRaw);
    const normBase = normalizeTitle(displayCandidate);
    if (!normBase) continue;

    const creator = doc.author_name?.[0]?.trim();
    const normAuthor = normalizeTitle(creator ?? '');
    const titleScore = scoreBaseTitleCandidate(displayCandidate, combinedRaw);

    let target = groups.find(
      (g) => g.normBase === normBase && g.normAuthor === normAuthor
    );

    if (!target && !normAuthor) {
      target = groups.find((g) => g.normBase === normBase);
    }

    if (!target && normAuthor) {
      target = groups.find((g) => g.normBase === normBase && !g.normAuthor);
      if (target) {
        target.normAuthor = normAuthor;
        target.creator = creator;
      }
    }

    if (!target) {
      groups.push({
        normBase,
        normAuthor,
        creator,
        docs: [doc],
        bestDisplayTitle: displayCandidate,
        bestTitleScore: titleScore,
      });
    } else {
      target.docs.push(doc);
      if (!target.creator && creator) {
        target.creator = creator;
        target.normAuthor = normAuthor;
      }
      if (titleScore > target.bestTitleScore) {
        target.bestTitleScore = titleScore;
        target.bestDisplayTitle = displayCandidate;
      }
    }
  }

  return groups.map((group) => {
    const isComic =
      preferComic ||
      group.docs.some((doc) => {
        const subjects = (doc.subject ?? []).join(' ').toLowerCase();
        return (
          subjects.includes('comic') ||
          subjects.includes('graphic novel') ||
          subjects.includes('superhero') ||
          isComicPublisher(doc.publisher) ||
          COMIC_QUALIFIER_RE.test(`${doc.title} ${doc.subtitle ?? ''}`)
        );
      });

    const years = group.docs
      .map((d) => d.first_publish_year)
      .filter((y): y is number => typeof y === 'number' && y > 0);
    const earliestYear = years.length > 0 ? String(Math.min(...years)) : undefined;

    const allPublishers = group.docs.flatMap((d) => d.publisher ?? []);
    const primaryPublisher =
      allPublishers.find((p) => DC_PUBLISHER_RE.test(p)) ??
      allPublishers.find((p) => COMIC_PUBLISHER_RE.test(p)) ??
      allPublishers[0];

    const sortedDocs = [...group.docs].sort(
      (a, b) => scoreDocAsPrimary(b) - scoreDocAsPrimary(a)
    );
    const primaryDoc = sortedDocs[0];
    const primaryCovers = buildOpenLibraryCoverUrls(primaryDoc.cover_i);

    // Prioritize primary + edition/volume works + recent publisher editions (up to 6)
    const prioritizedForEditions = [...group.docs].sort((a, b) => {
      const aPri =
        (a.key === primaryDoc.key ? 100 : 0) +
        (a.cover_i ? 40 : 0) +
        (VOLUME_MATCH_RE.test(a.title) || COMIC_QUALIFIER_RE.test(a.title) ? 25 : 0) +
        (isComicPublisher(a.publisher) ? 15 : 0) +
        (a.first_publish_year && a.first_publish_year >= 2020 ? 10 : 0);
      const bPri =
        (b.key === primaryDoc.key ? 100 : 0) +
        (b.cover_i ? 40 : 0) +
        (VOLUME_MATCH_RE.test(b.title) || COMIC_QUALIFIER_RE.test(b.title) ? 25 : 0) +
        (isComicPublisher(b.publisher) ? 15 : 0) +
        (b.first_publish_year && b.first_publish_year >= 2020 ? 10 : 0);
      return bPri - aPri;
    });

    const relatedWorkKeys = Array.from(
      new Set(prioritizedForEditions.map((d) => d.key))
    ).slice(0, 6);

    const relatedDocs: OpenLibraryWorkSummary[] = group.docs.map((d) => ({
      key: d.key,
      title: d.title,
      subtitle: d.subtitle,
      year: d.first_publish_year,
      coverId: d.cover_i,
      publishers: d.publisher,
      editionCount: d.edition_count,
      pages: d.number_of_pages_median,
    }));

    const baseSlug = group.normBase.replace(/\s+/g, '-');
    const authorSlug = group.normAuthor ? group.normAuthor.replace(/\s+/g, '-') : 'work';
    const canonicalWorkKey = `ol-${baseSlug}-${authorSlug}`;

    return {
      id: `ol-${primaryDoc.key.replace(/\//g, '_')}`,
      title: group.bestDisplayTitle,
      subtitle:
        [group.creator, earliestYear].filter(Boolean).join(' · ') ||
        (isComic ? 'Comic Run' : 'Book'),
      medium: isComic ? 'comic' : 'book',
      pillar: 'read',
      kindLabel: isComic ? 'Digital' : 'Book',
      year: earliestYear,
      creator: group.creator,
      coverUrl: primaryCovers.coverUrl,
      hqCoverUrl: primaryCovers.hqCoverUrl,
      fallbackCoverUrl: primaryCovers.fallbackCoverUrl,
      suggestedUnitCount: isComic ? 12 : 3,
      unitPrefix: isComic ? 'Issue #' : 'Part ',
      unitPlural: isComic ? 'issues' : 'parts',
      externalSource: 'openlibrary',
      externalId: primaryDoc.key,
      canonicalWorkKey,
      relatedWorkKeys,
      relatedDocs,
      publisher: primaryPublisher,
    };
  });
}

export function getDefaultReadingEditions(
  medium: 'comic' | 'book',
  publisher?: string,
  defaultCoverUrl?: string,
  defaultHqCoverUrl?: string
): ComicEditionOption[] {
  const fallbackCoverUrl = defaultCoverUrl;

  if (medium === 'book') {
    return [
      {
        id: 'digital',
        label: 'Digital / E-Book',
        shortBadge: 'E-Book',
        description: 'Digital reading edition',
        coverUrl: defaultCoverUrl,
        hqCoverUrl: defaultHqCoverUrl,
        fallbackCoverUrl,
        suggestedShelf: 'owned_digital',
      },
      {
        id: 'paperback',
        label: 'Paperback',
        shortBadge: 'Paperback',
        description: 'Standard paperback edition',
        coverUrl: defaultCoverUrl,
        hqCoverUrl: defaultHqCoverUrl,
        fallbackCoverUrl,
        suggestedShelf: 'owned_physical',
      },
      {
        id: 'hardcover',
        label: 'Hardcover',
        shortBadge: 'Hardcover',
        description: 'Hardcover print edition',
        coverUrl: defaultCoverUrl,
        hqCoverUrl: defaultHqCoverUrl,
        fallbackCoverUrl,
        suggestedShelf: 'owned_physical',
      },
      {
        id: 'audiobook',
        label: 'Audiobook',
        shortBadge: 'Audiobook',
        description: 'Narrated audio edition',
        coverUrl: defaultCoverUrl,
        hqCoverUrl: defaultHqCoverUrl,
        fallbackCoverUrl,
        suggestedShelf: 'owned_digital',
      },
    ];
  }

  const isDc = isDcPublisher(publisher);
  return [
    {
      id: 'digital',
      label: 'Digital',
      shortBadge: 'Digital',
      description: 'Single issues · Most common',
      coverUrl: defaultCoverUrl,
      hqCoverUrl: defaultHqCoverUrl,
      fallbackCoverUrl,
      suggestedUnitCount: 12,
      startUnit: 1,
      suggestedShelf: 'owned_digital',
    },
    {
      id: 'tpb',
      label: 'Common TPB',
      shortBadge: 'TPB',
      description: 'Standard trade paperback',
      coverUrl: defaultCoverUrl,
      hqCoverUrl: defaultHqCoverUrl,
      fallbackCoverUrl,
      suggestedUnitCount: 12,
      startUnit: 1,
      suggestedShelf: 'owned_physical',
    },
    {
      id: 'hardcover',
      label: 'Deluxe / Hardcover',
      shortBadge: 'Hardcover',
      description: 'Standard or deluxe hardcover',
      coverUrl: defaultCoverUrl,
      hqCoverUrl: defaultHqCoverUrl,
      fallbackCoverUrl,
      suggestedUnitCount: 12,
      startUnit: 1,
      suggestedShelf: 'owned_physical',
    },
    {
      id: 'absolute',
      label: 'Absolute Hardcover',
      shortBadge: 'Absolute',
      description: 'Oversized slipcase edition',
      coverUrl: defaultCoverUrl,
      hqCoverUrl: defaultHqCoverUrl,
      fallbackCoverUrl,
      suggestedUnitCount: 12,
      startUnit: 1,
      suggestedShelf: 'owned_physical',
    },
    {
      id: 'compact',
      label: isDc ? 'DC Compact TPB' : 'Compact / Pocket TPB',
      shortBadge: isDc ? 'DC Compact' : 'Compact TPB',
      description: isDc ? 'DC Compact Comics paperback' : 'Pocket-size paperback',
      coverUrl: defaultCoverUrl,
      hqCoverUrl: defaultHqCoverUrl,
      fallbackCoverUrl,
      suggestedUnitCount: 12,
      startUnit: 1,
      suggestedShelf: 'owned_physical',
    },
    {
      id: 'omnibus',
      label: 'Omnibus',
      shortBadge: 'Omnibus',
      description: 'Collected omnibus hardcover',
      coverUrl: defaultCoverUrl,
      hqCoverUrl: defaultHqCoverUrl,
      fallbackCoverUrl,
      suggestedUnitCount: 12,
      startUnit: 1,
      suggestedShelf: 'owned_physical',
    },
  ];
}

function extractYearFromDate(value?: string | number): string | undefined {
  if (typeof value === 'number' && value > 1900 && value < 2100) {
    return String(value);
  }
  if (typeof value === 'string') {
    const match = value.match(/\b(19\d{2}|20\d{2})\b/);
    if (match) return match[1];
  }
  return undefined;
}

interface EditionCandidate {
  title: string;
  subtitle: string;
  physicalFormat: string;
  publishers: string[];
  year?: string;
  coverId: number;
  languageScore: number;
}

function scoreLanguageAndPublisher(
  combinedText: string,
  publishers: string[],
  languages?: { key: string }[]
): number {
  let score = 0;
  if (languages && languages.length > 0) {
    const hasEnglish = languages.some((l) => l.key.endsWith('/eng'));
    score += hasEnglish ? 30 : -40;
  }
  if (
    /\b(de bolso|capa dura|edici[oó]n|ediciones|tome|band\s*\d+|integrale)\b/i.test(
      combinedText
    )
  ) {
    score -= 35;
  }
  if (isDcPublisher(undefined, publishers)) {
    score += 25;
  } else if (isComicPublisher(publishers)) {
    score += 15;
  }
  return score;
}

export function buildOpenLibraryEditions(params: {
  medium: 'comic' | 'book';
  publisher?: string;
  defaultCoverUrl?: string;
  defaultHqCoverUrl?: string;
  relatedDocs?: OpenLibraryWorkSummary[];
  rawEditions?: OpenLibraryRawEdition[];
}): ComicEditionOption[] {
  const baseOptions = getDefaultReadingEditions(
    params.medium,
    params.publisher,
    params.defaultCoverUrl,
    params.defaultHqCoverUrl
  );

  const candidates: EditionCandidate[] = [];

  for (const ed of params.rawEditions ?? []) {
    const coverId = (ed.covers ?? []).find((c) => typeof c === 'number' && c > 0);
    if (!coverId) continue;
    const title = (ed.title ?? '').trim();
    const subtitle = (ed.subtitle ?? '').trim();
    const physicalFormat = (ed.physical_format ?? '').trim();
    const publishers = ed.publishers ?? [];
    candidates.push({
      title,
      subtitle,
      physicalFormat,
      publishers,
      year: extractYearFromDate(ed.publish_date),
      coverId,
      languageScore: scoreLanguageAndPublisher(
        `${title} ${subtitle} ${publishers.join(' ')}`,
        publishers,
        ed.languages
      ),
    });
  }

  for (const doc of params.relatedDocs ?? []) {
    if (!doc.coverId || doc.coverId <= 0) continue;
    const publishers = doc.publishers ?? [];
    candidates.push({
      title: doc.title,
      subtitle: doc.subtitle ?? '',
      physicalFormat: '',
      publishers,
      year: extractYearFromDate(doc.year),
      coverId: doc.coverId,
      languageScore: scoreLanguageAndPublisher(
        `${doc.title} ${doc.subtitle ?? ''} ${publishers.join(' ')}`,
        publishers
      ),
    });
  }

  if (candidates.length === 0) {
    return baseOptions;
  }

  const pickBest = (
    slotScorer: (cand: EditionCandidate, text: string) => number
  ): EditionCandidate | null => {
    let best: EditionCandidate | null = null;
    let bestScore = 0;

    for (const cand of candidates) {
      const text = `${cand.title} ${cand.subtitle} ${cand.physicalFormat}`.trim();
      const slotScore = slotScorer(cand, text);
      if (slotScore <= 0) continue;
      const total = slotScore + cand.languageScore;
      if (!best || total > bestScore) {
        best = cand;
        bestScore = total;
      }
    }
    return best;
  };

  const applyCandidate = (
    opt: ComicEditionOption,
    cand: EditionCandidate | null,
    noteText?: string
  ): ComicEditionOption => {
    if (!cand) return opt;
    const covers = buildOpenLibraryCoverUrls(cand.coverId);
    const descParts = [cand.year, noteText].filter(Boolean);
    return {
      ...opt,
      coverUrl: covers.coverUrl ?? opt.coverUrl,
      hqCoverUrl: covers.hqCoverUrl ?? opt.hqCoverUrl,
      fallbackCoverUrl:
        opt.coverUrl && opt.coverUrl !== covers.coverUrl
          ? opt.coverUrl
          : opt.fallbackCoverUrl,
      year: cand.year ?? opt.year,
      description: descParts.length > 0 ? descParts.join(' · ') : opt.description,
      isVerified: true,
    };
  };

  if (params.medium === 'book') {
    const paperback = pickBest((_, text) =>
      /\b(paperback|mass market|trade paperback)\b/i.test(text) ? 60 : 0
    );
    const hardcover = pickBest((_, text) =>
      /\b(hardcover|hardback)\b/i.test(text) ? 60 : 0
    );
    return baseOptions.map((opt) => {
      if (opt.id === 'paperback') {
        return applyCandidate(opt, paperback, 'Paperback edition');
      }
      if (opt.id === 'hardcover') {
        return applyCandidate(opt, hardcover, 'Hardcover edition');
      }
      return opt;
    });
  }

  // Comic edition matching
  const compactMatch = pickBest((_, text) => {
    if (/\b(dc\s+compact|compact\s+comics)\b/i.test(text)) return 100;
    if (/\b(compact\s+edition|pocket\s+edition|de\s+bolso)\b/i.test(text)) return 55;
    return 0;
  });

  const absoluteMatch = pickBest((_, text) =>
    /\babsolute\b/i.test(text) ? 90 : 0
  );

  const omnibusMatch = pickBest((_, text) =>
    /\b(omnibus|compendium)\b/i.test(text) ? 90 : 0
  );

  const hardcoverMatch = pickBest((cand, text) => {
    if (/\b(absolute|omnibus|compendium|compact)\b/i.test(text)) return 0;
    if (/\bdeluxe\b/i.test(text)) return 90;
    if (
      /\b(hardcover|hc)\b/i.test(text) ||
      /\bhardcover\b/i.test(cand.physicalFormat)
    ) {
      return 60;
    }
    return 0;
  });

  const tpbMatch = pickBest((cand, text) => {
    if (/\b(absolute|omnibus|compendium|compact|deluxe|hardcover)\b/i.test(text)) {
      return 0;
    }
    if (VOLUME_MATCH_RE.test(text)) return 0;
    if (
      /\b(tpb|trade paperback|paperback)\b/i.test(text) ||
      /\bpaperback\b/i.test(cand.physicalFormat) ||
      isComicPublisher(cand.publishers)
    ) {
      return 45;
    }
    return 0;
  });

  const upgraded = baseOptions.map((opt) => {
    if (opt.id === 'compact' && compactMatch) {
      const isDcMatch = /\b(dc\s+compact|compact\s+comics)\b/i.test(
        `${compactMatch.title} ${compactMatch.subtitle}`
      );
      const rawNote = compactMatch.subtitle
        ? formatDisplayTitle(compactMatch.subtitle)
        : isDcMatch
          ? 'DC Compact Comics Edition'
          : 'Compact Paperback';
      const next = applyCandidate(opt, compactMatch, rawNote);
      if (isDcMatch) {
        next.label = 'DC Compact TPB';
        next.shortBadge = 'DC Compact';
      }
      return next;
    }

    if (opt.id === 'absolute' && absoluteMatch) {
      return applyCandidate(opt, absoluteMatch, 'Absolute Edition');
    }

    if (opt.id === 'omnibus' && omnibusMatch) {
      return applyCandidate(opt, omnibusMatch, 'Omnibus Edition');
    }

    if (opt.id === 'hardcover' && hardcoverMatch) {
      const rawNote = hardcoverMatch.subtitle
        ? formatDisplayTitle(hardcoverMatch.subtitle)
        : 'Hardcover Edition';
      return applyCandidate(opt, hardcoverMatch, rawNote);
    }

    if (opt.id === 'tpb' && tpbMatch) {
      return applyCandidate(opt, tpbMatch, 'Trade Paperback');
    }

    return opt;
  });

  // Discover Volume splits (e.g. Vol. 1, Vol. 2)
  const volumeMap = new Map<number, { cand: EditionCandidate; score: number }>();
  for (const cand of candidates) {
    const text = `${cand.title} ${cand.subtitle}`;
    const volMatch = text.match(VOLUME_MATCH_RE);
    if (!volMatch) continue;
    const volNum = Number(volMatch[1]);
    if (!Number.isFinite(volNum) || volNum < 1 || volNum > 12) continue;

    const score = 70 + cand.languageScore;
    const existing = volumeMap.get(volNum);
    if (!existing || score > existing.score) {
      volumeMap.set(volNum, { cand, score });
    }
  }

  const volumeOptions: ComicEditionOption[] = Array.from(volumeMap.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(0, 4)
    .map(([volNum, { cand }]) => {
      const covers = buildOpenLibraryCoverUrls(cand.coverId);
      const startUnit = (volNum - 1) * 6 + 1;
      const descParts = [cand.year, `Issues #${startUnit}–${startUnit + 5}`].filter(
        Boolean
      );
      return {
        id: `vol-${volNum}`,
        label: `Vol. ${volNum} TPB`,
        shortBadge: `Vol. ${volNum}`,
        description: descParts.join(' · '),
        coverUrl: covers.coverUrl ?? params.defaultCoverUrl,
        hqCoverUrl: covers.hqCoverUrl ?? params.defaultHqCoverUrl,
        fallbackCoverUrl: params.defaultCoverUrl,
        year: cand.year,
        suggestedUnitCount: 6,
        startUnit,
        suggestedShelf: 'owned_physical',
        isVerified: true,
        titleSuffix: `Vol. ${volNum}`,
      };
    });

  return [...upgraded, ...volumeOptions];
}

export async function fetchOpenLibraryEditions(
  params: {
    workKeys: string[];
    medium: 'comic' | 'book';
    publisher?: string;
    defaultCoverUrl?: string;
    defaultHqCoverUrl?: string;
    relatedDocs?: OpenLibraryWorkSummary[];
  },
  signal?: AbortSignal
): Promise<ComicEditionOption[]> {
  const uniqueKeys = Array.from(
    new Set(params.workKeys.filter((k) => k.startsWith('/works/')))
  ).slice(0, 6);

  const rawEditions: OpenLibraryRawEdition[] = [];

  if (uniqueKeys.length > 0) {
    const settled = await Promise.allSettled(
      uniqueKeys.map(async (workKey) => {
        const res = await fetch(
          `https://openlibrary.org${workKey}/editions.json?limit=20`,
          { signal }
        );
        if (!res.ok) return [] as OpenLibraryRawEdition[];
        const data = (await res.json()) as { entries?: OpenLibraryRawEdition[] };
        return data.entries ?? [];
      })
    );

    if (signal?.aborted) {
      return buildOpenLibraryEditions({
        medium: params.medium,
        publisher: params.publisher,
        defaultCoverUrl: params.defaultCoverUrl,
        defaultHqCoverUrl: params.defaultHqCoverUrl,
        relatedDocs: params.relatedDocs,
      });
    }

    for (const item of settled) {
      if (item.status === 'fulfilled') {
        rawEditions.push(...item.value);
      }
    }
  }

  return buildOpenLibraryEditions({
    medium: params.medium,
    publisher: params.publisher,
    defaultCoverUrl: params.defaultCoverUrl,
    defaultHqCoverUrl: params.defaultHqCoverUrl,
    relatedDocs: params.relatedDocs,
    rawEditions,
  });
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
          coverImage?: {
            extraLarge?: string | null;
            large?: string | null;
            medium?: string | null;
          } | null;
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
      coverUrl:
        item.coverImage?.large ??
        item.coverImage?.extraLarge ??
        item.coverImage?.medium ??
        undefined,
      hqCoverUrl:
        item.coverImage?.extraLarge ??
        item.coverImage?.large ??
        item.coverImage?.medium ??
        undefined,
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
  category: OnlineSearchCategory,
  signal?: AbortSignal
): Promise<OnlineSearchResult[]> {
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(
      query
    )}&limit=12&fields=key,title,subtitle,author_name,first_publish_year,cover_i,subject,publisher,edition_count,number_of_pages_median`,
    { signal }
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    docs?: OpenLibraryDoc[];
  };

  const grouped = groupOpenLibraryDocs(data.docs ?? [], category === 'comic');
  if (category === 'comic') {
    return grouped.filter((item) => item.medium === 'comic');
  }
  if (category === 'book') {
    return grouped.filter((item) => item.medium === 'book');
  }
  return grouped;
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
      (game.source === 'steam'
        ? 'PC / Steam · Chapters or Milestones'
        : 'Video Game · Chapters or Milestones'),
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

function getTitleMatchScore(query: string, candidateTitle: string): number {
  const queryLower = normalizeTitle(query);
  const titleLower = normalizeTitle(candidateTitle);
  if (titleLower === queryLower) return 120;
  if (titleLower.startsWith(`${queryLower} `)) return 75;
  if (titleLower.includes(queryLower)) return 45;
  if (isGoodTitleMatch(query, candidateTitle)) return 30;
  return 0;
}

function scoreResult(item: OnlineSearchResult, query: string): number {
  let score = getTitleMatchScore(query, item.title);
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
    tasks.push(searchOpenLibrary(trimmed, category, signal));
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
      const dedupeKey = item.canonicalWorkKey
        ? `${item.medium}::${item.canonicalWorkKey}`
        : `${item.medium}::${normalizeTitle(item.title)}::${item.year ?? ''}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      combined.push(item);
    }
  }

  const hasStrongMatch = combined.some(
    (item) => getTitleMatchScore(trimmed, item.title) >= 45
  );
  const pruned = hasStrongMatch
    ? combined.filter((item) => isGoodTitleMatch(trimmed, item.title))
    : combined;

  pruned.sort((a, b) => scoreResult(b, trimmed) - scoreResult(a, trimmed));

  return pruned.slice(0, 16);
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
