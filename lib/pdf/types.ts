export interface PositionedItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface Line {
  page: number;
  y: number;
  x0: number;
  x1: number;
  text: string;
}

export interface PageData {
  page: number;
  lines: Line[];
  text: string;
}

export interface CleanedDocument {
  isScanned: boolean;
  pageCount: number;
  qualityScore: number;
  warnings: string[];
  text: string;
  pages: Array<{ page: number; text: string }>;
  meta: {
    extractedChars: number;
    joinedLineBreaks: number;
    headersRemoved: number;
    columnsDetectedPages: number;
  };
}

export interface ProgressState {
  stage: 'idle' | 'extracting' | 'detecting columns' | 'removing headers' | 'repairing lines' | 'finalizing';
  currentPage: number;
  totalPages: number;
  percent: number;
}

export interface CleanPdfOptions {
  maxPages?: number;
  onProgress?: (progress: ProgressState) => void;
}
