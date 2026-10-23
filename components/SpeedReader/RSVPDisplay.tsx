import { useMemo } from "react";
import { resolveReaderColor } from "@/lib/readerColor";
import { renderBionicWord } from "@/lib/bionic";

interface RSVPDisplayProps {
  words: string[];
  currentIndex: number;
  chunkSize: number;
  isPlaying: boolean;
  fontSize: number;
  fontFamily?: string;
  fontWeight: string;
  fontColor?: string;
  useBionicReading: boolean;
  onTogglePlay: () => void;
}

export function RSVPDisplay({ words, currentIndex, chunkSize, isPlaying, fontSize, fontFamily = 'Inter', fontWeight, fontColor = '#000000', useBionicReading, onTogglePlay }: RSVPDisplayProps) {
  
  const currentChunk = useMemo(() => {
    return words.slice(currentIndex, currentIndex + chunkSize);
  }, [words, currentIndex, chunkSize]);

  const isSingleWord = chunkSize === 1 && currentChunk.length > 0;
  
  const renderWord = (word: string) => {
    if (!word) return null;
    return useBionicReading ? renderBionicWord(word) : word;
  };

  const renderSingleWord = (word: string) => {
    if (!word) return null;
    
    return (
      <div 
        className="text-center tracking-wide"
        style={{ fontSize: 'calc(var(--reader-font-size, 24px) * 1.5)', fontFamily: `'${fontFamily}', sans-serif`, fontWeight: parseInt(fontWeight) || 400, color: resolveReaderColor(fontColor) }}
      >
        {renderWord(word)}
      </div>
    );
  };

  const total = words.length;
  const position = Math.min(currentIndex + 1, total);

  return (
    <div 
      className="flex-1 flex flex-col items-center justify-center px-6 bg-background select-none cursor-pointer"
      onClick={onTogglePlay}
    >
      {/* A focal frame rather than a word floating in empty space: the eye
          needs somewhere fixed to rest between flashes. */}
      <div className="w-full max-w-2xl">
        <div className="relative">
          {/* Guide rules bound the focal band; the amber ticks mark its centre. */}
          <div className="h-px w-full bg-border/70" />
          <span className="absolute left-1/2 top-0 h-[7px] w-[1.5px] -translate-x-1/2 bg-highlight/70" />

          <div className="relative z-10 min-h-[136px] flex items-center justify-center py-6">
            {isSingleWord ? (
              renderSingleWord(currentChunk[0])
            ) : (
              <div 
                className="text-center leading-tight"
                style={{ fontSize: 'var(--reader-font-size, 24px)', fontFamily: `'${fontFamily}', sans-serif`, fontWeight: parseInt(fontWeight) || 400, color: resolveReaderColor(fontColor) }}
              >
                {currentChunk.map((word, i) => (
                  <span key={i}>{renderWord(word)}{i < currentChunk.length - 1 ? ' ' : ''}</span>
                ))}
              </div>
            )}
          </div>

          <div className="h-px w-full bg-border/70" />
          <span className="absolute bottom-0 left-1/2 h-[7px] w-[1.5px] -translate-x-1/2 bg-highlight/70" />
        </div>

        {/* Position readout: the one piece of orientation RSVP removes. */}
        <div className="flex items-center justify-center gap-2 pt-5 text-[11px] text-muted-foreground/70">
          <span className="tabular-nums">{position.toLocaleString()}</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="tabular-nums">{total.toLocaleString()}</span>
          <span className="pl-1">words</span>
        </div>
      </div>
    </div>
  );
}
