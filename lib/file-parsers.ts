import { extractTextFromPDF } from './pdf-parser';

export interface ParsedFileResult {
  text: string;
  pdfData?: ArrayBuffer;
}

export async function parseFile(file: File): Promise<string> {
  const result = await parseFileWithData(file);
  return result.text;
}

export async function parseFileWithData(file: File): Promise<ParsedFileResult> {
  const fileName = file.name.toLowerCase();
  const fileType = file.type;

  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    const pdfData = await file.arrayBuffer();
    const text = await extractTextFromPDF(file);
    return { text, pdfData };
  }

  if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
    return { text: await parseDocx(file) };
  }

  if (fileType === 'application/epub+zip' || fileName.endsWith('.epub')) {
    return { text: await parseEpub(file) };
  }

  if (fileType === 'text/html' || fileName.endsWith('.html') || fileName.endsWith('.htm')) {
    return { text: await parseHtml(file) };
  }

  if (fileType === 'text/markdown' || fileName.endsWith('.md')) {
    return { text: await parseMarkdown(file) };
  }

  return { text: await readAsText(file) };
}

async function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function parseDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function parseEpub(file: File): Promise<string> {
  const ePub = (await import('epubjs')).default;
  const arrayBuffer = await file.arrayBuffer();
  const book = ePub(arrayBuffer);
  await book.ready;
  
  const spine = book.spine as any;
  const items = spine.items as any[];
  
  // Process spine items in parallel batches for better performance
  const BATCH_SIZE = 10;
  const results: (string | null)[] = new Array(items.length).fill(null);
  
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (item, batchIndex) => {
      const globalIndex = i + batchIndex;
      try {
        const doc = await book.load(item.href);
        if (doc && typeof doc === 'object' && 'body' in doc) {
          const body = (doc as Document).body;
          results[globalIndex] = body.textContent + '\n\n';
        }
      } catch (e) {
        console.warn('Could not load spine item:', item.href);
      }
    });
    await Promise.all(batchPromises);
  }
  
  const fullText = results.filter(Boolean).join('');
  return fullText.trim() || 'Could not extract text from EPUB';
}

function parseHtml(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const html = e.target?.result as string;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const scripts = doc.querySelectorAll('script, style, noscript');
      scripts.forEach(el => el.remove());
      
      const text = doc.body.textContent || '';
      resolve(text.replace(/\s+/g, ' ').trim());
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function parseMarkdown(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let text = e.target?.result as string;
      text = text.replace(/^#{1,6}\s+/gm, '');
      text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
      text = text.replace(/\*([^*]+)\*/g, '$1');
      text = text.replace(/`([^`]+)`/g, '$1');
      text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      text = text.replace(/^[-*+]\s+/gm, '');
      text = text.replace(/^\d+\.\s+/gm, '');
      text = text.replace(/^>\s+/gm, '');
      resolve(text.trim());
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
