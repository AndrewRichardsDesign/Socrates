import { cleanPdf } from './pdf/cleanPdf';
import type { CleanPdfOptions } from './pdf/types';

/**
 * Extracts reading-ready text from a PDF file.
 *
 * Thin wrapper over the cleanPdf pipeline (extract -> columns -> headers/footers
 * -> line repair -> normalize) that returns just the text, which is all the
 * file-parsers entry point needs.
 */
export async function extractTextFromPDF(
  file: File,
  options: CleanPdfOptions = {}
): Promise<string> {
  const result = await cleanPdf(file, options);

  if (result.isScanned && !result.text.trim()) {
    throw new Error(
      'This PDF appears to be scanned images with no embedded text. Try a text-based PDF.'
    );
  }

  return result.text;
}
