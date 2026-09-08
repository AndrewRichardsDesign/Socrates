import { useState, useEffect, useRef, useCallback, useMemo, CSSProperties } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { Sidebar } from "@/components/SpeedReader/Sidebar";
import { ControlBar } from "@/components/SpeedReader/ControlBar";
import { BottomControlBar } from "@/components/SpeedReader/BottomControlBar";
import { RSVPDisplay } from "@/components/SpeedReader/RSVPDisplay";
import { ScrollDisplay } from "@/components/SpeedReader/ScrollDisplay";
import { UploadResultModal } from "@/components/SpeedReader/UploadResultModal";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Trash2, Pencil, X, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { RightPanel } from "@/components/SpeedReader/RightPanel";
import { MobileControlBar } from "@/components/SpeedReader/MobileControlBar";
import { useDocuments, useCreateDocument, useUpdateDocument, useDeleteDocument } from "@/hooks/use-documents";
import { usePreferences, useUpdatePreferences, loadDocumentPreferences, saveDocumentPreferences, hasDocumentPreferences, deleteDocumentPreferences } from "@/hooks/use-preferences";
import type { LocalDocument } from "@/lib/indexeddb";
import { parseFileWithData } from "@/lib/file-parsers";
import { PDFViewerDisplay } from "@/components/SpeedReader/PDFViewerDisplay";
import { loadGoogleFont } from "@/lib/googleFonts";
import { ChapterNav } from "@/components/SpeedReader/ChapterNav";
import { parseBookContent } from "@/lib/frontMatterParser";
import { optimizeDocument, type OptimizedDocument, type Block, type PauseMarker } from "@/lib/optimizedLayout";
import { detectChapters, type ChapterInfo } from "@/lib/chapterDetector";
import { restructureDocument, type RestructuredDocument } from "@/lib/paragraphRestructure";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total

// Demo text for initial state
const DEMO_TEXT = `Speed reading is a skill that allows you to absorb information faster without sacrificing comprehension. By reducing subvocalization and increasing your visual span, you can process words more efficiently. This application demonstrates two powerful techniques: Rapid Serial Visual Presentation (RSVP) and Guided Scrolling.

In RSVP mode, words are flashed one by one (or in chunks) at a fixed location. This eliminates the need for your eyes to move across the page (saccades), which consumes a significant amount of reading time. You can adjust the words per minute (WPM) and the number of words displayed at once to find your optimal pace.

In Guided Scrolling mode, the text is highlighted word by word within the full document context. This mimics natural reading but forces a consistent pace, helping to break habits like re-reading or regression. It's excellent for longer texts where context retention is crucial.

Experiment with different speeds. Most people read at about 200-250 WPM. With practice, you can comfortably reach 400-600 WPM using these tools. Try increasing the chunk size to 2 or 3 words to take advantage of your peripheral vision.`;

export type WordMetadata = {
  isSentenceEnd: boolean;
  isParagraphEnd: boolean;
  isHeading: boolean;
  pauseDuration: number;
  blockIndex: number;
  blockType: 'heading' | 'paragraph' | 'list';
};

export type Document = {
  id: string;
  title: string;
  content: string;
  fileType?: string;
  source?: string;
  pdfData?: ArrayBuffer;
  words: string[];
  metadata?: WordMetadata[];
  optimizedDoc?: OptimizedDocument;
  blockInfo?: { original: number; restructured: number } | null;
  chapter1WordIndex?: number;
  chapters?: ChapterInfo[];
};

