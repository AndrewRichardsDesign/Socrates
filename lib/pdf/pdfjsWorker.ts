import { GlobalWorkerOptions } from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export function configurePdfWorker() {
  GlobalWorkerOptions.workerSrc = workerUrl;
}

export { pdfjsLib };
