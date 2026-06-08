import React, { useEffect, useRef, useState, useLayoutEffect, useMemo, memo, useCallback, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { renderBionicWord } from "@/lib/bionic";
import type { ChapterInfo } from "@/lib/chapterDetector";

// Memoized highlight component - only re-renders when lineAnimation or isPlaying changes
// This decouples the animation from word-by-word React updates
interface HighlightProps {
  lineAnimation: {
    lineStart: number;
    lineEnd: number;
    startLeft: number;
    endLeft: number;
    top: number;
    height: number;
    width: number;
    duration: number;
  };
  highlightStyle: 'block' | 'underline' | 'line-start';
  highlightColor: string;
  fontSize: number;
  isPlaying: boolean;
  currentWordProgress: number; // 0-1 progress through the line
  showTrail: boolean;
}

const GlidingHighlight = memo(function GlidingHighlight({
  lineAnimation,
  highlightStyle,
  highlightColor,
  fontSize,
  isPlaying,
  currentWordProgress,
  showTrail
}: HighlightProps) {
  const highlightRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const prevLineAnimationRef = useRef(lineAnimation);
  
  // Handle line changes and play/pause - update animation imperatively
  useLayoutEffect(() => {
    const highlightEl = highlightRef.current;
    const trailEl = trailRef.current;
    if (!highlightEl) return;
    
    const isNewLine = prevLineAnimationRef.current !== lineAnimation;
    prevLineAnimationRef.current = lineAnimation;
    
    // Update CSS custom properties for the new line
    highlightEl.style.setProperty('--highlight-start', `${lineAnimation.startLeft}px`);
    highlightEl.style.setProperty('--highlight-end', `${lineAnimation.endLeft}px`);
    
    // Update position styles
    highlightEl.style.top = `${lineAnimation.top}px`;
    highlightEl.style.height = `${lineAnimation.height}px`;
    
    // Also update trail element
    const lineWidth = lineAnimation.endLeft - lineAnimation.startLeft + lineAnimation.width;
    if (trailEl) {
      trailEl.style.top = `${lineAnimation.top}px`;
      trailEl.style.height = `${lineAnimation.height}px`;
      trailEl.style.left = `${lineAnimation.startLeft}px`;
      trailEl.style.setProperty('--trail-width', `${lineWidth}px`);
    }
    
    if (isPlaying) {
      // For new lines, start from the beginning (progress 0)
      // For resume, use current word progress
      const progress = isNewLine ? 0 : currentWordProgress;
      const delay = -progress * lineAnimation.duration;
      
      // Force animation restart by briefly removing it
      highlightEl.style.animation = 'none';
      if (trailEl) trailEl.style.animation = 'none';
      // Force reflow to ensure animation restarts
      void highlightEl.offsetWidth;
      
      highlightEl.style.animation = `highlightGlide ${lineAnimation.duration}ms linear forwards`;
      highlightEl.style.animationDelay = `${delay}ms`;
      
      // Trail follows the same animation timing
      if (trailEl) {
        trailEl.style.animation = `trailExpand ${lineAnimation.duration}ms linear forwards`;
        trailEl.style.animationDelay = `${delay}ms`;
      }
    } else {
      // Pausing - calculate current position and set it directly
      const currentLeft = lineAnimation.startLeft + currentWordProgress * (lineAnimation.endLeft - lineAnimation.startLeft);
      highlightEl.style.animation = 'none';
      highlightEl.style.left = `${currentLeft}px`;
      
      // Trail width matches current progress
      if (trailEl) {
        const trailWidth = currentLeft - lineAnimation.startLeft + lineAnimation.width;
        trailEl.style.animation = 'none';
        trailEl.style.width = `${Math.max(0, trailWidth)}px`;
      }
    }
  }, [isPlaying, lineAnimation, currentWordProgress]);
  
  return (
    <>
      {/* Trail overlay - shows "read" portion of the line (only when showTrail is enabled) */}
      {showTrail && (highlightStyle === 'block' || highlightStyle === 'underline') && (
        <div
          ref={trailRef}
          className="absolute pointer-events-none"
          style={{
            ...(highlightStyle === 'block' ? {
              backgroundColor: highlightColor + '80', // 50% opacity - more visible
              borderRadius: `${Math.max(2, fontSize * 0.1)}px`,
            } : {
              borderBottom: `${Math.round(Math.max(2, fontSize * 0.15))}px solid ${highlightColor}80`, // 50% opacity
            }),
            zIndex: 0,
            width: 0, // Starts at 0, expands via animation
            // top, left, height set via useEffect to avoid conflicts
          }}
        />
      )}
      
      {/* Main highlight - zIndex 0 so text (zIndex 1+) appears above it */}
      <div
        ref={highlightRef}
        className="absolute pointer-events-none"
        style={{ 
          ...(highlightStyle === 'block' ? {
            backgroundColor: highlightColor,
            borderRadius: `${Math.max(2, fontSize * 0.1)}px`,
            zIndex: 0,
          } : highlightStyle === 'underline' ? {
            borderBottom: `${Math.round(Math.max(2, fontSize * 0.15))}px solid ${highlightColor}`,
            zIndex: 0,
          } : {
            backgroundColor: highlightColor,
            borderRadius: `${Math.max(1, fontSize * 0.03)}px`,
            zIndex: 0,
          }),
          width: highlightStyle === 'line-start' ? Math.round(Math.max(2, fontSize * 0.12)) : lineAnimation.width,
          // top, left, height set via useEffect to avoid conflicts
        }}
      />
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if these change
  // Allow lineAnimation changes to trigger re-render for line transitions
  return prevProps.isPlaying === nextProps.isPlaying &&
         prevProps.lineAnimation === nextProps.lineAnimation &&
         prevProps.highlightStyle === nextProps.highlightStyle &&
         prevProps.highlightColor === nextProps.highlightColor &&
         prevProps.fontSize === nextProps.fontSize &&
         prevProps.showTrail === nextProps.showTrail &&
         // Only check currentWordProgress if we're pausing (not playing)
         (prevProps.isPlaying || prevProps.currentWordProgress === nextProps.currentWordProgress);
});

interface FindHighlightInfo {
  wordIndex: number;
  left: number;
  top: number;
  width: number;
  height: number;
  isCurrentMatch: boolean;
}

interface FindHighlightsProps {
  findText: string;
  findMatches: number[];
  currentMatchIndex: number;
  words: string[];
  wordRefs: React.MutableRefObject<(HTMLSpanElement | null)[]>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  currentIndex: number;
}

const FindHighlights = memo(function FindHighlights({
  findText,
  findMatches,
  currentMatchIndex,
  words,
  wordRefs,
  contentRef,
  containerRef,
  currentIndex
}: FindHighlightsProps) {
  const [highlights, setHighlights] = useState<FindHighlightInfo[]>([]);
  const [scrollTrigger, setScrollTrigger] = useState(0);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrollTrigger(t => t + 1);
          ticking = false;
        });
        ticking = true;
      }
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef]);
  
  useLayoutEffect(() => {
    if (!findText || findMatches.length === 0 || !contentRef.current) {
      setHighlights([]);
      return;
    }
    
    const newHighlights: FindHighlightInfo[] = [];
    const searchLower = findText.toLowerCase();
    const contentRect = contentRef.current.getBoundingClientRect();
    
    for (let i = 0; i < findMatches.length; i++) {
      const wordIndex = findMatches[i];
      const wordEl = wordRefs.current[wordIndex];
      const word = words[wordIndex];
      
      if (!wordEl || !word) continue;
      
      const wordLower = word.toLowerCase();
      const matchStart = wordLower.indexOf(searchLower);
      
      if (matchStart === -1) continue;
      
      const wordRect = wordEl.getBoundingClientRect();
      const wordText = wordEl.textContent || word;
      
      const range = document.createRange();
      const textNode = wordEl.firstChild;
      
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        try {
          range.setStart(textNode, matchStart);
          range.setEnd(textNode, Math.min(matchStart + findText.length, wordText.length));
          const matchRect = range.getBoundingClientRect();
          
          newHighlights.push({
            wordIndex,
            left: matchRect.left - contentRect.left,
            top: matchRect.top - contentRect.top,
            width: matchRect.width,
            height: matchRect.height,
            isCurrentMatch: i === currentMatchIndex
          });
        } catch (e) {
        }
      } else {
        const charWidth = wordRect.width / word.length;
        newHighlights.push({
          wordIndex,
          left: wordRect.left - contentRect.left + matchStart * charWidth,
          top: wordRect.top - contentRect.top,
          width: findText.length * charWidth,
          height: wordRect.height,
          isCurrentMatch: i === currentMatchIndex
        });
      }
    }
    
    setHighlights(newHighlights);
  }, [findText, findMatches, currentMatchIndex, words, wordRefs, contentRef, currentIndex, scrollTrigger]);
  
  if (highlights.length === 0) return null;
  
  return (
    <>
      {highlights.map((h, idx) => (
        <div
          key={`find-${h.wordIndex}-${idx}`}
          className="absolute pointer-events-none"
          style={{
            left: h.left,
            top: h.top,
            width: h.width,
            height: h.height,
            backgroundColor: h.isCurrentMatch ? 'rgba(255, 200, 0, 0.6)' : 'rgba(255, 200, 0, 0.35)',
            borderRadius: '2px',
            zIndex: 5,
            transition: 'background-color 0.15s ease'
          }}
        />
      ))}
    </>
  );
});

