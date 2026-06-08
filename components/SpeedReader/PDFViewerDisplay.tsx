import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { pdfjsLib, configurePdfWorker } from '@/lib/pdf/pdfjsWorker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

configurePdfWorker();

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}

interface PDFWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
  globalWordIndex: number;
}

interface PDFPage {
  pageIndex: number;
  words: PDFWord[];
  width: number;
  height: number;
}

interface PDFViewerDisplayProps {
  pdfData: ArrayBuffer;
  currentIndex: number;
  isPlaying: boolean;
  highlightColor?: string;
  fontColor?: string;
  onWordClick?: (globalIndex: number) => void;
  wpm?: number;
}

export function PDFViewerDisplay({
  pdfData,
  currentIndex,
  isPlaying,
  highlightColor = '#FFD700',
  fontColor = '#000000',
  onWordClick,
  wpm = 300,
}: PDFViewerDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pages, setPages] = useState<PDFPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [pageRendered, setPageRendered] = useState(false);
  const [totalWords, setTotalWords] = useState(0);
  
  const renderTaskRef = useRef<any>(null);

  // Load PDF document
  useEffect(() => {
    const loadPdf = async () => {
      try {
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        setPdfDoc(pdf);
        
        // Extract text with coordinates from all pages
        const allPages: PDFPage[] = [];
        let globalWordIndex = 0;
        
        for (let i = 0; i < pdf.numPages; i++) {
          const page = await pdf.getPage(i + 1);
          const viewport = page.getViewport({ scale: 1 });
          const textContent = await page.getTextContent();
          
          const pageWords: PDFWord[] = [];
          
          for (const item of textContent.items as TextItem[]) {
            if (!item.str.trim()) continue;
            
            // Split text items into individual words
            const words = item.str.split(/\s+/).filter(w => w.length > 0);
            let currentX = item.transform[4];
            const y = viewport.height - item.transform[5];
            const charWidth = item.width / item.str.length;
            
            for (const word of words) {
              pageWords.push({
                text: word,
                x: currentX,
                y: y - item.height,
                width: word.length * charWidth,
                height: item.height * 1.2,
                pageIndex: i,
                globalWordIndex: globalWordIndex++,
              });
              currentX += (word.length + 1) * charWidth;
            }
          }
          
          allPages.push({
            pageIndex: i,
            words: pageWords,
            width: viewport.width,
            height: viewport.height,
          });
        }
        
        setPages(allPages);
        setTotalWords(globalWordIndex);
      } catch (error) {
        console.error('Failed to load PDF:', error);
      }
    };
    
    loadPdf();
  }, [pdfData]);

  // Find which page contains the current word
  useEffect(() => {
    if (pages.length === 0) return;
    
    for (const page of pages) {
      const hasCurrentWord = page.words.some(w => w.globalWordIndex === currentIndex);
      if (hasCurrentWord) {
        if (page.pageIndex !== currentPage) {
          setCurrentPage(page.pageIndex);
        }
        break;
      }
    }
  }, [currentIndex, pages, currentPage]);

  // Render current page to canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    
    const renderPage = async () => {
      // Cancel any pending render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
      
      setPageRendered(false);
      
      const page = await pdfDoc.getPage(currentPage + 1);
      const viewport = page.getViewport({ scale });
      
      const canvas = canvasRef.current!;
      const context = canvas.getContext('2d')!;
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      
      try {
        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;
        setPageRendered(true);
      } catch (error: any) {
        if (error?.name !== 'RenderingCancelledException') {
          console.error('Failed to render page:', error);
        }
      }
    };
    
    renderPage();
  }, [pdfDoc, currentPage, scale]);

  // Get words for current page
  const currentPageWords = useMemo(() => {
    return pages[currentPage]?.words || [];
  }, [pages, currentPage]);

  // Current active word
  const activeWord = useMemo(() => {
    return currentPageWords.find(w => w.globalWordIndex === currentIndex);
  }, [currentPageWords, currentIndex]);

  // Handle word click
  const handleWordClick = useCallback((word: PDFWord) => {
    onWordClick?.(word.globalWordIndex);
  }, [onWordClick]);

  // Scroll to keep active word visible
  useEffect(() => {
    if (!activeWord || !overlayRef.current || !containerRef.current) return;
    
    const overlay = overlayRef.current;
    const container = containerRef.current;
    
    const wordY = activeWord.y * scale;
    const containerHeight = container.clientHeight;
    const scrollTop = container.scrollTop;
    
    // If word is not visible, scroll to center it
    if (wordY < scrollTop || wordY > scrollTop + containerHeight - 100) {
      container.scrollTo({
        top: wordY - containerHeight / 2,
        behavior: 'smooth',
      });
    }
  }, [activeWord, scale]);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));
  const handlePrevPage = () => setCurrentPage(p => Math.max(0, p - 1));
  const handleNextPage = () => setCurrentPage(p => Math.min((pdfDoc?.numPages || 1) - 1, p + 1));

  if (!pdfDoc) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[80px] text-center">
            Page {currentPage + 1} of {pdfDoc?.numPages || 1}
          </span>
          <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage >= (pdfDoc?.numPages || 1) - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/30"
      >
        <div className="flex justify-center p-4">
          <div className="relative shadow-lg">
            {/* Canvas for PDF rendering */}
            <canvas ref={canvasRef} className="block" />
            
            {/* Overlay for highlights and click handling */}
            {pageRendered && (
              <div
                ref={overlayRef}
                className="absolute inset-0"
                style={{ pointerEvents: 'none' }}
              >
                {currentPageWords.map((word) => {
                  const isActive = word.globalWordIndex === currentIndex;
                  const isPast = word.globalWordIndex < currentIndex;
                  
                  return (
                    <div
                      key={word.globalWordIndex}
                      className={cn(
                        "absolute cursor-pointer transition-colors",
                        isActive && "z-10"
                      )}
                      style={{
                        left: word.x * scale,
                        top: word.y * scale,
                        width: word.width * scale,
                        height: word.height * scale,
                        backgroundColor: isActive ? highlightColor : 'transparent',
                        opacity: isPast ? 0.4 : 1,
                        pointerEvents: 'auto',
                        borderRadius: '2px',
                      }}
                      onClick={() => handleWordClick(word)}
                      title={word.text}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
