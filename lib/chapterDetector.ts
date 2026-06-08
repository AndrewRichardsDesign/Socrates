export interface ChapterInfo {
  title: string;
  wordIndex: number;
  charIndex: number;
}

export interface WordPosition {
  wordIndex: number;
  charStart: number;
  charEnd: number;
}

// This must match the tokenization logic in optimizedLayout.ts exactly
// to ensure chapter word indices align with the words array
export function buildWordPositionMap(content: string): WordPosition[] {
  const positions: WordPosition[] = [];
  const regex = /(\S+)/g;
  let match;
  let wordIndex = 0;
  
  while ((match = regex.exec(content)) !== null) {
    const word = match[1];
    const startIndex = match.index;
    
    // Match the exact tokenization from optimizedLayout.ts
    const punctuationMatch = word.match(/^([.,!?;:'"()[\]{}…—–-]+)?(.+?)([.,!?;:'"()[\]{}…—–-]+)?$/);
    
    if (punctuationMatch) {
      const [, leadingPunct, core, trailingPunct] = punctuationMatch;
      let currentIndex = startIndex;
      
      // Each part becomes a separate token/word (matching optimizedLayout.ts)
      if (leadingPunct) {
        positions.push({
          wordIndex,
          charStart: currentIndex,
          charEnd: currentIndex + leadingPunct.length
        });
        wordIndex++;
        currentIndex += leadingPunct.length;
      }
      
      if (core) {
        positions.push({
          wordIndex,
          charStart: currentIndex,
          charEnd: currentIndex + core.length
        });
        wordIndex++;
        currentIndex += core.length;
      }
      
      if (trailingPunct) {
        positions.push({
          wordIndex,
          charStart: currentIndex,
          charEnd: currentIndex + trailingPunct.length
        });
        wordIndex++;
      }
    } else {
      positions.push({
        wordIndex,
        charStart: startIndex,
        charEnd: startIndex + word.length
      });
      wordIndex++;
    }
  }
  
  return positions;
}

const CHAPTER_PATTERNS = [
  /^chapter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)(\s|:|\.|\n|$)/i,
  /^(act\s+)?scene\s+(\d+|one|two|three|four|five|i|ii|iii|iv|v|vi|vii|viii|ix|x)/i,
  /^act\s+(\d+|one|two|three|four|five|i|ii|iii|iv|v)/i,
  /^part\s+(one|two|three|four|five|six|seven|eight|1|2|3|4|5|6|7|8|i|ii|iii|iv|v|vi|vii|viii)(\s|:|\.|\n|$)/i,
  /^book\s+(one|two|three|four|five|1|2|3|4|5|i|ii|iii|iv|v)(\s|:|\.|\n|$)/i,
  /^letter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|i|ii|iii|iv|v|vi|vii|viii|ix|x)(\s|:|\.|\n|$)/i,
  /^volume\s+(one|two|three|1|2|3|i|ii|iii)(\s|:|\.|\n|$)/i,
  /^adventure\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)(\s|:|\.|\n|$)/i,
  /^story\s+(\d+|one|two|three|four|five|i|ii|iii|iv|v)(\s|:|\.|\n|$)/i,
  /^canto\s+(\d+|one|two|three|four|five|i|ii|iii|iv|v|vi|vii|viii|ix|x)(\s|:|\.|\n|$)/i,
  /^stanza\s+(\d+|one|two|three|four|i|ii|iii|iv|v)(\s|:|\.|\n|$)/i,
  /^song\s+(\d+|one|two|three|four|i|ii|iii|iv|v)(\s|:|\.|\n|$)/i,
  /^(entry|day)\s+(\d+|one|two|three|four|i|ii|iii|iv|v)(\s|:|\.|\n|$)/i,
  /^section\s+(\d+|one|two|three|four|five|i|ii|iii|iv|v)(\s|:|\.|\n|$)/i,
  /^prologue(\s|:|\.|\n|$)/i,
  /^epilogue(\s|:|\.|\n|$)/i,
  /^introduction(\s|:|\.|\n|$)/i,
  /^preface(\s|:|\.|\n|$)/i,
  /^conclusion(\s|:|\.|\n|$)/i,
];

function isChapterHeading(text: string): boolean {
  const trimmed = text.trim();
  for (const pattern of CHAPTER_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  return false;
}

function findGutenbergStart(content: string): number {
  const match = content.match(/\*\*\*\s*START\s+OF\s+(THE|THIS)\s+PROJECT\s+GUTENBERG[^\n]*/i);
  if (match && match.index !== undefined) {
    let idx = match.index + match[0].length;
    while (idx < content.length && content[idx] === '\n') {
      idx++;
    }
    return idx;
  }
  return 0;
}

export function detectChapters(content: string, words: string[]): ChapterInfo[] {
  const allChapters: ChapterInfo[] = [];
  
  const wordPositions = buildWordPositionMap(content);
  
  const gutenbergStart = findGutenbergStart(content);
  const effectiveContent = content.slice(gutenbergStart);
  const lines = effectiveContent.split('\n');
  
  let charIndex = gutenbergStart;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (trimmed.length > 0 && trimmed.length <= 100) {
      const prevLine = i > 0 ? lines[i - 1].trim() : '';
      const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
      const hasSurroundingWhitespace = prevLine === '' || nextLine === '';
      
      if (hasSurroundingWhitespace && isChapterHeading(trimmed)) {
        const wordIndex = findWordIndexFromPositionMap(wordPositions, charIndex);
        
        let title = trimmed;
        if (nextLine && !isChapterHeading(nextLine) && nextLine.length <= 60) {
          const wordsInNext = nextLine.split(/\s+/).length;
          if (wordsInNext <= 8 && lines[i + 2]?.trim() === '') {
            title = trimmed + ': ' + nextLine;
          }
        }
        
        allChapters.push({
          title: formatChapterTitle(title),
          wordIndex,
          charIndex,
        });
      }
    }
    
    charIndex += line.length + 1;
  }
  
  // Deduplicate chapters: if the same title appears multiple times (e.g., ToC entry + actual chapter),
  // keep only the LAST occurrence which is typically the actual chapter content, not the ToC
  const chapterByTitle = new Map<string, ChapterInfo>();
  for (const ch of allChapters) {
    // Normalize title for comparison (lowercase, remove extra whitespace)
    const normalizedTitle = ch.title.toLowerCase().replace(/\s+/g, ' ').trim();
    chapterByTitle.set(normalizedTitle, ch);
  }
  
  // Return chapters in their original order based on wordIndex
  const chapters = Array.from(chapterByTitle.values())
    .sort((a, b) => a.wordIndex - b.wordIndex);
  
  return chapters;
}

function findWordIndexFromPositionMap(positions: WordPosition[], targetCharPos: number): number {
  if (positions.length === 0) return 0;
  
  for (let i = 0; i < positions.length; i++) {
    if (positions[i].charStart >= targetCharPos) {
      return positions[i].wordIndex;
    }
  }
  
  return positions.length > 0 ? positions[positions.length - 1].wordIndex : 0;
}


function formatChapterTitle(title: string): string {
  const lines = title.split(':').map(s => s.trim()).filter(s => s);
  
  if (lines.length === 1) {
    return capitalizeTitle(lines[0]);
  }
  
  const chapterPart = capitalizeTitle(lines[0]);
  const namePart = lines.slice(1).join(': ').trim();
  
  if (namePart) {
    return `${chapterPart}: ${capitalizeTitle(namePart)}`;
  }
  
  return chapterPart;
}

function capitalizeTitle(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (word.length === 0) return word;
      if (/^[ivxlcdm]+$/i.test(word)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
