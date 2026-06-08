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
    <div className="border-t border-border bg-background/95 backdrop-blur-sm sticky bottom-0 z-10">
      <div className="py-2.5 px-3 md:py-3 md:px-4 flex items-center justify-center gap-2 md:gap-3">
        {/* Repeat Split Button */}
        <div className="flex items-center">
          <Button 
            variant="outline" 
            size="sm"
            className="h-8 rounded-r-none border-r-0 px-2.5 gap-1.5 text-xs font-medium"
            onClick={handleRepeat}
            title={`Repeat ${repeatSentences} sentence${repeatSentences > 1 ? 's' : ''}`}
          >
            <Repeat className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Repeat</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 rounded-l-none px-1.5"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-[80px]">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground py-1">Sentences</DropdownMenuLabel>
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
          className="h-8 px-3 gap-1.5 text-xs font-medium"
          onClick={onReset}
          title="Reset"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </Button>
        
        {/* Play/Pause Button */}
        <Button 
          size="sm"
          className={cn(
            "h-8 px-4 gap-1.5 text-xs font-medium shadow-sm transition-all",
            isPlaying ? "bg-destructive hover:bg-destructive/90 text-white" : "bg-primary hover:bg-primary/90 text-primary-foreground"
          )}
          onClick={onPlayPause}
        >
          {isPlaying ? (
            <>
              <Pause className="h-3.5 w-3.5 fill-current" />
              <span className="hidden sm:inline">Pause</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span className="hidden sm:inline">Play</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
