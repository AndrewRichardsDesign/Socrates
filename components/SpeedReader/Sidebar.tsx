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

const fileTypeColors: Record<string, string> = {
  epub: 'bg-purple-100 text-purple-700',
  pdf: 'bg-red-100 text-red-700',
  docx: 'bg-blue-100 text-blue-700',
  doc: 'bg-blue-100 text-blue-700',
  txt: 'bg-gray-100 text-gray-600',
  md: 'bg-green-100 text-green-700',
  html: 'bg-orange-100 text-orange-700',
};

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
      <aside className="w-60 border-r border-sidebar-border bg-white flex flex-col h-full shrink-0 z-[70] md:z-20 md:relative fixed inset-y-0 left-0 shadow-xl md:shadow-none overflow-hidden" style={{ color: '#1f2937' }}>
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
      <aside className="w-[420px] max-w-[90vw] border-r border-sidebar-border bg-white flex flex-col h-full shrink-0 z-[70] md:z-20 md:relative fixed inset-y-0 left-0 shadow-xl md:shadow-none overflow-hidden" style={{ color: '#1f2937' }}>
        <PdfSmokeTest onClose={() => setShowSmokeTest(false)} />
      </aside>
    );
  }


  return (
    <aside className="w-60 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col h-full shrink-0 z-[70] md:z-20 md:relative fixed inset-y-0 left-0 shadow-xl md:shadow-none">
      <div className="px-3 py-3 border-b border-sidebar-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground">
            <BookOpen className="h-4 w-4" />
          </div>
          <span className="font-heading font-semibold text-sm tracking-tight text-sidebar-foreground">Aristotle</span>
        </div>
        <div className="flex items-center gap-1">
          {/* PDF Smoke Test button hidden - logic kept for system-level checks */}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={onClose}>
            <PanelLeftClose className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="p-3 space-y-2">
        {/* Upload Area */}
        <div 
          {...getRootProps()} 
          className={cn(
            "border border-dashed rounded-md p-3 text-center cursor-pointer transition-colors",
            isDragActive ? "border-sidebar-primary bg-sidebar-primary/10" : "border-sidebar-border hover:border-sidebar-foreground/30 hover:bg-sidebar-accent/50"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-1.5 text-sidebar-foreground/60">
            <Upload className="h-4 w-4" />
            <span className="text-[10px] font-medium leading-tight">Upload file (.pdf, .docx, .epub, .txt, .md, .html)</span>
          </div>
        </div>

        {/* Blank Document Button */}
        <Button 
          variant="outline" 
          className="w-full gap-2 h-8 text-xs font-medium bg-transparent border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" 
          onClick={onBlankDocument}
          data-testid="button-blank-document"
        >
          <Plus className="h-3.5 w-3.5" />
          Blank Document
        </Button>
        
        {/* Find Free Books Button */}
        <Button 
          variant="outline" 
          className="w-full gap-2 h-8 text-xs font-medium bg-transparent border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" 
          onClick={() => setShowFreeBooks(true)}
          data-testid="button-find-free-books"
        >
          <Library className="h-3.5 w-3.5" />
          Find Free Books
        </Button>

      </div>
      <div className="px-3 pb-1.5 pt-1">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-widest">Library</h3>
          <span className="text-[9px] text-sidebar-foreground/40">Local storage</span>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-1.5 space-y-0.5 pb-3">
          {documents.map((doc) => (
            <Button
              key={doc.id}
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2 font-normal h-auto py-2 px-2.5 rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                currentDocId === doc.id && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
              onClick={() => onSelect(doc.id)}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <div className="truncate text-left min-w-0 flex-1">
                <span className="block truncate text-xs">{doc.title}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {doc.fileType && (
                    <span className={cn(
                      "text-[9px] font-medium px-1 py-0.5 rounded uppercase",
                      fileTypeColors[doc.fileType] || 'bg-gray-100 text-gray-600'
                    )}>
                      {doc.fileType}
                    </span>
                  )}
                  <span className="text-[10px] opacity-50 font-mono">{doc.words.length} words</span>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </ScrollArea>
      {/* Generator Button - Sticky at bottom */}
      <div className="sticky bottom-0 p-3 border-t border-sidebar-border bg-sidebar">
        <ContentGenerator onGenerate={onGenerate} />
      </div>
    </aside>
  );
}
