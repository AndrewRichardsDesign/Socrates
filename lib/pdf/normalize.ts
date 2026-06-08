import type { Line } from './types';

const TERMINAL_PUNCTUATION = /[.!?]["'\u201D\u2019\u2018\u201C)}\]]*$/;
const CONTINUATION_START = /^[,);:\u2014\u2013]/;
const LOWERCASE_START = /^[a-z]/;
const BULLET_PATTERN = /^(\s*[-•*]\s+|\s*\d+\.\s+)/;
const HYPHEN_END = /-$/;
const EM_DASH = /[—–]$/;

export function normalizePageText(lines: Line[]): { text: string; joinedLineBreaks: number } {
  if (lines.length === 0) {
    return { text: '', joinedLineBreaks: 0 };
  }

  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    gaps.push(lines[i].y - lines[i - 1].y);
  }
  
  const medianGap = gaps.length > 0 ? median(gaps) : 20;
  const paragraphGapThreshold = medianGap * 1.6;

  const paragraphs: string[] = [];
  let currentParagraph = '';
  let joinedLineBreaks = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineText = line.text.trim();
    
    if (!lineText) continue;

    const isBullet = BULLET_PATTERN.test(lineText);
    const isParagraphBreak = i > 0 && (lines[i].y - lines[i - 1].y) > paragraphGapThreshold;

    if (isBullet || isParagraphBreak) {
      if (currentParagraph) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = '';
      }
    }

    if (!currentParagraph) {
      currentParagraph = lineText;
    } else {
      const prevLine = lines[i - 1]?.text.trim() || '';
      const shouldJoin = shouldJoinLines(prevLine, lineText);

      if (shouldJoin) {
        const { merged, wasHyphenated } = dehyphenate(currentParagraph, lineText);
        currentParagraph = merged;
        if (!wasHyphenated) {
          joinedLineBreaks++;
        }
      } else {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = lineText;
      }
    }
  }

  if (currentParagraph) {
    paragraphs.push(currentParagraph.trim());
  }

  let text = paragraphs.join('\n\n');
  
  text = text.replace(/ +/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');

  return { text, joinedLineBreaks };
}

function shouldJoinLines(prevLine: string, currentLine: string): boolean {
  if (!prevLine || !currentLine) return false;

  if (TERMINAL_PUNCTUATION.test(prevLine)) {
    return false;
  }

  if (BULLET_PATTERN.test(currentLine)) {
    return false;
  }

  if (LOWERCASE_START.test(currentLine) || CONTINUATION_START.test(currentLine)) {
    return true;
  }

  if (HYPHEN_END.test(prevLine) && !EM_DASH.test(prevLine)) {
    return true;
  }

  return false;
}

const CONTINUATION_CHARS = /^[,;:)\]]/;

function dehyphenate(prev: string, current: string): { merged: string; wasHyphenated: boolean } {
  if (!HYPHEN_END.test(prev) || EM_DASH.test(prev)) {
    return { merged: `${prev} ${current}`, wasHyphenated: false };
  }

  const prefix = prev.slice(0, -1);
  
  if (prefix.length <= 2) {
    return { merged: `${prev} ${current}`, wasHyphenated: false };
  }

  if (/^[A-Z]/.test(current)) {
    return { merged: `${prev} ${current}`, wasHyphenated: false };
  }

  return { merged: `${prefix}${current}`, wasHyphenated: true };
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function normalizeAllPages(linesPerPage: Line[][]): { 
  pages: Array<{ page: number; text: string }>; 
  totalJoins: number;
} {
  const pages: Array<{ page: number; text: string }> = [];
  let totalJoins = 0;

  for (let i = 0; i < linesPerPage.length; i++) {
    const { text, joinedLineBreaks } = normalizePageText(linesPerPage[i]);
    pages.push({ page: i + 1, text });
    totalJoins += joinedLineBreaks;
  }

  return { pages, totalJoins };
}
