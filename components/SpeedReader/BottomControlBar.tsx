import { Button } from "@/components/ui/button";
import { 
  Play, 
  Pause, 
  RotateCcw,
  Repeat,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

interface BottomControlBarProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  onRepeat: (sentences: number) => void;
  isMobile: boolean;
}

export function BottomControlBar({
  isPlaying,
  onPlayPause,
  onReset,
  onRepeat,
  isMobile,
}: BottomControlBarProps) {
  const [repeatSentences, setRepeatSentences] = useState(1);

  const handleRepeat = () => {
    onRepeat(repeatSentences);
  };

  return (
    <div className="border-t border-border/70 bg-background/80 backdrop-blur-xl sticky bottom-0 z-10">
      <div className="h-[52px] px-3 md:px-4 flex items-center justify-center gap-2">
        {/* Repeat Split Button */}
        <div className="flex items-center">
          <Button 
            variant="outline" 
            size="sm"
            className="h-8 rounded-r-none border-r-0 px-2.5 gap-1.5 text-[12.5px] font-medium"
            onClick={handleRepeat}
            title={`Repeat ${repeatSentences} sentence${repeatSentences > 1 ? 's' : ''}`}
          >
            <Repeat className="h-[14px] w-[14px]" strokeWidth={2} />
            <span className="hidden sm:inline">Repeat</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 rounded-l-none px-1.5 text-muted-foreground"
              >
                <ChevronDown className="h-[13px] w-[13px]" strokeWidth={2} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-[80px]">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground/80 py-1">Sentences</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[1, 2, 3, 4, 5].map((num) => (
                <DropdownMenuItem 
                  key={num}
                  onClick={() => setRepeatSentences(num)}
                  className={cn(
                    "cursor-pointer text-xs py-1.5",
                    repeatSentences === num && "bg-accent"
                  )}
                >
                  {num}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Reset Button */}
        <Button 
          variant="outline" 
          size="sm"
          className="h-8 px-3 gap-1.5 text-[12.5px] font-medium"
          onClick={onReset}
          title="Reset"
        >
          <RotateCcw className="h-[14px] w-[14px]" strokeWidth={2} />
          <span className="hidden sm:inline">Reset</span>
        </Button>
        
        {/* Play/pause: the primary action, labelled with the key that drives it */}
        <Button
          size="sm"
          className="h-8 pl-3.5 pr-2.5 gap-2 text-[12.5px] font-medium ml-1"
          onClick={onPlayPause}
          title={isPlaying ? "Pause (space)" : "Play (space)"}
        >
          <span className="inline-flex items-center gap-1.5">
            {isPlaying ? (
              <Pause className="h-[13px] w-[13px] fill-current" />
            ) : (
              <Play className="h-[13px] w-[13px] fill-current" />
            )}
            <span className="hidden sm:inline">{isPlaying ? "Pause" : "Play"}</span>
          </span>
          <span
            aria-hidden
            className="hidden sm:inline-flex h-[17px] min-w-[34px] items-center justify-center rounded-[5px]
                       border border-primary-foreground/20 bg-primary-foreground/10 px-1
                       font-mono text-[10px] leading-none text-primary-foreground/70"
          >
            space
          </span>
        </Button>
      </div>
    </div>
  );
}
