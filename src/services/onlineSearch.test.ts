import { describe, expect, it } from 'vitest';
import {
  parseCollectedIssuesWikitext,
  parseDcCompactCatalogWikitext,
} from '../../api/media';
import {
  buildOpenLibraryEditions,
  extractCanonicalWorkBase,
  formatDisplayTitle,
  groupOpenLibraryDocs,
  isGoodTitleMatch,
  OpenLibraryDoc,
  OpenLibraryRawEdition,
} from './onlineSearch';

describe('formatDisplayTitle', () => {
  it('fixes lowercase hyphenated compounds and minor words properly', () => {
    expect(formatDisplayTitle('All-star Superman')).toBe('All-Star Superman');
    expect(formatDisplayTitle('The Dark Knight returns')).toBe('The Dark Knight Returns');
    expect(formatDisplayTitle('Batman: year one')).toBe('Batman: Year One');
    expect(formatDisplayTitle('All Star Superman VOL 02')).toBe(
      'All Star Superman Vol. 2'
    );
    expect(formatDisplayTitle('spider-man: blue')).toBe('Spider-Man: Blue');
  });
});

describe('extractCanonicalWorkBase', () => {
  it('strips edition prefixes and volume qualifiers without collapsing sequels', () => {
    expect(extractCanonicalWorkBase('Absolute All-Star Superman')).toBe(
      'All-Star Superman'
    );
    expect(extractCanonicalWorkBase('All Star Superman VOL 02')).toBe(
      'All Star Superman'
    );
    expect(extractCanonicalWorkBase('All Star Superman, Vol. 1')).toBe(
      'All Star Superman'
    );
    expect(extractCanonicalWorkBase('All-Star Superman (Deluxe Edition)')).toBe(
      'All-Star Superman'
    );
    expect(extractCanonicalWorkBase('All-Star Superman 02')).toBe(
      'All-Star Superman'
    );
    expect(extractCanonicalWorkBase('Dune Messiah')).toBe('Dune Messiah');
    expect(extractCanonicalWorkBase('Before Watchmen')).toBe('Before Watchmen');
  });
});

describe('isGoodTitleMatch', () => {
  it('matches exact/hyphenated titles and rejects unrelated noise', () => {
    expect(isGoodTitleMatch('all star superman', 'All-Star Superman')).toBe(true);
    expect(
      isGoodTitleMatch('all star superman', 'Last night, a superhero saved my life')
    ).toBe(false);
    expect(isGoodTitleMatch('all star superman', 'Superman')).toBe(false);
  });
});

describe('groupOpenLibraryDocs', () => {
  it('collapses fragmented OpenLibrary All-Star Superman works into one clean comic', () => {
    const docs: OpenLibraryDoc[] = [
      {
        key: '/works/OL15023038W',
        title: 'All-star Superman',
        author_name: ['Grant Morrison'],
        first_publish_year: 2007,
        cover_i: 11956378,
        publisher: ['OVNI PRESS', 'DC Comics'],
        subject: ['Superheroes', 'Comic books, strips'],
        edition_count: 4,
      },
      {
        key: '/works/OL6670904W',
        title: 'All Star Superman VOL 02',
        author_name: ['Grant Morrison'],
        first_publish_year: 2008,
        cover_i: 2737964,
        publisher: ['DC Comics'],
        subject: ['Comic books, strips'],
        edition_count: 1,
      },
      {
        key: '/works/OL16576814W',
        title: 'Absolute All-Star Superman',
        author_name: ['Grant Morrison'],
        first_publish_year: 2010,
        cover_i: 13236179,
        publisher: ['DC Comics'],
        subject: ['Comic books, strips'],
        edition_count: 1,
      },
      {
        key: '/works/OL6670905W',
        title: 'All Star Superman, Vol. 1',
        author_name: ['Grant Morrison'],
        cover_i: 749415,
      },
      {
        key: '/works/OL37863742W',
        title: 'All-Star Superman',
        author_name: ['Grant Morrison'],
        first_publish_year: 2024,
        cover_i: 14652411,
        publisher: ['DC Comics'],
        edition_count: 1,
      },
      {
        key: '/works/OL26356768W',
        title: 'All-Star Superman',
        author_name: ['Grant Morrison'],
        first_publish_year: 2021,
        cover_i: 12298611,
        publisher: ['DC Comics'],
        edition_count: 1,
      },
      {
        key: '/works/OL15728485W',
        title: 'All-Star Superman 02',
        author_name: ['Grant Morrison'],
        first_publish_year: 2010,
        cover_i: 6746314,
        publisher: ['DC Comics'],
        edition_count: 1,
      },
    ];

    const grouped = groupOpenLibraryDocs(docs, false);
    expect(grouped).toHaveLength(1);
    const result = grouped[0];
    expect(result.title).toBe('All-Star Superman');
    expect(result.year).toBe('2007');
    expect(result.creator).toBe('Grant Morrison');
    expect(result.publisher).toBe('DC Comics');
    expect(result.medium).toBe('comic');
    expect(result.kindLabel).toBe('Digital');
    expect(result.canonicalWorkKey).toBe('ol-all-star-superman-grant-morrison');
    expect(result.relatedWorkKeys).toEqual(
      expect.arrayContaining([
        '/works/OL15023038W',
        '/works/OL6670904W',
        '/works/OL16576814W',
        '/works/OL37863742W',
      ])
    );
  });

  it('appends non-edition subtitles like Year One cleanly while merging Absolute editions', () => {
    const docs: OpenLibraryDoc[] = [
      {
        key: '/works/OL253475W',
        title: 'Batman',
        subtitle: 'Year One',
        author_name: ['Frank Miller'],
        first_publish_year: 1986,
        cover_i: 2996338,
        publisher: ['DC Comics'],
        subject: ['Comic books'],
      },
      {
        key: '/works/OL21130612W',
        title: 'Absolute Batman Year One',
        author_name: ['Frank Miller'],
        first_publish_year: 2016,
        publisher: ['DC Comics'],
        subject: ['Comic books'],
      },
    ];

    const grouped = groupOpenLibraryDocs(docs, false);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].title).toBe('Batman: Year One');
    expect(grouped[0].medium).toBe('comic');
    expect(grouped[0].year).toBe('1986');
  });
});

