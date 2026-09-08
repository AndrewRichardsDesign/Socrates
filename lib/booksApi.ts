/**
 * Client-side replacement for the /api/books/* Express routes.
 *
 * The app is served as a static site on GitHub Pages, so book search and
 * downloads run in the browser against the upstream APIs directly. Every
 * endpoint used here sends `Access-Control-Allow-Origin: *`.
 *
 * The one exception is Project Gutenberg: www.gutenberg.org sends no CORS
 * headers, so its files cannot be read from a page. Gutenberg books are
 * instead pulled from the Internet Archive's mirror of the same corpus —
 * see fetchGutenbergContent.
 */

export type BookSource = 'openlibrary' | 'gutenberg' | 'internetarchive';

export interface BookResult {
  id: string;
  title: string;
  author: string;
  publishDate: string;
  source: BookSource;
  coverId?: string;
  description?: string;
  iaId?: string;
}

export interface BookDetails {
  id: string;
  title: string;
  author: string;
  publishDate: string;
  description: string;
  source: string;
  coverId?: string;
}

export type BookContent =
  | { title: string; source: BookSource; format: 'txt'; content: string }
  | { title: string; source: BookSource; format: 'epub'; epubData: ArrayBuffer };

/** Thrown when a book exists but its full text cannot be retrieved. */
export class ContentUnavailableError extends Error {
  readonly title: string;

  constructor(title: string, message: string) {
    super(message);
    this.name = 'ContentUnavailableError';
    this.title = title;
  }
}

const STUDY_MATERIAL_PATTERNS = /\b(notes|study\s*guide|cliffsnotes|sparknotes|coles\s*notes|york\s*notes|monarch\s*notes|barron'?s|maxnotes|analysis|criticism|companion|guide\s*to|reader'?s\s*guide|teaching\s*guide|teacher'?s\s*guide|student'?s?\s*guide|exam\s*prep|test\s*prep|essay|summary|outline|review|workbook|study\s*aid|passnotes|pass\s*notes|understanding\s+the|readings\s+on|studies\s+in|guide\s*$|:\s*guide|critical\s+essays|commentary|interpretation|masterplots|masterwork|booknotes|quicknotes|lectures\s+on|making\s+of|behind\s+the\s+scenes|adaptation|screenplay|film\s+tie-?in|movie\s+tie-?in)\b/i;

function isStudyMaterial(title: string, subtitle?: string): boolean {
  return STUDY_MATERIAL_PATTERNS.test(subtitle ? `${title} ${subtitle}` : title);
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.json();
}

// --- Search -----------------------------------------------------------------

