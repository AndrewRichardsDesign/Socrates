import type { Line } from './types';

export const COLUMNS_CONFIG = {
  COLUMN_SEPARATION_THRESHOLD: 0.18,
  MIN_LINES_FOR_COLUMNS: 20,
  MIN_COLUMN_BALANCE: 0.25,
};

const COLUMN_SEPARATION_THRESHOLD = COLUMNS_CONFIG.COLUMN_SEPARATION_THRESHOLD;
const MIN_LINES_FOR_COLUMNS = COLUMNS_CONFIG.MIN_LINES_FOR_COLUMNS;
const MIN_COLUMN_BALANCE = COLUMNS_CONFIG.MIN_COLUMN_BALANCE;

interface Cluster {
  center: number;
  lines: Line[];
}

export function detectAndReorderColumns(
  lines: Line[],
  pageWidth: number
): { reordered: Line[]; isMultiColumn: boolean } {
  if (lines.length < MIN_LINES_FOR_COLUMNS) {
    return { reordered: lines, isMultiColumn: false };
  }

  const xCenters = lines.map(line => (line.x0 + line.x1) / 2);
  
  const clusters = kMeansClustering(xCenters, lines, 2);
  
  if (clusters.length !== 2) {
    return { reordered: lines, isMultiColumn: false };
  }

  const [left, right] = clusters[0].center < clusters[1].center 
    ? [clusters[0], clusters[1]] 
    : [clusters[1], clusters[0]];

  const separation = Math.abs(right.center - left.center) / pageWidth;

  if (separation < COLUMN_SEPARATION_THRESHOLD) {
    return { reordered: lines, isMultiColumn: false };
  }

  const minClusterSize = lines.length * MIN_COLUMN_BALANCE;
  if (left.lines.length < minClusterSize || right.lines.length < minClusterSize) {
    return { reordered: lines, isMultiColumn: false };
  }

  const leftSorted = [...left.lines].sort((a, b) => a.y - b.y);
  const rightSorted = [...right.lines].sort((a, b) => a.y - b.y);

  return {
    reordered: [...leftSorted, ...rightSorted],
    isMultiColumn: true,
  };
}

function kMeansClustering(xCenters: number[], lines: Line[], k: number): Cluster[] {
  if (xCenters.length < k) return [];

  const sorted = [...xCenters].sort((a, b) => a - b);
  let centers = [sorted[0], sorted[sorted.length - 1]];

  for (let iteration = 0; iteration < 10; iteration++) {
    const clusters: Cluster[] = centers.map(c => ({ center: c, lines: [] }));

    for (let i = 0; i < xCenters.length; i++) {
      const x = xCenters[i];
      const line = lines[i];
      
      let minDist = Infinity;
      let closestIdx = 0;
      
      for (let j = 0; j < centers.length; j++) {
        const dist = Math.abs(x - centers[j]);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = j;
        }
      }
      
      clusters[closestIdx].lines.push(line);
    }

    const newCenters = clusters.map(cluster => {
      if (cluster.lines.length === 0) return cluster.center;
      const sum = cluster.lines.reduce((acc, line) => acc + (line.x0 + line.x1) / 2, 0);
      return sum / cluster.lines.length;
    });

    const converged = centers.every((c, i) => Math.abs(c - newCenters[i]) < 1);
    centers = newCenters;

    if (converged) break;
  }

  return centers.map((center, i) => {
    const cluster: Cluster = { center, lines: [] };
    for (let j = 0; j < xCenters.length; j++) {
      const x = xCenters[j];
      let minDist = Infinity;
      let closestIdx = 0;
      
      for (let c = 0; c < centers.length; c++) {
        const dist = Math.abs(x - centers[c]);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = c;
        }
      }
      
      if (closestIdx === i) {
        cluster.lines.push(lines[j]);
      }
    }
    return cluster;
  });
}

export function processAllPagesColumns(
  linesPerPage: Line[][],
  pageWidths: number[]
): { processed: Line[][]; columnsDetectedPages: number } {
  let columnsDetectedPages = 0;
  const processed: Line[][] = [];

  for (let i = 0; i < linesPerPage.length; i++) {
    const pageWidth = pageWidths[i] || 600;
    const { reordered, isMultiColumn } = detectAndReorderColumns(linesPerPage[i], pageWidth);
    
    if (isMultiColumn) {
      columnsDetectedPages++;
    }
    
    processed.push(reordered);
  }

  return { processed, columnsDetectedPages };
}
