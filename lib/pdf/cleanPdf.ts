import { configurePdfWorker, pdfjsLib } from './pdfjsWorker';
import { extractAllPages, detectScanned } from './extract';
import { buildAllLines } from './lines';
import { removeHeadersFooters } from './headersFooters';
import { processAllPagesColumns } from './columns';
import { normalizeAllPages } from './normalize';
import { calculateQualityScore } from './score';
import type { CleanedDocument, ProgressState, CleanPdfOptions } from './types';

configurePdfWorker();

const DEFAULT_MAX_PAGES = 75;
const SCALE = 1.5;

export async function cleanPdf(
  file: File,
  options: CleanPdfOptions = {}
): Promise<CleanedDocument> {
  const { maxPages = DEFAULT_MAX_PAGES, onProgress } = options;

  const updateProgress = (state: Partial<ProgressState>) => {
    if (onProgress) {
      onProgress({
        stage: 'idle',
        currentPage: 0,
        totalPages: 0,
        percent: 0,
        ...state,
      });
    }
  };

  const warnings: string[] = [];

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = Math.min(pdf.numPages, maxPages);

  if (pdf.numPages > maxPages) {
    warnings.push(`PDF has ${pdf.numPages} pages. Processing first ${maxPages} pages only.`);
  }

  updateProgress({
    stage: 'extracting',
    currentPage: 0,
    totalPages,
    percent: 0,
  });

  const { items: itemsPerPage, pageHeights } = await extractAllPages(
    pdf,
    (current, total) => {
      updateProgress({
        stage: 'extracting',
        currentPage: current,
        totalPages: total,
        percent: (current / total) * 25,
      });
    },
    maxPages
  );

  const pageWidths: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: SCALE });
    pageWidths.push(viewport.width);
  }

  await new Promise(r => setTimeout(r, 0));

  const isScanned = detectScanned(itemsPerPage);
  if (isScanned) {
    warnings.push('PDF appears scanned; OCR required for reliable text extraction.');
  }

  updateProgress({
    stage: 'detecting columns',
    currentPage: totalPages,
    totalPages,
    percent: 30,
  });

  let linesPerPage = buildAllLines(itemsPerPage);

  await new Promise(r => setTimeout(r, 0));

  const { processed: columnProcessed, columnsDetectedPages } = processAllPagesColumns(
    linesPerPage,
    pageWidths
  );
  linesPerPage = columnProcessed;

  await new Promise(r => setTimeout(r, 0));

  updateProgress({
    stage: 'removing headers',
    currentPage: totalPages,
    totalPages,
    percent: 50,
  });

  const { cleaned: headerCleaned, removedCount: headersRemoved } = removeHeadersFooters(
    linesPerPage,
    pageHeights
  );
  linesPerPage = headerCleaned;

  await new Promise(r => setTimeout(r, 0));

  updateProgress({
    stage: 'repairing lines',
    currentPage: totalPages,
    totalPages,
    percent: 70,
  });

  const { pages, totalJoins } = normalizeAllPages(linesPerPage);

  await new Promise(r => setTimeout(r, 0));

  updateProgress({
    stage: 'finalizing',
    currentPage: totalPages,
    totalPages,
    percent: 90,
  });

  const fullText = pages.map(p => p.text).join('\n\n---\n\n');
  const extractedChars = fullText.replace(/\s/g, '').length;

  const qualityScore = calculateQualityScore({
    extractedChars,
    pageCount: totalPages,
    joinedLineBreaks: totalJoins,
    headersRemoved,
    columnsDetectedPages,
    isScanned,
  });

  updateProgress({
    stage: 'idle',
    currentPage: totalPages,
    totalPages,
    percent: 100,
  });

  return {
    isScanned,
    pageCount: totalPages,
    qualityScore,
    warnings,
    text: fullText,
    pages,
    meta: {
      extractedChars,
      joinedLineBreaks: totalJoins,
      headersRemoved,
      columnsDetectedPages,
    },
  };
}
