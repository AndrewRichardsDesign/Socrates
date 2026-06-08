import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDocumentSchema, insertPreferencesSchema, updatePreferencesSchema } from "@shared/schema";

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

const STUDY_MATERIAL_PATTERNS = /\b(notes|study\s*guide|cliffsnotes|sparknotes|coles\s*notes|york\s*notes|monarch\s*notes|barron'?s|maxnotes|analysis|criticism|companion|guide\s*to|reader'?s\s*guide|teaching\s*guide|teacher'?s\s*guide|student'?s?\s*guide|exam\s*prep|test\s*prep|essay|summary|outline|review|workbook|study\s*aid|passnotes|pass\s*notes|understanding\s+the|readings\s+on|studies\s+in|guide\s*$|:\s*guide|critical\s+essays|commentary|interpretation|masterplots|masterwork|booknotes|quicknotes|lectures\s+on|making\s+of|behind\s+the\s+scenes|adaptation|screenplay|film\s+tie-?in|movie\s+tie-?in)\b/i;

function isStudyMaterial(title: string, subtitle?: string): boolean {
  const fullTitle = subtitle ? `${title} ${subtitle}` : title;
  return STUDY_MATERIAL_PATTERNS.test(fullTitle);
}

function isGarbageContent(text: string): { isGarbage: boolean; reason?: string } {
  if (!text || text.length < 1000) {
    return { isGarbage: true, reason: 'Content too short (less than 1000 characters)' };
  }
  
  const urlCount = (text.match(/https?:\/\/[^\s]+/gi) || []).length;
  const textLength = text.length;
  const urlDensity = urlCount / (textLength / 1000);
  
  if (urlDensity > 2) {
    return { isGarbage: true, reason: 'Content contains too many URLs - appears to be metadata or link collection' };
  }
  
  const moviePatterns = /\b(imdb\.com|youtube\.com|filme|film\s+adaptation|trilha\s*sonora|soundtrack|movie\s+review|cinema|cinematograph|directed\s+by|starring|cast:|runtime:|rating:)\b/gi;
  const movieMatches = (text.match(moviePatterns) || []).length;
  if (movieMatches > 5) {
    return { isGarbage: true, reason: 'Content appears to be movie/film metadata rather than book text' };
  }
  
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 50);
  if (paragraphs.length < 3) {
    return { isGarbage: true, reason: 'Content lacks proper paragraph structure - appears to be metadata' };
  }
  
  const first5000 = text.slice(0, 5000);
  const sentences = first5000.split(/[.!?]+/).filter(s => s.trim().length > 20);
  if (sentences.length < 10) {
    return { isGarbage: true, reason: 'Content lacks proper sentence structure' };
  }
  
  return { isGarbage: false };
}

async function searchOpenLibrary(query: string): Promise<BookResult[]> {
  try {
    const response = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=50&has_fulltext=true`
    );
    const data = await response.json();
    
    const results = (data.docs || [])
      .filter((doc: any) => {
        const hasIA = doc.ia && Array.isArray(doc.ia) && doc.ia.length > 0;
        const isPublicScan = doc.public_scan_b === true;
        if (!hasIA && !isPublicScan) return false;
        
        // Filter out study guides, notes, criticism, etc.
        const title = doc.title || '';
        const subtitle = doc.subtitle || '';
        if (isStudyMaterial(title, subtitle)) return false;
        
        // Also check subjects for study material indicators
        const subjects = (doc.subject || []).join(' ').toLowerCase();
        if (/study\s*guides|literary\s*criticism|examinations|outlines/i.test(subjects)) {
          // Only filter if the title also looks suspicious (short or has "guide" etc.)
          if (title.length < 50 && /guide|notes|companion/i.test(title)) return false;
        }
        
        return true;
      })
      .slice(0, 20)
      .map((doc: any) => ({
        id: doc.key?.replace('/works/', '') || doc.edition_key?.[0] || '',
        title: doc.title || 'Unknown Title',
        author: doc.author_name?.[0] || 'Unknown Author',
        publishDate: doc.first_publish_year?.toString() || 'Unknown',
        source: 'openlibrary' as const,
        coverId: doc.cover_i?.toString(),
        description: doc.first_sentence?.[0] || undefined,
        iaId: doc.ia?.[0],
      }));
    
    return results;
  } catch (error) {
    console.error('Open Library search error:', error);
    return [];
  }
}

async function searchGutenberg(query: string): Promise<BookResult[]> {
  try {
    const response = await fetch(
      `https://gutendex.com/books/?search=${encodeURIComponent(query)}`
    );
    const data = await response.json();
    
    return (data.results || [])
      .filter((book: any) => {
        const title = book.title || '';
        // Apply the same study material filter as other sources
        if (isStudyMaterial(title)) return false;
        return true;
      })
      .slice(0, 20)
      .map((book: any) => ({
        id: book.id?.toString() || '',
        title: book.title || 'Unknown Title',
        author: book.authors?.[0]?.name || 'Unknown Author',
        publishDate: book.authors?.[0]?.birth_year?.toString() || 'Classic',
        source: 'gutenberg' as const,
        coverId: book.formats?.['image/jpeg'] || undefined,
      }));
  } catch (error) {
    console.error('Gutenberg search error:', error);
    return [];
  }
}