async function searchOpenLibrary(query: string): Promise<BookResult[]> {
  try {
    const data = await fetchJson(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=50&has_fulltext=true`
    );

    return (data.docs || [])
      .filter((doc: any) => {
        const hasIA = doc.ia && Array.isArray(doc.ia) && doc.ia.length > 0;
        if (!hasIA && doc.public_scan_b !== true) return false;

        const title = doc.title || '';
        if (isStudyMaterial(title, doc.subtitle || '')) return false;

        const subjects = (doc.subject || []).join(' ').toLowerCase();
        if (/study\s*guides|literary\s*criticism|examinations|outlines/i.test(subjects)) {
          if (title.length < 50 && /guide|notes|companion/i.test(title)) return false;
        }

        return true;
      })
      .slice(0, 20)
      .map((doc: any) => ({
        id: doc.key?.replace('/works/', '') || doc.edition_key?.[0] || '',
        title: doc.title || 'Unknown Title',
        author: doc.author_name?.[0] || 'Unknown Author',
        publishDate: doc.first_publish_year?.toString() || 'Unknown',
        source: 'openlibrary' as const,
        coverId: doc.cover_i?.toString(),
        description: doc.first_sentence?.[0] || undefined,
        iaId: doc.ia?.[0],
      }));
  } catch (error) {
    console.error('Open Library search error:', error);
    return [];
  }
}

async function searchGutenberg(query: string): Promise<BookResult[]> {
  try {
    const data = await fetchJson(`https://gutendex.com/books/?search=${encodeURIComponent(query)}`);

    return (data.results || [])
      .filter((book: any) => !isStudyMaterial(book.title || ''))
      .slice(0, 20)
      .map((book: any) => ({
        id: book.id?.toString() || '',
        title: book.title || 'Unknown Title',
        author: book.authors?.[0]?.name || 'Unknown Author',
        publishDate: book.authors?.[0]?.birth_year?.toString() || 'Classic',
        source: 'gutenberg' as const,
        coverId: book.formats?.['image/jpeg'] || undefined,
      }));
  } catch (error) {
    console.error('Gutenberg search error:', error);
    return [];
  }
}

async function searchInternetArchive(query: string): Promise<BookResult[]> {
  try {
    const data = await fetchJson(
      `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
        `title:(${query}) AND mediatype:texts AND format:(Text OR EPUB)`
      )}&fl=identifier,title,creator,date,description&rows=50&output=json`
    );

    const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

    return (data.response?.docs || [])
      .filter((doc: any) => {
        const title = doc.title || '';
        if (isStudyMaterial(title)) return false;

        // Require at least half the query words to appear in the title.
        const titleLower = title.toLowerCase();
        const matching = queryWords.filter((w) => titleLower.includes(w));
        return matching.length >= Math.ceil(queryWords.length / 2);
      })
      .slice(0, 15)
      .map((doc: any) => ({
        id: doc.identifier || '',
        title: doc.title || 'Unknown Title',
        author: Array.isArray(doc.creator) ? doc.creator[0] : doc.creator || 'Unknown Author',
        publishDate: doc.date || 'Unknown',
        source: 'internetarchive' as const,
        description: Array.isArray(doc.description) ? doc.description[0] : doc.description,
      }));
  } catch (error) {
    console.error('Internet Archive search error:', error);
    return [];
  }
}

export async function searchBooks(query: string): Promise<BookResult[]> {
  if (!query || query.trim().length < 2) return [];

  const [openLibrary, gutenberg, internetArchive] = await Promise.all([
    searchOpenLibrary(query),
    searchGutenberg(query),
    searchInternetArchive(query),
  ]);

  const queryLower = query.toLowerCase().trim();

  return [...gutenberg, ...openLibrary, ...internetArchive].sort((a, b) => {
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();

    const aExact = aTitle === queryLower;
    const bExact = bTitle === queryLower;
    if (aExact !== bExact) return aExact ? -1 : 1;

    const aStarts = aTitle.startsWith(queryLower);
    const bStarts = bTitle.startsWith(queryLower);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;

    // Gutenberg books are verified public domain classics.
    const aGut = a.source === 'gutenberg';
    const bGut = b.source === 'gutenberg';
    if (aGut !== bGut) return aGut ? -1 : 1;

    return 0;
  });
}

// --- Details ----------------------------------------------------------------

export async function fetchBookDetails(source: string, id: string): Promise<BookDetails> {
  if (source === 'openlibrary') {
    const data = await fetchJson(`https://openlibrary.org/works/${id}.json`);
    return {
      id,
      title: data.title || 'Unknown Title',
      author: data.authors?.[0]?.author?.key || 'Unknown Author',
      publishDate: data.first_publish_date || 'Unknown',
      description:
        typeof data.description === 'string'
          ? data.description
          : data.description?.value || 'No description available.',
      source: 'openlibrary',
      coverId: data.covers?.[0]?.toString(),
    };
  }

  if (source === 'gutenberg') {
    const data = await fetchJson(`https://gutendex.com/books/${id}`);
    return {
      id,
      title: data.title || 'Unknown Title',
      author: data.authors?.[0]?.name || 'Unknown Author',
      publishDate: data.authors?.[0]?.birth_year?.toString() || 'Classic',
      description: data.subjects?.join(', ') || 'A classic from Project Gutenberg.',
      source: 'gutenberg',
      coverId: data.formats?.['image/jpeg'],
    };
  }

  if (source === 'internetarchive') {
    const data = await fetchJson(`https://archive.org/metadata/${id}`);
    const metadata = data.metadata || {};
    return {
      id,
      title: metadata.title || 'Unknown Title',
      author: Array.isArray(metadata.creator) ? metadata.creator[0] : metadata.creator || 'Unknown Author',
      publishDate: metadata.date || 'Unknown',
      description: Array.isArray(metadata.description)
        ? metadata.description.join(' ')
        : metadata.description || 'No description available.',
      source: 'internetarchive',
    };
  }

  throw new Error(`Unknown source: ${source}`);
}

// --- Internet Archive item helpers ------------------------------------------

interface ArchiveFile {
  name: string;
  size?: string;
}

interface ArchiveItem {
  restricted: boolean;
  files: ArchiveFile[];
  title: string;
}

async function fetchArchiveItem(identifier: string): Promise<ArchiveItem | null> {
  try {
    const data = await fetchJson(`https://archive.org/metadata/${identifier}`);
    const metadata = data.metadata || {};
    return {
      // Lending-restricted items answer downloads with 401.
      restricted: metadata['access-restricted-item'] === 'true' || metadata['access-restricted-item'] === true,
      files: data.files || [],
      title: metadata.title || 'Unknown Title',
    };
  } catch {
    return null;
  }
}

function downloadUrl(identifier: string, fileName: string): string {
  return `https://archive.org/download/${identifier}/${encodeURIComponent(fileName)}`;
}

// Scanned editions can run to hundreds of megabytes of page images, which
// would stall the browser long before any text came out of them.
const MAX_EPUB_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_BYTES = 15 * 1024 * 1024;

function withinSize(file: ArchiveFile, limit: number): boolean {
  const size = Number(file.size);
  return !Number.isFinite(size) || size <= limit;
}

function pickEpub(files: ArchiveFile[]): ArchiveFile | undefined {
  const epubs = files.filter(
    (f) => f.name?.endsWith('.epub') && !f.name.includes('_text') && withinSize(f, MAX_EPUB_BYTES)
  );
  // EPUB3 renders more reliably than the older format.
  return epubs.find((f) => f.name.toLowerCase().includes('epub3')) || epubs[0];
}

function pickText(files: ArchiveFile[]): ArchiveFile | undefined {
  const candidates = files.filter(
    (f) => f.name?.endsWith('.txt') && !/_meta|_hocr|readme/i.test(f.name) && withinSize(f, MAX_TEXT_BYTES)
  );
  // Prefer real text over djvu OCR of a scan, which is often unreadable noise.
  const clean = candidates.filter((f) => !f.name.endsWith('_djvu.txt'));
  const pool = clean.length > 0 ? clean : candidates;
  // Part files sit alongside whole-book files; the largest is the complete one.
  return pool.sort((a, b) => Number(b.size || 0) - Number(a.size || 0))[0];
}

/** Reads an item's text, preferring EPUB and falling back to plain text. */
async function readArchiveItem(identifier: string): Promise<BookContent | null> {
  const item = await fetchArchiveItem(identifier);
  if (!item || item.restricted) return null;

  const epub = pickEpub(item.files);
  if (epub) {
    try {
      const response = await fetch(downloadUrl(identifier, epub.name));
      if (response.ok) {
        return {
          title: item.title,
          source: 'internetarchive',
          format: 'epub',
          epubData: await response.arrayBuffer(),
        };
      }
    } catch {
      // Fall through to plain text.
    }
  }

  const text = pickText(item.files);
  if (text) {
    try {
      const response = await fetch(downloadUrl(identifier, text.name));
      if (response.ok) {
        const raw = await response.text();
        if (!/^\s*<(!DOCTYPE|html)/i.test(raw)) {
          return { title: item.title, source: 'internetarchive', format: 'txt', content: raw };
        }
      }
    } catch {
      // Nothing readable in this item.
    }
  }

  return null;
}

/** Finds Archive items likely to hold the full text of a given title. */
async function findArchiveCopies(title: string, author?: string): Promise<string[]> {
  const terms = [`title:(${title})`, 'mediatype:texts'];
  if (author) terms.push(`creator:(${author})`);

  const data = await fetchJson(
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
      terms.join(' AND ')
    )}&fl=identifier,title&rows=10&output=json`
  ).catch(() => null);

  const titleWords = title.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

  return (data?.response?.docs || [])
    .filter((doc: any) => {
      const docTitle = (doc.title || '').toLowerCase();
      if (isStudyMaterial(doc.title || '')) return false;
      const matching = titleWords.filter((w) => docTitle.includes(w));
      return matching.length >= Math.ceil(titleWords.length / 2);
    })
    .map((doc: any) => doc.identifier)
    .filter(Boolean);
}

// --- Content ----------------------------------------------------------------

/**
 * Gutenberg text via the Internet Archive.
 *
 * www.gutenberg.org sends no CORS headers, so the browser cannot read its
 * files. The Archive mirrors the Gutenberg corpus under identifiers shaped
 * like `<slug><5-digit Gutenberg id>gut` (Dracula, PG 345 -> dracula00345gut),
 * which makes the mirror addressable from the Gutenberg id alone.
 */
async function fetchGutenbergContent(id: string): Promise<BookContent> {
  const book = await fetchJson(`https://gutendex.com/books/${id}`).catch(() => null);
  const title = book?.title || 'Unknown Title';

  const paddedId = String(id).padStart(5, '0');
  const search = await fetchJson(
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
      `collection:gutenberg AND identifier:*${paddedId}gut`
    )}&fl=identifier&rows=5&output=json`
  ).catch(() => null);

  for (const doc of search?.response?.docs || []) {
    const result = await readArchiveItem(doc.identifier);
    if (result) return { ...result, title, source: 'gutenberg' };
  }

  // Not every Gutenberg edition is mirrored under its own id — obscure
  // translations and reissues often are not. Fall back to any Archive copy of
  // the same title.
  const author = book?.authors?.[0]?.name?.split(',')[0]?.trim();
  for (const identifier of await findArchiveCopies(title, author)) {
    const result = await readArchiveItem(identifier);
    if (result) return { ...result, title, source: 'gutenberg' };
  }

  throw new ContentUnavailableError(
    title,
    `The full text of "${title}" is not available from Project Gutenberg's Archive mirror.`
  );
}

