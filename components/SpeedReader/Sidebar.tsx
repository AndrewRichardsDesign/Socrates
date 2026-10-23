import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FileText, Plus, Upload, BookOpen, PanelLeftClose, Library, FlaskConical } from "lucide-react";
import { useDropzone } from "react-dropzone";
import type { Document } from "@/pages/Home";
import { ContentGenerator } from "./ContentGenerator";
import { FreeBooks } from "./FreeBooks";
import { PdfSmokeTest } from "./PdfSmokeTest";

interface SidebarProps {
  documents: (Document & { fileType?: string })[];
  currentDocId: string;
  onSelect: (id: string) => void;
  onUpload: (files: File[]) => void;
  onGenerate: (title: string, content: string) => void;
  onBlankDocument: () => void;
  onClose: () => void;
  onAddFreeBook: (title: string, content: string, fileType?: string) => void;
}

// Format is secondary information, so it is set in one muted monochrome
// treatment rather than a different colour per extension.
const FILE_TYPE_CHIP =
  'border border-border/70 bg-background/60 text-muted-foreground/90';

export function Sidebar({ documents, currentDocId, onSelect, onUpload, onGenerate, onBlankDocument, onClose, onAddFreeBook }: SidebarProps) {
  const [showFreeBooks, setShowFreeBooks] = useState(false);
  const [showSmokeTest, setShowSmokeTest] = useState(false);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onUpload(acceptedFiles);
      }
    },
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'text/html': ['.html', '.htm'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/epub+zip': ['.epub'],
    },
    maxFiles: 10
  });

  if (showFreeBooks) {
    return (
      <aside className="w-[244px] border-r border-sidebar-border/80 bg-sidebar text-foreground flex flex-col h-full shrink-0 z-[70] md:z-20 md:relative fixed inset-y-0 left-0 shadow-xl md:shadow-none overflow-hidden">
        <FreeBooks 
          onAddBook={(title, content, fileType) => {
            onAddFreeBook(title, content, fileType);
            setShowFreeBooks(false);
          }} 
          onClose={() => setShowFreeBooks(false)} 
        />
      </aside>
    );
  }

  if (showSmokeTest) {
    return (
      <aside className="w-[420px] max-w-[90vw] border-r border-sidebar-border/80 bg-sidebar text-foreground flex flex-col h-full shrink-0 z-[70] md:z-20 md:relative fixed inset-y-0 left-0 shadow-xl md:shadow-none overflow-hidden">
        <PdfSmokeTest onClose={() => setShowSmokeTest(false)} />
      </aside>
    );
  }


  return (
    <aside className="w-[244px] border-r border-sidebar-border/80 bg-sidebar text-sidebar-foreground flex flex-col h-full shrink-0 z-[70] md:z-20 md:relative fixed inset-y-0 left-0 shadow-xl md:shadow-none">
      <div className="h-12 px-3 border-b border-sidebar-border/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-[26px] w-[26px] rounded-[7px] bg-primary flex items-center justify-center text-primary-foreground shadow-[0_1px_2px_0_hsl(28_20%_12%/0.16)]">
            <BookOpen className="h-[15px] w-[15px]" strokeWidth={2} />
          </div>
          <span className="font-wordmark font-semibold text-[15px] tracking-[-0.02em] text-foreground">
            Aristotle
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* PDF Smoke Test button hidden - logic kept for system-level checks */}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={onClose}>
            <PanelLeftClose className="h-[15px] w-[15px]" strokeWidth={2} />
          </Button>
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        {/* Upload Area */}
        <div 
          {...getRootProps()} 
          className={cn(
            "group rounded-lg border border-dashed px-3 py-4 text-center cursor-pointer transition-colors duration-150",
            isDragActive
              ? "border-highlight/70 bg-highlight-subtle"
              : "border-border bg-card/50 hover:border-border hover:bg-card"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-1.5">
            <Upload
              className={cn(
                "h-[15px] w-[15px] transition-colors",
                isDragActive ? "text-highlight" : "text-muted-foreground/70"
              )}
              strokeWidth={2}
            />
            <span className="text-[12px] font-medium leading-none text-foreground/80">
              {isDragActive ? "Drop to add" : "Add a document"}
            </span>
            <span className="text-[10.5px] leading-none text-muted-foreground/70">
              PDF, DOCX, EPUB, TXT, MD, HTML
            </span>
          </div>
        </div>

        {/* Blank Document Button */}
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 h-8 text-[12.5px] font-medium" 
          onClick={onBlankDocument}
          data-testid="button-blank-document"
        >
          <Plus className="h-[14px] w-[14px]" strokeWidth={2} />
          Blank Document
        </Button>
        
        {/* Find Free Books Button */}
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 h-8 text-[12.5px] font-medium" 
          onClick={() => setShowFreeBooks(true)}
          data-testid="button-find-free-books"
        >
          <Library className="h-[14px] w-[14px]" strokeWidth={2} />
          Find Free Books
        </Button>

      </div>
      <div className="px-3 pb-2 pt-2.5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[11px] font-medium text-muted-foreground/90 tracking-[0.01em]">Library</h3>
          <span className="text-[10.5px] text-muted-foreground/60 tabular-nums">
            {documents.length} {documents.length === 1 ? "document" : "documents"}
          </span>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-1.5 space-y-0.5 pb-3">
          {documents.map((doc) => (
            <Button
              key={doc.id}
              variant="ghost"
              className={cn(
                "group relative w-full justify-start gap-2.5 font-normal h-auto py-2 pl-3 pr-2.5 rounded-lg",
                "text-foreground/75 hover:bg-card hover:text-foreground",
                currentDocId === doc.id &&
                  "bg-card text-foreground shadow-[0_1px_2px_0_hsl(28_20%_12%/0.05)]"
              )}
              onClick={() => onSelect(doc.id)}
            >
              {currentDocId === doc.id && (
                <span className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full bg-highlight" />
              )}
              <FileText
                className={cn(
                  "h-[14px] w-[14px] shrink-0",
                  currentDocId === doc.id ? "text-highlight" : "text-muted-foreground/50"
                )}
                strokeWidth={2}
              />
              <div className="truncate text-left min-w-0 flex-1">
                <span className={cn(
                  "block truncate text-[12.5px] leading-tight",
                  currentDocId === doc.id ? "font-medium" : "font-normal"
                )}>
                  {doc.title}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  {doc.fileType && (
                    <span className={cn(
                      "text-[9px] font-medium px-1.5 py-[1px] rounded uppercase tracking-[0.04em]",
                      FILE_TYPE_CHIP
                    )}>
                      {doc.fileType}
                    </span>
                  )}
                  <span className="text-[10.5px] text-muted-foreground/70 tabular-nums">
                    {doc.words.length.toLocaleString()} words
                  </span>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </ScrollArea>
      {/* Generator Button - Sticky at bottom */}
      <div className="sticky bottom-0 p-3 border-t border-sidebar-border/80 bg-sidebar">
        <ContentGenerator onGenerate={onGenerate} />
      </div>
    </aside>
  );
}
