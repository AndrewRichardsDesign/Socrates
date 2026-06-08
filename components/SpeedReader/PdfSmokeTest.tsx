import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Upload, FileText, Loader2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";

import { configurePdfWorker, pdfjsLib } from "@/lib/pdf/pdfjsWorker";
import { extractAllPages, detectScanned } from "@/lib/pdf/extract";
import { buildAllLines, LINES_CONFIG } from "@/lib/pdf/lines";
import { processAllPagesColumns, detectAndReorderColumns, COLUMNS_CONFIG } from "@/lib/pdf/columns";
import { removeHeadersFooters, HEADERS_FOOTERS_CONFIG } from "@/lib/pdf/headersFooters";

interface PageStats {
  page: number;
  rawItems: number;
  nonWsChars: number;
  linesBuilt: number;
  medianLineGap: number | null;
  columnsDetected: boolean;
  leftLines: number;
  rightLines: number;
  headersRemoved: number;
}

interface SmokeTestProps {
  onClose: () => void;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function PdfSmokeTest({ onClose }: SmokeTestProps) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ page: number; total: number; stage: string } | null>(null);
  const [stats, setStats] = useState<PageStats[]>([]);
  const [summary, setSummary] = useState<{
    isScanned: boolean;
    avgChars: number;
    totalPages: number;
    twoColPages: number;
    headersRemoved: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      if (files.length > 0) {
        setFile(files[0]);
        setStats([]);
        setSummary(null);
        setError(null);
      }
    },
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });


  async function runAnalysis() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setStats([]);
    setSummary(null);

    try {
      configurePdfWorker();
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = Math.min(pdf.numPages, 75);

      setProgress({ page: 0, total: totalPages, stage: "Extracting text items..." });

      const { items: itemsPerPage, pageHeights } = await extractAllPages(
        pdf,
        (current, total) => {
          setProgress({ page: current, total, stage: "Extracting text items..." });
        },
        75
      );

      const pageWidths: number[] = [];
      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        pageWidths.push(viewport.width);
      }

      setProgress({ page: totalPages, total: totalPages, stage: "Building lines..." });
      await new Promise(r => setTimeout(r, 0));

      const isScanned = detectScanned(itemsPerPage);
      let linesPerPage = buildAllLines(itemsPerPage);

      setProgress({ page: totalPages, total: totalPages, stage: "Detecting columns..." });
      await new Promise(r => setTimeout(r, 0));

      const { processed: columnProcessed, columnsDetectedPages } = processAllPagesColumns(
        linesPerPage,
        pageWidths
      );
      linesPerPage = columnProcessed;

      setProgress({ page: totalPages, total: totalPages, stage: "Removing headers/footers..." });
      await new Promise(r => setTimeout(r, 0));

      const { cleaned: headerCleaned, removedCount } = removeHeadersFooters(linesPerPage, pageHeights);

      const perPageStats: PageStats[] = [];

      for (let i = 0; i < totalPages; i++) {
        const pageItems = itemsPerPage[i] || [];
        const beforeCleanup = linesPerPage[i] || [];
        const afterCleanup = headerCleaned[i] || [];
        const pageWidth = pageWidths[i] || 600;

        const nonWsChars = pageItems
          .map(it => it.text.replace(/\s+/g, ""))
          .join("").length;

        const sortedByY = [...afterCleanup].sort((a, b) => a.y - b.y);
        const gaps: number[] = [];
        for (let j = 1; j < sortedByY.length; j++) {
          gaps.push(sortedByY[j].y - sortedByY[j - 1].y);
        }
        const medianGap = median(gaps);

        const isMultiColumn = detectAndReorderColumns(beforeCleanup, pageWidth).isMultiColumn;
        
        let leftLines = 0;
        let rightLines = 0;
        if (isMultiColumn) {
          const xCenters = beforeCleanup.map(l => (l.x0 + l.x1) / 2);
          const medianX = median(xCenters) || pageWidth / 2;
          leftLines = beforeCleanup.filter(l => (l.x0 + l.x1) / 2 <= medianX).length;
          rightLines = beforeCleanup.length - leftLines;
        }

        perPageStats.push({
          page: i + 1,
          rawItems: pageItems.length,
          nonWsChars,
          linesBuilt: afterCleanup.length,
          medianLineGap: medianGap,
          columnsDetected: isMultiColumn,
          leftLines,
          rightLines,
          headersRemoved: beforeCleanup.length - afterCleanup.length,
        });
      }

      setStats(perPageStats);

      const avgChars = perPageStats.reduce((a, s) => a + s.nonWsChars, 0) / Math.max(perPageStats.length, 1);
      setSummary({
        isScanned,
        avgChars,
        totalPages,
        twoColPages: columnsDetectedPages,
        headersRemoved: removedCount,
      });

      setProgress(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">PDF Smoke Test</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{file.name}</span>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Drop a PDF here or click to select</p>
            )}
          </div>

          <Button
            onClick={runAnalysis}
            disabled={!file || busy}
            className="w-full"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Run Analysis"
            )}
          </Button>

          {progress && (
            <div className="text-sm bg-blue-50 p-3 rounded-md">
              <div className="font-medium text-blue-900">
                Page {progress.page} / {progress.total}
              </div>
              <div className="text-blue-700">{progress.stage}</div>
            </div>
          )}

          {error && (
            <div className="text-sm bg-red-50 text-red-700 p-3 rounded-md">
              Error: {error}
            </div>
          )}

          <div className="bg-gray-50 p-3 rounded-md space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase">Current Thresholds (from modules)</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Y Tolerance:</span>{" "}
                <span className="font-mono">{LINES_CONFIG.Y_TOLERANCE}</span>
              </div>
              <div>
                <span className="text-gray-500">Space Mult:</span>{" "}
                <span className="font-mono">{LINES_CONFIG.SPACE_THRESHOLD_MULTIPLIER}</span>
              </div>
              <div>
                <span className="text-gray-500">Col Separation:</span>{" "}
                <span className="font-mono">{COLUMNS_CONFIG.COLUMN_SEPARATION_THRESHOLD}</span>
              </div>
              <div>
                <span className="text-gray-500">Min Col Lines:</span>{" "}
                <span className="font-mono">{COLUMNS_CONFIG.MIN_LINES_FOR_COLUMNS}</span>
              </div>
              <div>
                <span className="text-gray-500">Col Balance:</span>{" "}
                <span className="font-mono">{COLUMNS_CONFIG.MIN_COLUMN_BALANCE}</span>
              </div>
              <div>
                <span className="text-gray-500">Header Rep:</span>{" "}
                <span className="font-mono">{HEADERS_FOOTERS_CONFIG.REPETITION_THRESHOLD}</span>
              </div>
            </div>
          </div>

          {summary && (
            <div className="bg-green-50 p-3 rounded-md space-y-1">
              <h3 className="text-xs font-semibold text-green-800 uppercase">Summary</h3>
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-green-700">Avg chars/page:</span>{" "}
                  <span className="font-medium">{summary.avgChars.toFixed(0)}</span>
                </div>
                <div>
                  <span className="text-green-700">Likely scanned:</span>{" "}
                  <span className={cn("font-medium", summary.isScanned ? "text-orange-600" : "text-green-600")}>
                    {summary.isScanned ? "YES (OCR needed)" : "No"}
                  </span>
                </div>
                <div>
                  <span className="text-green-700">Two-column pages:</span>{" "}
                  <span className="font-medium">{summary.twoColPages} / {summary.totalPages}</span>
                </div>
                <div>
                  <span className="text-green-700">Headers/footers removed:</span>{" "}
                  <span className="font-medium">{summary.headersRemoved}</span>
                </div>
              </div>
            </div>
          )}

          {stats.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left p-2 font-medium">Page</th>
                      <th className="text-left p-2 font-medium">Items</th>
                      <th className="text-left p-2 font-medium">Chars</th>
                      <th className="text-left p-2 font-medium">Lines</th>
                      <th className="text-left p-2 font-medium">Gap</th>
                      <th className="text-left p-2 font-medium">Cols</th>
                      <th className="text-left p-2 font-medium">L/R</th>
                      <th className="text-left p-2 font-medium">Hdr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((s) => (
                      <tr key={s.page} className="border-t border-gray-100">
                        <td className="p-2">{s.page}</td>
                        <td className="p-2">{s.rawItems}</td>
                        <td className="p-2">{s.nonWsChars}</td>
                        <td className="p-2">{s.linesBuilt}</td>
                        <td className="p-2 font-mono">
                          {s.medianLineGap != null ? s.medianLineGap.toFixed(1) : "—"}
                        </td>
                        <td className="p-2">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-medium",
                            s.columnsDetected ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                          )}>
                            {s.columnsDetected ? "2-col" : "1-col"}
                          </span>
                        </td>
                        <td className="p-2 font-mono">
                          {s.columnsDetected ? `${s.leftLines}/${s.rightLines}` : "—"}
                        </td>
                        <td className="p-2">
                          {s.headersRemoved > 0 ? (
                            <span className="text-orange-600">-{s.headersRemoved}</span>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-md">
            <strong>Tuning tips:</strong>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li>If pages are falsely marked "2-col", increase COLUMN_SEPARATION_THRESHOLD to 0.20+</li>
              <li>If 2-col PDFs show as "1-col", lower separation to 0.15 or reduce MIN_LINES_FOR_COLUMNS</li>
              <li>Large median gaps ({">"} 20) may indicate paragraph breaks are being split as lines</li>
              <li>Low chars/page ({"<"} 100) suggests scanned PDF or extraction issues</li>
            </ul>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
