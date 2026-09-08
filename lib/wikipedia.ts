/**
 * Practice text sourced from Wikipedia.
 *
 * Runs entirely in the browser: the MediaWiki API supports CORS when passed
 * origin=*, so no server is involved.
 */

const API = 'https://en.wikipedia.org/w/api.php';

export interface PracticeText {
  title: string;
  content: string;
}

/** No article matched the topic, even after a search. */
export class TopicNotFoundError extends Error {
  constructor(topic: string) {
    super(`No Wikipedia article found for "${topic}".`);
    this.name = 'TopicNotFoundError';
  }
}

/** Wikipedia is throttling requests from this reader. */
export class RateLimitedError extends Error {
  constructor() {
    super('Wikipedia is rate-limiting requests right now. Try again in a moment.');
    this.name = 'RateLimitedError';
  }
}

// Appendix sections are link lists and citation stubs rather than prose, so
// they make poor reading material.
const APPENDIX_HEADINGS = /^=+ *(see also|references|further reading|external links|notes|citations|bibliography|sources|footnotes|works cited)[^=]* *=+$/im;

const HEADING_LINE = /^=+ *(.+?) *=+$/gm;

/** Turns a MediaWiki plaintext extract into clean prose. */
export function cleanExtract(extract: string): string {
  let text = extract;

  // Cut everything from the first appendix heading onward.
  const appendix = text.match(APPENDIX_HEADINGS);
  if (appendix && appendix.index !== undefined) {
    text = text.slice(0, appendix.index);
  }

  return text
    // "== Overview ==" is markup, not something to read aloud.
    .replace(HEADING_LINE, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function query(params: Record<string, string>): Promise<any> {
  const search = new URLSearchParams({ format: 'json', origin: '*', ...params });
  const response = await fetch(`${API}?${search}`);

  if (response.status === 429) throw new RateLimitedError();
  if (!response.ok) throw new Error(`Wikipedia returned ${response.status}`);

  return response.json();
}

/** Reads the extract of the first page in a query result, if it has one. */
function firstExtract(data: any): PracticeText | null {
  const pages = data?.query?.pages;
  if (!pages) return null;

  const page = pages[Object.keys(pages)[0]];
  if (!page || page.missing !== undefined || !page.extract) return null;

  const content = cleanExtract(page.extract);
  return content ? { title: page.title, content } : null;
}

async function fetchArticle(title: string): Promise<PracticeText | null> {
  // Without exintro this returns the whole article rather than the lead
  // section, which is an order of magnitude more to read.
  return firstExtract(
    await query({
      action: 'query',
      prop: 'extracts',
      explaintext: '1',
      redirects: '1',
      titles: title,
    })
  );
}

/**
 * Finds an article for a topic and returns its text.
 *
 * Tries the topic as an exact title first so precise input ("Mercury
 * (planet)") is honoured, then falls back to a search so natural phrasing
 * ("how speed reading works") resolves too.
 */
export async function fetchPracticeText(topic: string): Promise<PracticeText> {
  const trimmed = topic.trim();
  if (!trimmed) throw new TopicNotFoundError(topic);

  const exact = await fetchArticle(trimmed);
  if (exact) return exact;

  const results = await query({
    action: 'query',
    list: 'search',
    srsearch: trimmed,
    srlimit: '5',
  });

  for (const hit of results?.query?.search || []) {
    const article = await fetchArticle(hit.title);
    if (article) return article;
  }

  throw new TopicNotFoundError(topic);
}
