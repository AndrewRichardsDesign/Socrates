import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Settings2,
  Type,
  AlignLeft,
  ChevronDown,
  Eye,
  Minus,
  Plus,
  ArrowLeftRight,
  Paintbrush,
  Highlighter,
  Scan,
  Underline,
  Ban,
  Timer,
  Hash,
  TextCursorInput,
  Bold,
  CaseUpper,
  FastForward,
  PanelRightClose,
  FileText,
  GripVertical
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { fetchGoogleFonts, parseVariants, loadGoogleFont, type GoogleFont } from '@/lib/googleFonts';
import { Search } from 'lucide-react';

interface RightPanelProps {
  wpm: number;
  onWpmChange: (val: number) => void;
  chunkSize: number;
  onChunkSizeChange: (val: number) => void;
  linePercent: number;
  onLinePercentChange: (val: number) => void;
  multipleWords: boolean;
  onMultipleWordsChange: (val: boolean) => void;
  columnWidth: number;
  onColumnWidthChange: (val: number) => void;
  showTrail: boolean;
  onShowTrailChange: (val: boolean) => void;
  useWindowMask: boolean;
  onUseWindowMaskChange: (val: boolean) => void;
  highlightStyle: 'block' | 'underline' | 'line-start' | 'bold' | 'none';
  onHighlightStyleChange: (val: 'block' | 'underline' | 'line-start' | 'bold' | 'none') => void;
  highlightColor: string;
  onHighlightColorChange: (val: string) => void;
  
  // Font Settings
  fontSize: number;
  onFontSizeChange: (val: number) => void;
  fontFamily: string;
  onFontFamilyChange: (val: string) => void;
  fontWeight: string;
  onFontWeightChange: (val: string) => void;
  fontColor: string;
  onFontColorChange: (val: string) => void;
  useBionicReading: boolean;
  onUseBionicReadingChange: (val: boolean) => void;

  // Pause Settings
  pauseOnSentence: boolean;
  onPauseOnSentenceChange: (val: boolean) => void;
  sentencePauseFrequency: number;
  onSentencePauseFrequencyChange: (val: number) => void;
  sentencePauseDuration: number;
  onSentencePauseDurationChange: (val: number) => void;
  
  pauseOnParagraph: boolean;
  onPauseOnParagraphChange: (val: boolean) => void;
  paragraphPauseFrequency: number;
  onParagraphPauseFrequencyChange: (val: number) => void;
  paragraphPauseDuration: number;
  onParagraphPauseDurationChange: (val: number) => void;
  
  mode: 'rsvp' | 'scroll' | 'pdf';
  onModeChange: (val: 'rsvp' | 'scroll' | 'pdf') => void;
  onClose: () => void;
  isEditing: boolean;
  onEditToggle: () => void;
  
  // Document-specific preferences
  rememberForDocument: boolean;
  onRememberForDocumentChange: (val: boolean) => void;
  
  // Gradual WPM increase
  gradualIncrease: boolean;
  onGradualIncreaseChange: (val: boolean) => void;
  gradualIncreaseWpm: number;
  onGradualIncreaseWpmChange: (val: number) => void;
  gradualIncreaseSentences: number;
  onGradualIncreaseSentencesChange: (val: number) => void;
  maxWpm: number | null;
  onMaxWpmChange: (val: number | null) => void;
  
  // Paragraph restructuring
  restructureParagraphs: boolean;
  onRestructureParagraphsChange: (val: boolean) => void;
  blockCountInfo: { original: number; restructured: number } | null;
}

// Sortable Item Component
function SortableItem({ id, children, isReordering }: { id: string, children: React.ReactNode, isReordering: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("relative", isReordering && "border border-border/50 rounded-lg mb-2 bg-muted/30")}>
      {isReordering && (
         <div 
            {...attributes} 
            {...listeners}
            className="absolute left-2 top-2 z-10 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground"
         >
           <GripVertical className="h-4 w-4" />
         </div>
      )}
      <div className={cn(isReordering && "pl-8 pr-2 py-2 opacity-80 pointer-events-none")}>
        {children}
      </div>
    </div>
  );
}

