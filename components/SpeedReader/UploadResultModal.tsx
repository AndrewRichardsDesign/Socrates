import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Upload, CheckCircle2, XCircle } from "lucide-react";

interface FileInfo {
  name: string;
  size: number;
  reason?: 'size' | 'parse';
}

interface UploadResultModalProps {
  acceptedFiles: FileInfo[];
  rejectedFiles: FileInfo[];
  onUploadMore: () => void;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getRejectionReason(file: FileInfo): string {
  if (file.reason === 'parse') return 'Failed to parse';
  if (file.size > 50 * 1024 * 1024) return 'Exceeds 50MB limit';
  return 'Exceeded batch limit';
}

export function UploadResultModal({ acceptedFiles, rejectedFiles, onUploadMore, onClose }: UploadResultModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
      onClick={onClose}
      role="presentation"
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
        aria-describedby="upload-modal-description"
        className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="upload-modal-title" className="text-lg font-semibold">Upload Results</h2>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
            data-testid="button-close-upload-modal"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div id="upload-modal-description" className="flex-1 overflow-y-auto p-4 space-y-4">
          {acceptedFiles.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h3 className="font-medium text-sm text-emerald-700">Accepted Files ({acceptedFiles.length})</h3>
              </div>
              <ul className="space-y-1 pl-6">
                {acceptedFiles.map((file, i) => (
                  <li key={i} className="text-sm flex items-center justify-between gap-2">
                    <span className="truncate">{file.name}</span>
                    <span className="text-muted-foreground text-xs shrink-0">{formatFileSize(file.size)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rejectedFiles.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <h3 className="font-medium text-sm text-destructive">Rejected Files ({rejectedFiles.length})</h3>
              </div>
              <ul className="space-y-1 pl-6">
                {rejectedFiles.map((file, i) => (
                  <li key={i} className="text-sm flex items-center justify-between gap-2 text-muted-foreground">
                    <span className="truncate">{file.name}</span>
                    <span className="text-xs shrink-0">{getRejectionReason(file)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <Button
            variant="outline"
            onClick={onUploadMore}
            className="gap-2"
            data-testid="button-upload-more"
          >
            <Upload className="h-4 w-4" />
            Upload more files
          </Button>
          <Button onClick={onClose} data-testid="button-done-upload">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