async function fetchOpenLibraryContent(id: string, iaId?: string): Promise<BookContent> {
  const work = await fetchJson(`https://openlibrary.org/works/${id}.json`).catch(() => null);
  const title = work?.title || 'Unknown Title';

  const archiveIds: string[] = iaId ? [iaId] : [];

  const editions = await fetchJson(
    `https://openlibrary.org/works/${id}/editions.json?limit=20`
  ).catch(() => null);
  archiveIds.push(
    ...(editions?.entries || []).filter((e: any) => e.ocaid).map((e: any) => e.ocaid)
  );

  for (const archiveId of archiveIds) {
    const result = await readArchiveItem(archiveId);
    if (result) return { ...result, title, source: 'openlibrary' };
  }

  throw new ContentUnavailableError(
    title,
    `The full text of "${title}" is not available from Open Library.`
  );
}

async function fetchInternetArchiveContent(id: string): Promise<BookContent> {
  const item = await fetchArchiveItem(id);
  const title = item?.title || 'Unknown Title';

  const result = await readArchiveItem(id);
  if (result) return { ...result, title };

  throw new ContentUnavailableError(
    title,
    `The full text of "${title}" is not available in a readable format from Internet Archive.`
  );
}

export async function fetchBookContent(
  source: string,
  id: string,
  iaId?: string
): Promise<BookContent> {
  if (source === 'gutenberg') return fetchGutenbergContent(id);
  if (source === 'openlibrary') return fetchOpenLibraryContent(id, iaId);
  if (source === 'internetarchive') return fetchInternetArchiveContent(id);
  throw new Error(`Unknown source: ${source}`);
}
