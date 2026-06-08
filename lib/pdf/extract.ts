import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { PositionedItem } from './types';

const SCALE = 1.5;

export async function extractPageItems(
  page: PDFPageProxy,
  pageNumber: number
): Promise<PositionedItem[]> {
  const viewport = page.getViewport({ scale: SCALE });
  const textContent = await page.getTextContent();
  const items: PositionedItem[] = [];

  for (const item of textContent.items) {
    if (!('str' in item) || !item.str.trim()) continue;

    const transform = item.transform;
    const x = transform[4] * SCALE;
    const rawY = transform[5] * SCALE;
    const y = viewport.height - rawY;

    const width = item.width * SCALE;
    const height = Math.abs(transform[0]) * SCALE || 12;

    items.push({
      text: item.str,
      x,
      y,
      width,
      height,
      page: pageNumber,
    });
  }

  return items;
}

export async function extractAllPages(
  pdf: PDFDocumentProxy,
  onProgress?: (page: number, total: number) => void,
  maxPages?: number
): Promise<{ items: PositionedItem[][]; pageHeights: number[] }> {
  const totalPages = Math.min(pdf.numPages, maxPages || pdf.numPages);
  const allItems: PositionedItem[][] = [];
  const pageHeights: number[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: SCALE });
    pageHeights.push(viewport.height);
    
    const items = await extractPageItems(page, i);
    allItems.push(items);

    if (onProgress) onProgress(i, totalPages);
    
    if (i % 5 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  return { items: allItems, pageHeights };
}

export function detectScanned(itemsPerPage: PositionedItem[][]): boolean {
  if (itemsPerPage.length === 0) return true;

  let totalNonWsChars = 0;
  let lowItemPages = 0;

  for (const pageItems of itemsPerPage) {
    const nonWsChars = pageItems.reduce((sum, item) => sum + item.text.replace(/\s/g, '').length, 0);
    totalNonWsChars += nonWsChars;
    
    if (pageItems.length < 10) {
      lowItemPages++;
    }
  }

  const avgNonWsCharsPerPage = totalNonWsChars / itemsPerPage.length;
  const lowItemPageRatio = lowItemPages / itemsPerPage.length;

  return avgNonWsCharsPerPage < 50 || lowItemPageRatio > 0.6;
}
