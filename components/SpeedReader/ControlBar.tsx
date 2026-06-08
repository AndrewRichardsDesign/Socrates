import { Button } from "@/components/ui/button";
import { 
  AlignLeft,
  Eye,
  Menu,
  Settings2,
  Focus,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface ControlBarProps {
  mode: 'rsvp' | 'scroll' | 'pdf';
  onModeChange: (mode: 'rsvp' | 'scroll' | 'pdf') => void;
  isPdfDocument?: boolean;
  currentIndex: number;
  totalWords: number;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isRightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  isMobile: boolean;
  focusMode: boolean;
  onToggleFocusMode: () => void;
}

export function ControlBar({
  mode,
  onModeChange,
  isPdfDocument = false,
  currentIndex,
  totalWords,
  isSidebarOpen,
  onToggleSidebar,
  isRightPanelOpen,
  onToggleRightPanel,
  isMobile,
  focusMode,
  onToggleFocusMode,
}: ControlBarProps) {
  const progress = totalWords <= 1 ? (currentIndex > 0 ? 100 : 0) : Math.min(100, Math.max(0, (currentIndex / Math.max(1, totalWords - 1)) * 100));

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10 flex flex-col">
      <div className="py-2 px-3 md:py-2.5 md:px-4 flex items-center justify-between gap-2 md:gap-3">
        
        {/* Left: Menu + Progress */}
        <div className="flex items-center gap-1.5 md:gap-2 flex-1">
          {!isSidebarOpen && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={onToggleSidebar}
              title="Open library"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}

          <div className="flex flex-col ml-1.5 md:ml-3 min-w-[50px] md:min-w-[80px]">
            <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-widest hidden md:block">
              Progress
            </span>
            <div className="flex items-center">
              <span className="text-xs font-mono text-muted-foreground">
                {progress < 1 && progress > 0 ? progress.toFixed(1) : Math.round(progress)}%
              </span>
            </div>
          </div>
        </div>

        {/* Center: Mode Tabs */}
        <div className="flex items-center justify-center">
          <div className="flex bg-muted p-0.5 rounded-md">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 rounded px-2.5 lg:px-3 h-7 text-xs font-medium transition-colors",
                mode === 'scroll' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onModeChange('scroll')}
              title="Scroll Mode"
            >
              <AlignLeft className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Scroll</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 rounded px-2.5 lg:px-3 h-7 text-xs font-medium transition-colors",
                mode === 'rsvp' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onModeChange('rsvp')}
              title="Isolate Mode"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Isolate</span>
            </Button>
            {isPdfDocument && (
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-1.5 rounded px-2.5 lg:px-3 h-7 text-xs font-medium transition-colors",
                  mode === 'pdf' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => onModeChange('pdf')}
                title="PDF Mode"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">PDF</span>
              </Button>
            )}
          </div>
        </div>

        {/* Right: Focus + Settings */}
        <div className="flex items-center gap-1.5 shrink-0 flex-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 rounded px-2 lg:px-2.5 h-7 text-xs",
              focusMode ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={onToggleFocusMode}
            title={focusMode ? "Exit focus mode" : "Enter focus mode"}
          >
            <Focus className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
            <span className="font-medium text-xs lg:text-sm hidden lg:inline">Focus</span>
          </Button>
          {!isRightPanelOpen && !isMobile && !focusMode && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded px-2 lg:px-2.5 h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={onToggleRightPanel}
              title="Open settings"
            >
              <Settings2 className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
              <span className="font-medium text-xs lg:text-sm hidden lg:inline">Settings</span>
            </Button>
          )}
        </div>
      </div>
      
      {/* Progress Bar Line */}
      <Progress value={progress} className="h-1 w-full rounded-none" />
    </div>
  );
}