export default function Home() {
  const { toast } = useToast();
  
  // Fetch data from backend
  const { data: dbDocuments, isLoading: docsLoading } = useDocuments();
  const { data: preferences, isLoading: prefsLoading } = usePreferences();
  const createDocument = useCreateDocument();
  const updateDocument = useUpdateDocument();
  const deleteDocument = useDeleteDocument();
  const updatePreferences = useUpdatePreferences();
  
  // -- State --
  const [currentDocId, setCurrentDocId] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<'rsvp' | 'scroll' | 'pdf'>('scroll');
  const [focusMode, setFocusMode] = useState(false);
  // Upload result modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadAccepted, setUploadAccepted] = useState<{ name: string; size: number; reason?: 'size' | 'parse' }[]>([]);
  const [uploadRejected, setUploadRejected] = useState<{ name: string; size: number; reason?: 'size' | 'parse' }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Settings state (initialized from preferences)
  const [wpm, setWpm] = useState(300);
  const [chunkSize, setChunkSize] = useState(1);
  const [columnWidth, setColumnWidth] = useState(800);
  const [showTrail, setShowTrail] = useState(false);
  const [useWindowMask, setUseWindowMask] = useState(false);
  const [highlightStyle, setHighlightStyle] = useState<'block' | 'underline' | 'line-start' | 'bold' | 'none'>('block');
  const [highlightColor, setHighlightColor] = useState('#a6a6a6');
  const [fontSize, setFontSize] = useState(1);
  const [fontFamily, setFontFamily] = useState('Inter');
  const [fontWeight, setFontWeight] = useState('400');
  const [fontColor, setFontColor] = useState('#000000');
  const [useBionicReading, setUseBionicReading] = useState(false);
  
  // Load font when fontFamily changes
  useEffect(() => {
    if (fontFamily) {
      loadGoogleFont(fontFamily);
    }
  }, [fontFamily]);
  
  const [linePercent, setLinePercent] = useState(20);
  const [multipleWords, setMultipleWords] = useState(false);
  const [scrollChunkSize, setScrollChunkSize] = useState(1); // Computed chunk size from ScrollDisplay
  
  // Debounce expensive settings (only re-render after slider stops moving)
  const debouncedChunkSize = useDebounce(chunkSize, 100);
  const debouncedLinePercent = useDebounce(linePercent, 100);
  const debouncedColumnWidth = useDebounce(columnWidth, 100);
  const debouncedFontSize = useDebounce(fontSize, 100);
  const [pauseOnSentence, setPauseOnSentence] = useState(false);
  const [sentencePauseFrequency, setSentencePauseFrequency] = useState(1);
  const [sentencePauseDuration, setSentencePauseDuration] = useState(1000);
  const [pauseOnParagraph, setPauseOnParagraph] = useState(false);
  const [paragraphPauseFrequency, setParagraphPauseFrequency] = useState(1);
  const [paragraphPauseDuration, setParagraphPauseDuration] = useState(2000);
  
  // Gradual WPM increase
  const [gradualIncrease, setGradualIncrease] = useState(true);
  const [gradualIncreaseWpm, setGradualIncreaseWpm] = useState(5);
  const [gradualIncreaseSentences, setGradualIncreaseSentences] = useState(2);
  const [sentencesSinceLastIncrease, setSentencesSinceLastIncrease] = useState(0);
  const [maxWpm, setMaxWpm] = useState<number | null>(null);
  
  // Paragraph restructuring
  const [restructureParagraphs, setRestructureParagraphs] = useState(false);
  const [blockCountInfo, setBlockCountInfo] = useState<{ original: number; restructured: number } | null>(null);
  
  // Document-specific preferences
  const [rememberForDocument, setRememberForDocument] = useState(false);
  
  // Panel State - collapsed by default on mobile
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [isMobileControlOpen, setIsMobileControlOpen] = useState(false);
  
  // Track if user manually closed panels (vs auto-hidden by breakpoint)
  const [sidebarManuallyHidden, setSidebarManuallyHidden] = useState(false);
  const [rightPanelManuallyHidden, setRightPanelManuallyHidden] = useState(false);
  
  // Handlers for manually closing panels
  const handleCloseSidebar = () => {
    setSidebarManuallyHidden(true);
    setIsSidebarOpen(false);
  };
  
  const handleCloseRightPanel = () => {
    setRightPanelManuallyHidden(true);
    setIsRightPanelOpen(false);
  };
  
  // Get current preferences as an object for saving
  const getCurrentPreferences = useCallback(() => ({
    wpm,
    chunkSize,
    columnWidth,
    highlightStyle,
    showTrail,
    useWindowMask,
    fontSize,
    fontFamily,
    fontWeight,
    fontColor,
    highlightColor,
    useBionicReading,
    pauseOnSentence,
    sentencePauseFrequency,
    sentencePauseDuration,
    pauseOnParagraph,
    paragraphPauseFrequency,
    paragraphPauseDuration,
    maxWpm,
  }), [wpm, chunkSize, columnWidth, highlightStyle, showTrail, useWindowMask, fontSize, fontFamily, fontWeight, fontColor, highlightColor, useBionicReading, pauseOnSentence, sentencePauseFrequency, sentencePauseDuration, pauseOnParagraph, paragraphPauseFrequency, paragraphPauseDuration, maxWpm]);
  
  // Handle "Remember for this Document" checkbox
  const handleRememberForDocumentChange = useCallback((enabled: boolean) => {
    setRememberForDocument(enabled);
    if (enabled && currentDocId) {
      // Save current preferences for this document
      saveDocumentPreferences(currentDocId, getCurrentPreferences());
    } else if (!enabled && currentDocId) {
      // Clear saved preferences for this document when unchecked
      deleteDocumentPreferences(currentDocId);
    }
  }, [currentDocId, getCurrentPreferences]);
  
  // Refs for panel manual state to avoid re-running resize effect
  const sidebarManuallyHiddenRef = useRef(sidebarManuallyHidden);
  const rightPanelManuallyHiddenRef = useRef(rightPanelManuallyHidden);
  
  useEffect(() => {
    sidebarManuallyHiddenRef.current = sidebarManuallyHidden;
  }, [sidebarManuallyHidden]);
  
  useEffect(() => {
    rightPanelManuallyHiddenRef.current = rightPanelManuallyHidden;
  }, [rightPanelManuallyHidden]);
  
  // Detect screen size and auto-hide/show panels when content would be too narrow
  useEffect(() => {
    const sidebarWidth = 240;
    const rightPanelWidth = 288;
    const minContentWidth = 250;
    
    // Use matchMedia for instant breakpoint detection
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const sidebarQuery = window.matchMedia(`(min-width: ${sidebarWidth + minContentWidth}px)`);
    const bothPanelsQuery = window.matchMedia(`(min-width: ${sidebarWidth + rightPanelWidth + minContentWidth}px)`);
    
    const updateLayout = () => {
      const mobile = mobileQuery.matches;
      setIsMobile(mobile);
      
      if (mobile) {
        setIsSidebarOpen(false);
        setIsRightPanelOpen(false);
      } else {
        // Handle sidebar
        if (sidebarQuery.matches) {
          if (!sidebarManuallyHiddenRef.current) {
            setIsSidebarOpen(true);
          }
        } else {
          setIsSidebarOpen(false);
        }
        
        // Handle right panel
        if (bothPanelsQuery.matches) {
          if (!rightPanelManuallyHiddenRef.current) {
            setIsRightPanelOpen(true);
          }
        } else {
          setIsRightPanelOpen(false);
        }
      }
    };
    
    // Initial check
    updateLayout();
    
    // Listen to media query changes (instant, no debounce needed)
    mobileQuery.addEventListener('change', updateLayout);
    sidebarQuery.addEventListener('change', updateLayout);
    bothPanelsQuery.addEventListener('change', updateLayout);
    
    return () => {
      mobileQuery.removeEventListener('change', updateLayout);
      sidebarQuery.removeEventListener('change', updateLayout);
      bothPanelsQuery.removeEventListener('change', updateLayout);
    };
  }, []);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingContent, setEditingContent] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  
  // Find in document feature
  const [findText, setFindText] = useState("");
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findMatches, setFindMatches] = useState<number[]>([]); // word indices of matches
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [documentStartOffset, setDocumentStartOffset] = useState<Record<string, number>>({});
  const findInputRef = useRef<HTMLInputElement>(null);

  // Refs for tracking pause frequency logic
  const sentencesSincePauseRef = useRef(0);
  const paragraphsSincePauseRef = useRef(0);
  const sentencesSinceWpmIncreaseRef = useRef(0);
  
  // Refs for gradual increase settings (to avoid re-triggering tick effect)
  const gradualIncreaseRef = useRef(gradualIncrease);
  const gradualIncreaseWpmRef = useRef(gradualIncreaseWpm);
  const gradualIncreaseSentencesRef = useRef(gradualIncreaseSentences);
  const wpmRef = useRef(wpm);
  const maxWpmRef = useRef(maxWpm);
  const initialWpmRef = useRef(wpm);
  
  // Keep refs in sync with state
  useEffect(() => {
    gradualIncreaseRef.current = gradualIncrease;
  }, [gradualIncrease]);
  useEffect(() => {
    gradualIncreaseWpmRef.current = gradualIncreaseWpm;
  }, [gradualIncreaseWpm]);
  useEffect(() => {
    gradualIncreaseSentencesRef.current = gradualIncreaseSentences;
  }, [gradualIncreaseSentences]);
  useEffect(() => {
    wpmRef.current = wpm;
  }, [wpm]);
  useEffect(() => {
    maxWpmRef.current = maxWpm;
  }, [maxWpm]);
  const prefsInitializedRef = useRef(false);

  // Parse text utility using optimized layout engine
  const parseText = useCallback((text: string, useRestructure: boolean = false) => {
    const baseDoc = optimizeDocument(text);
    
    let docToProcess: OptimizedDocument | RestructuredDocument;
    let blockInfo: { original: number; restructured: number } | null = null;
    
    if (useRestructure) {
      const restructured = restructureDocument(baseDoc);
      docToProcess = restructured;
      blockInfo = {
        original: restructured.originalBlockCount,
        restructured: restructured.restructuredBlockCount
      };
    } else {
      docToProcess = baseDoc;
    }
    
    const words: string[] = [];
    const metadata: WordMetadata[] = [];
    
    for (let blockIndex = 0; blockIndex < docToProcess.blocks.length; blockIndex++) {
      const block = docToProcess.blocks[blockIndex];
      
      let pendingWord = '';
      let pendingTokenIndex = -1;
      let leadingPunct = '';
      
      for (let tokenIndex = 0; tokenIndex < block.tokens.length; tokenIndex++) {
        const token = block.tokens[tokenIndex];
        
        if (token.isPunctuation) {
          if (pendingWord) {
            // Trailing punctuation - append to current word
            pendingWord += token.text;
          } else {
            // Leading punctuation - buffer for the next word
            leadingPunct += token.text;
          }
          continue;
        }
        
        // If we have a pending word, push it before starting the new one
        if (pendingWord) {
          words.push(pendingWord);
          
          const pauseMarker = block.pauseMarkers.find(m => m.afterTokenIndex === pendingTokenIndex);
          const isSentenceEnd = pauseMarker?.type === 'sentence' || pauseMarker?.type === 'heading';
          const isParagraphEnd = pauseMarker?.type === 'paragraph' || pauseMarker?.type === 'heading';
          
          metadata.push({
            isSentenceEnd,
            isParagraphEnd,
            isHeading: block.type === 'heading',
            pauseDuration: pauseMarker?.duration || 0,
            blockIndex,
            blockType: block.type
          });
        }
        
        // Start a new pending word, prepending any buffered leading punctuation
        pendingWord = leadingPunct + token.text;
        pendingTokenIndex = tokenIndex;
        leadingPunct = '';
      }
      
      // Push the last pending word in this block
      if (pendingWord) {
        words.push(pendingWord);
        
        const pauseMarker = block.pauseMarkers.find(m => m.afterTokenIndex === pendingTokenIndex);
        const isSentenceEnd = pauseMarker?.type === 'sentence' || pauseMarker?.type === 'heading';
        const isParagraphEnd = pauseMarker?.type === 'paragraph' || pauseMarker?.type === 'heading';
        
        metadata.push({
          isSentenceEnd,
          isParagraphEnd,
          isHeading: block.type === 'heading',
          pauseDuration: pauseMarker?.duration || 0,
          blockIndex,
          blockType: block.type
        });
      }
    }
    
    return { words, metadata, optimizedDoc: docToProcess, blockInfo };
  }, []);

  // Process documents with metadata and apply start offset
  const documents = useMemo<Document[]>(() => {
    if (!dbDocuments) return [];
    
    return dbDocuments.map(doc => {
      const { words: allWords, metadata: allMetadata, optimizedDoc, blockInfo } = parseText(doc.content, restructureParagraphs);
      const offset = documentStartOffset[doc.id] || 0;
      const words = allWords.slice(offset);
      const metadata = allMetadata.slice(offset);
      
      // Calculate chapter 1 word index based on front matter analysis
      // Use character position to find the corresponding word index in allWords
      let chapter1WordIndex = 0;
      let frontMatterChapters: ChapterInfo[] = [];
      
      try {
        const parsed = parseBookContent(doc.content);
        
        // Convert front matter sections to chapter-like navigation items
        // Each front matter section becomes a button in the chapter nav
        const charToWordIndex = (targetCharPos: number): number => {
          let charPos = 0;
          for (let i = 0; i < allWords.length; i++) {
            const word = allWords[i].replace(/^[^\w]+|[^\w]+$/g, '');
            if (!word) continue;
            const wordPos = doc.content.indexOf(word, charPos);
            if (wordPos >= 0) {
              if (wordPos >= targetCharPos) {
                return i;
              }
              charPos = wordPos + word.length;
            }
          }
          return 0;
        };
        
        // Add front matter sections as chapters (they'll appear first in the nav)
        for (const section of parsed.frontMatter) {
          const wordIndex = charToWordIndex(section.startIndex);
          const label = section.title || {
            'introduction': 'Introduction',
            'preface': 'Preface',
            'foreword': 'Foreword',
            'prologue': 'Prologue',
            'dedication': 'Dedication',
            'acknowledgments': 'Acknowledgments',
            'contents': 'Contents',
            'epigraph': 'Epigraph',
            'author': 'Author',
            'other': 'Note'
          }[section.type] || 'Note';
          
          frontMatterChapters.push({
            title: label,
            wordIndex,
            charIndex: section.startIndex
          });
        }
        
        if (parsed.chapter1StartIndex > 0) {
          chapter1WordIndex = charToWordIndex(parsed.chapter1StartIndex);
        }
      } catch (e) {
        console.warn('Failed to parse front matter:', e);
      }
      
      const chapters = detectChapters(doc.content, allWords);
      
      return {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        fileType: doc.fileType,
        source: doc.source,
        pdfData: doc.pdfData,
        words,
        metadata,
        optimizedDoc,
        blockInfo,
        chapter1WordIndex: chapter1WordIndex > 0 ? chapter1WordIndex - offset : 0,
        chapters: [
          // Front matter sections first (adjusted for offset)
          ...frontMatterChapters.map(ch => ({
            ...ch,
            wordIndex: Math.max(0, ch.wordIndex - offset)
          })),
          // Then regular chapters
          ...chapters.map(ch => ({
            ...ch,
            wordIndex: Math.max(0, ch.wordIndex - offset)
          }))
        ]
      };
    });
  }, [dbDocuments, parseText, documentStartOffset, restructureParagraphs]);

  // Initialize preferences from backend (only once on first load)
  useEffect(() => {
    if (preferences && !prefsInitializedRef.current) {
      prefsInitializedRef.current = true;
      setWpm(preferences.wpm);
      setChunkSize(preferences.chunkSize);
      setColumnWidth(preferences.columnWidth);
      setHighlightStyle(preferences.highlightStyle as any);
      setShowTrail(preferences.showTrail);
      setUseWindowMask(preferences.useWindowMask);
      setFontSize(preferences.fontSize);
      setFontWeight(preferences.fontWeight || '400');
      if (preferences.fontFamily) setFontFamily(preferences.fontFamily);
      setUseBionicReading(preferences.useBionicReading);
      setPauseOnSentence(preferences.pauseOnSentence);
      setSentencePauseFrequency(preferences.sentencePauseFrequency);
      setSentencePauseDuration(preferences.sentencePauseDuration);
      setPauseOnParagraph(preferences.pauseOnParagraph);
      setParagraphPauseFrequency(preferences.paragraphPauseFrequency);
      setParagraphPauseDuration(preferences.paragraphPauseDuration);
    }
  }, [preferences]);

  // Create demo document if no documents exist
  useEffect(() => {
    if (!docsLoading && dbDocuments?.length === 0) {
      createDocument.mutate({
        title: "Introduction to Speed Reading",
        content: DEMO_TEXT,
        fileType: 'txt',
        source: 'generated'
      });
    }
  }, [docsLoading, dbDocuments]);

  // Set current document to first available (and load its preferences if saved)
  const initialDocLoadedRef = useRef(false);
  useEffect(() => {
    if (documents.length > 0 && !currentDocId && !initialDocLoadedRef.current) {
      initialDocLoadedRef.current = true;
      // Check for saved preferences on the initial document
      const docId = documents[0].id;
      const docPrefs = loadDocumentPreferences(docId);
      const hasPrefs = hasDocumentPreferences(docId);
      
      setRememberForDocument(hasPrefs);
      
      if (docPrefs) {
        if (docPrefs.wpm !== undefined) setWpm(docPrefs.wpm);
        if (docPrefs.chunkSize !== undefined) setChunkSize(docPrefs.chunkSize);
        if (docPrefs.columnWidth !== undefined) setColumnWidth(docPrefs.columnWidth);
        if (docPrefs.highlightStyle !== undefined) setHighlightStyle(docPrefs.highlightStyle as any);
        if (docPrefs.showTrail !== undefined) setShowTrail(docPrefs.showTrail);
        if (docPrefs.useWindowMask !== undefined) setUseWindowMask(docPrefs.useWindowMask);
        if (docPrefs.fontSize !== undefined) setFontSize(docPrefs.fontSize);
        if (docPrefs.fontWeight !== undefined) setFontWeight(docPrefs.fontWeight);
        if (docPrefs.fontFamily !== undefined) setFontFamily(docPrefs.fontFamily);
        if (docPrefs.fontColor !== undefined) setFontColor(docPrefs.fontColor);
        if (docPrefs.highlightColor !== undefined) setHighlightColor(docPrefs.highlightColor);
        if (docPrefs.useBionicReading !== undefined) setUseBionicReading(docPrefs.useBionicReading);
        if (docPrefs.pauseOnSentence !== undefined) setPauseOnSentence(docPrefs.pauseOnSentence);
        if (docPrefs.sentencePauseFrequency !== undefined) setSentencePauseFrequency(docPrefs.sentencePauseFrequency);
        if (docPrefs.sentencePauseDuration !== undefined) setSentencePauseDuration(docPrefs.sentencePauseDuration);
        if (docPrefs.pauseOnParagraph !== undefined) setPauseOnParagraph(docPrefs.pauseOnParagraph);
        if (docPrefs.paragraphPauseFrequency !== undefined) setParagraphPauseFrequency(docPrefs.paragraphPauseFrequency);
        if (docPrefs.paragraphPauseDuration !== undefined) setParagraphPauseDuration(docPrefs.paragraphPauseDuration);
      }
      
      setCurrentDocId(docId);
      // Set initial reading position to chapter 1 (after front matter)
      const initialDoc = documents[0];
      if (initialDoc.chapter1WordIndex && initialDoc.chapter1WordIndex > 0) {
        setCurrentIndex(initialDoc.chapter1WordIndex);
      }
    }
  }, [documents, currentDocId]);

  const currentDoc = documents.find(d => d.id === currentDocId) || documents[0];
  const totalWords = currentDoc?.words.length || 0;
  const currentMetadata = currentDoc?.metadata || [];

  // Reset mode to scroll when switching to a non-PDF document
  useEffect(() => {
    if (currentDoc && currentDoc.fileType !== 'pdf' && mode === 'pdf') {
      setMode('scroll');
    }
  }, [currentDoc?.id, currentDoc?.fileType, mode]);

  // Update block count info when current document changes
  useEffect(() => {
    if (currentDoc?.blockInfo) {
      setBlockCountInfo(currentDoc.blockInfo);
    }
  }, [currentDoc?.id, currentDoc?.blockInfo]);

  // Save preferences to backend with debounce
  const savePrefTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  useEffect(() => {
    if (!preferences) return;
    
    clearTimeout(savePrefTimeoutRef.current);
    savePrefTimeoutRef.current = setTimeout(() => {
      updatePreferences.mutate({
        id: preferences.id,
        data: {
          wpm,
          chunkSize,
          columnWidth,
          highlightStyle,
          showTrail,
          useWindowMask,
          fontSize,
          fontWeight,
          useBionicReading,
          pauseOnSentence,
          sentencePauseFrequency,
          sentencePauseDuration,
          pauseOnParagraph,
          paragraphPauseFrequency,
          paragraphPauseDuration,
        }
      });
    }, 1000);

    return () => clearTimeout(savePrefTimeoutRef.current);
  }, [
    preferences,
    wpm,
    chunkSize,
    columnWidth,
    highlightStyle,
    showTrail,
    useWindowMask,
    fontSize,
    fontWeight,
    useBionicReading,
    pauseOnSentence,
    sentencePauseFrequency,
    sentencePauseDuration,
    pauseOnParagraph,
    paragraphPauseFrequency,
    paragraphPauseDuration,
  ]);
  
  // Save document-specific preferences when settings change and checkbox is enabled
  const saveDocPrefTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  useEffect(() => {
    if (!rememberForDocument || !currentDocId) return;
    
    clearTimeout(saveDocPrefTimeoutRef.current);
    saveDocPrefTimeoutRef.current = setTimeout(() => {
      saveDocumentPreferences(currentDocId, {
        wpm,
        chunkSize,
        columnWidth,
        highlightStyle,
        showTrail,
        useWindowMask,
        fontSize,
        fontWeight,
        fontColor,
        highlightColor,
        useBionicReading,
        pauseOnSentence,
        sentencePauseFrequency,
        sentencePauseDuration,
        pauseOnParagraph,
        paragraphPauseFrequency,
        paragraphPauseDuration,
      });
    }, 1000);

    return () => clearTimeout(saveDocPrefTimeoutRef.current);
  }, [
    rememberForDocument,
    currentDocId,
    wpm,
    chunkSize,
    columnWidth,
    highlightStyle,
    showTrail,
    useWindowMask,
    fontSize,
    fontWeight,
    fontColor,
    highlightColor,
    useBionicReading,
    pauseOnSentence,
    sentencePauseFrequency,
    sentencePauseDuration,
    pauseOnParagraph,
    paragraphPauseFrequency,
    paragraphPauseDuration,
  ]);

  // -- Keyboard Shortcuts --
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Period toggles focus mode
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        setFocusMode(f => !f);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Capture initial WPM when reading starts (for max WPM calculation)
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (isPlaying && !wasPlayingRef.current) {
      initialWpmRef.current = wpm;
    }
    wasPlayingRef.current = isPlaying;
  }, [isPlaying, wpm]);

  // -- Reading Logic --
  // Calculate interval based on the actual step size for each mode
  // For accurate WPM: interval = (60000 / wpm) * wordsPerStep
  const effectiveChunkSize = mode === 'scroll' ? scrollChunkSize : chunkSize;

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const tick = () => {
      if (!isPlaying) return;

      // Use wpmRef to avoid re-triggering effect when WPM changes during gradual increase
      const currentWpm = wpmRef.current;
      
      // Calculate duration based on WPM and words per step
      // The visual animation in ScrollDisplay now uses the same WPM-based timing,
      // so there's no need for special synchronization
      let duration = (60000 / currentWpm) * effectiveChunkSize;
      
      // In scroll mode, advance by the computed chunk size (line-based)
      // In RSVP mode, advance by chunkSize
      const stepSize = effectiveChunkSize;
      
      const currentWordsMeta = currentMetadata.slice(currentIndex, currentIndex + stepSize);
      
      const hasSentenceEnd = currentWordsMeta.some(m => m.isSentenceEnd);
      const hasParagraphEnd = currentWordsMeta.some(m => m.isParagraphEnd);
      
      const maxPauseDuration = Math.max(...currentWordsMeta.map(m => m.pauseDuration || 0), 0);
      if (maxPauseDuration > 0) {
        duration += maxPauseDuration;
      }

      if (hasSentenceEnd) {
        sentencesSincePauseRef.current += 1;
        if (pauseOnSentence && sentencesSincePauseRef.current >= sentencePauseFrequency) {
          duration += sentencePauseDuration;
          sentencesSincePauseRef.current = 0;
        }
        
        // Gradual WPM increase (use refs to avoid re-triggering effect)
        if (gradualIncreaseRef.current) {
          sentencesSinceWpmIncreaseRef.current += 1;
          if (sentencesSinceWpmIncreaseRef.current >= gradualIncreaseSentencesRef.current) {
            const baseWpm = initialWpmRef.current;
            const effectiveMax = maxWpmRef.current ?? (baseWpm < 300 ? 500 : baseWpm + 300);
            setWpm(prev => Math.min(effectiveMax, prev + gradualIncreaseWpmRef.current));
            sentencesSinceWpmIncreaseRef.current = 0;
          }
        }
      }

      if (hasParagraphEnd) {
        paragraphsSincePauseRef.current += 1;
        if (pauseOnParagraph && paragraphsSincePauseRef.current >= paragraphPauseFrequency) {
          duration += paragraphPauseDuration;
          paragraphsSincePauseRef.current = 0;
        }
      }
      
      timeoutId = setTimeout(() => {
        setCurrentIndex((prev) => {
          const next = prev + stepSize;
          if (next >= totalWords) {
            setIsPlaying(false);
            return totalWords - 1;
          }
          return next;
        });
      }, duration);
    };

    if (isPlaying) {
      tick();
    }

    return () => clearTimeout(timeoutId);
  }, [
    isPlaying, 
    currentIndex,
    effectiveChunkSize,
    totalWords,
    currentMetadata,
    pauseOnSentence,
    sentencePauseFrequency,
    sentencePauseDuration,
    pauseOnParagraph,
    paragraphPauseFrequency,
    paragraphPauseDuration
  ]);

  // -- Handlers --
  const handleFilesUpload = useCallback(async (files: File[]) => {
    const accepted: { file: File; name: string; size: number }[] = [];
    const rejected: { name: string; size: number; reason: 'size' | 'parse' }[] = [];
    let totalSize = 0;
    
    // Process files in order until we hit the limit
    for (const file of files) {
      // Reject individual files over 50MB
      if (file.size > MAX_FILE_SIZE) {
        rejected.push({ name: file.name, size: file.size, reason: 'size' });
        continue;
      }
      
      // Check if adding this file would exceed total limit
      if (totalSize + file.size > MAX_TOTAL_SIZE) {
        rejected.push({ name: file.name, size: file.size, reason: 'size' });
        continue;
      }
      
      totalSize += file.size;
      accepted.push({ file, name: file.name, size: file.size });
    }
    
    // Process accepted files - track successful uploads
    const successfulUploads: { name: string; size: number }[] = [];
    let lastDocId: string | null = null;
    
    for (const { file, name, size } of accepted) {
      try {
        const parseResult = await parseFileWithData(file);
        if (!parseResult.text) {
          rejected.push({ name, size, reason: 'parse' });
          continue;
        }
        
        // Extract file type from extension
        const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
        const fileType = ext;
        
        await new Promise<void>((resolve) => {
          createDocument.mutate({
            title: file.name,
            content: parseResult.text,
            fileType,
            source: 'upload',
            pdfData: parseResult.pdfData
          }, {
            onSuccess: (newDoc) => {
              lastDocId = newDoc.id;
              successfulUploads.push({ name, size });
              resolve();
            },
            onError: () => {
              rejected.push({ name, size, reason: 'parse' });
              resolve();
            }
          });
        });
      } catch (error) {
        rejected.push({ name, size, reason: 'parse' });
      }
    }
    
    // Select the last uploaded document
    if (lastDocId) {
      setCurrentDocId(lastDocId);
      setCurrentIndex(0);
      setIsPlaying(false);
      // New documents don't have saved preferences
      setRememberForDocument(false);
      // Restore global preferences for new document
      if (preferences) {
        setWpm(preferences.wpm);
        setChunkSize(preferences.chunkSize);
        setColumnWidth(preferences.columnWidth);
        setHighlightStyle(preferences.highlightStyle as any);
        setShowTrail(preferences.showTrail);
        setUseWindowMask(preferences.useWindowMask);
        setFontSize(preferences.fontSize);
        setFontWeight(preferences.fontWeight || '400');
      if (preferences.fontFamily) setFontFamily(preferences.fontFamily);
        setUseBionicReading(preferences.useBionicReading);
        setPauseOnSentence(preferences.pauseOnSentence);
        setSentencePauseFrequency(preferences.sentencePauseFrequency);
        setSentencePauseDuration(preferences.sentencePauseDuration);
        setPauseOnParagraph(preferences.pauseOnParagraph);
        setParagraphPauseFrequency(preferences.paragraphPauseFrequency);
        setParagraphPauseDuration(preferences.paragraphPauseDuration);
      }
    }
    
    // Show modal if there were rejected files
    if (rejected.length > 0) {
      setUploadAccepted(successfulUploads);
      setUploadRejected(rejected);
      setUploadModalOpen(true);
    } else if (successfulUploads.length > 0) {
      // Just show a toast for successful uploads
      toast({
        title: "Documents Uploaded",
        description: `Uploaded ${successfulUploads.length} file${successfulUploads.length > 1 ? 's' : ''}`,
      });
    }
  }, [createDocument, toast, preferences]);
  
  const handleUploadMore = useCallback(() => {
    setUploadModalOpen(false);
    fileInputRef.current?.click();
  }, []);
  
  
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFilesUpload(files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [handleFilesUpload]);

  const handleGenerate = useCallback((title: string, content: string) => {
    createDocument.mutate({
      title,
      content,
      fileType: 'txt',
      source: 'generated'
    }, {
      onSuccess: (newDoc) => {
        setCurrentDocId(newDoc.id);
        setCurrentIndex(0);
        setIsPlaying(false);
        // New documents don't have saved preferences
        setRememberForDocument(false);
        // Restore global preferences for new document
        if (preferences) {
          setWpm(preferences.wpm);
          setChunkSize(preferences.chunkSize);
          setColumnWidth(preferences.columnWidth);
          setHighlightStyle(preferences.highlightStyle as any);
          setShowTrail(preferences.showTrail);
          setUseWindowMask(preferences.useWindowMask);
          setFontSize(preferences.fontSize);
          setFontWeight(preferences.fontWeight || '400');
      if (preferences.fontFamily) setFontFamily(preferences.fontFamily);
          setUseBionicReading(preferences.useBionicReading);
          setPauseOnSentence(preferences.pauseOnSentence);
          setSentencePauseFrequency(preferences.sentencePauseFrequency);
          setSentencePauseDuration(preferences.sentencePauseDuration);
          setPauseOnParagraph(preferences.pauseOnParagraph);
          setParagraphPauseFrequency(preferences.paragraphPauseFrequency);
          setParagraphPauseDuration(preferences.paragraphPauseDuration);
        }
      }
    });
  }, [createDocument, preferences]);

  const handleSelectDoc = useCallback((id: string) => {
    // Check if new document has saved preferences
    const docPrefs = loadDocumentPreferences(id);
    const hasPrefs = hasDocumentPreferences(id);
    
    setRememberForDocument(hasPrefs);
    
    if (docPrefs) {
      // Load document-specific preferences
      if (docPrefs.wpm !== undefined) setWpm(docPrefs.wpm);
      if (docPrefs.chunkSize !== undefined) setChunkSize(docPrefs.chunkSize);
      if (docPrefs.columnWidth !== undefined) setColumnWidth(docPrefs.columnWidth);
      if (docPrefs.highlightStyle !== undefined) setHighlightStyle(docPrefs.highlightStyle as any);
      if (docPrefs.showTrail !== undefined) setShowTrail(docPrefs.showTrail);
      if (docPrefs.useWindowMask !== undefined) setUseWindowMask(docPrefs.useWindowMask);
      if (docPrefs.fontSize !== undefined) setFontSize(docPrefs.fontSize);
      if (docPrefs.fontWeight !== undefined) setFontWeight(docPrefs.fontWeight);
      if (docPrefs.fontFamily !== undefined) setFontFamily(docPrefs.fontFamily);
      if (docPrefs.fontColor !== undefined) setFontColor(docPrefs.fontColor);
      if (docPrefs.highlightColor !== undefined) setHighlightColor(docPrefs.highlightColor);
      if (docPrefs.useBionicReading !== undefined) setUseBionicReading(docPrefs.useBionicReading);
      if (docPrefs.pauseOnSentence !== undefined) setPauseOnSentence(docPrefs.pauseOnSentence);
      if (docPrefs.sentencePauseFrequency !== undefined) setSentencePauseFrequency(docPrefs.sentencePauseFrequency);
      if (docPrefs.sentencePauseDuration !== undefined) setSentencePauseDuration(docPrefs.sentencePauseDuration);
      if (docPrefs.pauseOnParagraph !== undefined) setPauseOnParagraph(docPrefs.pauseOnParagraph);
      if (docPrefs.paragraphPauseFrequency !== undefined) setParagraphPauseFrequency(docPrefs.paragraphPauseFrequency);
      if (docPrefs.paragraphPauseDuration !== undefined) setParagraphPauseDuration(docPrefs.paragraphPauseDuration);
    } else if (preferences) {
      // Restore global preferences for documents without saved settings
      setWpm(preferences.wpm);
      setChunkSize(preferences.chunkSize);
      setColumnWidth(preferences.columnWidth);
      setHighlightStyle(preferences.highlightStyle as any);
      setShowTrail(preferences.showTrail);
      setUseWindowMask(preferences.useWindowMask);
      setFontSize(preferences.fontSize);
      setFontWeight(preferences.fontWeight || '400');
      if (preferences.fontFamily) setFontFamily(preferences.fontFamily);
      if (preferences.fontColor) setFontColor(preferences.fontColor);
      if (preferences.highlightColor) setHighlightColor(preferences.highlightColor);
      setUseBionicReading(preferences.useBionicReading);
      setPauseOnSentence(preferences.pauseOnSentence);
      setSentencePauseFrequency(preferences.sentencePauseFrequency);
      setSentencePauseDuration(preferences.sentencePauseDuration);
      setPauseOnParagraph(preferences.pauseOnParagraph);
      setParagraphPauseFrequency(preferences.paragraphPauseFrequency);
      setParagraphPauseDuration(preferences.paragraphPauseDuration);
    }
    
    setCurrentDocId(id);
    // Use the pre-calculated chapter1WordIndex from the documents array
    const selectedDoc = documents.find(d => d.id === id);
    if (selectedDoc?.chapter1WordIndex && selectedDoc.chapter1WordIndex > 0) {
      setCurrentIndex(selectedDoc.chapter1WordIndex);
    } else {
      setCurrentIndex(0);
    }
    setIsPlaying(false);
    setIsEditing(false);
    sentencesSinceWpmIncreaseRef.current = 0;
  }, [preferences, documents]);

  const handleBlankDocument = useCallback(() => {
    setIsEditing(true);
    setEditingTitle("");
    setEditingContent("");
    setIsPlaying(false);
  }, []);

  const handleSaveBlankDocument = useCallback(() => {
    if (!editingContent.trim()) return;
    
    const title = editingTitle.trim() || "Untitled Document";
    
    // Check if we're editing an existing blank document
    if (currentDoc && currentDoc.source === 'blank' && currentDoc.id) {
      // Update existing document
      updateDocument.mutate({
        id: currentDoc.id,
        title,
        content: editingContent
      }, {
        onSuccess: () => {
          setIsEditing(false);
          setEditingTitle("");
          setEditingContent("");
        }
      });
      return;
    }
    
    // Create new document
    createDocument.mutate({
      title,
      content: editingContent,
      fileType: 'txt',
      source: 'blank'
    }, {
      onSuccess: (newDoc) => {
        setCurrentDocId(newDoc.id);
        setCurrentIndex(0);
        setIsEditing(false);
        setEditingTitle("");
        setEditingContent("");
        // New documents don't have saved preferences
        setRememberForDocument(false);
        // Restore global preferences for new document
        if (preferences) {
          setWpm(preferences.wpm);
          setChunkSize(preferences.chunkSize);
          setColumnWidth(preferences.columnWidth);
          setHighlightStyle(preferences.highlightStyle as any);
          setShowTrail(preferences.showTrail);
          setUseWindowMask(preferences.useWindowMask);
          setFontSize(preferences.fontSize);
          setFontWeight(preferences.fontWeight || '400');
      if (preferences.fontFamily) setFontFamily(preferences.fontFamily);
          setUseBionicReading(preferences.useBionicReading);
          setPauseOnSentence(preferences.pauseOnSentence);
          setSentencePauseFrequency(preferences.sentencePauseFrequency);
          setSentencePauseDuration(preferences.sentencePauseDuration);
          setPauseOnParagraph(preferences.pauseOnParagraph);
          setParagraphPauseFrequency(preferences.paragraphPauseFrequency);
          setParagraphPauseDuration(preferences.paragraphPauseDuration);
        }
      }
    });
  }, [editingTitle, editingContent, createDocument, updateDocument, currentDoc, preferences]);

  const handlePlayPause = () => setIsPlaying(!isPlaying);
  
  // Spacebar to toggle play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
    sentencesSinceWpmIncreaseRef.current = 0;
  };

  const handleRepeat = (sentences: number) => {
    // Find sentence ends before current position and jump back
    let sentenceEndsFound = 0;
    let targetIndex = currentIndex;
    
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (currentMetadata[i]?.isSentenceEnd) {
        sentenceEndsFound++;
        if (sentenceEndsFound >= sentences) {
          // Jump to the word after this sentence end (start of next sentence)
          targetIndex = i + 1;
          break;
        }
      }
    }
    
    // If we didn't find enough sentences, go to the beginning
    if (sentenceEndsFound < sentences) {
      targetIndex = 0;
    }
    
    // Pause, jump to target, wait 0.5s, then resume playback
    setIsPlaying(false);
    setCurrentIndex(targetIndex);
    setTimeout(() => setIsPlaying(true), 500);
  };

  const handleSeek = (value: number) => {
    setCurrentIndex(value);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!currentDoc) return;
    
    const newContent = e.target.value;
    
    // Optimistic update - update locally immediately
    const { words, metadata } = parseText(newContent, restructureParagraphs);
    
    // Debounce the API call
    updateDocument.mutate({
      id: currentDoc.id,
      title: currentDoc.title,
      content: newContent
    });
  };

  const toggleEditMode = () => {
    setIsEditing(!isEditing);
    if (isPlaying) setIsPlaying(false);
  };

  // Find all matches and highlight them
  const handleFindInDocument = useCallback((searchText: string) => {
    if (!searchText.trim() || !currentDoc?.words) {
      setFindMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }
    
    const searchLower = searchText.toLowerCase().trim();
    const matches: number[] = [];
    
    // Find all word indices that contain the search text
    currentDoc.words.forEach((word, index) => {
      if (word.toLowerCase().includes(searchLower)) {
        matches.push(index);
      }
    });
    
    setFindMatches(matches);
    
    if (matches.length > 0) {
      // Find the closest match to current position
      const closestMatchIdx = matches.reduce((closest, matchWordIdx, idx) => {
        const closestDist = Math.abs(matches[closest] - currentIndex);
        const thisDist = Math.abs(matchWordIdx - currentIndex);
        return thisDist < closestDist ? idx : closest;
      }, 0);
      
      setCurrentMatchIndex(closestMatchIdx);
      setCurrentIndex(matches[closestMatchIdx]);
    } else {
      setCurrentMatchIndex(-1);
    }
  }, [currentDoc?.words, currentIndex]);
  
  // Navigate to next match
  const handleNextMatch = useCallback(() => {
    if (findMatches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % findMatches.length;
    setCurrentMatchIndex(nextIdx);
    setCurrentIndex(findMatches[nextIdx]);
  }, [findMatches, currentMatchIndex]);
  
  // Navigate to previous match
  const handlePrevMatch = useCallback(() => {
    if (findMatches.length === 0) return;
    const prevIdx = currentMatchIndex <= 0 ? findMatches.length - 1 : currentMatchIndex - 1;
    setCurrentMatchIndex(prevIdx);
    setCurrentIndex(findMatches[prevIdx]);
  }, [findMatches, currentMatchIndex]);
  
  // Close find and clear
  const handleCloseFind = useCallback(() => {
    setIsFindOpen(false);
    setFindText("");
    setFindMatches([]);
    setCurrentMatchIndex(-1);
  }, []);
  
  // Effect to search as user types
  useEffect(() => {
    if (isFindOpen) {
      handleFindInDocument(findText);
    }
  }, [findText, isFindOpen, handleFindInDocument]);
  
  // Focus input when find opens
  useEffect(() => {
    if (isFindOpen && findInputRef.current) {
      findInputRef.current.focus();
    }
  }, [isFindOpen]);

  const handleResetStartPosition = useCallback(() => {
    if (!currentDocId) return;
    setDocumentStartOffset(prev => {
      const next = { ...prev };
      delete next[currentDocId];
      return next;
    });
    setCurrentIndex(0);
  }, [currentDocId]);

  const handleDeleteDocument = useCallback(() => {
    if (!currentDocId || documents.length <= 1) return;
    
    const currentIdx = documents.findIndex(d => d.id === currentDocId);
    const nextDoc = documents[currentIdx + 1] || documents[currentIdx - 1];
    
    deleteDocument.mutate(currentDocId, {
      onSuccess: () => {
        if (nextDoc) {
          setCurrentDocId(nextDoc.id);
        }
        setCurrentIndex(0);
        setIsPlaying(false);
      }
    });
  }, [currentDocId, documents, deleteDocument]);

  const handleStartRename = useCallback(() => {
    if (!currentDoc) return;
    
    // For blank documents, enter full edit mode
    if (currentDoc.source === 'blank') {
      setEditingTitle(currentDoc.title);
      setEditingContent(currentDoc.content);
      setIsEditing(true);
      setIsPlaying(false);
    } else {
      // For all other document types, open rename modal
      setRenameValue(currentDoc.title);
      setIsRenameModalOpen(true);
    }
  }, [currentDoc]);

  const handleSaveRename = useCallback(() => {
    if (!currentDoc || !renameValue.trim()) return;
    
    updateDocument.mutate({
      id: currentDoc.id,
      title: renameValue.trim(),
      content: currentDoc.content
    });
    setIsRenameModalOpen(false);
  }, [currentDoc, renameValue, updateDocument]);

  if (docsLoading || prefsLoading || !currentDoc) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background overflow-hidden font-sans text-foreground">
      {/* Backdrop for Sidebar when in overlay mode (mobile only) - z-[60] to be above bottom toolbar (z-50) */}
      {isSidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 z-[60]"
          onClick={handleCloseSidebar}
        />
      )}
      {/* Sidebar */}
      {isSidebarOpen && !focusMode && (
        <Sidebar 
          documents={documents} 
          currentDocId={currentDocId} 
          onSelect={(id) => {
            handleSelectDoc(id);
            if (isMobile) setIsSidebarOpen(false);
          }} 
          onUpload={(files) => {
            handleFilesUpload(files);
            if (isMobile) setIsSidebarOpen(false);
          }}
          onGenerate={(title, content) => {
            handleGenerate(title, content);
            if (isMobile) setIsSidebarOpen(false);
          }}
          onBlankDocument={() => {
            handleBlankDocument();
            if (isMobile) setIsSidebarOpen(false);
          }}
          onClose={handleCloseSidebar}
          onAddFreeBook={(title, content, fileType) => {
            createDocument.mutate({
              title,
              content,
              fileType: fileType || 'txt',
              source: 'free_book'
            }, {
              onSuccess: (newDoc) => {
                setCurrentDocId(newDoc.id);
                setCurrentIndex(0);
                setIsPlaying(false);
                setRememberForDocument(false);
              }
            });
            if (isMobile) setIsSidebarOpen(false);
          }}
        />
      )}
      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full min-w-[320px] relative overflow-hidden">
        {/* Top Control Bar */}
        <ControlBar
          mode={mode}
          onModeChange={setMode}
          isPdfDocument={currentDoc?.fileType === 'pdf'}
          currentIndex={currentIndex}
          totalWords={totalWords}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => {
            setSidebarManuallyHidden(false);
            setIsSidebarOpen(true);
          }}
          isRightPanelOpen={isRightPanelOpen}
          onToggleRightPanel={() => {
            setRightPanelManuallyHidden(false);
            setIsRightPanelOpen(true);
          }}
          isMobile={isMobile}
          focusMode={focusMode}
          onToggleFocusMode={() => setFocusMode(!focusMode)}
        />
        
        {/* Document toolbar - chapters, find, rename, delete */}
        {!focusMode && <div className="px-2 md:px-4 py-2 border-b border-border bg-muted/30 flex items-center gap-1.5 md:gap-2 relative z-10">
          {/* Chapter buttons group - left side with constrained width */}
          {currentDoc && currentDoc.chapters && currentDoc.chapters.length > 0 && (
            <div className="flex-1 min-w-0 overflow-hidden">
              <ChapterNav 
                chapters={currentDoc.chapters}
                currentIndex={currentIndex}
                onChapterClick={(wordIndex) => {
                  setCurrentIndex(wordIndex);
                  setIsPlaying(false);
                }}
                hidden={false}
                compact={true}
              />
            </div>
          )}
          
          {/* Vertical divider - only show when chapters exist */}
          {currentDoc && currentDoc.chapters && currentDoc.chapters.length > 0 && (
            <div className="w-px h-6 bg-border shrink-0" />
          )}
          
          {/* Action buttons - find, edit, delete - always right aligned */}
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            {/* Find in document - collapsible */}
            {isFindOpen ? (
              <>
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  ref={findInputRef}
                  type="text"
                  placeholder="Find..."
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.shiftKey ? handlePrevMatch() : handleNextMatch();
                    }
                    if (e.key === 'Escape') {
                      handleCloseFind();
                    }
                  }}
                  className="h-8 text-sm w-24 md:w-32"
                  data-testid="input-find-in-document"
                />
                {findMatches.length > 0 && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {currentMatchIndex + 1}/{findMatches.length}
                  </span>
                )}
                {findText && findMatches.length === 0 && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    0
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handlePrevMatch}
                  disabled={findMatches.length === 0}
                  className="shrink-0 h-8 w-8 p-0"
                  data-testid="button-find-prev"
                  title="Previous match (Shift+Enter)"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleNextMatch}
                  disabled={findMatches.length === 0}
                  className="shrink-0 h-8 w-8 p-0"
                  data-testid="button-find-next"
                  title="Next match (Enter)"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCloseFind}
                  className="shrink-0 h-8 w-8 p-0"
                  data-testid="button-close-find"
                  title="Close find"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsFindOpen(true)}
                className="h-8 w-8 p-0"
                data-testid="button-open-find"
                title="Find in document"
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleStartRename}
              className="text-muted-foreground hover:text-foreground h-8 w-8 p-0 shrink-0"
              data-testid="button-edit-document"
              title="Edit document"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={documents.length <= 1}
                  className="text-muted-foreground hover:text-destructive h-8 w-8 p-0 shrink-0"
                  data-testid="button-delete-document"
                  title="Delete document"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Document</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this file?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteDocument}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-delete"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>}

        
        {/* Display Area */}
        <div 
          className="flex-1 flex overflow-hidden pb-14 md:pb-0"
          style={{
            '--reader-font-size': `${fontSize}px`,
            '--reader-column-width': columnWidth >= 1200 ? '100%' : `${columnWidth}px`,
          } as CSSProperties}
        >
          <div className="flex-1 relative overflow-hidden flex flex-col">
            {isEditing ? (
              <div className="flex-1 p-8 bg-background flex flex-col items-center overflow-hidden">
                <div className="w-full max-w-4xl h-full flex flex-col gap-4">
                  <Input 
                    className="text-xl font-semibold border-none shadow-none px-0 focus-visible:ring-0 bg-transparent"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    placeholder="Untitled Document"
                    data-testid="input-document-title"
                  />
                  <Textarea 
                    className="flex-1 resize-none text-base p-0 leading-relaxed border-none shadow-none focus-visible:ring-0 bg-transparent caret-primary"
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    placeholder="Paste text here or type"
                    autoFocus
                    data-testid="input-document-editor"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {editingContent.split(/\s+/).filter(w => w).length} words
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsEditing(false)}
                        data-testid="button-cancel-edit"
                      >
                        Cancel
                      </Button>
                      <Button 
                        size="sm"
                        onClick={handleSaveBlankDocument}
                        disabled={!editingContent.trim()}
                        data-testid="button-save-document"
                      >
                        Save Document
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              mode === 'rsvp' ? (
                <>
                  <RSVPDisplay 
                    words={currentDoc.words}
                    currentIndex={currentIndex}
                    chunkSize={debouncedChunkSize}
                    isPlaying={isPlaying}
                    fontSize={fontSize}
                    fontFamily={fontFamily}
                    fontWeight={fontWeight}
                    fontColor={fontColor}
                    useBionicReading={useBionicReading}
                    onTogglePlay={handlePlayPause}
                  />
                </>
              ) : mode === 'pdf' && currentDoc.pdfData ? (
                <PDFViewerDisplay
                  pdfData={currentDoc.pdfData}
                  currentIndex={currentIndex}
                  isPlaying={isPlaying}
                  highlightColor={highlightColor}
                  fontColor={fontColor}
                  wpm={wpm}
                  onWordClick={(index) => {
                    setCurrentIndex(index);
                    setIsPlaying(false);
                    setTimeout(() => setIsPlaying(true), 500);
                  }}
                />
              ) : (
                <>
                  <ScrollDisplay 
                  key={`scroll-${currentDoc.id}-${currentDoc.chapter1WordIndex || 0}`}
                  words={currentDoc.words}
                  currentIndex={currentIndex}
                  linePercent={debouncedLinePercent}
                  multipleWords={multipleWords}
                  isPlaying={isPlaying}
                  onWordClick={(index) => { 
                    setCurrentIndex(index); 
                    setIsPlaying(false);
                    // Delay playback by 0.5s to let user process new position
                    setTimeout(() => setIsPlaying(true), 500);
                  }}
                  onChunkSizeChange={setScrollChunkSize}
                  columnWidth={debouncedColumnWidth}
                  showTrail={showTrail}
                  useWindowMask={useWindowMask}
                  highlightStyle={highlightStyle}
                  highlightColor={highlightColor}
                  fontSize={fontSize}
                  fontFamily={fontFamily}
                  wpm={wpm}
                  fontWeight={fontWeight}
                  fontColor={fontColor}
                  useBionicReading={useBionicReading}
                  onTogglePlay={handlePlayPause}
                  onPause={() => setIsPlaying(false)}
                  displayStartIndex={currentDoc.chapter1WordIndex || 0}
                  chapters={currentDoc.chapters}
                  findText={findText}
                  findMatches={findMatches}
                  currentMatchIndex={currentMatchIndex}
                />
                </>
              )
            )}
          </div>
        </div>
        
        {/* Bottom Control Bar - Desktop Only */}
        {!isMobile && !focusMode && (
          <BottomControlBar
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onReset={handleReset}
            onRepeat={handleRepeat}
            isMobile={isMobile}
          />
        )}
      </main>
      {/* Right Panel - Desktop Only */}
      {isRightPanelOpen && !isMobile && !focusMode && (
        <RightPanel 
          wpm={wpm}
          onWpmChange={setWpm}
          chunkSize={chunkSize}
          onChunkSizeChange={setChunkSize}
          linePercent={linePercent}
          onLinePercentChange={setLinePercent}
          multipleWords={multipleWords}
          onMultipleWordsChange={setMultipleWords}
          columnWidth={columnWidth}
          onColumnWidthChange={setColumnWidth}
          showTrail={showTrail}
          onShowTrailChange={setShowTrail}
          useWindowMask={useWindowMask}
          onUseWindowMaskChange={setUseWindowMask}
          highlightStyle={highlightStyle}
          onHighlightStyleChange={setHighlightStyle}
          highlightColor={highlightColor}
          onHighlightColorChange={setHighlightColor}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          fontFamily={fontFamily}
          onFontFamilyChange={setFontFamily}
          fontWeight={fontWeight}
          onFontWeightChange={setFontWeight}
          fontColor={fontColor}
          onFontColorChange={setFontColor}
          useBionicReading={useBionicReading}
          onUseBionicReadingChange={setUseBionicReading}
          pauseOnSentence={pauseOnSentence}
          onPauseOnSentenceChange={setPauseOnSentence}
          sentencePauseFrequency={sentencePauseFrequency}
          onSentencePauseFrequencyChange={setSentencePauseFrequency}
          sentencePauseDuration={sentencePauseDuration}
          onSentencePauseDurationChange={setSentencePauseDuration}
          pauseOnParagraph={pauseOnParagraph}
          onPauseOnParagraphChange={setPauseOnParagraph}
          paragraphPauseFrequency={paragraphPauseFrequency}
          onParagraphPauseFrequencyChange={setParagraphPauseFrequency}
          paragraphPauseDuration={paragraphPauseDuration}
          onParagraphPauseDurationChange={setParagraphPauseDuration}
          mode={mode}
          onModeChange={setMode}
          onClose={handleCloseRightPanel}
          isEditing={isEditing}
          onEditToggle={toggleEditMode}
          rememberForDocument={rememberForDocument}
          onRememberForDocumentChange={handleRememberForDocumentChange}
          gradualIncrease={gradualIncrease}
          onGradualIncreaseChange={setGradualIncrease}
          gradualIncreaseWpm={gradualIncreaseWpm}
          onGradualIncreaseWpmChange={setGradualIncreaseWpm}
          gradualIncreaseSentences={gradualIncreaseSentences}
          onGradualIncreaseSentencesChange={setGradualIncreaseSentences}
          maxWpm={maxWpm}
          onMaxWpmChange={setMaxWpm}
          restructureParagraphs={restructureParagraphs}
          onRestructureParagraphsChange={setRestructureParagraphs}
          blockCountInfo={blockCountInfo}
        />
      )}
      {/* Mobile Bottom Control Bar */}
      {isMobile && !focusMode && (
        <MobileControlBar
          wpm={wpm}
          onWpmChange={setWpm}
          chunkSize={chunkSize}
          onChunkSizeChange={setChunkSize}
          linePercent={linePercent}
          onLinePercentChange={setLinePercent}
          multipleWords={multipleWords}
          onMultipleWordsChange={setMultipleWords}
          columnWidth={columnWidth}
          onColumnWidthChange={setColumnWidth}
          showTrail={showTrail}
          onShowTrailChange={setShowTrail}
          useWindowMask={useWindowMask}
          onUseWindowMaskChange={setUseWindowMask}
          highlightStyle={highlightStyle}
          onHighlightStyleChange={setHighlightStyle}
          highlightColor={highlightColor}
          onHighlightColorChange={setHighlightColor}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          fontFamily={fontFamily}
          onFontFamilyChange={setFontFamily}
          fontWeight={fontWeight}
          onFontWeightChange={setFontWeight}
          fontColor={fontColor}
          onFontColorChange={setFontColor}
          useBionicReading={useBionicReading}
          onUseBionicReadingChange={setUseBionicReading}
          pauseOnSentence={pauseOnSentence}
          onPauseOnSentenceChange={setPauseOnSentence}
          sentencePauseFrequency={sentencePauseFrequency}
          onSentencePauseFrequencyChange={setSentencePauseFrequency}
          sentencePauseDuration={sentencePauseDuration}
          onSentencePauseDurationChange={setSentencePauseDuration}
          pauseOnParagraph={pauseOnParagraph}
          onPauseOnParagraphChange={setPauseOnParagraph}
          paragraphPauseFrequency={paragraphPauseFrequency}
          onParagraphPauseFrequencyChange={setParagraphPauseFrequency}
          paragraphPauseDuration={paragraphPauseDuration}
          onParagraphPauseDurationChange={setParagraphPauseDuration}
          gradualIncrease={gradualIncrease}
          onGradualIncreaseChange={setGradualIncrease}
          gradualIncreaseWpm={gradualIncreaseWpm}
          onGradualIncreaseWpmChange={setGradualIncreaseWpm}
          gradualIncreaseSentences={gradualIncreaseSentences}
          onGradualIncreaseSentencesChange={setGradualIncreaseSentences}
          mode={mode}
          isEditing={isEditing}
          onEditToggle={toggleEditMode}
          isOpen={isMobileControlOpen}
          onToggle={() => setIsMobileControlOpen(!isMobileControlOpen)}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onReset={handleReset}
          onRepeat={handleRepeat}
        />
      )}
      
      {/* Hidden file input for "Upload more" functionality */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.md,.html,.htm,.pdf,.docx,.epub"
        className="hidden"
        onChange={handleFileInputChange}
      />
      
      {/* Upload Result Modal */}
      {uploadModalOpen && (
        <UploadResultModal
          acceptedFiles={uploadAccepted}
          rejectedFiles={uploadRejected}
          onUploadMore={handleUploadMore}
          onClose={() => setUploadModalOpen(false)}
        />
      )}
      
      {/* Rename Document Modal */}
      <Dialog open={isRenameModalOpen} onOpenChange={setIsRenameModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Document</DialogTitle>
            <DialogDescription>
              Enter a new name for this document.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Document name"
            className="mt-2"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveRename();
              if (e.key === 'Escape') setIsRenameModalOpen(false);
            }}
            data-testid="input-rename-modal"
          />
          <DialogFooter className="mt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsRenameModalOpen(false)}
              data-testid="button-cancel-rename-modal"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveRename}
              disabled={!renameValue.trim()}
              data-testid="button-save-rename-modal"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