describe('buildOpenLibraryEditions', () => {
  it('classifies real All-Star Superman editions including DC Compact, Deluxe, Absolute, and Volumes', () => {
    const rawEditions: OpenLibraryRawEdition[] = [
      {
        title: 'All-Star Superman',
        subtitle: 'DC Compact Comics Edition',
        publishers: ['DC Comics'],
        publish_date: '2024',
        covers: [14652411],
      },
      {
        title: 'All-Star Superman',
        subtitle: 'the Deluxe Edition',
        publishers: ['DC Comics'],
        publish_date: '2022',
        covers: [12502724],
      },
      {
        title: 'Absolute All-Star Superman',
        publishers: ['DC Comics'],
        publish_date: '2010',
        covers: [13236179],
      },
      {
        title: 'All Star Superman VOL 02',
        publishers: ['DC Comics'],
        publish_date: '2008',
        covers: [2737964],
      },
    ];

    const editions = buildOpenLibraryEditions({
      medium: 'comic',
      publisher: 'DC Comics',
      defaultCoverUrl: 'https://covers.openlibrary.org/b/id/11956378-M.jpg?default=false',
      defaultHqCoverUrl: 'https://covers.openlibrary.org/b/id/11956378-L.jpg?default=false',
      rawEditions,
    });

    expect(editions[0].id).toBe('digital');
    expect(editions[0].label).toBe('Digital');

    const tpb = editions.find((e) => e.id === 'tpb');
    expect(tpb?.label).toBe('Common TPB');

    const deluxe = editions.find((e) => e.id === 'hardcover');
    expect(deluxe?.isVerified).toBe(true);
    expect(deluxe?.coverUrl).toContain('12502724');
    expect(deluxe?.year).toBe('2022');

    const absolute = editions.find((e) => e.id === 'absolute');
    expect(absolute?.isVerified).toBe(true);
    expect(absolute?.coverUrl).toContain('13236179');
    expect(absolute?.year).toBe('2010');

    const compact = editions.find((e) => e.id === 'compact');
    expect(compact?.label).toBe('DC Compact TPB');
    expect(compact?.shortBadge).toBe('DC Compact');
    expect(compact?.isVerified).toBe(true);
    expect(compact?.year).toBe('2024');
    expect(compact?.coverUrl).toContain('14652411');

    const omnibus = editions.find((e) => e.id === 'omnibus');
    expect(omnibus?.label).toBe('Omnibus');

    const vol2 = editions.find((e) => e.id === 'vol-2');
    expect(vol2).toBeDefined();
    expect(vol2?.startUnit).toBe(7);
    expect(vol2?.suggestedUnitCount).toBe(6);
    expect(vol2?.coverUrl).toContain('2737964');
  });

  it('uses resolved ISBN covers (PRH fallback) when OpenLibrary covers array is empty', () => {
    const rawEditions: OpenLibraryRawEdition[] = [
      {
        title: 'The Flash: Rebirth: DC Compact Comics Edition',
        publishers: ['Penguin Random House NZ'],
        isbn_13: ['9781799507697'],
      },
    ];

    const editions = buildOpenLibraryEditions({
      medium: 'comic',
      publisher: 'DC Comics',
      defaultCoverUrl: 'https://covers.openlibrary.org/b/id/6391572-M.jpg?default=false',
      defaultHqCoverUrl: 'https://covers.openlibrary.org/b/id/6391572-L.jpg?default=false',
      rawEditions,
      resolvedIsbnCovers: {
        '9781799507697': {
          coverUrl: 'https://images.randomhouse.com/cover/9781799507697',
          hqCoverUrl: 'https://images.randomhouse.com/cover/9781799507697',
        },
      },
    });

    const compact = editions.find((e) => e.id === 'compact');
    expect(compact?.label).toBe('DC Compact TPB');
    expect(compact?.isVerified).toBe(true);
    expect(compact?.coverUrl).toBe('https://images.randomhouse.com/cover/9781799507697');
  });

  it('parses Wikipedia DC Compact catalog wikitext and applies real issue counts to editions', () => {
    const sampleWikitext = `
=== Batgirl ===
{| class="wikitable sortable"
|-
!Title
!Years
!Issues collected
!Writers
!Artists
!Genre
!Pages
!Pub date
!ISBN
|-
|'''''Batgirl of Burnside'''''
|2014–2015
|
* ''Batgirl'' (vol. 4) #35–45, ''Annual'' #3
* ''Secret Origins'' #10
* ''DC Sneak Peek: Batgirl'' #1
|Cameron Stewart
|Babs Tarr
|Adventure
|312
|{{DTS|15 Sep 2026}}
|{{nowrap|{{ISBNT|978-1799508557}}}}
|}

=== The Flash ===
{| class="wikitable sortable"
|-
|'''''[[The Flash: Rebirth|Rebirth]]'''''
|2009–2011
|
* ''The Flash: Rebirth'' #1–6
* ''[[The Flash (comic book)|The Flash]]'' (vol. 3) #1–7
|[[Geoff Johns]]
|[[Ethan Van Sciver]]
|Adventure
|352
|{{DTS|17 Mar 2026}}
|{{nowrap|{{ISBNT|978-1799507697}}}}
|}

=== Superman ===
{| class="wikitable sortable"
|-
|'''''[[All-Star Superman]]'''''
|2005–2008
|
* ''All-Star Superman'' #1–12
|[[Grant Morrison]]
|[[Frank Quitely]]
|Sci-Fi
|296
|{{DTS|2 Jul 2024}}
|{{nowrap|{{ISBNT|978-1779527257}}}}
|}
`;

    const entries = parseDcCompactCatalogWikitext(sampleWikitext);
    expect(entries).toHaveLength(3);

    const batgirl = entries.find((e) => e.title === 'Batgirl of Burnside');
    expect(batgirl?.issueCount).toBe(14);

    const flash = entries.find((e) => e.isbn === '9781799507697');
    expect(flash?.issueCount).toBe(13);
    expect(flash?.year).toBe('2026');
    expect(flash?.units[0].canonicalKey).toBe('the-flash-rebirth:1');
    expect(flash?.units[5].canonicalKey).toBe('the-flash-rebirth:6');
    expect(flash?.units[6].canonicalKey).toBe('the-flash-vol-3:1');
    expect(flash?.units[12].canonicalKey).toBe('the-flash-vol-3:7');

    const parsedSuperman = parseCollectedIssuesWikitext(`* ''All-Star Superman'' #1–12`);
    expect(parsedSuperman.units).toHaveLength(12);

    const editions = buildOpenLibraryEditions({
      medium: 'comic',
      publisher: 'DC Comics',
      defaultCoverUrl: 'https://covers.openlibrary.org/b/id/6391572-M.jpg?default=false',
      defaultHqCoverUrl: 'https://covers.openlibrary.org/b/id/6391572-L.jpg?default=false',
      comicMeta: {
        seriesIssueCount: 6,
        seriesUnits: Array.from({ length: 6 }, (_, i) => ({
          title: `The Flash: Rebirth #${i + 1}`,
          subtitle: `Issue #${i + 1}`,
          unitNumber: i + 1,
          canonicalKey: `the-flash-rebirth:${i + 1}`,
        })),
        compact: flash
          ? {
              title: flash.title,
              year: flash.year,
              pages: flash.pages,
              isbn: flash.isbn,
              coverUrl: 'https://images.penguinrandomhouse.com/cover/9781799507697',
              hqCoverUrl: 'https://images.penguinrandomhouse.com/cover/9781799507697',
              issueCount: flash.issueCount,
              units: flash.units,
              summary: flash.summary,
            }
          : null,
      },
    });

    const digital = editions.find((e) => e.id === 'digital');
    expect(digital?.suggestedUnitCount).toBe(6);
    expect(digital?.units).toHaveLength(6);

    const tpb = editions.find((e) => e.id === 'tpb');
    expect(tpb?.suggestedUnitCount).toBe(6);

    const compact = editions.find((e) => e.id === 'compact');
    expect(compact?.suggestedUnitCount).toBe(13);
    expect(compact?.units).toHaveLength(13);
    expect(compact?.coverUrl).toBe(
      'https://images.penguinrandomhouse.com/cover/9781799507697'
    );
    expect(compact?.description).toContain('13 issues');
  });
});
