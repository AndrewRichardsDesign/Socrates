import { useState, useCallback } from "react";
import { Search, X, BookOpen, Plus, Info, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { stripGutenbergBoilerplate } from "@/lib/frontMatterParser";

interface BookResult {
  id: string;
  title: string;
  author: string;
  publishDate: string;
  source: 'openlibrary' | 'gutenberg' | 'internetarchive';
  coverId?: string;
  description?: string;
  iaId?: string;
}

interface BookDetails {
  id: string;
  title: string;
  author: string;
  publishDate: string;
  description: string;
  source: string;
  coverId?: string;
}

function isGarbageContent(text: string): { isGarbage: boolean; reason?: string } {
  if (!text || text.length < 1000) {
    return { isGarbage: true, reason: 'Content too short' };
  }
  
  const urlCount = (text.match(/https?:\/\/[^\s]+/gi) || []).length;
  const textLength = text.length;
  const urlDensity = urlCount / (textLength / 1000);
  
  if (urlDensity > 2) {
    return { isGarbage: true, reason: 'Content contains too many URLs - appears to be metadata' };
  }
  
  const moviePatterns = /\b(imdb\.com|youtube\.com|filme|film\s+adaptation|trilha\s*sonora|soundtrack|movie\s+review|cinema|cinematograph|directed\s+by|starring|cast:|runtime:|rating:)\b/gi;
  const movieMatches = (text.match(moviePatterns) || []).length;
  if (movieMatches > 5) {
    return { isGarbage: true, reason: 'Content appears to be movie metadata rather than book text' };
  }
  
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 50);
  if (paragraphs.length < 3) {
    return { isGarbage: true, reason: 'Content lacks proper paragraph structure' };
  }
  
  const first5000 = text.slice(0, 5000);
  const sentences = first5000.split(/[.!?]+/).filter(s => s.trim().length > 20);
  if (sentences.length < 10) {
    return { isGarbage: true, reason: 'Content lacks proper sentence structure' };
  }
  
  return { isGarbage: false };
}

interface FreeBooksProps {
  onAddBook: (title: string, content: string, fileType?: string) => void;
  onClose: () => void;
}

const sourceLabels = {
  openlibrary: 'Open Library',
  gutenberg: 'Project Gutenberg',
  internetarchive: 'Internet Archive',
};

const sourceBadgeColors = {
  openlibrary: 'bg-blue-100 text-blue-700',
  gutenberg: 'bg-green-100 text-green-700',
  internetarchive: 'bg-orange-100 text-orange-700',
};