// Debounced Slider - instant local updates, debounced parent updates
function DebouncedSlider({ 
  value, 
  onValueChange, 
  debounceMs = 150,
  ...props 
}: { 
  value: number[]; 
  onValueChange: (val: number[]) => void; 
  debounceMs?: number;
} & Omit<React.ComponentProps<typeof Slider>, 'value' | 'onValueChange'>) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sync local value when parent value changes (e.g., from preferences load)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  const handleChange = useCallback((newValue: number[]) => {
    setLocalValue(newValue);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      onValueChange(newValue);
    }, debounceMs);
  }, [onValueChange, debounceMs]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return <Slider value={localValue} onValueChange={handleChange} {...props} />;
}

function FontSizeSlider({ 
  sizes, 
  fontSize, 
  onFontSizeChange, 
  sliderRef 
}: { 
  sizes: number[]; 
  fontSize: number; 
  onFontSizeChange: (size: number) => void; 
  sliderRef: React.RefObject<HTMLDivElement | null>;
}) {
  const currentIndex = sizes.indexOf(fontSize);
  
  const getIndexFromPosition = (clientX: number) => {
    if (!sliderRef.current) return currentIndex;
    const rect = sliderRef.current.getBoundingClientRect();
    const padding = 12;
    const effectiveWidth = rect.width - (padding * 2);
    const relativeX = clientX - rect.left - padding;
    const percent = Math.max(0, Math.min(100, (relativeX / effectiveWidth) * 100));
    return Math.round((percent / 100) * (sizes.length - 1));
  };
  
  const handleDrag = (clientX: number) => {
    const index = getIndexFromPosition(clientX);
    onFontSizeChange(sizes[Math.max(0, Math.min(sizes.length - 1, index))]);
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDrag(e.clientX);
    const onMouseMove = (e: MouseEvent) => handleDrag(e.clientX);
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) handleDrag(e.touches[0].clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleDrag(e.touches[0].clientX);
    };
    const onTouchEnd = () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  };
  
  return (
    <div 
      ref={sliderRef}
      className="relative h-8 border border-border rounded-full flex items-center px-3 cursor-pointer select-none"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {sizes.map((size) => {
        const isSelected = fontSize === size;
        return (
          <div key={size} className="flex-1 flex items-center justify-center">
            {isSelected ? (
              <div className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-md min-w-[28px] text-center shadow-sm">
                {size}
              </div>
            ) : (
              <div className="w-2 h-2 rounded-full border border-muted-foreground/30" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Integrated font size input with dropdown
function FontSizeInput({ 
  value, 
  onChange, 
  presets 
}: { 
  value: number; 
  onChange: (val: number) => void; 
  presets: number[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index only when dropdown opens (not when value changes)
  const prevIsOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      // Just opened - set to current value
      const currentIndex = presets.indexOf(value);
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current && highlightedIndex >= 0) {
      const items = listRef.current.querySelectorAll('[data-size-item]');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // When dropdown is open, navigate the list
    if (isOpen) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => Math.min(prev + 1, presets.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < presets.length) {
            onChange(presets[highlightedIndex]);
            setIsOpen(false);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
      return;
    }

    // When dropdown is closed, arrow keys adjust the number
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newVal = Math.min(value + 1, 120);
      onChange(newVal);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newVal = Math.max(value - 1, 8);
      onChange(newVal);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val >= 8 && val <= 120) {
      onChange(val);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div 
        className="flex items-center h-9 border border-border rounded-md bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1"
        data-testid="font-size-input-container"
      >
        <input
          ref={inputRef}
          type="number"
          min={8}
          max={120}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="flex-1 h-full px-3 text-sm bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          data-testid="input-font-size"
        />
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            // Keep focus on input so arrow keys work
            inputRef.current?.focus();
          }}
          className="h-full px-2 border-l border-border hover:bg-muted transition-colors"
          tabIndex={-1}
          data-testid="btn-font-size-dropdown"
        >
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </button>
      </div>
      
      {isOpen && (
        <div 
          ref={listRef}
          className="absolute z-50 bottom-full left-0 right-0 mb-1 max-h-48 overflow-auto bg-popover border border-border rounded-md shadow-md"
        >
          {presets.map((size, index) => (
            <button
              key={size}
              type="button"
              data-size-item
              onClick={() => {
                onChange(size);
                setIsOpen(false);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                "w-full px-3 py-2 text-sm text-left transition-colors",
                value === size && "font-medium",
                highlightedIndex === index ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              )}
            >
              {size}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FontSection({
  fontSize,
  onFontSizeChange,
  fontFamily,
  onFontFamilyChange,
  fontWeight,
  onFontWeightChange,
  fontColor,
  onFontColorChange,
  fontSizeSliderRef,
}: {
  fontSize: number;
  onFontSizeChange: (val: number) => void;
  fontFamily: string;
  onFontFamilyChange: (val: string) => void;
  fontWeight: string;
  onFontWeightChange: (val: string) => void;
  fontColor: string;
  onFontColorChange: (val: string) => void;
  fontSizeSliderRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [fonts, setFonts] = useState<GoogleFont[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [highlightedFontIndex, setHighlightedFontIndex] = useState(-1);
  const fontListRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    fetchGoogleFonts().then(setFonts);
  }, []);
  
  useEffect(() => {
    if (fontFamily) {
      const font = fonts.find(f => f.family === fontFamily);
      if (font) {
        loadGoogleFont(fontFamily, font.variants);
      }
    }
  }, [fontFamily, fonts]);
  
  const selectedFont = fonts.find(f => f.family === fontFamily);
  const fontVariants = selectedFont ? parseVariants(selectedFont.variants) : [];
  const normalVariants = fontVariants.filter(v => v.style === 'normal');
  const italicVariants = fontVariants.filter(v => v.style === 'italic');
  
  const filteredFonts = searchQuery.trim()
    ? fonts.filter(f => f.family.toLowerCase().includes(searchQuery.toLowerCase()))
    : fonts;

  // Reset highlighted index when popover opens or search changes
  useEffect(() => {
    if (isPopoverOpen) {
      const currentIndex = filteredFonts.findIndex(f => f.family === fontFamily);
      setHighlightedFontIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  }, [isPopoverOpen, searchQuery]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isPopoverOpen && fontListRef.current && highlightedFontIndex >= 0) {
      const items = fontListRef.current.querySelectorAll('[data-font-item]');
      if (items[highlightedFontIndex]) {
        items[highlightedFontIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedFontIndex, isPopoverOpen]);

  const handleFontKeyDown = (e: React.KeyboardEvent) => {
    if (filteredFonts.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedFontIndex(prev => Math.min(prev + 1, filteredFonts.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedFontIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedFontIndex >= 0 && highlightedFontIndex < filteredFonts.length) {
          handleFontSelect(filteredFonts[highlightedFontIndex].family);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsPopoverOpen(false);
        break;
    }
  };
  
  const handleFontSelect = (family: string) => {
    onFontFamilyChange(family);
    const font = fonts.find(f => f.family === family);
    if (font) {
      loadGoogleFont(family, font.variants);
      const variants = parseVariants(font.variants);
      const has400 = variants.some(v => v.value === '400');
      if (has400) {
        onFontWeightChange('400');
      } else if (variants.length > 0) {
        onFontWeightChange(variants[0].value);
      }
    }
    setIsPopoverOpen(false);
    setSearchQuery('');
  };
  
  const containerClass = "px-4 py-3 space-y-4";
  
  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
          <CaseUpper className="h-3.5 w-3.5" />
          Font
        </h3>
        <ColorPicker
          value={fontColor}
          onChange={onFontColorChange}
          triggerClassName="w-5 h-5"
        />
      </div>
      <div className="space-y-3 px-1">
        {/* Typeface - at top, no label */}
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between h-9 text-sm font-normal"
              style={{ fontFamily: `'${fontFamily}', sans-serif` }}
              data-testid="btn-font-family"
            >
              <span>{fontFamily}</span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search fonts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleFontKeyDown}
                  className="pl-8 h-8"
                  data-testid="input-font-search"
                />
              </div>
            </div>
            <ScrollArea className="h-64">
              <div ref={fontListRef} className="p-1">
                {filteredFonts.map((font, index) => (
                  <button
                    key={font.family}
                    data-font-item
                    onClick={() => handleFontSelect(font.family)}
                    onMouseEnter={() => setHighlightedFontIndex(index)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded-sm cursor-pointer transition-colors",
                      highlightedFontIndex === index ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                    )}
                    style={{ fontFamily: `'${font.family}', ${font.category}` }}
                    data-testid={`font-option-${font.family.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <span className="block truncate">{font.family}</span>
                    <span className="text-[10px] text-muted-foreground capitalize">{font.category}</span>
                  </button>
                ))}
                {filteredFonts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No fonts found</p>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
        
        {/* Font Size and Weight on same line, no labels */}
        <div className="flex gap-2">
          <div className="flex-1">
            <FontSizeInput 
              value={fontSize} 
              onChange={onFontSizeChange}
              presets={[12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 72]}
            />
          </div>
          <div className="flex-1">
            {fontVariants.length > 0 ? (
              <Select value={fontWeight} onValueChange={onFontWeightChange}>
                <SelectTrigger className="w-full h-9" style={{ fontFamily: `'${fontFamily}', sans-serif`, fontWeight: parseInt(fontWeight) || 400 }}>
                  <SelectValue placeholder="Weight" />
                </SelectTrigger>
                <SelectContent>
                  {normalVariants.map((variant) => (
                    <SelectItem 
                      key={variant.value} 
                      value={variant.value}
                      style={{ fontFamily: `'${fontFamily}', sans-serif`, fontWeight: variant.weight }}
                    >
                      {variant.label}
                    </SelectItem>
                  ))}
                  {italicVariants.length > 0 && normalVariants.length > 0 && (
                    <SelectItem disabled value="---">───────</SelectItem>
                  )}
                  {italicVariants.map((variant) => (
                    <SelectItem 
                      key={variant.value} 
                      value={variant.value}
                      className="italic"
                      style={{ fontFamily: `'${fontFamily}', sans-serif`, fontWeight: variant.weight }}
                    >
                      {variant.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-9 flex items-center justify-center border border-border rounded-md text-xs text-muted-foreground">
                No weights
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LineLengthSlider({ 
  lengths, 
  chunkSize, 
  onChunkSizeChange, 
  sliderRef 
}: { 
  lengths: number[]; 
  chunkSize: number; 
  onChunkSizeChange: (size: number) => void; 
  sliderRef: React.RefObject<HTMLDivElement | null>;
}) {
  const currentIndex = lengths.indexOf(chunkSize);
  
  const getIndexFromPosition = (clientX: number) => {
    if (!sliderRef.current) return currentIndex >= 0 ? currentIndex : 0;
    const rect = sliderRef.current.getBoundingClientRect();
    const padding = 12;
    const effectiveWidth = rect.width - (padding * 2);
    const relativeX = clientX - rect.left - padding;
    const percent = Math.max(0, Math.min(100, (relativeX / effectiveWidth) * 100));
    return Math.round((percent / 100) * (lengths.length - 1));
  };
  
  const handleDrag = (clientX: number) => {
    const index = getIndexFromPosition(clientX);
    onChunkSizeChange(lengths[Math.max(0, Math.min(lengths.length - 1, index))]);
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDrag(e.clientX);
    const onMouseMove = (e: MouseEvent) => handleDrag(e.clientX);
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) handleDrag(e.touches[0].clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleDrag(e.touches[0].clientX);
    };
    const onTouchEnd = () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  };
  
  return (
    <div 
      ref={sliderRef}
      className="relative h-8 border border-border rounded-full flex items-center px-3 cursor-pointer select-none"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {lengths.map((length) => {
        const isSelected = chunkSize === length;
        return (
          <div key={length} className="flex-1 flex items-center justify-center">
            {isSelected ? (
              <div className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-md min-w-[28px] text-center shadow-sm">
                {length}
              </div>
            ) : (
              <div className="w-2 h-2 rounded-full border border-muted-foreground/30" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function RightPanel({
  wpm,
  onWpmChange,
  chunkSize,
  onChunkSizeChange,
  linePercent,
  onLinePercentChange,
  multipleWords,
  onMultipleWordsChange,
  columnWidth,
  onColumnWidthChange,
  showTrail,
  onShowTrailChange,
  useWindowMask,
  onUseWindowMaskChange,
  highlightStyle,
  onHighlightStyleChange,
  highlightColor,
  onHighlightColorChange,
  
  fontSize,
  onFontSizeChange,
  fontFamily,
  onFontFamilyChange,
  fontWeight,
  onFontWeightChange,
  fontColor,
  onFontColorChange,
  useBionicReading,
  onUseBionicReadingChange,

  pauseOnSentence,
  onPauseOnSentenceChange,
  sentencePauseFrequency,
  onSentencePauseFrequencyChange,
  sentencePauseDuration,
  onSentencePauseDurationChange,
  pauseOnParagraph,
  onPauseOnParagraphChange,
  paragraphPauseFrequency,
  onParagraphPauseFrequencyChange,
  paragraphPauseDuration,
  onParagraphPauseDurationChange,
  
  mode,
  onModeChange,
  onClose,
  isEditing,
  onEditToggle,
  rememberForDocument,
  onRememberForDocumentChange,
  gradualIncrease,
  onGradualIncreaseChange,
  gradualIncreaseWpm,
  onGradualIncreaseWpmChange,
  gradualIncreaseSentences,
  onGradualIncreaseSentencesChange,
  maxWpm,
  onMaxWpmChange,
  restructureParagraphs,
  onRestructureParagraphsChange,
  blockCountInfo
}: RightPanelProps) {
  const { toast } = useToast();
  const fontSizeSliderRef = useRef<HTMLDivElement>(null);
  const lineLengthSliderRef = useRef<HTMLDivElement>(null);

  const [isReordering, setIsReordering] = useState(false);
  
  const handleDisabledClick = useCallback(() => {
    toast({
      variant: "dark",
      title: "This setting is only available in the Scroll mode.",
      action: (
        <ToastAction 
          altText="Switch to Scroll" 
          onClick={() => onModeChange('scroll')}
          className="bg-white text-zinc-900 hover:bg-zinc-200 border-none"
        >
          Switch to Scroll
        </ToastAction>
      ),
      duration: 10000,
    });
  }, [toast, onModeChange]);
  const [items, setItems] = useState([
    'column-width',
    'speed',
    'highlight',
    'paint-trail',
    'focus-window',
    'pause',
    'font-size',
    'restructure',
    'edit-document'
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const renderSection = (id: string) => {
    const isDisabled = mode === 'rsvp' && ['column-width', 'paint-trail', 'focus-window', 'highlight'].includes(id);

    const containerClass = cn(
       "space-y-3 py-2",
       isDisabled && "opacity-40 grayscale transition-opacity"
    );
    
    const wrapWithDisabledClick = (content: React.ReactNode) => {
      if (isDisabled) {
        return (
          <div 
            className="cursor-pointer" 
            onClick={handleDisabledClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleDisabledClick()}
          >
            <div className="pointer-events-none">
              {content}
            </div>
          </div>
        );
      }
      return content;
    };

    switch(id) {
      case 'edit-document':
        // Edit document UI hidden - logic kept
        return null;
      
      case 'restructure':
        // Restructure paragraphs UI hidden - logic kept
        return null;
      
      case 'font-size':
        return (
          <FontSection
            fontSize={fontSize}
            onFontSizeChange={onFontSizeChange}
            fontFamily={fontFamily}
            onFontFamilyChange={onFontFamilyChange}
            fontWeight={fontWeight}
            onFontWeightChange={onFontWeightChange}
            fontColor={fontColor}
            onFontColorChange={onFontColorChange}
            fontSizeSliderRef={fontSizeSliderRef}
          />
        );

      case 'pause':
        return (
          <div className={containerClass}>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" />
              Pause
            </h3>
            <div className="space-y-4 px-1">
                {/* Sentence Pause */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="pause-sentence-panel" 
                      checked={pauseOnSentence}
                      onCheckedChange={(checked) => onPauseOnSentenceChange(checked === true)}
                    />
                    <Label htmlFor="pause-sentence-panel" className="text-sm font-medium cursor-pointer">End of Sentence</Label>
                  </div>
                  
                  {pauseOnSentence && (
                    <div className="grid grid-cols-2 gap-3 pl-6 animate-in slide-in-from-top-2 fade-in duration-200">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Every</Label>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            min={1} 
                            value={sentencePauseFrequency}
                            onChange={(e) => onSentencePauseFrequencyChange(Number(e.target.value) || 1)}
                            className="h-7 text-xs font-mono" 
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Duration (ms)</Label>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            min={100} 
                            step={100}
                            value={sentencePauseDuration}
                            onChange={(e) => onSentencePauseDurationChange(Number(e.target.value) || 100)}
                            className="h-7 text-xs font-mono" 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Paragraph Pause */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="pause-paragraph-panel" 
                      checked={pauseOnParagraph}
                      onCheckedChange={(checked) => onPauseOnParagraphChange(checked === true)}
                    />
                    <Label htmlFor="pause-paragraph-panel" className="text-sm font-medium cursor-pointer">End of Paragraph</Label>
                  </div>
                  
                  {pauseOnParagraph && (
                    <div className="grid grid-cols-2 gap-3 pl-6 animate-in slide-in-from-top-2 fade-in duration-200">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Every</Label>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            min={1} 
                            value={paragraphPauseFrequency}
                            onChange={(e) => onParagraphPauseFrequencyChange(Number(e.target.value) || 1)}
                            className="h-7 text-xs font-mono" 
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">Duration (ms)</Label>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            min={100} 
                            step={100}
                            value={paragraphPauseDuration}
                            onChange={(e) => onParagraphPauseDurationChange(Number(e.target.value) || 100)}
                            className="h-7 text-xs font-mono" 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
            </div>
          </div>
        );

      case 'speed':
        return (
          <div className={containerClass}>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <FastForward className="h-3.5 w-3.5" />
              Speed
            </h3>
            <div className="space-y-4 px-2">
               <div className="flex items-center justify-between">
                 <Label className="text-xs font-medium uppercase text-muted-foreground">Words / Minute (WPM): {wpm}</Label>
               </div>
               <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8 shrink-0"
                    onClick={() => onWpmChange(Math.max(50, wpm - 25))}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <div className="flex-1 px-2">
                    <DebouncedSlider 
                      value={[wpm]} 
                      min={50} 
                      max={1000} 
                      step={10} 
                      onValueChange={(vals) => onWpmChange(vals[0])}
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8 shrink-0"
                    onClick={() => onWpmChange(Math.min(1000, wpm + 25))}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
               </div>
               
               {/* Gradual Increase */}
               <div className="pt-3 space-y-2">
                 <div className="flex items-center gap-2">
                   <Checkbox 
                     id="gradual-increase"
                     checked={gradualIncrease}
                     onCheckedChange={(checked) => onGradualIncreaseChange(checked === true)}
                     data-testid="checkbox-gradual-increase"
                   />
                   <Label htmlFor="gradual-increase" className="text-xs font-medium cursor-pointer">
                     Gradual Increase
                   </Label>
                 </div>
                 
                 {gradualIncrease && (
                   <div className="pl-6 space-y-2">
                     <div className="flex items-center gap-2">
                       <span className="text-xs text-muted-foreground">Increase by</span>
                       <Input
                         type="number"
                         min={1}
                         max={100}
                         value={gradualIncreaseWpm}
                         onChange={(e) => onGradualIncreaseWpmChange(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                         onKeyDown={(e) => {
                           if (e.key === 'ArrowUp') {
                             e.preventDefault();
                             onGradualIncreaseWpmChange(Math.min(100, gradualIncreaseWpm + 1));
                           } else if (e.key === 'ArrowDown') {
                             e.preventDefault();
                             onGradualIncreaseWpmChange(Math.max(1, gradualIncreaseWpm - 1));
                           }
                         }}
                         className="h-7 w-14 text-xs text-center font-mono"
                         data-testid="input-gradual-increase-wpm"
                       />
                       <span className="text-xs text-muted-foreground">WPM</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <span className="text-xs text-muted-foreground">Every</span>
                       <Input
                         type="number"
                         min={1}
                         max={100}
                         value={gradualIncreaseSentences}
                         onChange={(e) => onGradualIncreaseSentencesChange(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                         onKeyDown={(e) => {
                           if (e.key === 'ArrowUp') {
                             e.preventDefault();
                             onGradualIncreaseSentencesChange(Math.min(100, gradualIncreaseSentences + 1));
                           } else if (e.key === 'ArrowDown') {
                             e.preventDefault();
                             onGradualIncreaseSentencesChange(Math.max(1, gradualIncreaseSentences - 1));
                           }
                         }}
                         className="h-7 w-14 text-xs text-center font-mono"
                         data-testid="input-gradual-increase-sentences"
                       />
                       <span className="text-xs text-muted-foreground">sentences</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <Label htmlFor="max-wpm" className="text-xs text-muted-foreground">Max WPM</Label>
                       <Input
                         id="max-wpm"
                         type="number"
                         min={100}
                         max={2000}
                         value={maxWpm ?? ''}
                         placeholder={String(wpm < 300 ? 500 : wpm + 300)}
                         onChange={(e) => {
                           const val = e.target.value;
                           if (val === '') {
                             onMaxWpmChange(null);
                           } else {
                             onMaxWpmChange(Math.max(100, Math.min(2000, Number(val) || 100)));
                           }
                         }}
                         className="h-7 w-20 text-xs text-center font-mono"
                         data-testid="input-max-wpm"
                       />
                     </div>
                   </div>
                 )}
               </div>

               {mode === 'rsvp' && (
                 <div className="pt-3 mt-2 border-t border-border space-y-1.5">
                   <Label className="text-[10px] font-semibold uppercase text-muted-foreground tracking-widest">Word Count</Label>
                   <LineLengthSlider 
                     lengths={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                     chunkSize={chunkSize}
                     onChunkSizeChange={onChunkSizeChange}
                     sliderRef={lineLengthSliderRef}
                   />
                 </div>
               )}
               
            </div>
          </div>
        );

      case 'column-width':
        return wrapWithDisabledClick(
          <div className={containerClass}>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Column Width
            </h3>
            <div className="space-y-4 px-2">
               <div className="flex items-center justify-between">
                 <Label className="text-xs font-medium uppercase text-muted-foreground">Width: {columnWidth >= 1200 ? 'Full' : `${columnWidth}px`}</Label>
               </div>
               <DebouncedSlider 
                  value={[columnWidth]} 
                  min={100} 
                  max={1200} 
                  step={10} 
                  onValueChange={(vals) => onColumnWidthChange(vals[0])}
                />
            </div>
          </div>
        );

      case 'paint-trail':
        // Paint trail UI hidden - logic kept
        return null;

      case 'focus-window':
        return wrapWithDisabledClick(
          <div className={cn(
            "flex items-center justify-between py-3 border-t border-border/50",
            isDisabled && "opacity-40 grayscale"
          )}>
             <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Scan className="h-3.5 w-3.5" />
                Focus Window
             </span>
             <Switch 
                checked={useWindowMask}
                onCheckedChange={onUseWindowMaskChange}
             />
          </div>
        );

      case 'highlight':
        return wrapWithDisabledClick(
          <div className={containerClass}>
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Highlighter className="h-3.5 w-3.5" />
                Highlight
              </h3>
              <ColorPicker
                value={highlightColor}
                onChange={onHighlightColorChange}
                triggerClassName="w-6 h-6"
              />
            </div>
            <ToggleGroup type="single" value={highlightStyle} onValueChange={(val) => val && onHighlightStyleChange(val as any)} className="justify-start flex-wrap gap-2">
               <ToggleGroupItem value="block" size="sm" className="flex-1 min-w-[80px]">
                 <span className="text-xs">Block</span>
               </ToggleGroupItem>
               <ToggleGroupItem value="underline" size="sm" className="flex-1 min-w-[80px]">
                 <span className="text-xs">Underline</span>
               </ToggleGroupItem>
               <ToggleGroupItem value="line-start" size="sm" className="flex-1 min-w-[80px]">
                 <span className="text-xs">Vertical</span>
               </ToggleGroupItem>
               <ToggleGroupItem value="bold" size="sm" className="flex-1 min-w-[80px]">
                 <span className="text-xs font-bold">Bold</span>
               </ToggleGroupItem>
               <ToggleGroupItem value="none" size="sm" className="flex-1 min-w-[80px]">
                 <span className="text-xs">None</span>
               </ToggleGroupItem>
            </ToggleGroup>
            
            {/* Highlight multiple words UI hidden - logic kept */}
            
            <div className="pt-3 mt-1 border-t border-border/50 flex items-center justify-between">
              <Label className="text-[10px] font-semibold uppercase text-muted-foreground tracking-widest">Bionic Reading</Label>
              <Switch 
                 checked={useBionicReading} 
                 onCheckedChange={onUseBionicReadingChange}
              />
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <aside className="w-72 max-w-[85vw] border-l border-border bg-background flex flex-col h-full shrink-0 z-20 md:relative fixed inset-y-0 right-0 shadow-xl md:shadow-none">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Settings</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onClose}>
          <PanelRightClose className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 pb-10">
          {/* Remember for Document checkbox */}
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border">
            <Checkbox 
              id="remember-for-document"
              checked={rememberForDocument}
              onCheckedChange={(checked) => onRememberForDocumentChange(checked === true)}
              data-testid="checkbox-remember-for-document"
            />
            <Label 
              htmlFor="remember-for-document" 
              className="text-xs font-medium cursor-pointer"
            >
              Remember for this Document
            </Label>
          </div>
           <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={items}
                strategy={verticalListSortingStrategy}
                disabled={!isReordering}
              >
                {items.map((id, index) => {
                  const section = renderSection(id);
                  if (!section) return null;
                  
                  // Find next visible section index
                  let hasNextVisibleSection = false;
                  for (let i = index + 1; i < items.length; i++) {
                    if (renderSection(items[i])) {
                      hasNextVisibleSection = true;
                      break;
                    }
                  }
                  
                  return (
                    <div key={id}>
                      <SortableItem id={id} isReordering={isReordering}>
                         {section}
                      </SortableItem>
                      {/* Add separator between items, but not after the last visible one */}
                      {hasNextVisibleSection && <Separator className="my-2" />}
                    </div>
                  );
                })}
              </SortableContext>
           </DndContext>
        </div>
      </ScrollArea>
      {/* Reorder Settings button hidden - logic kept */}
    </aside>
  );
}