async function searchInternetArchive(query: string): Promise<BookResult[]> {
  try {
    // Search by title field to get more relevant results (not full-text which returns study guides, etc.)
    const response = await fetch(
      `https://archive.org/advancedsearch.php?q=title:(${encodeURIComponent(query)})+AND+mediatype:texts+AND+format:(Text OR EPUB)&fl=identifier,title,creator,date,description&rows=50&output=json`
    );
    const data = await response.json();
    
    const results = (data.response?.docs || [])
      .filter((doc: any) => {
        const title = (doc.title || '');
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
        
        // Use the shared study material filter
        if (isStudyMaterial(title)) return false;
        
        // Require at least half the query words to appear in the title
        const titleLower = title.toLowerCase();
        const matchingWords = queryWords.filter(w => titleLower.includes(w));
        return matchingWords.length >= Math.ceil(queryWords.length / 2);
      })
      .slice(0, 15)
      .map((doc: any) => ({
        id: doc.identifier || '',
        title: doc.title || 'Unknown Title',
        author: Array.isArray(doc.creator) ? doc.creator[0] : (doc.creator || 'Unknown Author'),
        publishDate: doc.date || 'Unknown',
        source: 'internetarchive' as const,
        description: Array.isArray(doc.description) ? doc.description[0] : doc.description,
      }));
    
    return results;
  } catch (error) {
    console.error('Internet Archive search error:', error);
    return [];
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Documents API
  app.get("/api/documents", async (req, res) => {
    try {
      const docs = await storage.getAllDocuments();
      res.json(docs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/:id", async (req, res) => {
    try {
      const doc = await storage.getDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(doc);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  app.post("/api/documents", async (req, res) => {
    try {
      const validated = insertDocumentSchema.parse(req.body);
      const doc = await storage.createDocument(validated);
      res.status(201).json(doc);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid document data" });
      }
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  app.patch("/api/documents/:id", async (req, res) => {
    try {
      const { content, title } = req.body;
      if (!content || !title) {
        return res.status(400).json({ error: "Content and title are required" });
      }
      const doc = await storage.updateDocument(req.params.id, content, title);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(doc);
    } catch (error) {
      res.status(500).json({ error: "Failed to update document" });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const success = await storage.deleteDocument(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Preferences API
  app.get("/api/preferences", async (req, res) => {
    try {
      let prefs = await storage.getPreferences();
      
      // If no preferences exist, create default ones
      if (!prefs) {
        prefs = await storage.createPreferences({
          wpm: 300,
          chunkSize: 1,
          columnWidth: 800,
          highlightStyle: 'block',
          showTrail: false,
          useWindowMask: false,
          fontSize: 1,
          fontWeight: 'normal',
          useBionicReading: false,
          pauseOnSentence: false,
          sentencePauseFrequency: 1,
          sentencePauseDuration: 1000,
          pauseOnParagraph: false,
          paragraphPauseFrequency: 1,
          paragraphPauseDuration: 2000,
        });
      }
      
      res.json(prefs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch preferences" });
    }
  });

  app.patch("/api/preferences/:id", async (req, res) => {
    try {
      const validated = updatePreferencesSchema.parse(req.body);
      const prefs = await storage.updatePreferences(req.params.id, validated);
      if (!prefs) {
        return res.status(404).json({ error: "Preferences not found" });
      }
      res.json(prefs);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid preference data" });
      }
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  // Free Books API - Search across all sources
  app.get("/api/books/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length < 2) {
        return res.json([]);
      }

      const [openLibrary, gutenberg, internetArchive] = await Promise.all([
        searchOpenLibrary(query),
        searchGutenberg(query),
        searchInternetArchive(query),
      ]);

      // Combine and sort results: prioritize exact title matches and Gutenberg (verified classics)
      const queryLower = query.toLowerCase().trim();
      const allResults = [...gutenberg, ...openLibrary, ...internetArchive]
        .sort((a, b) => {
          const aTitleLower = a.title.toLowerCase();
          const bTitleLower = b.title.toLowerCase();
          
          // Exact title match gets highest priority
          const aExact = aTitleLower === queryLower;
          const bExact = bTitleLower === queryLower;
          if (aExact && !bExact) return -1;
          if (bExact && !aExact) return 1;
          
          // Title starts with query gets second priority  
          const aStarts = aTitleLower.startsWith(queryLower);
          const bStarts = bTitleLower.startsWith(queryLower);
          if (aStarts && !bStarts) return -1;
          if (bStarts && !aStarts) return 1;
          
          // Gutenberg books (verified public domain classics) get priority
          if (a.source === 'gutenberg' && b.source !== 'gutenberg') return -1;
          if (b.source === 'gutenberg' && a.source !== 'gutenberg') return 1;
          
          return 0;
        });
      
      res.json(allResults);
    } catch (error) {
      console.error('Book search error:', error);
      res.status(500).json({ error: "Failed to search books" });
    }
  });

  // Get book details
  app.get("/api/books/details/:source/:id", async (req, res) => {
    try {
      const { source, id } = req.params;
      
      if (source === 'openlibrary') {
        const response = await fetch(`https://openlibrary.org/works/${id}.json`);
        const data = await response.json();
        res.json({
          id,
          title: data.title || 'Unknown Title',
          author: data.authors?.[0]?.author?.key || 'Unknown Author',
          publishDate: data.first_publish_date || 'Unknown',
          description: typeof data.description === 'string' ? data.description : data.description?.value || 'No description available.',
          source: 'openlibrary',
          coverId: data.covers?.[0]?.toString(),
        });
      } else if (source === 'gutenberg') {
        const response = await fetch(`https://gutendex.com/books/${id}`);
        const data = await response.json();
        res.json({
          id,
          title: data.title || 'Unknown Title',
          author: data.authors?.[0]?.name || 'Unknown Author',
          publishDate: data.authors?.[0]?.birth_year?.toString() || 'Classic',
          description: data.subjects?.join(', ') || 'A classic from Project Gutenberg.',
          source: 'gutenberg',
          coverId: data.formats?.['image/jpeg'],
        });
      } else if (source === 'internetarchive') {
        const response = await fetch(`https://archive.org/metadata/${id}`);
        const data = await response.json();
        const metadata = data.metadata || {};
        res.json({
          id,
          title: metadata.title || 'Unknown Title',
          author: Array.isArray(metadata.creator) ? metadata.creator[0] : (metadata.creator || 'Unknown Author'),
          publishDate: metadata.date || 'Unknown',
          description: Array.isArray(metadata.description) ? metadata.description.join(' ') : (metadata.description || 'No description available.'),
          source: 'internetarchive',
        });
      } else {
        res.status(400).json({ error: "Invalid source" });
      }
    } catch (error) {
      console.error('Book details error:', error);
      res.status(500).json({ error: "Failed to fetch book details" });
    }
  });

  // Fetch book content for import
  app.get("/api/books/content/:source/:id", async (req, res) => {
    try {
      const { source, id } = req.params;
      let content = '';
      let title = 'Unknown Title';
      let epubData: string | null = null;
      
      if (source === 'gutenberg') {
        const bookResponse = await fetch(`https://gutendex.com/books/${id}`);
        const bookData = await bookResponse.json();
        title = bookData.title || 'Unknown Title';
        
        // PRIORITY 1: Try EPUB3 format first (URL contains .epub3)
        // PRIORITY 2: Try regular EPUB format
        const epubUrl = bookData.formats?.['application/epub+zip'];
        let finalEpubUrl = epubUrl;
        
        // Check if EPUB3 version is available by constructing the URL
        if (epubUrl && epubUrl.includes('.epub.')) {
          const epub3Url = epubUrl.replace('.epub.', '.epub3.');
          try {
            const epub3Response = await fetch(epub3Url, { method: 'HEAD', redirect: 'follow' });
            console.log(`EPUB3 check for book ${id}: status=${epub3Response.status}, ok=${epub3Response.ok}`);
            if (epub3Response.ok) {
              finalEpubUrl = epub3Url;
              console.log(`Using EPUB3 format for book ${id}: ${epub3Url}`);
            }
          } catch (e) {
            console.log(`EPUB3 check failed for book ${id}:`, e);
            // EPUB3 not available, use regular EPUB
          }
        }
        console.log(`Final EPUB URL for book ${id}: ${finalEpubUrl}`);
        
        if (finalEpubUrl) {
          try {
            const epubResponse = await fetch(finalEpubUrl);
            if (epubResponse.ok) {
              const buffer = await epubResponse.arrayBuffer();
              epubData = Buffer.from(buffer).toString('base64');
            }
          } catch (e) {
            console.log('EPUB fetch failed, falling back to text');
          }
        }
        
        // PRIORITY 2: Fall back to plain text if no EPUB
        if (!epubData) {
          const textUrl = bookData.formats?.['text/plain; charset=utf-8'] 
            || bookData.formats?.['text/plain'];
          
          if (textUrl) {
            const textResponse = await fetch(textUrl);
            let rawContent = await textResponse.text();
            
            // Check if we accidentally got HTML instead of plain text
            if (rawContent.trim().startsWith('<!DOCTYPE') || rawContent.trim().startsWith('<html') || rawContent.trim().startsWith('<HTML')) {
              // Strip HTML tags
              rawContent = rawContent
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#\d+;/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            }
            content = rawContent;
          } else {
            // PRIORITY 3: Fall back to HTML format if no plain text available
            const htmlUrl = bookData.formats?.['text/html'];
            if (htmlUrl) {
              const htmlResponse = await fetch(htmlUrl);
              let htmlContent = await htmlResponse.text();
              // Extract body content and strip tags
              const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
              if (bodyMatch) {
                htmlContent = bodyMatch[1];
              }
              content = htmlContent
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#\d+;/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            }
          }
        }
      } else if (source === 'openlibrary') {
        const workResponse = await fetch(`https://openlibrary.org/works/${id}.json`);
        const workData = await workResponse.json();
        title = workData.title || 'Unknown Title';
        
        const iaId = req.query.iaId as string | undefined;
        let textContent = '';
        
        // Try using the direct Internet Archive ID from search results first
        const archiveIds: string[] = iaId ? [iaId] : [];
        
        // Also get editions with ocaid as fallback
        const editionsResponse = await fetch(`https://openlibrary.org/works/${id}/editions.json?limit=20`);
        const editionsData = await editionsResponse.json();
        const editionsWithOcaid = (editionsData.entries || []).filter((e: any) => e.ocaid);
        archiveIds.push(...editionsWithOcaid.map((e: any) => e.ocaid));
        
        // PRIORITY 1: Try EPUB format first
        for (const archiveId of archiveIds) {
          if (epubData) break;
          try {
            const metaResponse = await fetch(`https://archive.org/metadata/${archiveId}`);
            if (metaResponse.ok) {
              const metaData = await metaResponse.json();
              // PRIORITY 1: EPUB3 files (contain 'epub3' in filename)
              // PRIORITY 2: Regular EPUB files
              const epub3File = metaData.files?.find((f: any) => 
                f.name?.toLowerCase().includes('epub3') && f.name?.endsWith('.epub') && !f.name?.includes('_text')
              );
              const epubFile = epub3File || metaData.files?.find((f: any) => 
                f.name?.endsWith('.epub') && !f.name?.includes('_text')
              );
              
              if (epubFile) {
                const epubUrl = `https://archive.org/download/${archiveId}/${epubFile.name}`;
                const epubResponse = await fetch(epubUrl);
                if (epubResponse.ok) {
                  const buffer = await epubResponse.arrayBuffer();
                  epubData = Buffer.from(buffer).toString('base64');
                  if (epub3File) console.log(`Using EPUB3 format from Internet Archive: ${epub3File.name}`);
                  break;
                }
              }
            }
          } catch (e) {
            continue;
          }
        }
        
        // PRIORITY 2: Fall back to plain text if no EPUB
        if (!epubData) {
          for (const archiveId of archiveIds) {
            try {
              const metaResponse = await fetch(`https://archive.org/metadata/${archiveId}`);
              if (metaResponse.ok) {
                const metaData = await metaResponse.json();
                const textFile = metaData.files?.find((f: any) => 
                  f.name?.endsWith('_djvu.txt') || 
                  (f.name?.endsWith('.txt') && !f.name?.includes('_meta') && !f.name?.includes('_hocr'))
                );
                
                if (textFile) {
                  const textUrl = `https://archive.org/download/${archiveId}/${textFile.name}`;
                  const textResponse = await fetch(textUrl);
                  if (textResponse.ok) {
                    const rawText = await textResponse.text();
                    if (!rawText.trim().startsWith('<!DOCTYPE') && !rawText.trim().startsWith('<html')) {
                      textContent = rawText;
                      break;
                    }
                  }
                }
              }
            } catch (e) {
              continue;
            }
          }
        }
        
        if (!epubData && textContent) {
          content = textContent;
        } else if (!epubData) {
          return res.status(404).json({ 
            error: 'content_unavailable',
            title,
            message: `The full text of "${title}" is not available from Open Library.`,
            source: 'openlibrary'
          });
        }
      } else if (source === 'internetarchive') {
        const metaResponse = await fetch(`https://archive.org/metadata/${id}`);
        const metaData = await metaResponse.json();
        title = metaData.metadata?.title || 'Unknown Title';
        
        // PRIORITY 1: EPUB3 files (contain 'epub3' in filename)
        // PRIORITY 2: Regular EPUB files
        const epub3File = metaData.files?.find((f: any) => 
          f.name?.toLowerCase().includes('epub3') && f.name?.endsWith('.epub') && !f.name?.includes('_text')
        );
        const epubFile = epub3File || metaData.files?.find((f: any) => 
          f.name?.endsWith('.epub') && !f.name?.includes('_text')
        );
        
        if (epubFile) {
          try {
            const epubUrl = `https://archive.org/download/${id}/${epubFile.name}`;
            const epubResponse = await fetch(epubUrl);
            if (epubResponse.ok) {
              const buffer = await epubResponse.arrayBuffer();
              epubData = Buffer.from(buffer).toString('base64');
              if (epub3File) console.log(`Using EPUB3 format from Internet Archive: ${epub3File.name}`);
            }
          } catch (e) {
            console.log('EPUB fetch failed, falling back to text');
          }
        }
        
        // PRIORITY 2: Fall back to plain text if no EPUB
        if (!epubData) {
          const textFile = metaData.files?.find((f: any) => 
            f.name?.endsWith('_djvu.txt') || 
            (f.name?.endsWith('.txt') && !f.name?.includes('_meta'))
          );
          
          if (textFile) {
            const textUrl = `https://archive.org/download/${id}/${textFile.name}`;
            const textResponse = await fetch(textUrl);
            const rawText = await textResponse.text();
            
            if (!rawText.trim().startsWith('<!DOCTYPE') && !rawText.trim().startsWith('<html')) {
              const qualityCheck = isGarbageContent(rawText);
              if (qualityCheck.isGarbage) {
                console.log(`Content quality check failed for ${id}: ${qualityCheck.reason}`);
                return res.status(404).json({
                  error: 'content_unavailable',
                  title,
                  message: `The content from Internet Archive appears to be corrupted or not the actual book text. ${qualityCheck.reason}`,
                  source: 'internetarchive'
                });
              }
              content = rawText;
            } else {
              return res.status(404).json({
                error: 'content_unavailable',
                title,
                message: `The full text of "${title}" could not be extracted from Internet Archive.`,
                source: 'internetarchive'
              });
            }
          } else {
            return res.status(404).json({
              error: 'content_unavailable',
              title,
              message: `The full text of "${title}" is not available in a readable format from Internet Archive.`,
              source: 'internetarchive'
            });
          }
        }
      }
      
      // Return EPUB data if available, otherwise return text content
      if (epubData) {
        return res.json({ title, epubData, source, format: 'epub' });
      }
      
      if (!content) {
        return res.status(404).json({ 
          error: 'content_unavailable',
          title,
          message: `The full text of "${title}" could not be fetched.`,
          source
        });
      }
      
      res.json({ title, content, source, format: 'txt' });
    } catch (error) {
      console.error('Book content error:', error);
      res.status(500).json({ error: "Failed to fetch book content" });
    }
  });

  return httpServer;
}
