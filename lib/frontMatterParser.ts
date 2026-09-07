export type FrontMatterType =
  | 'introduction'
  | 'preface'
  | 'foreword'
  | 'prologue'
  | 'dedication'
  | 'acknowledgments'
  | 'contents'
  | 'epigraph'
  | 'author'
  | 'other';

export interface FrontMatterSection {
  type: FrontMatterType;
  title: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

export interface ParsedBook {
  frontMatter: FrontMatterSection[];
  dedication?: string;
  epigraph?: string;
  /** Character offset where the main body begins, or 0 if none was found. */
  chapter1StartIndex: number;
  body: string;
}

// Headings are matched on their own line, allowing for the numbering and
// decoration ebook exports tend to carry ("PREFACE.", "* INTRODUCTION *").
const HEADING_PATTERNS: Array<{ type: FrontMatterType; pattern: RegExp }> = [
  { type: 'contents', pattern: /^(?:table\s+of\s+)?contents$/i },
  { type: 'dedication', pattern: /^dedication$/i },
  { type: 'epigraph', pattern: /^epigraph$/i },
  { type: 'foreword', pattern: /^forewor?d$/i },
  { type: 'preface', pattern: /^preface(?:\s+to\s+.+)?$/i },
  { type: 'introduction', pattern: /^introduction(?:\s*[:—-]\s*.+)?$/i },
  { type: 'prologue', pattern: /^prologue(?:\s*[:—-]\s*.+)?$/i },
  { type: 'acknowledgments', pattern: /^acknowledge?ments?$/i },
  { type: 'author', pattern: /^(?:about\s+the\s+author|author'?s?\s+note)$/i },
];

// The first line that counts as the start of the main body.
const BODY_PATTERNS: RegExp[] = [
  /^chapter\s+(?:1|one|i)\b.*$/i,
  /^(?:part|book)\s+(?:1|one|i)\b.*$/i,
  /^1\.?$/,
  /^one$/i,
];

const MAX_HEADING_LENGTH = 80;
// Front matter lives at the front; scanning the whole of a long book invites
// false positives from body text that happens to start a line with "One".
const FRONT_MATTER_SCAN_RATIO = 0.4;
const MIN_SCAN_CHARS = 20000;

interface HeadingHit {
  type: FrontMatterType | 'body';
  title: string;
  startIndex: number;
  headingEndIndex: number;
}

function stripDecoration(line: string): string {
  return line
    .replace(/^[\s*_#=~-]+/, '')
    .replace(/[\s*_#=~.-]+$/, '')
    .trim();
}

function classifyLine(line: string): { type: FrontMatterType | 'body'; title: string } | null {
  const cleaned = stripDecoration(line);
  if (!cleaned || cleaned.length > MAX_HEADING_LENGTH) return null;

  for (const { type, pattern } of HEADING_PATTERNS) {
    if (pattern.test(cleaned)) return { type, title: cleaned };
  }
  for (const pattern of BODY_PATTERNS) {
    if (pattern.test(cleaned)) return { type: 'body', title: cleaned };
  }
  return null;
}

/**
 * Splits a book into its front matter sections and main body.
 *
 * Headings are detected line by line; a section runs from its heading to the
 * next heading (or to the start of the body). Everything is reported with
 * character offsets so callers can map positions back onto the raw content.
 */
export function parseBookContent(content: string): ParsedBook {
  const empty: ParsedBook = {
    frontMatter: [],
    chapter1StartIndex: 0,
    body: content,
  };

  if (!content || !content.trim()) return empty;

  const scanLimit = Math.max(
    MIN_SCAN_CHARS,
    Math.floor(content.length * FRONT_MATTER_SCAN_RATIO)
  );

  const hits: HeadingHit[] = [];
  const lineRegex = /^.*$/gm;
  let match: RegExpExecArray | null;

  while ((match = lineRegex.exec(content)) !== null) {
    // Zero-length matches on blank lines would spin the regex forever.
    if (match[0] === '' && lineRegex.lastIndex === match.index) {
      lineRegex.lastIndex++;
      continue;
    }
    if (match.index > scanLimit) break;

    const classified = classifyLine(match[0]);
    if (!classified) continue;

    hits.push({
      type: classified.type,
      title: classified.title,
      startIndex: match.index,
      headingEndIndex: match.index + match[0].length,
    });

    if (classified.type === 'body') break;
  }

  if (hits.length === 0) return empty;

  const bodyHit = hits.find((h) => h.type === 'body');
  const chapter1StartIndex = bodyHit ? bodyHit.startIndex : 0;
  const sectionEnd = bodyHit ? bodyHit.startIndex : content.length;

  const frontMatter: FrontMatterSection[] = [];
  const sectionHits = hits.filter((h) => h.type !== 'body');

  for (let i = 0; i < sectionHits.length; i++) {
    const hit = sectionHits[i];
    const next = sectionHits[i + 1];
    const endIndex = next ? next.startIndex : sectionEnd;
    const sectionText = content.slice(hit.startIndex, endIndex).trim();

    // A heading with nothing under it is a table-of-contents entry, not a section.
    if (content.slice(hit.headingEndIndex, endIndex).trim().length === 0) continue;

    frontMatter.push({
      type: hit.type as FrontMatterType,
      title: hit.title,
      content: sectionText,
      startIndex: hit.startIndex,
      endIndex,
    });
  }

  const bodyOf = (type: FrontMatterType): string | undefined => {
    const section = frontMatter.find((s) => s.type === type);
    if (!section) return undefined;
    const text = section.content.split('\n').slice(1).join('\n').trim();
    return text || undefined;
  };

  return {
    frontMatter,
    dedication: bodyOf('dedication'),
    epigraph: bodyOf('epigraph'),
    chapter1StartIndex,
    body: content.slice(chapter1StartIndex),
  };
}

const GUTENBERG_START =
  /^\s*\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*\s*$/im;
const GUTENBERG_END =
  /^\s*\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*\s*$/im;

/**
 * Removes the Project Gutenberg license header and footer that wrap the actual
 * book text in their plain-text editions.
 */
export function stripGutenbergBoilerplate(content: string): string {
  if (!content) return content;

  let result = content;

  const start = result.match(GUTENBERG_START);
  if (start && start.index !== undefined) {
    result = result.slice(start.index + start[0].length);
  }

  const end = result.match(GUTENBERG_END);
  if (end && end.index !== undefined) {
    result = result.slice(0, end.index);
  }

  // Some editions repeat a "Produced by ..." credit line after the marker.
  result = result.replace(/^\s*(?:produced|transcribed|updated|e-?text prepared)\s+by\s+.*$/gim, '');

  return result.trim();
}
