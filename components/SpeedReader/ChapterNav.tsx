import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { ChapterInfo } from "@/lib/chapterDetector";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ChapterNavProps {
  chapters: ChapterInfo[];
  currentIndex: number;
  onChapterClick: (wordIndex: number) => void;
  hidden?: boolean;
  compact?: boolean;
}

export function ChapterNav({ 
  chapters, 
  currentIndex, 
  onChapterClick,
  hidden = false,
  compact = false
}: ChapterNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeButtonRef = useRef<HTMLButtonElement>(null);
  
  const activeChapterIndex = chapters.findIndex((ch, idx) => {
    const nextChapter = chapters[idx + 1];
    if (!nextChapter) {
      return currentIndex >= ch.wordIndex;
    }
    return currentIndex >= ch.wordIndex && currentIndex < nextChapter.wordIndex;
  });
  
  useEffect(() => {
    if (activeButtonRef.current && scrollRef.current) {
      const button = activeButtonRef.current;
      const container = scrollRef.current;
      const buttonRect = button.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      if (buttonRect.left < containerRect.left || buttonRect.right > containerRect.right) {
        button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeChapterIndex]);
  
  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 200;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };
  
  if (hidden || chapters.length === 0) {
    return null;
  }
  
  const content = (
    <div className={cn("flex items-center gap-1", !compact && "px-2 py-2")}>
      <button
        onClick={() => scroll('left')}
        className="shrink-0 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Scroll chapters left"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      
      <div 
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide flex gap-1 flex-1 min-w-0"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {chapters.map((chapter, idx) => {
          const isActive = idx === activeChapterIndex;
          return (
            <button
              key={`ch-${idx}-${chapter.wordIndex}`}
              ref={isActive ? activeButtonRef : null}
              onClick={() => onChapterClick(chapter.wordIndex)}
              data-testid={`button-chapter-${idx}`}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "shrink-0 px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap",
                compact && "px-2 py-0.5",
                isActive 
                  ? "bg-primary text-primary-foreground font-medium" 
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {chapter.title.length > (compact ? 15 : 25) ? chapter.title.slice(0, compact ? 15 : 25) + '...' : chapter.title}
            </button>
          );
        })}
      </div>
      
      <button
        onClick={() => scroll('right')}
        className="shrink-0 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Scroll chapters right"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
  
  if (compact) {
    return <div data-testid="chapter-nav">{content}</div>;
  }
  
  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border" data-testid="chapter-nav">
      {content}
    </div>
  );
}
