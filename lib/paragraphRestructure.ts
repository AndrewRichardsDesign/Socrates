import { Block, BlockType, OptimizedDocument, Token, PauseMarker } from './optimizedLayout';

export interface RestructuredBlock extends Block {
  originalBlockIndex?: number;
  subparagraphIndex?: number;
}

export interface RestructuredDocument extends OptimizedDocument {
  blocks: RestructuredBlock[];
  originalBlockCount: number;
  restructuredBlockCount: number;
  tokenIndexMap: Map<number, number>;
}

const COMMON_ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'ave', 'blvd',
  'vs', 'etc', 'inc', 'ltd', 'corp', 'co', 'eg', 'ie', 'viz', 'cf',
  'approx', 'dept', 'est', 'govt', 'no', 'vol', 'rev', 'gen', 'col',
  'capt', 'lt', 'sgt', 'fig', 'al', 'ed', 'eds', 'trans', 'pp', 'ch',
  'sec', 'para', 'esp', 'max', 'min', 'avg', 'jan', 'feb', 'mar',
  'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
]);

const DISCOURSE_MARKERS = [
  'however', 'therefore', 'meanwhile', 'for example', 'in contrast',
  'on the other hand', 'additionally', 'furthermore', 'first', 'second',
  'third', 'finally', 'in summary', 'in conclusion', 'moreover',
  'nevertheless', 'consequently', 'as a result', 'in addition',
  'on the contrary', 'in other words', 'that is', 'namely',
  'specifically', 'for instance', 'thus', 'hence', 'accordingly'
];

const TARGET_WORDS_MIN = 18;
const TARGET_WORDS_MAX = 35;
const HARD_MAX_WORDS = 45;
const MIN_WORDS_PER_SUBPARAGRAPH = 8;
const MAX_SUBPARAGRAPHS = 8;

