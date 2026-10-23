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

  const modes = [
    { id: 'scroll' as const, label: 'Scroll', icon: AlignLeft, title: 'Scroll Mode' },
    { id: 'rsvp' as const, label: 'Isolate', icon: Eye, title: 'Isolate Mode' },
    ...(isPdfDocument
      ? [{ id: 'pdf' as const, label: 'PDF', icon: FileText, title: 'PDF Mode' }]
      : []),
  ];

  return (
    <div className="border-b border-border/70 bg-background/80 backdrop-blur-xl sticky top-0 z-10 flex flex-col">
      <div className="h-12 px-3 md:px-4 flex items-center justify-between gap-2 md:gap-3">

        {/* Left: library toggle and progress readout */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {!isSidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -ml-1"
              onClick={onToggleSidebar}
              title="Open library"
            >
              <Menu className="h-[16px] w-[16px]" strokeWidth={2} />
            </Button>
          )}

          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[13px] font-medium tabular-nums text-foreground/85">
              {progress < 1 && progress > 0 ? progress.toFixed(1) : Math.round(progress)}%
            </span>
            <span className="text-[11px] text-muted-foreground/70 hidden md:inline">read</span>
          </div>
        </div>

        {/* Centre: mode switch */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-0.5 bg-muted/80 p-[3px] rounded-[9px] border border-border/50">
            {modes.map(({ id, label, icon: Icon, title }) => (
              <button
                key={id}
                type="button"
                onClick={() => onModeChange(id)}
                title={title}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[6px] px-2.5 lg:px-3 h-[26px]",
                  "text-[12.5px] font-medium transition-all duration-150",
                  mode === id
                    ? "bg-card text-foreground shadow-[0_1px_2px_0_hsl(28_20%_12%/0.08)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-[14px] w-[14px]" strokeWidth={2} />
                <span className="hidden lg:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: focus and settings */}
        <div className="flex items-center gap-0.5 shrink-0 flex-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 h-8 px-2 lg:px-2.5 text-[12.5px]",
              focusMode && "bg-highlight-subtle text-highlight hover:bg-highlight-subtle hover:text-highlight"
            )}
            onClick={onToggleFocusMode}
            title={focusMode ? "Exit focus mode (\u2318.)" : "Enter focus mode (\u2318.)"}
          >
            <Focus className="h-[15px] w-[15px]" strokeWidth={2} />
            <span className="font-medium hidden lg:inline">Focus</span>
          </Button>
          {!isRightPanelOpen && !isMobile && !focusMode && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-8 px-2 lg:px-2.5 text-[12.5px]"
              onClick={onToggleRightPanel}
              title="Open settings"
            >
              <Settings2 className="h-[15px] w-[15px]" strokeWidth={2} />
              <span className="font-medium hidden lg:inline">Settings</span>
            </Button>
          )}
        </div>
      </div>

      {/* Reading progress: the one place amber runs the full width */}
      <div className="h-[2px] w-full bg-border/40">
        <div
          className="h-full bg-highlight transition-[width] duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
