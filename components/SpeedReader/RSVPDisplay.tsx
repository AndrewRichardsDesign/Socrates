import { useMemo } from "react";
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
        style={{ fontSize: 'calc(var(--reader-font-size, 24px) * 1.5)', fontFamily: `'${fontFamily}', sans-serif`, fontWeight: parseInt(fontWeight) || 400, color: fontColor }}
      >
        {renderWord(word)}
      </div>
    );
  };

  return (
    <div 
      className="flex-1 flex flex-col items-center justify-center p-8 bg-background select-none cursor-pointer"
      onClick={onTogglePlay}
    >
      
      <div className="relative z-10 min-h-[120px] flex items-center justify-center">
        {isSingleWord ? (
          renderSingleWord(currentChunk[0])
        ) : (
          <div 
            className="text-center leading-tight max-w-4xl"
            style={{ fontSize: 'var(--reader-font-size, 24px)', fontFamily: `'${fontFamily}', sans-serif`, fontWeight: parseInt(fontWeight) || 400, color: fontColor }}
          >
            {currentChunk.map((word, i) => (
              <span key={i}>{renderWord(word)}{i < currentChunk.length - 1 ? ' ' : ''}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