const VISIBLE_WINDOW = 150;

// Helper to find the exact word index at a click position using browser text APIs
function findWordIndexAtPoint(
  x: number, 
  y: number, 
  textContent: string, 
  baseIndex: number
): number | null {
  // Try to get the caret position at the click point
  let range: Range | null = null;
  
  // Use caretRangeFromPoint (WebKit/Blink) or caretPositionFromPoint (Firefox)
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
  } else if ((document as any).caretPositionFromPoint) {
    const pos = (document as any).caretPositionFromPoint(x, y);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.setEnd(pos.offsetNode, pos.offset);
    }
  }
  
  if (!range || !range.startContainer || range.startContainer.nodeType !== Node.TEXT_NODE) {
    return null;
  }
  
  const textNode = range.startContainer as Text;
  const charOffset = range.startOffset;
  const fullText = textNode.textContent || '';
  
  // Count words up to the character offset
  let wordCount = 0;
  let inWord = false;
  
  for (let i = 0; i < charOffset && i < fullText.length; i++) {
    const isSpace = /\s/.test(fullText[i]);
    if (!isSpace && !inWord) {
      wordCount++;
      inWord = true;
    } else if (isSpace) {
      inWord = false;
    }
  }
  
  // Adjust: if we're at the start of a word, count it
  if (charOffset < fullText.length && !/\s/.test(fullText[charOffset])) {
    if (charOffset === 0 || /\s/.test(fullText[charOffset - 1])) {
      // We're at the start of a new word
    } else {
      // We're in the middle of a word, already counted
    }
  }
  
  // Convert to global word index
  return baseIndex + Math.max(0, wordCount - 1);
}

interface ScrollDisplayProps {
  words: string[];
  currentIndex: number;
  linePercent: number;
  multipleWords: boolean;
  isPlaying: boolean;
  onWordClick: (index: number) => void;
  onChunkSizeChange?: (chunkSize: number) => void;
  columnWidth: number;
  showTrail?: boolean;
  useWindowMask?: boolean;
  highlightStyle?: 'block' | 'underline' | 'line-start' | 'bold' | 'none';
  highlightColor?: string;
  fontSize: number;
  fontFamily?: string;
  wpm?: number;
  fontWeight: string;
  fontColor?: string;
  useBionicReading?: boolean;
  onTogglePlay: () => void;
  onPause?: () => void;
  displayStartIndex?: number;
  chapters?: ChapterInfo[];
  findText?: string;
  findMatches?: number[];
  currentMatchIndex?: number;
  onLineDurationChange?: (duration: number) => void;
}