function isAbbreviation(word: string): boolean {
  const lower = word.toLowerCase().replace(/\.$/, '');
  if (COMMON_ABBREVIATIONS.has(lower)) return true;
  if (/^[A-Z]\.?$/.test(word)) return true;
  if (/^([A-Z]\.)+[A-Z]?$/.test(word)) return true;
  return false;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
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

function computeDensityScore(sentence: string): number {
  const words = sentence.split(/\s+/).filter(w => w);
  const wordCount = words.length;
  if (wordCount === 0) return 0;
  
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / wordCount;
  const commaCount = (sentence.match(/,/g) || []).length;
  const semicolonColonCount = (sentence.match(/[;:]/g) || []).length;
  const parenthesisCount = (sentence.match(/[()[\]{}]/g) || []).length;
  const longWords = words.filter(w => w.replace(/[^a-zA-Z]/g, '').length >= 8).length;
  const percentLongWords = longWords / wordCount;
  
  let score = 0;
  score += (avgWordLength - 4) * 0.5;
  score += commaCount * 2;
  score += semicolonColonCount * 3;
  score += parenthesisCount * 1.5;
  score += percentLongWords * 10;
  
  return score;
}

function isHighDensity(sentence: string): boolean {
  const wordCount = countWords(sentence);
  const densityScore = computeDensityScore(sentence);
  return densityScore > 8 || wordCount > 35;
}

function splitAtSafeSeparators(sentence: string): string[] {
  const separators = /\s*[;:—–]\s*/;
  const parts = sentence.split(separators).filter(p => p.trim());
  
  if (parts.length > 1 && parts.every(p => countWords(p) >= 6)) {
    return parts.map(p => p.trim());
  }
  
  const commaParts = sentence.split(/\s*,\s*/).filter(p => p.trim());
  if (commaParts.length > 1) {
    const merged: string[] = [];
    let current = '';
    
    for (const part of commaParts) {
      const testMerge = current ? `${current}, ${part}` : part;
      if (countWords(testMerge) <= TARGET_WORDS_MAX) {
        current = testMerge;
      } else if (countWords(current) >= MIN_WORDS_PER_SUBPARAGRAPH) {
        merged.push(current);
        current = part;
      } else {
        current = testMerge;
      }
    }
    
    if (current) {
      merged.push(current);
    }
    
    if (merged.length > 1 && merged.every(m => countWords(m) >= MIN_WORDS_PER_SUBPARAGRAPH)) {
      return merged;
    }
  }
  
  return [sentence];
}

function findDiscourseMarkerPosition(text: string): number {
  const lowerText = text.toLowerCase();
  
  for (const marker of DISCOURSE_MARKERS) {
    const regex = new RegExp(`\\s${marker}\\s`, 'i');
    const match = lowerText.match(regex);
    if (match && match.index !== undefined) {
      return match.index;
    }
  }
  
  return -1;
}

function splitAtDiscourseMarker(text: string, minWordsBefore: number = 10): string[] {
  const lowerText = text.toLowerCase();
  
  for (const marker of DISCOURSE_MARKERS) {
    const regex = new RegExp(`(\\s)(${marker})([,]?\\s)`, 'i');
    const match = text.match(regex);
    
    if (match && match.index !== undefined) {
      const before = text.slice(0, match.index).trim();
      const after = text.slice(match.index).trim();
      
      if (countWords(before) >= minWordsBefore && countWords(after) >= MIN_WORDS_PER_SUBPARAGRAPH) {
        return [before, after];
      }
    }
  }
  
  return [text];
}

function isInsideQuoteOrCode(text: string, position: number): boolean {
  let quoteCount = 0;
  let codeCount = 0;
  
  for (let i = 0; i < position; i++) {
    if (text[i] === '"' || text[i] === "'") quoteCount++;
    if (text[i] === '`') codeCount++;
  }
  
  return quoteCount % 2 === 1 || codeCount % 2 === 1;
}

function isEmphasisSentence(text: string): boolean {
  const wordCount = countWords(text);
  return wordCount <= 8 && /[!.]$/.test(text.trim());
}

export function restructureParagraph(text: string): string[] {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  
  const sentences = splitIntoSentences(normalizedText);
  
  if (sentences.length <= 2 && normalizedText.length <= 350) {
    return [normalizedText];
  }
  
  let processedSentences: string[] = [];
  
  for (const sentence of sentences) {
    if (isHighDensity(sentence)) {
      const splitParts = splitAtSafeSeparators(sentence);
      processedSentences.push(...splitParts);
    } else {
      processedSentences.push(sentence);
    }
  }
  
  let subparagraphs: string[] = [];
  let currentChunk: string[] = [];
  let currentWordCount = 0;
  
  for (let i = 0; i < processedSentences.length; i++) {
    const sentence = processedSentences[i];
    const sentenceWords = countWords(sentence);
    
    const discourseMarkerSplit = splitAtDiscourseMarker(sentence, 10);
    if (discourseMarkerSplit.length > 1) {
      if (currentChunk.length > 0 && currentWordCount >= MIN_WORDS_PER_SUBPARAGRAPH) {
        subparagraphs.push(currentChunk.join(' '));
        currentChunk = [];
        currentWordCount = 0;
      }
      
      for (const part of discourseMarkerSplit) {
        const partWords = countWords(part);
        
        if (currentWordCount + partWords > HARD_MAX_WORDS && currentChunk.length > 0) {
          if (currentWordCount >= MIN_WORDS_PER_SUBPARAGRAPH) {
            subparagraphs.push(currentChunk.join(' '));
            currentChunk = [];
            currentWordCount = 0;
          }
        }
        
        currentChunk.push(part);
        currentWordCount += partWords;
        
        if (currentWordCount >= TARGET_WORDS_MIN && currentWordCount <= TARGET_WORDS_MAX) {
          subparagraphs.push(currentChunk.join(' '));
          currentChunk = [];
          currentWordCount = 0;
        }
      }
      continue;
    }
    
    if (currentWordCount + sentenceWords > HARD_MAX_WORDS && currentChunk.length > 0) {
      if (currentWordCount >= MIN_WORDS_PER_SUBPARAGRAPH) {
        subparagraphs.push(currentChunk.join(' '));
        currentChunk = [];
        currentWordCount = 0;
      }
    }
    
    currentChunk.push(sentence);
    currentWordCount += sentenceWords;
    
    if (currentWordCount >= TARGET_WORDS_MIN && currentWordCount <= TARGET_WORDS_MAX) {
      subparagraphs.push(currentChunk.join(' '));
      currentChunk = [];
      currentWordCount = 0;
    }
  }
  
  if (currentChunk.length > 0) {
    const remaining = currentChunk.join(' ');
    const remainingWords = countWords(remaining);
    
    if (remainingWords < MIN_WORDS_PER_SUBPARAGRAPH && subparagraphs.length > 0 && !isEmphasisSentence(remaining)) {
      const lastIdx = subparagraphs.length - 1;
      subparagraphs[lastIdx] = subparagraphs[lastIdx] + ' ' + remaining;
    } else {
      subparagraphs.push(remaining);
    }
  }
  
  if (subparagraphs.length > MAX_SUBPARAGRAPHS) {
    const merged: string[] = [];
    let currentMerge = '';
    const targetPerMerge = Math.ceil(subparagraphs.length / MAX_SUBPARAGRAPHS);
    let count = 0;
    
    for (const sub of subparagraphs) {
      currentMerge = currentMerge ? `${currentMerge} ${sub}` : sub;
      count++;
      
      if (count >= targetPerMerge) {
        merged.push(currentMerge);
        currentMerge = '';
        count = 0;
      }
    }
    
    if (currentMerge) {
      if (merged.length > 0 && countWords(currentMerge) < MIN_WORDS_PER_SUBPARAGRAPH) {
        merged[merged.length - 1] = merged[merged.length - 1] + ' ' + currentMerge;
      } else {
        merged.push(currentMerge);
      }
    }
    
    subparagraphs = merged;
  }
  
  subparagraphs = subparagraphs.filter(s => s.trim().length > 0);
  
  if (subparagraphs.length === 0) {
    return [normalizedText];
  }
  
  return subparagraphs;
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

function generatePauseMarkers(tokens: Token[], blockType: BlockType, isSubparagraphEnd: boolean = false): PauseMarker[] {
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
    } else if (isSubparagraphEnd || blockType === 'paragraph' || blockType === 'list') {
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

export function restructureDocument(doc: OptimizedDocument, targetLineLength: number = 55): RestructuredDocument {
  const newBlocks: RestructuredBlock[] = [];
  const tokenIndexMap = new Map<number, number>();
  
  let oldGlobalTokenIndex = 0;
  let newGlobalTokenIndex = 0;
  
  for (let blockIdx = 0; blockIdx < doc.blocks.length; blockIdx++) {
    const block = doc.blocks[blockIdx];
    
    if (block.type !== 'paragraph') {
      const newBlock: RestructuredBlock = {
        ...block,
        originalBlockIndex: blockIdx,
        subparagraphIndex: 0
      };
      
      for (let i = 0; i < block.tokens.length; i++) {
        tokenIndexMap.set(oldGlobalTokenIndex, newGlobalTokenIndex);
        oldGlobalTokenIndex++;
        newGlobalTokenIndex++;
      }
      
      newBlocks.push(newBlock);
      continue;
    }
    
    const subparagraphs = restructureParagraph(block.text);
    
    for (let subIdx = 0; subIdx < subparagraphs.length; subIdx++) {
      const subText = subparagraphs[subIdx];
      const tokens = tokenizeText(subText);
      const lines = reflowText(subText, targetLineLength);
      const isSubparagraphEnd = true;
      const pauseMarkers = generatePauseMarkers(tokens, 'paragraph', isSubparagraphEnd);
      
      const newBlock: RestructuredBlock = {
        type: 'paragraph',
        text: subText,
        tokens,
        lines,
        pauseMarkers,
        originalBlockIndex: blockIdx,
        subparagraphIndex: subIdx
      };
      
      newBlocks.push(newBlock);
      
      for (let i = 0; i < tokens.length; i++) {
        newGlobalTokenIndex++;
      }
    }
    
    for (let i = 0; i < block.tokens.length; i++) {
      const mappedIndex = findNewTokenIndex(block, i, subparagraphs, newBlocks, blockIdx);
      tokenIndexMap.set(oldGlobalTokenIndex, mappedIndex);
      oldGlobalTokenIndex++;
    }
  }
  
  let totalTokens = 0;
  for (const block of newBlocks) {
    totalTokens += block.tokens.length;
  }
  
  return {
    blocks: newBlocks,
    totalTokens,
    originalBlockCount: doc.blocks.length,
    restructuredBlockCount: newBlocks.length,
    tokenIndexMap
  };
}

function findNewTokenIndex(
  originalBlock: Block,
  localTokenIndex: number,
  subparagraphs: string[],
  newBlocks: RestructuredBlock[],
  originalBlockIndex: number
): number {
  let globalIndex = 0;
  
  for (const block of newBlocks) {
    if (block.originalBlockIndex === originalBlockIndex) {
      const originalToken = originalBlock.tokens[localTokenIndex];
      if (!originalToken) break;
      
      for (let i = 0; i < block.tokens.length; i++) {
        const newToken = block.tokens[i];
        if (newToken.text === originalToken.text) {
          return globalIndex + i;
        }
      }
    }
    globalIndex += block.tokens.length;
  }
  
  return 0;
}

export function mapTokenIndex(doc: RestructuredDocument, oldIndex: number): number {
  return doc.tokenIndexMap.get(oldIndex) ?? 0;
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function validateRestructure(original: string, subparagraphs: string[]): boolean {
  const normalizedOriginal = normalizeWhitespace(original);
  const normalizedRestructured = normalizeWhitespace(subparagraphs.join(' '));
  return normalizedOriginal === normalizedRestructured;
}
