import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Upload, Download, Copy, AlertTriangle, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { cleanPdf } from '@/lib/pdf/cleanPdf';
import type { CleanedDocument, ProgressState } from '@/lib/pdf/types';

interface PdfImportCardProps {
  onImport?: (title: string, content: string, fileType: string) => void;
  onClose?: () => void;
}

export function PdfImportCard({ onImport, onClose }: PdfImportCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<ProgressState>({
    stage: 'idle',
    currentPage: 0,
    totalPages: 0,
    percent: 0,
  });
  const [copied, setCopied] = useState(false);

  const cleanupMutation = useMutation({
    mutationFn: async (pdfFile: File) => {
      return cleanPdf(pdfFile, {
        maxPages: 75,
        onProgress: setProgress,
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFile = acceptedFiles.find(f => f.type === 'application/pdf');
    if (pdfFile) {
      setFile(pdfFile);
      cleanupMutation.reset();
    }
  }, [cleanupMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  const handleExtract = () => {
    if (file) {
      cleanupMutation.mutate(file);
    }
  };

  const handleCopyText = async () => {
    if (cleanupMutation.data?.text) {
      await navigator.clipboard.writeText(cleanupMutation.data.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadTxt = () => {
    if (cleanupMutation.data?.text) {
      const blob = new Blob([cleanupMutation.data.text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file?.name.replace('.pdf', '') || 'document'}_cleaned.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadJson = () => {
    if (cleanupMutation.data) {
      const blob = new Blob([JSON.stringify(cleanupMutation.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file?.name.replace('.pdf', '') || 'document'}_model.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImportToLibrary = () => {
    if (cleanupMutation.data && file && onImport) {
      const title = file.name.replace('.pdf', '');
      onImport(title, cleanupMutation.data.text, 'pdf');
    }
  };

  const result = cleanupMutation.data;
  const isProcessing = cleanupMutation.isPending;
  const hasResult = !!result;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          PDF Cleanup Engine
        </CardTitle>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
            isProcessing && "pointer-events-none opacity-50"
          )}
        >
          <input {...getInputProps()} data-testid="input-pdf-upload" />
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          {file ? (
            <p className="text-sm font-medium">{file.name}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Drag & drop a PDF, or click to select
            </p>
          )}
        </div>

        <Button
          className="w-full"
          onClick={handleExtract}
          disabled={!file || isProcessing}
          data-testid="button-extract-clean"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            'Extract & Clean'
          )}
        </Button>

        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <div className="flex justify-between text-sm text-muted-foreground">
                <span className="capitalize">{progress.stage}</span>
                <span>{progress.currentPage} / {progress.totalPages} pages</span>
              </div>
              <Progress value={progress.percent} className="h-2" />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {hasResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex flex-wrap gap-2">
                <Badge variant={result.isScanned ? "destructive" : "secondary"}>
                  {result.isScanned ? 'Scanned' : 'Digital'}
                </Badge>
                <Badge variant="outline">{result.pageCount} pages</Badge>
                <Badge variant="outline">
                  Quality: {Math.round(result.qualityScore * 100)}%
                </Badge>
                <Badge variant="outline">
                  {result.meta.extractedChars.toLocaleString()} chars
                </Badge>
              </div>

              {result.warnings.length > 0 && (
                <div className="space-y-2">
                  {result.warnings.map((warning, i) => (
                    <Alert key={i} variant="destructive" className="py-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">{warning}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
                  <TabsTrigger value="json" className="flex-1">JSON</TabsTrigger>
                  <TabsTrigger value="meta" className="flex-1">Meta</TabsTrigger>
                </TabsList>
                <TabsContent value="preview">
                  <ScrollArea className="h-64 border rounded-md p-3">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {result.pages.slice(0, 3).map(p => p.text).join('\n\n---\n\n')}
                      {result.pages.length > 3 && '\n\n... (more pages)'}
                    </pre>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="json">
                  <ScrollArea className="h-64 border rounded-md p-3">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="meta">
                  <div className="border rounded-md p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Extracted Characters</span>
                      <span>{result.meta.extractedChars.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Joined Line Breaks</span>
                      <span>{result.meta.joinedLineBreaks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Headers Removed</span>
                      <span>{result.meta.headersRemoved}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Multi-Column Pages</span>
                      <span>{result.meta.columnsDetectedPages}</span>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyText} data-testid="button-copy-text">
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? 'Copied!' : 'Copy Text'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadTxt} data-testid="button-download-txt">
                  <Download className="h-4 w-4 mr-1" />
                  Download .txt
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadJson} data-testid="button-download-json">
                  <Download className="h-4 w-4 mr-1" />
                  Download JSON
                </Button>
                {onImport && (
                  <Button size="sm" onClick={handleImportToLibrary} data-testid="button-import-to-library">
                    <FileText className="h-4 w-4 mr-1" />
                    Import to Library
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
