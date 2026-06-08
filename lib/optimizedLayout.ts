export type BlockType = 'heading' | 'paragraph' | 'list';

export interface Token {
  text: string;
  startIndex: number;
  endIndex: number;
  isPunctuation: boolean;
}

export interface PauseMarker {
  type: 'sentence' | 'paragraph' | 'heading';
  duration: number;
  afterTokenIndex: number;
}

export interface Block {
  type: BlockType;
  text: string;
  tokens: Token[];
  lines: string[];
  pauseMarkers: PauseMarker[];
}

export interface OptimizedDocument {
  blocks: Block[];
  totalTokens: number;
}

const SENTENCE_END_REGEX = /[.!?]$/;
const LIST_ITEM_REGEX = /^(\s*[-*•]|\s*\d+[.)]\s)/;
const HEADING_MAX_LENGTH = 60;

const COMMON_ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'ave', 'blvd',
  'vs', 'etc', 'inc', 'ltd', 'corp', 'co', 'eg', 'ie', 'viz', 'cf',
  'approx', 'dept', 'est', 'govt', 'no', 'vol', 'rev', 'gen', 'col',
  'capt', 'lt', 'sgt', 'fig', 'al', 'ed', 'eds', 'trans', 'pp', 'ch',
  'sec', 'para', 'esp', 'max', 'min', 'avg', 'jan', 'feb', 'mar',
  'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
]);

function isAbbreviation(word: string): boolean {
  const lower = word.toLowerCase().replace(/\.$/, '');
  if (COMMON_ABBREVIATIONS.has(lower)) return true;
  if (/^[A-Z]\.?$/.test(word)) return true;
  if (/^([A-Z]\.)+[A-Z]?$/.test(word)) return true;
  return false;
}

function isHeading(line: string, nextLine: string | undefined): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  
  if (trimmed.length > HEADING_MAX_LENGTH) return false;
  
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && trimmed.length > 1) {
    return true;
  }
  
  if (trimmed.endsWith(':')) {
    return true;
  }
  
  if (/^(Chapter|Section|Part|Article)\s+[\dIVXLCDM]+/i.test(trimmed)) {
    return true;
  }
  
  if (nextLine === '' || nextLine === undefined) {
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount <= 8 && !/[.!?,;]$/.test(trimmed)) {
      return true;
    }
  }
  
  return false;
}

function isListItem(line: string): boolean {
  return LIST_ITEM_REGEX.test(line);
}

function splitIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  let current = '';
  const words = text.split(/\s+/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    current += (current ? ' ' : '') + word;
    
    if (/[.!?]["']?$/.test(word)) {
      const cleanWord = word.replace(/["']?[.!?]["']?$/, '');
      
      if (isAbbreviation(cleanWord + '.')) {
        continue;
      }
      
      const nextWord = words[i + 1];
      if (nextWord && /^[a-z]/.test(nextWord)) {
        continue;
      }
      
      sentences.push(current.trim());
      current = '';
    }
  }
  
  if (current.trim()) {
    sentences.push(current.trim());
  }
  
  return sentences;
}

function splitLongParagraph(text: string): string[] {
  const sentences = splitIntoSentences(text);
  
  if (sentences.length <= 3 && text.length <= 500) {
    return [text];
  }
  
  const subParagraphs: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;
  
  for (const sentence of sentences) {
    if (currentChunk.length >= 3 || (currentLength + sentence.length > 450 && currentChunk.length > 0)) {
      subParagraphs.push(currentChunk.join(' '));
      currentChunk = [];
      currentLength = 0;
    }
    
    currentChunk.push(sentence);
    currentLength += sentence.length + 1;
  }
  
  if (currentChunk.length > 0) {
    subParagraphs.push(currentChunk.join(' '));
  }
  
  return subParagraphs;
}

function tokenizeText(text: string): Token[] {
  const tokens: Token[] = [];
  const regex = /(\S+)/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const word = match[1];
    const startIndex = match.index;
    const endIndex = startIndex + word.length;
    
    const punctuationMatch = word.match(/^([.,!?;:'"()[\]{}…—–-]+)?(.+?)([.,!?;:'"()[\]{}…—–-]+)?$/);
    
    if (punctuationMatch) {
      const [, leadingPunct, core, trailingPunct] = punctuationMatch;
      let currentIndex = startIndex;
      
      if (leadingPunct) {
        tokens.push({
          text: leadingPunct,
          startIndex: currentIndex,
          endIndex: currentIndex + leadingPunct.length,
          isPunctuation: true
        });
        currentIndex += leadingPunct.length;
      }
      
      if (core) {
        tokens.push({
          text: core,
          startIndex: currentIndex,
          endIndex: currentIndex + core.length,
          isPunctuation: false
        });
        currentIndex += core.length;
      }
      
      if (trailingPunct) {
        tokens.push({
          text: trailingPunct,
          startIndex: currentIndex,
          endIndex: currentIndex + trailingPunct.length,
          isPunctuation: true
        });
      }
    } else {
      tokens.push({
        text: word,
        startIndex,
        endIndex,
        isPunctuation: false
      });
    }
  }
  
  return tokens;
}

function reflowText(text: string, targetLineLength: number = 55): string[] {
  const words = text.split(/\s+/).filter(w => w);
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= targetLineLength) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

function generatePauseMarkers(tokens: Token[], blockType: BlockType): PauseMarker[] {
  const markers: PauseMarker[] = [];
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    if (token.isPunctuation && /[.!?]/.test(token.text)) {
      let wordTokenIndex = i - 1;
      while (wordTokenIndex >= 0 && tokens[wordTokenIndex].isPunctuation) {
        wordTokenIndex--;
      }
      if (wordTokenIndex >= 0) {
        markers.push({
          type: 'sentence',
          duration: 150,
          afterTokenIndex: wordTokenIndex
        });
      }
    }
  }
  
  let lastWordTokenIndex = tokens.length - 1;
  while (lastWordTokenIndex >= 0 && tokens[lastWordTokenIndex].isPunctuation) {
    lastWordTokenIndex--;
  }
  
  if (lastWordTokenIndex >= 0) {
    const existingMarker = markers.find(m => m.afterTokenIndex === lastWordTokenIndex);
    
    if (blockType === 'heading') {
      if (existingMarker) {
        existingMarker.type = 'heading';
        existingMarker.duration = 300;
      } else {
        markers.push({
          type: 'heading',
          duration: 300,
          afterTokenIndex: lastWordTokenIndex
        });
      }
    } else if (blockType === 'paragraph' || blockType === 'list') {
      if (existingMarker) {
        existingMarker.type = 'paragraph';
        existingMarker.duration = 200;
      } else {
        markers.push({
          type: 'paragraph',
          duration: 200,
          afterTokenIndex: lastWordTokenIndex
        });
      }
    }
  }
  
  return markers;
}

export function optimizeDocument(text: string, targetLineLength: number = 55): OptimizedDocument {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      i++;
      continue;
    }
    
    const nextLine = lines[i + 1]?.trim();
    
    if (isHeading(trimmedLine, nextLine)) {
      const tokens = tokenizeText(trimmedLine);
      blocks.push({
        type: 'heading',
        text: trimmedLine,
        tokens,
        lines: [trimmedLine],
        pauseMarkers: generatePauseMarkers(tokens, 'heading')
      });
      i++;
      continue;
    }
    
    if (isListItem(trimmedLine)) {
      const listItems: string[] = [];
      while (i < lines.length) {
        const currentLine = lines[i]?.trim();
        if (!currentLine) break;
        if (!isListItem(currentLine)) break;
        listItems.push(currentLine);
        i++;
      }
      
      const fullText = listItems.join('\n');
      const tokens = tokenizeText(fullText);
      blocks.push({
        type: 'list',
        text: fullText,
        tokens,
        lines: listItems,
        pauseMarkers: generatePauseMarkers(tokens, 'list')
      });
      continue;
    }
    
    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i]?.trim() && !isListItem(lines[i]?.trim())) {
      const currentTrimmed = lines[i].trim();
      const nextTrimmed = lines[i + 1]?.trim();
      
      if (isHeading(currentTrimmed, nextTrimmed) && paragraphLines.length > 0) {
        break;
      }
      
      paragraphLines.push(currentTrimmed);
      i++;
      
      if (lines[i]?.trim() === '') {
        i++;
        break;
      }
    }
    
    if (paragraphLines.length === 0) {
      i++;
      continue;
    }
    
    const fullParagraph = paragraphLines.join(' ');
    const subParagraphs = splitLongParagraph(fullParagraph);
    
    for (const subPara of subParagraphs) {
      const tokens = tokenizeText(subPara);
      const reflowedLines = reflowText(subPara, targetLineLength);
      
      blocks.push({
        type: 'paragraph',
        text: subPara,
        tokens,
        lines: reflowedLines,
        pauseMarkers: generatePauseMarkers(tokens, 'paragraph')
      });
    }
  }
  
  let totalTokens = 0;
  for (const block of blocks) {
    totalTokens += block.tokens.length;
  }
  
  return { blocks, totalTokens };
}

export function getWordTokens(doc: OptimizedDocument): Token[] {
  const allTokens: Token[] = [];
  for (const block of doc.blocks) {
    allTokens.push(...block.tokens.filter(t => !t.isPunctuation));
  }
  return allTokens;
}

export function getAllTokens(doc: OptimizedDocument): { token: Token; blockIndex: number; tokenIndex: number }[] {
  const result: { token: Token; blockIndex: number; tokenIndex: number }[] = [];
  
  for (let blockIndex = 0; blockIndex < doc.blocks.length; blockIndex++) {
    const block = doc.blocks[blockIndex];
    for (let tokenIndex = 0; tokenIndex < block.tokens.length; tokenIndex++) {
      result.push({
        token: block.tokens[tokenIndex],
        blockIndex,
        tokenIndex
      });
    }
  }
  
  return result;
}

export function getPauseAfterToken(doc: OptimizedDocument, globalTokenIndex: number): number | null {
  let currentIndex = 0;
  
  for (const block of doc.blocks) {
    for (let i = 0; i < block.tokens.length; i++) {
      if (currentIndex === globalTokenIndex) {
        const marker = block.pauseMarkers.find(m => m.afterTokenIndex === i);
        return marker ? marker.duration : null;
      }
      currentIndex++;
    }
  }
  
  return null;
}

export function getBlockAtToken(doc: OptimizedDocument, globalTokenIndex: number): { block: Block; blockIndex: number; localTokenIndex: number } | null {
  let currentIndex = 0;
  
  for (let blockIndex = 0; blockIndex < doc.blocks.length; blockIndex++) {
    const block = doc.blocks[blockIndex];
    for (let i = 0; i < block.tokens.length; i++) {
      if (currentIndex === globalTokenIndex) {
        return { block, blockIndex, localTokenIndex: i };
      }
      currentIndex++;
    }
  }
  
  return null;
}