export function FreeBooks({ onAddBook, onClose }: FreeBooksProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isAddingBook, setIsAddingBook] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || query.trim().length < 2) return;
    
    setIsSearching(true);
    setHasSearched(true);
    try {
      const response = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data = await response.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  const handleViewDetails = useCallback(async (book: BookResult) => {
    setIsLoadingDetails(true);
    try {
      const response = await fetch(`/api/books/details/${book.source}/${book.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch details');
      }
      const data = await response.json();
      setSelectedBook(data);
    } catch (error) {
      console.error('Details error:', error);
      setSelectedBook({
        id: book.id,
        title: book.title,
        author: book.author,
        publishDate: book.publishDate,
        description: book.description || 'No description available.',
        source: book.source,
        coverId: book.coverId,
      });
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  const parseEpubFromBase64 = useCallback(async (base64Data: string): Promise<string> => {
    const ePub = (await import('epubjs')).default;
    
    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;
    
    const book = ePub(arrayBuffer);
    await book.ready;
    
    const spine = book.spine as any;
    const items = spine.items as any[];
    
    // Process spine items in parallel batches for better performance
    const BATCH_SIZE = 10;
    const results: (string | null)[] = new Array(items.length).fill(null);
    
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (item, batchIndex) => {
        const globalIndex = i + batchIndex;
        try {
          const doc = await book.load(item.href);
          if (doc && typeof doc === 'object' && 'body' in doc) {
            const body = (doc as Document).body;
            results[globalIndex] = body.textContent + '\n\n';
          }
        } catch (e) {
          console.warn('Could not load spine item:', item.href);
        }
      });
      await Promise.all(batchPromises);
    }
    
    const fullText = results.filter(Boolean).join('');
    return fullText.trim() || 'Could not extract text from EPUB';
  }, []);

  const tryFetchContent = useCallback(async (source: string, id: string, iaId?: string): Promise<{ success: boolean; title?: string; content?: string; format?: string; epubData?: string; error?: string }> => {
    try {
      const url = source === 'openlibrary' && iaId
        ? `/api/books/content/${source}/${id}?iaId=${encodeURIComponent(iaId)}`
        : `/api/books/content/${source}/${id}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to fetch', title: data.title };
      }
      
      return { success: true, title: data.title, content: data.content, format: data.format, epubData: data.epubData };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const searchForAlternative = useCallback(async (title: string, excludeSource: string): Promise<BookResult | null> => {
    try {
      const response = await fetch(`/api/books/search?q=${encodeURIComponent(title)}`);
      if (!response.ok) return null;
      const allResults: BookResult[] = await response.json();
      
      // Find a result from a different source that matches the title well
      const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      for (const result of allResults) {
        if (result.source === excludeSource) continue;
        
        const resultTitleWords = result.title.toLowerCase().split(/\s+/);
        const matchCount = titleWords.filter(w => resultTitleWords.some(rw => rw.includes(w) || w.includes(rw))).length;
        if (matchCount >= Math.ceil(titleWords.length * 0.6)) {
          return result;
        }
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const handleAddBook = useCallback(async (book: BookResult) => {
    setIsAddingBook(book.id);
    const triedSources: string[] = [book.source];
    
    try {
      // Try the original source first
      let result = await tryFetchContent(book.source, book.id, book.iaId);
      
      // If content unavailable, try to find in other sources
      if (!result.success && result.error === 'content_unavailable') {
        const bookTitle = result.title || book.title;
        
        // Try to find an alternative from other sources
        const alternative = await searchForAlternative(bookTitle, book.source);
        
        if (alternative && !triedSources.includes(alternative.source)) {
          triedSources.push(alternative.source);
          result = await tryFetchContent(alternative.source, alternative.id, alternative.iaId);
          
          // If that also fails, try one more source
          if (!result.success && result.error === 'content_unavailable') {
            const thirdOption = await searchForAlternative(bookTitle, alternative.source);
            if (thirdOption && !triedSources.includes(thirdOption.source)) {
              triedSources.push(thirdOption.source);
              result = await tryFetchContent(thirdOption.source, thirdOption.id, thirdOption.iaId);
            }
          }
        }
      }
      
      if (!result.success) {
        const title = result.title || book.title;
        alert(`The complete "${title}" is not available from our sources. This may be due to copyright restrictions.`);
        return;
      }
      
      let content = result.content;
      
      // If EPUB data is returned, parse it on the client
      if (result.format === 'epub' && result.epubData) {
        content = await parseEpubFromBase64(result.epubData);
      }
      
      // Strip Gutenberg boilerplate (license text at start/end) for text files
      if (result.format === 'txt' && content) {
        content = stripGutenbergBoilerplate(content);
      }
      
      // Validate content quality to catch garbage/metadata content
      if (content) {
        const qualityCheck = isGarbageContent(content);
        if (qualityCheck.isGarbage) {
          console.warn(`Content quality check failed: ${qualityCheck.reason}`);
          alert(`The downloaded content for "${result.title}" appears to be corrupted or not the actual book text. ${qualityCheck.reason}`);
          return;
        }
      }
      
      const fileType = result.format === 'epub' ? 'epub' : 'txt';
      onAddBook(result.title!, content!, fileType);
      onClose();
    } catch (error) {
      console.error('Add book error:', error);
      alert('Could not download this book. Please try again later.');
    } finally {
      setIsAddingBook(null);
    }
  }, [onAddBook, onClose, parseEpubFromBase64, tryFetchContent, searchForAlternative]);

  const getCoverUrl = (book: BookResult) => {
    if (book.source === 'gutenberg' && book.coverId) {
      return book.coverId;
    }
    if (book.source === 'openlibrary' && book.coverId) {
      return `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`;
    }
    return null;
  };

  return (
    <div className="absolute inset-0 bg-white z-50 flex flex-col overflow-hidden" style={{ width: '100%', maxWidth: '240px' }}>
      <div className="flex items-center gap-1.5 p-2 border-b border-gray-200" style={{ width: '100%' }}>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 shrink-0">
          <X className="h-4 w-4" />
        </Button>
        <div className="flex-1 relative min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search books..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-7 h-7 text-xs"
            data-testid="input-book-search"
            autoFocus
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching || query.trim().length < 2} size="sm" className="h-7 px-2 shrink-0">
          {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ width: '100%' }}>
        {!hasSearched && (
          <div className="flex flex-col items-center justify-center h-64 text-center p-4">
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-1">Find Free Books</h3>
            <p className="text-sm text-muted-foreground max-w-[200px]">
              Search for public domain books from Open Library, Project Gutenberg, and Internet Archive
            </p>
          </div>
        )}

        {isSearching && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {hasSearched && !isSearching && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center p-4">
            <p className="text-sm text-muted-foreground">No books found. Try a different search term.</p>
          </div>
        )}

        {!isSearching && results.length > 0 && (
          <div className="space-y-3" style={{ width: '100%', padding: '12px', boxSizing: 'border-box' }}>
            {results.map((book) => (
              <div
                key={`${book.source}-${book.id}`}
                className="p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
                data-testid={`book-result-${book.source}-${book.id}`}
              >
                <div className="flex gap-2" style={{ width: '100%' }}>
                  {getCoverUrl(book) && (
                    <img
                      src={getCoverUrl(book)!}
                      alt={book.title}
                      className="object-cover rounded shadow-sm"
                      style={{ width: '40px', height: '56px', flexShrink: 0 }}
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <h4 className="font-medium text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</h4>
                    <p className="text-xs text-muted-foreground" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.author}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">{book.publishDate}</span>
                      <Badge variant="outline" className={`text-[10px] px-1 py-0 ${sourceBadgeColors[book.source]}`}>
                        {sourceLabels[book.source]}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => !isAddingBook && handleAddBook(book)}
                    disabled={!!isAddingBook}
                    className="w-full h-8 px-3 rounded-md flex items-center justify-center gap-1.5 cursor-pointer select-none border-2 bg-transparent hover:bg-blue-50 transition-colors disabled:opacity-50"
                    style={{ borderColor: '#0040DD', color: '#0040DD' }}
                    data-testid={`btn-add-book-${book.source}-${book.id}`}
                  >
                    {isAddingBook === book.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#0040DD' }} />
                    ) : (
                      <Plus className="w-4 h-4" style={{ color: '#0040DD' }} />
                    )}
                    <span className="text-xs font-semibold" style={{ color: '#0040DD' }}>Add to Library</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => !isLoadingDetails && handleViewDetails(book)}
                    disabled={!!isLoadingDetails}
                    className="w-full h-7 px-3 flex items-center justify-center gap-1.5 cursor-pointer select-none bg-transparent hover:underline transition-colors disabled:opacity-50"
                    style={{ color: '#6b7280', border: 'none' }}
                    data-testid={`btn-view-details-${book.source}-${book.id}`}
                  >
                    <Info className="w-3.5 h-3.5" style={{ color: '#6b7280' }} />
                    <span className="text-xs" style={{ color: '#6b7280' }}>View Details</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedBook} onOpenChange={() => setSelectedBook(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="pr-8">{selectedBook?.title}</DialogTitle>
          </DialogHeader>
          {selectedBook && (
            <div className="space-y-4">
              <div className="flex gap-4">
                {selectedBook.coverId && (
                  <img
                    src={
                      selectedBook.source === 'openlibrary'
                        ? `https://covers.openlibrary.org/b/id/${selectedBook.coverId}-M.jpg`
                        : selectedBook.coverId
                    }
                    alt={selectedBook.title}
                    className="w-20 h-28 object-cover rounded shadow"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{selectedBook.author}</p>
                  <p className="text-sm text-muted-foreground">Published: {selectedBook.publishDate}</p>
                  <Badge 
                    variant="outline" 
                    className={`mt-2 text-xs ${sourceBadgeColors[selectedBook.source as keyof typeof sourceBadgeColors] || ''}`}
                  >
                    {sourceLabels[selectedBook.source as keyof typeof sourceLabels] || selectedBook.source}
                  </Badge>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">Description</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedBook.description}
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  const book = results.find(
                    (r) => r.id === selectedBook.id && r.source === selectedBook.source
                  );
                  if (book) {
                    setSelectedBook(null);
                    handleAddBook(book);
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Library
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
