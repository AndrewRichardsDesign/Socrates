import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { 
  Settings2,
  Type,
  ChevronUp,
  ChevronDown,
  Gauge,
  Highlighter,
  Eye,
  Timer,
  FileText,
  Scan,
  Underline,
  Ban,
  Bold,
  Paintbrush,
  X,
  Play,
  Pause,
  RotateCcw,
  Repeat,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchGoogleFonts, parseVariants, loadGoogleFont, type GoogleFont } from '@/lib/googleFonts';
import { ColorPicker } from "@/components/ui/color-picker";

interface MobileControlBarProps {
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
  // Gradual WPM increase
  gradualIncrease: boolean;
  onGradualIncreaseChange: (val: boolean) => void;
  gradualIncreaseWpm: number;
  onGradualIncreaseWpmChange: (val: number) => void;
  gradualIncreaseSentences: number;
  onGradualIncreaseSentencesChange: (val: number) => void;
  mode: 'rsvp' | 'scroll' | 'pdf';
  isEditing: boolean;
  onEditToggle: () => void;
  isOpen: boolean;
  onToggle: () => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  onRepeat: (sentences: number) => void;
}

type TabId = 'speed' | 'display' | 'font' | 'more';

export function MobileControlBar({
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
  gradualIncrease,
  onGradualIncreaseChange,
  gradualIncreaseWpm,
  onGradualIncreaseWpmChange,
  gradualIncreaseSentences,
  onGradualIncreaseSentencesChange,
  mode,
  isEditing,
  onEditToggle,
  isOpen,
  onToggle,
  isPlaying,
  onPlayPause,
  onReset,
  onRepeat,
}: MobileControlBarProps) {
  const [activeTab, setActiveTab] = useState<TabId>('speed');
  const [repeatSentences, setRepeatSentences] = useState(1);
  const lineLengthSliderRef = useRef<HTMLDivElement>(null);
  
  // Font picker state
  const [fonts, setFonts] = useState<GoogleFont[]>([]);
  const [fontSearchQuery, setFontSearchQuery] = useState('');
  const [isFontPopoverOpen, setIsFontPopoverOpen] = useState(false);
  const [isFontSizePopoverOpen, setIsFontSizePopoverOpen] = useState(false);
  
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
  
  const filteredFonts = fontSearchQuery.trim()
    ? fonts.filter(f => f.family.toLowerCase().includes(fontSearchQuery.toLowerCase()))
    : fonts;
  
  // Parse font variants for the current font family (like desktop)
  const selectedFont = fonts.find(f => f.family === fontFamily);
  const fontVariants = selectedFont ? parseVariants(selectedFont.variants) : [];
  const normalVariants = fontVariants.filter(v => v.style === 'normal');
  const italicVariants = fontVariants.filter(v => v.style === 'italic');
  
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
    setIsFontPopoverOpen(false);
    setFontSearchQuery('');
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'speed', label: 'Speed', icon: <Gauge className="h-4 w-4" /> },
    { id: 'display', label: 'Display', icon: <Highlighter className="h-4 w-4" /> },
    { id: 'font', label: 'Font', icon: <Type className="h-4 w-4" /> },
    { id: 'more', label: 'More', icon: <Settings2 className="h-4 w-4" /> },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'speed':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">WPM</Label>
                <span className="text-sm font-mono">{wpm}</span>
              </div>
              <Slider 
                value={[wpm]} 
                min={50} 
                max={1500} 
                step={10} 
                onValueChange={(vals) => onWpmChange(vals[0])}
              />
            </div>
            
            {/* Gradual Increase */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="mobile-gradual-increase"
                  checked={gradualIncrease}
                  onCheckedChange={(checked) => onGradualIncreaseChange(checked === true)}
                />
                <Label htmlFor="mobile-gradual-increase" className="text-xs font-medium cursor-pointer">
                  Gradual Increase
                </Label>
              </div>
              {gradualIncrease && (
                <div className="grid grid-cols-2 gap-2 pl-6">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">+WPM</Label>
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={gradualIncreaseWpm}
                      onChange={(e) => onGradualIncreaseWpmChange(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Per # Sentences</Label>
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={gradualIncreaseSentences}
                      onChange={(e) => onGradualIncreaseSentencesChange(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'display':
        return (
          <div className="space-y-4">
            {mode === 'scroll' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Highlight Style</Label>
                  <ToggleGroup 
                    type="single" 
                    value={highlightStyle} 
                    onValueChange={(val) => val && onHighlightStyleChange(val as any)} 
                    className="flex flex-wrap gap-1"
                  >
                    <ToggleGroupItem value="block" size="sm" className="flex-1 min-w-[60px]">
                      <Scan className="h-3 w-3" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="underline" size="sm" className="flex-1 min-w-[60px]">
                      <Underline className="h-3 w-3" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="bold" size="sm" className="flex-1 min-w-[60px]">
                      <Bold className="h-3 w-3" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="none" size="sm" className="flex-1 min-w-[60px]">
                      <Ban className="h-3 w-3" />
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-medium">Highlight Color</Label>
                  <ColorPicker
                    value={highlightColor}
                    onChange={onHighlightColorChange}
                    triggerClassName="w-6 h-6"
                  />
                </div>
                {/* Highlight multiple words UI hidden - logic kept */}
                {/* Paint Trail UI hidden - logic kept */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Focus Window</Label>
                  <Switch checked={useWindowMask} onCheckedChange={onUseWindowMaskChange} />
                </div>
              </>
            )}
            {/* Bionic Reading - shown for both modes */}
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Bionic Reading</Label>
              <Switch checked={useBionicReading} onCheckedChange={onUseBionicReadingChange} />
            </div>
            {mode === 'rsvp' && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Word count</Label>
                {(() => {
                  const lengths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25];
                  const lineLengthCurrentIndex = lengths.indexOf(chunkSize);
                  
                  const getLineLengthIndexFromPosition = (clientX: number) => {
                    if (!lineLengthSliderRef.current) return lineLengthCurrentIndex >= 0 ? lineLengthCurrentIndex : 0;
                    const rect = lineLengthSliderRef.current.getBoundingClientRect();
                    const padding = 12;
                    const effectiveWidth = rect.width - (padding * 2);
                    const relativeX = clientX - rect.left - padding;
                    const percent = Math.max(0, Math.min(100, (relativeX / effectiveWidth) * 100));
                    return Math.round((percent / 100) * (lengths.length - 1));
                  };
                  
                  const handleLineLengthDrag = (clientX: number) => {
                    const index = getLineLengthIndexFromPosition(clientX);
                    onChunkSizeChange(lengths[Math.max(0, Math.min(lengths.length - 1, index))]);
                  };
                  
                  const handleLineLengthMouseDown = (e: React.MouseEvent) => {
                    e.preventDefault();
                    handleLineLengthDrag(e.clientX);
                    const onMouseMove = (e: MouseEvent) => handleLineLengthDrag(e.clientX);
                    const onMouseUp = () => {
                      document.removeEventListener('mousemove', onMouseMove);
                      document.removeEventListener('mouseup', onMouseUp);
                    };
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                  };
                  
                  const handleLineLengthTouchStart = (e: React.TouchEvent) => {
                    if (e.touches[0]) handleLineLengthDrag(e.touches[0].clientX);
                    const onTouchMove = (e: TouchEvent) => {
                      if (e.touches[0]) handleLineLengthDrag(e.touches[0].clientX);
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
                      ref={lineLengthSliderRef}
                      className="relative h-8 border border-border rounded-full flex items-center px-3 cursor-pointer select-none"
                      onMouseDown={handleLineLengthMouseDown}
                      onTouchStart={handleLineLengthTouchStart}
                    >
                      {lengths.map((length) => {
                        const isSelected = chunkSize === length;
                        return (
                          <div
                            key={length}
                            className="flex-1 flex items-center justify-center"
                          >
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
                })()}
              </div>
            )}
          </div>
        );

      case 'font':
        const fontSizePresets = [12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 72];
        
        return (
          <div className="space-y-4">
            {/* Font Family Picker */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Typeface</Label>
              <Popover open={isFontPopoverOpen} onOpenChange={setIsFontPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-9 text-sm font-normal"
                    style={{ fontFamily: `'${fontFamily}', sans-serif` }}
                  >
                    <span className="truncate">{fontFamily}</span>
                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search fonts..."
                        value={fontSearchQuery}
                        onChange={(e) => setFontSearchQuery(e.target.value)}
                        className="pl-8 h-8"
                      />
                    </div>
                  </div>
                  <ScrollArea className="h-48">
                    <div className="p-1">
                      {filteredFonts.slice(0, 50).map((font) => (
                        <button
                          key={font.family}
                          onClick={() => handleFontSelect(font.family)}
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm rounded-sm cursor-pointer transition-colors hover:bg-accent/50",
                            font.family === fontFamily && "bg-accent"
                          )}
                          style={{ fontFamily: `'${font.family}', ${font.category}` }}
                        >
                          <span className="block truncate">{font.family}</span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Font Size - Input with dropdown like desktop */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Font Size</Label>
              <Popover open={isFontSizePopoverOpen} onOpenChange={setIsFontSizePopoverOpen}>
                <PopoverTrigger asChild>
                  <div className="flex items-center h-9 border border-border rounded-md bg-background overflow-hidden cursor-pointer">
                    <input
                      type="number"
                      min={8}
                      max={120}
                      value={fontSize}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 8 && val <= 120) {
                          onFontSizeChange(val);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 h-full px-3 text-sm bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFontSizePopoverOpen(!isFontSizePopoverOpen);
                      }}
                      className="h-full px-2 border-l border-border hover:bg-muted transition-colors"
                    >
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isFontSizePopoverOpen && "rotate-180")} />
                    </button>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <ScrollArea className="h-48">
                    <div className="p-1">
                      {fontSizePresets.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => {
                            onFontSizeChange(size);
                            setIsFontSizePopoverOpen(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-sm text-left transition-colors hover:bg-accent/50",
                            fontSize === size && "font-medium bg-accent"
                          )}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
            {/* Font Weight - Select with variants like desktop */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Font Weight</Label>
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
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-medium">Font Color</Label>
              <ColorPicker
                value={fontColor}
                onChange={onFontColorChange}
                triggerClassName="w-5 h-5"
              />
            </div>
          </div>
        );

      case 'more':
        return (
          <div className="space-y-4">
            {/* Edit Document button hidden - logic kept */}
            
            {/* Sentence Pause */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="mobile-pause-sentence" 
                  checked={pauseOnSentence}
                  onCheckedChange={(checked) => onPauseOnSentenceChange(checked === true)}
                />
                <Label htmlFor="mobile-pause-sentence" className="text-xs font-medium cursor-pointer">Pause on Sentence</Label>
              </div>
              {pauseOnSentence && (
                <div className="grid grid-cols-2 gap-2 pl-6">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Every</Label>
                    <div className="flex items-center gap-1">
                      <Input 
                        type="number"
                        value={sentencePauseFrequency}
                        onChange={(e) => onSentencePauseFrequencyChange(Math.max(1, parseInt(e.target.value) || 1))}
                        min={1}
                        max={20}
                        className="h-8 w-14 text-xs text-center"
                      />
                      <span className="text-xs text-muted-foreground">sent.</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Duration</Label>
                    <div className="flex items-center gap-1">
                      <Input 
                        type="number"
                        value={sentencePauseDuration}
                        onChange={(e) => onSentencePauseDurationChange(Math.max(0.1, parseFloat(e.target.value) || 0.5))}
                        min={0.1}
                        max={10}
                        step={0.1}
                        className="h-8 w-14 text-xs text-center"
                      />
                      <span className="text-xs text-muted-foreground">sec</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Paragraph Pause */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="mobile-pause-paragraph" 
                  checked={pauseOnParagraph}
                  onCheckedChange={(checked) => onPauseOnParagraphChange(checked === true)}
                />
                <Label htmlFor="mobile-pause-paragraph" className="text-xs font-medium cursor-pointer">Pause on Paragraph</Label>
              </div>
              {pauseOnParagraph && (
                <div className="grid grid-cols-2 gap-2 pl-6">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Every</Label>
                    <div className="flex items-center gap-1">
                      <Input 
                        type="number"
                        value={paragraphPauseFrequency}
                        onChange={(e) => onParagraphPauseFrequencyChange(Math.max(1, parseInt(e.target.value) || 1))}
                        min={1}
                        max={20}
                        className="h-8 w-14 text-xs text-center"
                      />
                      <span className="text-xs text-muted-foreground">para.</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Duration</Label>
                    <div className="flex items-center gap-1">
                      <Input 
                        type="number"
                        value={paragraphPauseDuration}
                        onChange={(e) => onParagraphPauseDurationChange(Math.max(0.1, parseFloat(e.target.value) || 1))}
                        min={0.1}
                        max={10}
                        step={0.1}
                        className="h-8 w-14 text-xs text-center"
                      />
                      <span className="text-xs text-muted-foreground">sec</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {isOpen && (
        <div className="bg-background border-t border-border shadow-lg">
          <div className="p-4 max-h-[50vh] overflow-y-auto">
            {renderTabContent()}
          </div>
        </div>
      )}
      
      {/* Compact Play Controls */}
      <div className="bg-background border-t border-border px-3 py-1.5 flex items-center justify-center gap-2">
        {/* Repeat Split Button */}
        <div className="flex items-center">
          <Button 
            variant="outline" 
            size="sm"
            className="h-7 rounded-r-none border-r-0 px-4 gap-1 text-xs"
            onClick={() => onRepeat(repeatSentences)}
          >
            <Repeat className="h-3 w-3" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="h-7 rounded-l-none px-2"
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
        <Button 
          variant="outline" 
          size="sm"
          className="h-7 px-6 gap-1 text-xs"
          onClick={onReset}
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
        <Button 
          size="sm"
          className={cn(
            "h-7 px-8 gap-1 text-xs font-medium shadow-sm",
            isPlaying ? "bg-destructive hover:bg-destructive/90 text-white" : "bg-primary hover:bg-primary/90 text-primary-foreground"
          )}
          onClick={onPlayPause}
        >
          {isPlaying ? (
            <Pause className="h-3 w-3 fill-current" />
          ) : (
            <Play className="h-3 w-3 fill-current" />
          )}
        </Button>
      </div>
      
      <div className="bg-background border-t border-border flex items-center">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              if (activeTab === tab.id && isOpen) {
                onToggle();
              } else {
                setActiveTab(tab.id);
                if (!isOpen) onToggle();
              }
            }}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 px-1 text-xs transition-colors",
              activeTab === tab.id && isOpen
                ? "text-primary bg-muted/50"
                : "text-muted-foreground"
            )}
          >
            {tab.icon}
            <span className="text-[10px]">{tab.label}</span>
          </button>
        ))}
        <button
          onClick={onToggle}
          className="px-3 py-2 text-muted-foreground hover:text-foreground"
        >
          {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
