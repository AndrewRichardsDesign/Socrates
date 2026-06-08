import type { Line } from './types';

export const HEADERS_FOOTERS_CONFIG = {
  HEADER_THRESHOLD: 0.10,
  FOOTER_THRESHOLD: 0.90,
  REPETITION_THRESHOLD: 0.40,
  MIN_LINE_LENGTH: 3,
  MAX_LINE_LENGTH: 120,
};

const HEADER_THRESHOLD = HEADERS_FOOTERS_CONFIG.HEADER_THRESHOLD;
const FOOTER_THRESHOLD = HEADERS_FOOTERS_CONFIG.FOOTER_THRESHOLD;
const REPETITION_THRESHOLD = HEADERS_FOOTERS_CONFIG.REPETITION_THRESHOLD;
const MIN_LINE_LENGTH = HEADERS_FOOTERS_CONFIG.MIN_LINE_LENGTH;
const MAX_LINE_LENGTH = HEADERS_FOOTERS_CONFIG.MAX_LINE_LENGTH;

const PAGE_NUMBER_PATTERNS = [
  /^\d+$/,
  /^page\s+\d+(\s+of\s+\d+)?$/i,
  /^\d+\s+of\s+\d+$/i,
  /^-\s*\d+\s*-$/,
];

function isTooContentLike(text: string): boolean {
  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).length;
  const endsWithPeriod = /\.\s*$/.test(trimmed);
  
  if (endsWithPeriod && wordCount > 12) {
    return true;
  }
  
  return false;
}

function normalizeLine(text: string): string {
  let normalized = text.trim().replace(/\s+/g, ' ').toLowerCase();
  
  for (const pattern of PAGE_NUMBER_PATTERNS) {
    if (pattern.test(normalized)) {
      return '__PAGE_NUMBER__';
    }
  }
  
  normalized = normalized.replace(/\d+/g, '#');
  
  return normalized;
}

export function removeHeadersFooters(
  linesPerPage: Line[][],
  pageHeights: number[]
): { cleaned: Line[][]; removedCount: number } {
  if (linesPerPage.length < 3) {
    return { cleaned: linesPerPage, removedCount: 0 };
  }

  const headerCandidates = new Map<string, number>();
  const footerCandidates = new Map<string, number>();

  for (let pageIdx = 0; pageIdx < linesPerPage.length; pageIdx++) {
    const lines = linesPerPage[pageIdx];
    const pageHeight = pageHeights[pageIdx] || 800;
    const headerY = pageHeight * HEADER_THRESHOLD;
    const footerY = pageHeight * FOOTER_THRESHOLD;

    for (const line of lines) {
      const normalized = normalizeLine(line.text);
      if (!normalized || normalized.length < MIN_LINE_LENGTH || normalized.length > MAX_LINE_LENGTH) continue;
      
      if (isTooContentLike(line.text)) continue;

      if (line.y < headerY) {
        headerCandidates.set(normalized, (headerCandidates.get(normalized) || 0) + 1);
      } else if (line.y > footerY) {
        footerCandidates.set(normalized, (footerCandidates.get(normalized) || 0) + 1);
      }
    }
  }

  const pageCount = linesPerPage.length;
  const threshold = pageCount * REPETITION_THRESHOLD;

  const headersToRemove = new Set<string>();
  const footersToRemove = new Set<string>();

  headerCandidates.forEach((count, text) => {
    if (count >= threshold) {
      headersToRemove.add(text);
    }
  });

  footerCandidates.forEach((count, text) => {
    if (count >= threshold) {
      footersToRemove.add(text);
    }
  });

  let removedCount = 0;
  const cleaned: Line[][] = [];

  for (let pageIdx = 0; pageIdx < linesPerPage.length; pageIdx++) {
    const lines = linesPerPage[pageIdx];
    const pageHeight = pageHeights[pageIdx] || 800;
    const headerY = pageHeight * HEADER_THRESHOLD;
    const footerY = pageHeight * FOOTER_THRESHOLD;

    const filteredLines: Line[] = [];

    for (const line of lines) {
      const normalized = normalizeLine(line.text);
      
      const isHeader = line.y < headerY && headersToRemove.has(normalized);
      const isFooter = line.y > footerY && footersToRemove.has(normalized);

      if (isHeader || isFooter) {
        removedCount++;
      } else {
        filteredLines.push(line);
      }
    }

    cleaned.push(filteredLines);
  }

  return { cleaned, removedCount };
}