export function ScrollDisplay({ 
  words, 
  currentIndex, 
  linePercent,
  multipleWords, 
  isPlaying, 
  onWordClick, 
  onChunkSizeChange,
  columnWidth, 
  showTrail = false, 
  useWindowMask = false, 
  highlightStyle = 'block', 
  highlightColor = '#facc15',
  fontSize,
  fontFamily = 'Inter',
  wpm = 300,
  fontWeight,
  fontColor = '#000000',
  useBionicReading = false,
  onTogglePlay,
  onPause,
  displayStartIndex = 0,
  chapters = [],
  findText = '',
  findMatches = [],
  currentMatchIndex = -1,
  onLineDurationChange
}: ScrollDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const skipAutoScrollRef = useRef(false);
  const scrollToActiveAfterRenderRef = useRef(false);
  const clickYPositionRef = useRef<number | null>(null);
  
  const [trailIndices, setTrailIndices] = useState<Set<number>>(new Set());
  const prevCurrentIndexRef = useRef(currentIndex);
  
  // Cache consistent line metrics to prevent highlight shifting between lines
  // Measured once when fontSize/fontFamily changes using a reference element
  const cachedLineMetricsRef = useRef<{ height: number; baseline: number } | null>(null);
  const measurementRef = useRef<HTMLSpanElement>(null);
  
  // Track scroll version to force scroll after large jumps
  const [scrollVersion, setScrollVersion] = useState(0);
  
  // Track visible word range for bionic reading (based on scroll position)
  const [visibleWordRange, setVisibleWordRange] = useState<{ start: number; end: number }>({ start: 0, end: VISIBLE_WINDOW * 2 });
  
  // Detect large jumps in currentIndex (e.g., chapter navigation)
  useEffect(() => {
    const prevIndex = prevCurrentIndexRef.current;
    const indexDiff = Math.abs(currentIndex - prevIndex);
    prevCurrentIndexRef.current = currentIndex;
    
    // If jump is larger than visible window, increment scroll version to trigger scroll
    if (indexDiff > VISIBLE_WINDOW / 2) {
      // Force a state update which will cause a re-render, then scroll in the layout effect below
      setScrollVersion(v => v + 1);
    }
  }, [currentIndex]);
  
  // Scroll to active word after a version change (triggered by large jump)
  useLayoutEffect(() => {
    if (scrollVersion === 0) return; // Skip initial mount
    
    const scrollToActive = () => {
      if (!containerRef.current || !activeWordRef.current) return;
      
      const container = containerRef.current;
      const element = activeWordRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      const currentRelativeTop = elementRect.top - containerRect.top;
      const targetOffset = containerRect.height * 0.35;
      const targetScrollTop = container.scrollTop + (currentRelativeTop - targetOffset);
      
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'instant'
      });
    };
    
    // Use requestAnimationFrame to ensure the DOM is ready
    const frameId = requestAnimationFrame(() => {
      requestAnimationFrame(scrollToActive);
    });
    
    return () => cancelAnimationFrame(frameId);
  }, [scrollVersion]);
  
  // Calculate and cache consistent line metrics when fontSize/fontFamily changes
  // This ensures all highlights use the same height regardless of per-word glyph variations
  useEffect(() => {
    // Reset cached value when fontSize or fontFamily changes
    cachedLineMetricsRef.current = null;
  }, [fontSize, fontFamily]);
  
  // Pause on manual scroll - use wheel/touch events instead of scroll event
  // This avoids conflicts with programmatic scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleManualScroll = () => {
      if (isPlaying && onPause) {
        onPause();
      }
    };
    
    // Wheel event = mouse scroll wheel
    container.addEventListener('wheel', handleManualScroll, { passive: true });
    // Touch move = finger scroll on mobile
    container.addEventListener('touchmove', handleManualScroll, { passive: true });
    
    return () => {
      container.removeEventListener('wheel', handleManualScroll);
      container.removeEventListener('touchmove', handleManualScroll);
    };
  }, [isPlaying, onPause]);
  
  // Update visible word range on scroll (for bionic reading)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !useBionicReading) return;
    
    const calculateVisibleRange = () => {
      const containerRect = container.getBoundingClientRect();
      const scrollTop = container.scrollTop;
      const viewportHeight = containerRect.height;
      
      // Estimate words per viewport based on font size and line height
      // Approximate: ~60 chars per line, ~2.5 lines per viewport height unit
      const lineHeight = fontSize * 2.2; // leading-loose
      const linesInViewport = Math.ceil(viewportHeight / lineHeight) + 4; // Add buffer
      const wordsPerLine = Math.ceil(columnWidth / (fontSize * 0.55) / 5); // Approximate words per line
      const wordsInViewport = linesInViewport * wordsPerLine;
      
      // Estimate start word based on scroll position
      const totalContentHeight = container.scrollHeight - viewportHeight;
      const scrollRatio = totalContentHeight > 0 ? scrollTop / totalContentHeight : 0;
      const estimatedStartWord = Math.floor(scrollRatio * words.length);
      
      // Set visible range with buffer
      const bufferWords = 100;
      const start = Math.max(0, estimatedStartWord - bufferWords);
      const end = Math.min(words.length, estimatedStartWord + wordsInViewport + bufferWords);
      
      setVisibleWordRange({ start, end });
    };
    
    calculateVisibleRange();
    
    // Throttled scroll handler
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          calculateVisibleRange();
          ticking = false;
        });
        ticking = true;
      }
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [useBionicReading, words.length, fontSize, columnWidth]);
  
  // Line-based highlighting state
  const [lineInfo, setLineInfo] = useState<{ lineStart: number; lineEnd: number; wordsOnLine: number }>({ lineStart: 0, lineEnd: 0, wordsOnLine: 1 });
  
  // Calculate words to highlight based on linePercent (round down, minimum 1)
  // If multipleWords is false, always highlight just 1 word
  const chunkSize = useMemo(() => {
    if (!multipleWords) return 1;
    const wordsToHighlight = Math.max(1, Math.floor(lineInfo.wordsOnLine * (linePercent / 100)));
    return wordsToHighlight;
  }, [lineInfo.wordsOnLine, linePercent, multipleWords]);
  
  // Report chunk size to parent for progression control
  useEffect(() => {
    if (onChunkSizeChange) {
      onChunkSizeChange(chunkSize);
    }
  }, [chunkSize, onChunkSizeChange]);
  
  // Block/Underline Highlight State
  const prevTopRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Line-based animation state - pre-calculated positions for smooth motion
  const [lineAnimation, setLineAnimation] = useState<{
    lineStart: number;
    lineEnd: number;
    startLeft: number;
    endLeft: number;
    top: number;
    height: number;
    width: number; // fixed highlight width
    duration: number; // total animation duration for line
    pixelsPerSecond: number; // constant speed for highlight movement
    wordPositions: { left: number; width: number }[]; // Position of each word on the line relative to startLeft
    lineStartTime: number; // timestamp when this line's animation started
  } | null>(null);
  
  // Track graying animations for previous lines (continues after highlight moves to next line)
  const [grayingLines, setGrayingLines] = useState<Array<{
    lineStart: number;
    lineEnd: number;
    startTime: number; // actual timestamp when this line's animation started
    pixelsPerSecond: number;
    wordPositions: { left: number; width: number }[];
    highlightWidth: number;
    duration: number; // total duration for this line
  }>>([]);
  
  
  // Detect line boundaries and pre-calculate animation when entering a new line
  useLayoutEffect(() => {
    const currentWord = wordRefs.current[currentIndex];
    if (!currentWord || !contentRef.current) return;
    
    const currentTop = currentWord.offsetTop;
    const contentRect = contentRef.current.getBoundingClientRect();
    
    // Find all words on the same line - limit search to max 30 words in each direction for performance
    const maxSearch = 30;
    let lineStart = currentIndex;
    let lineEnd = currentIndex;
    
    // Search backwards for line start (limited range)
    const minSearch = Math.max(0, currentIndex - maxSearch);
    for (let i = currentIndex - 1; i >= minSearch; i--) {
      const word = wordRefs.current[i];
      if (word && Math.abs(word.offsetTop - currentTop) < 5) {
        lineStart = i;
      } else {
        break;
      }
    }
    
    // Search forwards for line end (limited range)
    const maxForward = Math.min(words.length, currentIndex + maxSearch);
    for (let i = currentIndex + 1; i < maxForward; i++) {
      const word = wordRefs.current[i];
      if (word && Math.abs(word.offsetTop - currentTop) < 5) {
        lineEnd = i;
      } else {
        break;
      }
    }
    
    const wordsOnLine = lineEnd - lineStart + 1;
    setLineInfo({ lineStart, lineEnd, wordsOnLine });
    
    // Check if we moved to a new line
    const isNewLine = lineAnimation === null || 
                      lineStart !== lineAnimation.lineStart || 
                      lineEnd !== lineAnimation.lineEnd;
    
    if (isNewLine && (highlightStyle === 'block' || highlightStyle === 'underline' || highlightStyle === 'line-start')) {
      // Pre-calculate line animation parameters
      const firstWord = wordRefs.current[lineStart];
      const lastWord = wordRefs.current[lineEnd];
      
      if (firstWord && lastWord) {
        const firstRect = firstWord.getBoundingClientRect();
        const lastRect = lastWord.getBoundingClientRect();
        
        // Calculate highlight widths based on style
        const avgCharWidth = fontSize * 0.55;
        const paddingX = fontSize * 0.2;
        const paddingY = fontSize * 0.12;
        
        // Block and underline use wider highlight (approx 5 characters)
        // Line-start (vertical) uses narrow highlight
        const isVertical = highlightStyle === 'line-start';
        const fixedWidth = isVertical 
          ? fontSize * 0.15 + (paddingX * 2) // Narrow vertical bar
          : avgCharWidth * 5 + (paddingX * 2); // Wide block/underline
        
        // Calculate positions relative to content div
        const startLeft = firstRect.left - contentRect.left - paddingX;
        
        // Get the EXACT text bounds of the last word, excluding trailing space
        // getClientRects() returns the visual bounds of actual rendered text
        // This is more accurate than getBoundingClientRect() which includes the trailing space
        const lastWordRects = lastWord.getClientRects();
        const lastTextRect = lastWordRects.length > 0 
          ? lastWordRects[lastWordRects.length - 1] // Use the last rect (covers text, not trailing space)
          : lastRect; // Fallback to bounding rect
        
        // endLeft is where the highlight's LEFT edge should be when its RIGHT edge touches the last character
        // At progress = 1: highlight.left = endLeft, highlight.right = endLeft + fixedWidth = lastCharRight
        const lastCharRightEdge = lastTextRect.right - contentRect.left + paddingX;
        const endLeft = lastCharRightEdge - fixedWidth;
        
        // Get consistent line metrics - measured once from hidden reference element
        // This prevents highlight shifting between lines with different word heights
        if (cachedLineMetricsRef.current === null && measurementRef.current) {
          // Use the hidden "Hg" measurement element for consistent line-box height
          // "Hg" contains both ascender (H) and descender (g) for accurate measurement
          const measureRect = measurementRef.current.getBoundingClientRect();
          cachedLineMetricsRef.current = {
            height: measureRect.height,
            baseline: measureRect.height
          };
        }
        // Fallback to first word height if measurement element not ready
        const lineHeight = cachedLineMetricsRef.current?.height ?? firstRect.height;
        const height = lineHeight + (paddingY * 2);
        
        // Calculate vertical offset to center the highlight around the text
        // Use the measured line height to maintain consistent positioning
        const wordTop = firstRect.top - contentRect.top;
        const wordCenterY = wordTop + (firstRect.height / 2);
        
        // Center the consistent-height highlight box around the word's vertical center
        // This ensures stable positioning regardless of individual word glyph variations
        const top = wordCenterY - (height / 2);
        
        // Calculate CONSTANT pixel speed based on WPM
        // This ensures the highlight moves at the same visual rate throughout the document
        // regardless of how many words are on each line
        // Formula: WPM / 60 = words per second
        // Average word width = avgCharWidth * 5 (average word is ~5 characters)
        // Pixels per second = words per second * average word width
        const avgWordWidth = avgCharWidth * 5;
        const wordsPerSecond = wpm / 60;
        const pixelsPerSecond = wordsPerSecond * avgWordWidth;
        
        // Calculate duration based on line width / constant pixel speed
        // Longer lines take more time, shorter lines take less time
        // Gray-out triggers when highlight reaches line end (not word advancement)
        const linePixelWidth = endLeft - startLeft + fixedWidth;
        const duration = (linePixelWidth / pixelsPerSecond) * 1000; // Convert to ms
        
        // Calculate position of each word on the line
        const wordPositions: { left: number; width: number }[] = [];
        for (let i = lineStart; i <= lineEnd; i++) {
          const wordEl = wordRefs.current[i];
          if (wordEl) {
            const wordRect = wordEl.getBoundingClientRect();
            wordPositions.push({
              left: wordRect.left - contentRect.left - paddingX - startLeft, // relative to line start
              width: wordRect.width
            });
          }
        }
        
        // Save current line for graying animation before switching to new line
        // Use the ACTUAL start time from when the previous line started animating
        if (lineAnimation && isPlaying) {
          setGrayingLines(prev => {
            // Keep only recent lines (max 3)
            const newLines = prev.slice(-2);
            newLines.push({
              lineStart: lineAnimation.lineStart,
              lineEnd: lineAnimation.lineEnd,
              startTime: lineAnimation.lineStartTime, // Use actual start time, not current time
              pixelsPerSecond: lineAnimation.pixelsPerSecond,
              wordPositions: lineAnimation.wordPositions,
              highlightWidth: lineAnimation.width,
              duration: lineAnimation.duration
            });
            return newLines;
          });
        }
        
        setLineAnimation({
          lineStart,
          lineEnd,
          startLeft,
          endLeft,
          top,
          height,
          width: fixedWidth,
          duration,
          pixelsPerSecond,
          wordPositions,
          lineStartTime: Date.now() // Track when this line animation starts
        });
        
        // Report the calculated line duration to parent for synchronized word advancement
        if (onLineDurationChange) {
          onLineDurationChange(duration);
        }
      }
    }
  }, [currentIndex, words.length, columnWidth, fontSize, wpm, highlightStyle, isPlaying, onLineDurationChange]);

  // Calculate current progress (0-1) through the line for the highlight
  // Use time-based progress for consistency with the constant-speed animation
  const [pausedElapsed, setPausedElapsed] = useState(0);
  const wasPlayingRef = useRef(isPlaying);
  
  // Handle pause/resume - adjust lineStartTime to exclude paused duration
  useEffect(() => {
    if (wasPlayingRef.current !== isPlaying && lineAnimation) {
      if (!isPlaying) {
        // Pausing: store how much time has elapsed so far
        const elapsed = Date.now() - lineAnimation.lineStartTime;
        setPausedElapsed(elapsed);
      } else {
        // Resuming: adjust lineStartTime so animation continues from where it was
        setLineAnimation(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            lineStartTime: Date.now() - pausedElapsed
          };
        });
      }
    }
    wasPlayingRef.current = isPlaying;
  }, [isPlaying, lineAnimation, pausedElapsed]);
  
  const currentWordProgress = useMemo(() => {
    if (!lineAnimation) return 0;
    
    if (!isPlaying) {
      // When paused, calculate progress from stored elapsed time
      const progress = pausedElapsed / lineAnimation.duration;
      return Math.max(0, Math.min(1, progress));
    }
    
    // When playing, calculate time-based progress
    const elapsed = Date.now() - lineAnimation.lineStartTime;
    const progress = elapsed / lineAnimation.duration;
    return Math.max(0, Math.min(1, progress));
  }, [lineAnimation, isPlaying, pausedElapsed]);

  // Detect line breaks and calculate trail
  useLayoutEffect(() => {
    if (!showTrail || !activeWordRef.current) {
      if (trailIndices.size > 0) setTrailIndices(new Set()); // Clear if disabled
      return;
    }

    const currentEl = activeWordRef.current;
    const currentTop = currentEl.offsetTop;
    const newTrail = new Set<number>();

    // Look backwards from current index
    // We only need to check words that are effectively rendered
    for (let i = currentIndex - 1; i >= 0; i--) {
      const el = wordRefs.current[i];
      if (!el) break; // Should exist if rendered

      // If vertical position differs significantly (more than 5px to account for line-height jitter), it's a new line
      if (Math.abs(el.offsetTop - currentTop) > 10) {
        break; // Reached previous line
      }
      
      newTrail.add(i);
    }
    
    setTrailIndices(newTrail);
  }, [currentIndex, showTrail, columnWidth]); // Recalculate on index move or layout change

  // Auto-scroll to keep the active word in view
  const currentScrollTopRef = useRef(0);
  const prevFontSizeRef = useRef(fontSize);
  
  // Immediate scroll for font size changes - runs before paint
  useLayoutEffect(() => {
    const fontSizeChanged = fontSize !== prevFontSizeRef.current;
    prevFontSizeRef.current = fontSize;
    
    if (!fontSizeChanged || useWindowMask) return;
    if (!containerRef.current || !activeWordRef.current) return;
    
    const container = containerRef.current;
    const element = activeWordRef.current;
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const currentRelativeTop = elementRect.top - containerRect.top;
    const targetOffset = containerRect.height * 0.35;
    const targetScrollTop = container.scrollTop + (currentRelativeTop - targetOffset);
    
    // Direct scrollTop assignment is the fastest possible scroll
    container.scrollTop = targetScrollTop;
  }, [fontSize, useWindowMask]);
  
  // Track the last line we scrolled to, to avoid scrolling on every word
  const lastScrolledLineStartRef = useRef<number | null>(null);
  
  // Auto-scroll ONLY on line transitions during playback
  // This effect runs only when lineAnimation.lineStart changes (actual line transitions)
  useEffect(() => {
    // Skip if focus window is on - handled separately
    if (useWindowMask) return;
    // Skip if not playing
    if (!isPlaying) return;
    // Skip if no lineAnimation yet
    if (!lineAnimation) return;
    // Skip auto-scroll if user just clicked a word
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    
    const currentLineStart = lineAnimation.lineStart;
    
    // Only scroll if this is actually a new line
    if (currentLineStart === lastScrolledLineStartRef.current) return;
    
    // Update ref BEFORE scrolling to prevent re-triggering
    lastScrolledLineStartRef.current = currentLineStart;
    
    if (!containerRef.current || !activeWordRef.current) return;
    
    const container = containerRef.current;
    const element = activeWordRef.current;
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    // Calculate where the element currently is relative to container top
    const currentRelativeTop = elementRect.top - containerRect.top;
    
    // Target is 35% down the screen
    const targetOffset = containerRect.height * 0.35;
    const targetScrollTop = container.scrollTop + (currentRelativeTop - targetOffset);
    
    currentScrollTopRef.current = targetScrollTop;
    container.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    });
  }, [lineAnimation?.lineStart, isPlaying, useWindowMask]);
  
  // Separate effect for scrolling when paused (only if out of view)
  useEffect(() => {
    if (useWindowMask) return;
    if (isPlaying) return; // Playing is handled by lineStart effect above
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    
    if (!containerRef.current || !activeWordRef.current) return;
    
    const container = containerRef.current;
    const element = activeWordRef.current;
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    const currentRelativeTop = elementRect.top - containerRect.top;
    const targetOffset = containerRect.height * 0.35;
    const targetScrollTop = container.scrollTop + (currentRelativeTop - targetOffset);
    
    // When paused, only scroll if element is out of view
    if (currentRelativeTop < 0 || currentRelativeTop > containerRect.height * 0.7) {
      // Update the ref so resuming doesn't cause immediate scroll
      if (lineAnimation) {
        lastScrolledLineStartRef.current = lineAnimation.lineStart;
      }
      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    }
  }, [currentIndex, isPlaying, useWindowMask, lineAnimation]);

  // Focus Window: Auto-scroll to keep current line in view
  const prevFocusFontSizeRef = useRef(fontSize);
  useLayoutEffect(() => {
    if (!useWindowMask || !activeWordRef.current || !containerRef.current) return;
    
    const container = containerRef.current;
    const element = activeWordRef.current;
    
    // Detect font size change for instant scroll
    const fontSizeChanged = fontSize !== prevFocusFontSizeRef.current;
    prevFocusFontSizeRef.current = fontSize;
    
    // Keep the current line at a fixed position (100px from top of container)
    const lineTop = element.offsetTop;
    const targetScrollTop = Math.max(0, lineTop - 100);
    
    if (fontSizeChanged) {
      // Direct scrollTop for fastest possible update
      container.scrollTop = targetScrollTop;
    } else {
      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    }
    
  }, [useWindowMask, currentIndex, fontSize, columnWidth]);

  // After a word click (especially on grayed-out text), scroll to the active word after DOM updates
  useLayoutEffect(() => {
    if (!scrollToActiveAfterRenderRef.current) return;
    scrollToActiveAfterRenderRef.current = false;
    
    if (!containerRef.current || !activeWordRef.current) return;
    
    const container = containerRef.current;
    const element = activeWordRef.current;
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    // Calculate where the element currently is relative to container
    const currentRelativeTop = elementRect.top - containerRect.top;
    
    // Use the saved click position to keep word at same visual location,
    // or default to 35% from top if no click position saved
    const savedClickY = clickYPositionRef.current;
    const targetOffset = savedClickY !== null 
      ? savedClickY - containerRect.top 
      : containerRect.height * 0.35;
    clickYPositionRef.current = null;
    
    // Scroll so the clicked word appears at the same Y position where user clicked
    const targetScrollTop = container.scrollTop + (currentRelativeTop - targetOffset);
    
    container.scrollTo({
      top: targetScrollTop,
      behavior: 'instant'
    });
  }, [currentIndex]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex-1 p-8 md:p-16 w-full select-none flex justify-center relative cursor-pointer overflow-x-hidden",
        useWindowMask ? "overflow-y-hidden" : "overflow-y-auto"
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget || e.target === containerRef.current) {
          onTogglePlay();
        }
      }}
    >

      <div 
        ref={contentRef}
        className={cn(
           "font-serif leading-loose transition-colors duration-300 transition-all ease-in-out relative z-10",
           "text-foreground"
        )}
        style={{ 
          width: '100%', 
          maxWidth: 'var(--reader-column-width, 100%)',
          fontSize: 'var(--reader-font-size, 24px)',
          fontFamily: `'${fontFamily}', sans-serif`,
          fontWeight: parseInt(fontWeight) || 400,
          fontStyle: fontWeight.includes('italic') ? 'italic' : 'normal',
          color: fontColor,
          // CSS variable for highlight glide duration - based on WPM word interval
          '--highlight-glide': `${60 / wpm}s`
        } as React.CSSProperties}
      >
        {/* Hidden measurement element for consistent line-box height */}
        <span
          ref={measurementRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            visibility: 'hidden',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            fontSize: 'inherit',
            fontFamily: 'inherit',
            fontWeight: 'inherit',
            lineHeight: 'inherit'
          }}
        >
          Hg
        </span>
        
        {/* Animated Highlight - memoized component decoupled from word-by-word React updates */}
        {lineAnimation && (highlightStyle === 'block' || highlightStyle === 'underline' || highlightStyle === 'line-start') && (
          <GlidingHighlight
            lineAnimation={lineAnimation}
            highlightStyle={highlightStyle}
            highlightColor={highlightColor}
            fontSize={fontSize}
            isPlaying={isPlaying}
            currentWordProgress={currentWordProgress}
            showTrail={showTrail}
          />
        )}
        
        {/* Find highlights - character-level, independent from reading highlight */}
        {findText && findMatches.length > 0 && (
          <FindHighlights
            findText={findText}
            findMatches={findMatches}
            currentMatchIndex={currentMatchIndex}
            words={words}
            wordRefs={wordRefs}
            contentRef={contentRef}
            containerRef={containerRef}
            currentIndex={currentIndex}
          />
        )}

        {useMemo(() => {
          // Apply displayStartIndex to hide front matter content
          // When currentIndex is less than displayStartIndex, we should still hide front matter
          // and show content starting from displayStartIndex
          const adjustedCurrentIndex = Math.max(currentIndex, displayStartIndex);
          
          // When bionic reading is enabled, expand the render window to include
          // all viewport-visible words (tracked via scroll position)
          let effectiveStartIdx: number;
          let endIdx: number;
          
          if (useBionicReading) {
            // Use the larger of: current reading window OR visible viewport range
            effectiveStartIdx = Math.max(
              displayStartIndex,
              Math.min(adjustedCurrentIndex - VISIBLE_WINDOW, visibleWordRange.start)
            );
            endIdx = Math.min(
              words.length,
              Math.max(adjustedCurrentIndex + VISIBLE_WINDOW, visibleWordRange.end)
            );
          } else {
            effectiveStartIdx = Math.max(displayStartIndex, adjustedCurrentIndex - VISIBLE_WINDOW);
            endIdx = Math.min(words.length, adjustedCurrentIndex + VISIBLE_WINDOW);
          }
          
          const elements = [];
          
          // Render placeholder for words before visible window (much faster than individual spans)
          // Only show content from displayStartIndex onwards
          if (effectiveStartIdx > displayStartIndex) {
            const beforeWords = words.slice(displayStartIndex, effectiveStartIdx);
            const beforeText = beforeWords.join(' ') + ' ';
            elements.push(
              <span 
                key="before" 
                className={useWindowMask ? "text-transparent select-none" : "opacity-40 cursor-pointer"}
                onClick={(e) => {
                  e.stopPropagation();
                  if (useWindowMask) return;
                  
                  // Save click position to maintain visual stability after re-render
                  clickYPositionRef.current = e.clientY;
                  
                  // Try to find exact word using browser text APIs
                  const exactIndex = findWordIndexAtPoint(e.clientX, e.clientY, beforeText, displayStartIndex);
                  
                  if (exactIndex !== null && exactIndex >= displayStartIndex && exactIndex < effectiveStartIdx) {
                    skipAutoScrollRef.current = true;
                    scrollToActiveAfterRenderRef.current = true;
                    onWordClick(exactIndex);
                  } else {
                    // Fallback to estimation if exact detection fails
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                    const beforeWordCount = effectiveStartIdx - displayStartIndex;
                    const estimatedOffset = Math.floor(clickRatio * beforeWordCount);
                    skipAutoScrollRef.current = true;
                    scrollToActiveAfterRenderRef.current = true;
                    onWordClick(Math.max(displayStartIndex, Math.min(effectiveStartIdx - 1, displayStartIndex + estimatedOffset)));
                  }
                }}
              >
                {beforeText}
              </span>
            );
          }
          
          const chapterMap = new Map(chapters.map(ch => [ch.wordIndex, ch]));
          
          for (let index = effectiveStartIdx; index < endIdx; index++) {
            const chapter = chapterMap.get(index);
            if (chapter) {
              elements.push(
                <div 
                  key={`chapter-${index}`}
                  className="w-full block mt-16 mb-8 pt-8 border-t border-border/30"
                  data-testid={`chapter-heading-${index}`}
                >
                  <div 
                    className="font-bold text-foreground"
                    style={{ 
                      fontSize: `${fontSize * 1.4}px`,
                      lineHeight: 1.3
                    }}
                  >
                    {chapter.title}
                  </div>
                </div>
              );
            }
            
            const word = words[index];
            // Clamp active range to current line boundaries
            const activeEnd = Math.min(currentIndex + chunkSize, lineInfo.lineEnd + 1);
            const isActive = index >= currentIndex && index < activeEnd;
            const isTrail = trailIndices.has(index);
            // For focus window: check if this word is on the current line
            const isOnCurrentLine = index >= lineInfo.lineStart && index <= lineInfo.lineEnd;
            const isHiddenByFocusWindow = useWindowMask && !isOnCurrentLine;
            
            // Words that have been passed (before current line) - these are "read" and grayed
            const isBeforeCurrentLine = index < lineInfo.lineStart;
            const isPast = index < currentIndex && !isTrail;
            // Words ahead of current position (not yet read)
            const isFuture = !isPast && !isActive && !isTrail;
            
            // For block/underline/line-start styles during playback:
            // Words on the current line should fade to gray as the highlight passes them
            const usesGlidingHighlight = highlightStyle === 'block' || highlightStyle === 'underline' || highlightStyle === 'line-start';
            const isOnCurrentLineAndPlaying = isOnCurrentLine && isPlaying && usesGlidingHighlight && lineAnimation;
            
            // Check if this word is on a previous line that's still in its fade animation
            // Continue animations even when paused so they complete naturally
            let isOnGrayingLine = false;
            let grayingLineInfo: typeof grayingLines[0] | null = null;
            if (isBeforeCurrentLine && usesGlidingHighlight) {
              const matchingLine = grayingLines.find(line => 
                index >= line.lineStart && index <= line.lineEnd
              );
              if (matchingLine) {
                const elapsed = Date.now() - matchingLine.startTime;
                // Use stored duration directly
                const lineDuration = matchingLine.duration;
                // Still animating if elapsed time is less than total line animation duration
                if (elapsed < lineDuration + 300) { // +300ms buffer for final word fade
                  isOnGrayingLine = true;
                  grayingLineInfo = matchingLine;
                }
              }
            }
            
            // Calculate when this word should start graying (after highlight passes it)
            let wordGrayDelay = 0;
            let wordGrayElapsed = 0;
            if (isOnCurrentLineAndPlaying && lineAnimation) {
              const wordIndexInLine = index - lineInfo.lineStart;
              const wordPos = lineAnimation.wordPositions[wordIndexInLine];
              if (wordPos) {
                // Time for highlight to reach the END of this word (when it passes)
                const distanceToWordEnd = wordPos.left + wordPos.width;
                const timeToPassMs = (distanceToWordEnd / lineAnimation.pixelsPerSecond) * 1000;
                wordGrayDelay = timeToPassMs;
              }
            } else if (isOnGrayingLine && grayingLineInfo) {
              // For previous lines still animating, calculate remaining animation time
              const wordIndexInLine = index - grayingLineInfo.lineStart;
              const wordPos = grayingLineInfo.wordPositions[wordIndexInLine];
              if (wordPos) {
                const distanceToWordEnd = wordPos.left + wordPos.width;
                const timeToPassMs = (distanceToWordEnd / grayingLineInfo.pixelsPerSecond) * 1000;
                const elapsed = Date.now() - grayingLineInfo.startTime;
                // Delay is how much time until this word starts fading, minus what's already elapsed
                wordGrayDelay = Math.max(0, timeToPassMs - elapsed);
                wordGrayElapsed = elapsed;
              }
            }
            
            elements.push(
              <span
                key={index}
                ref={(el) => { 
                  wordRefs.current[index] = el; 
                  if (index === currentIndex) activeWordRef.current = el;
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  // When Focus Window is enabled, only allow clicks on visible words (current line)
                  if (isHiddenByFocusWindow) {
                    return;
                  }
                  clickYPositionRef.current = e.clientY;
                  skipAutoScrollRef.current = true;
                  scrollToActiveAfterRenderRef.current = true;
                  onWordClick(index);
                }}
                className={cn(
                  "inline-block rounded-sm cursor-pointer relative z-[1]",
                  "px-[0.25em] -ml-[0.25em] py-1 border-y border-transparent",
                  highlightStyle === 'underline' && "border-t-0 py-0 pb-1 mb-1 border-b-transparent",
                  // Focus window: hide words not on current line and disable clicking
                  isHiddenByFocusWindow && "!text-transparent select-none cursor-default",
                  // Normal styling when not hidden by focus window
                  !isHiddenByFocusWindow && isActive && highlightStyle === 'block' && "text-black dark:text-black z-10",
                  !isHiddenByFocusWindow && isActive && highlightStyle === 'underline' && "text-foreground z-10 !rounded-none pb-0.5",
                  !isHiddenByFocusWindow && isActive && highlightStyle === 'line-start' && "text-foreground z-10 !rounded-none",
                  !isHiddenByFocusWindow && isActive && highlightStyle === 'bold' && "text-foreground z-10 [-webkit-text-stroke:0.6px_currentColor]",
                  !isHiddenByFocusWindow && isTrail && highlightStyle === 'block' && "text-black z-10",
                  !isHiddenByFocusWindow && isTrail && highlightStyle === 'underline' && "text-foreground !rounded-none pb-0.5",
                  !isHiddenByFocusWindow && isTrail && highlightStyle === 'line-start' && "text-foreground !rounded-none",
                  // Gray out entire completed lines (lines before current line) - use opacity to preserve font color
                  !isHiddenByFocusWindow && isBeforeCurrentLine && "opacity-40",
                  // Future words and words on current line stay in normal font color with hover effect
                  !isHiddenByFocusWindow && !isBeforeCurrentLine && !isActive && !isTrail && "hover:bg-muted"
                  
                  /* SAVED: Word-by-word graying code (disabled)
                  // Words before current line that finished animating are gray
                  !isHiddenByFocusWindow && isBeforeCurrentLine && !isOnGrayingLine && "text-muted-foreground/40",
                  // Words on a previous line still animating: apply fade animation
                  !isHiddenByFocusWindow && isOnGrayingLine && "word-fade-gray",
                  // Words on current line: apply fade animation as highlight passes (for gliding styles)
                  !isHiddenByFocusWindow && isOnCurrentLineAndPlaying && !isActive && !isTrail && "word-fade-gray",
                  // Bold style: past words are gray immediately
                  !isHiddenByFocusWindow && isPast && highlightStyle === 'bold' && "text-muted-foreground/40",
                  // When paused or for bold style: past words on current line are gray
                  !isHiddenByFocusWindow && isPast && !isPlaying && "text-muted-foreground/40",
                  // Future words (at/after active) stay in normal font color with hover effect
                  !isHiddenByFocusWindow && isFuture && !isOnCurrentLineAndPlaying && "text-foreground hover:bg-muted"
                  */
                )}
                style={undefined}
              >
                {useBionicReading ? renderBionicWord(word) : word}{' '}
              </span>
            );
          }
          
          // Render placeholder for words after visible window (much faster than individual spans)
          if (endIdx < words.length) {
            const afterWords = words.slice(endIdx);
            const afterText = afterWords.join(' ');
            const afterWordCount = words.length - endIdx;
            elements.push(
              <span 
                key="after" 
                className={useWindowMask ? "text-transparent select-none" : "cursor-pointer"}
                onClick={(e) => {
                  e.stopPropagation();
                  if (useWindowMask) return;
                  
                  // Save click position to maintain visual stability after re-render
                  clickYPositionRef.current = e.clientY;
                  
                  // Try to find exact word using browser text APIs
                  // Words in "after" section start at index endIdx
                  const exactIndex = findWordIndexAtPoint(e.clientX, e.clientY, afterText, endIdx);
                  
                  if (exactIndex !== null && exactIndex >= endIdx && exactIndex < words.length) {
                    skipAutoScrollRef.current = true;
                    scrollToActiveAfterRenderRef.current = true;
                    onWordClick(exactIndex);
                  } else {
                    // Fallback to estimation if exact detection fails
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                    const estimatedOffset = Math.floor(clickRatio * afterWordCount);
                    skipAutoScrollRef.current = true;
                    scrollToActiveAfterRenderRef.current = true;
                    onWordClick(Math.min(words.length - 1, endIdx + estimatedOffset));
                  }
                }}
              >
                {afterText}
              </span>
            );
          }
          
          return elements;
        }, [words, currentIndex, chunkSize, trailIndices, highlightStyle, useBionicReading, visibleWordRange, onWordClick, lineInfo.lineEnd, useWindowMask, lineInfo.lineStart, displayStartIndex, chapters, fontSize, isPlaying, lineAnimation, grayingLines])}
      </div>
      
      {/* Spacer at bottom to allow scrolling last words to center */}
      <div className="h-[50vh]" />
    </div>
  );
}
