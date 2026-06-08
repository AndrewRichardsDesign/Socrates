import type { PositionedItem, Line } from './types';

export const LINES_CONFIG = {
  SCALE: 1.5,
  Y_TOLERANCE: 4.5,
  SPACE_THRESHOLD_MULTIPLIER: 0.6,
};

const SCALE = LINES_CONFIG.SCALE;
const Y_TOLERANCE = LINES_CONFIG.Y_TOLERANCE;
const SPACE_THRESHOLD_MULTIPLIER = LINES_CONFIG.SPACE_THRESHOLD_MULTIPLIER;

export function buildLines(items: PositionedItem[], pageNumber: number): Line[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lineGroups: PositionedItem[][] = [];
  let currentGroup: PositionedItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) <= Y_TOLERANCE) {
      currentGroup.push(item);
    } else {
      lineGroups.push(currentGroup);
      currentGroup = [item];
      currentY = item.y;
    }
  }
  lineGroups.push(currentGroup);

  const lines: Line[] = [];

  for (const group of lineGroups) {
    const sortedByX = [...group].sort((a, b) => a.x - b.x);
    
    let lineText = '';
    const avgCharWidth = calculateAvgCharWidth(sortedByX);
    const spaceThreshold = avgCharWidth * SPACE_THRESHOLD_MULTIPLIER;

    for (let i = 0; i < sortedByX.length; i++) {
      const item = sortedByX[i];
      
      if (i > 0) {
        const prevItem = sortedByX[i - 1];
        const gap = item.x - (prevItem.x + prevItem.width);
        
        if (gap > spaceThreshold && !lineText.endsWith(' ')) {
          lineText += ' ';
        }
      }
      
      lineText += item.text;
    }

    const x0 = Math.min(...sortedByX.map(i => i.x));
    const x1 = Math.max(...sortedByX.map(i => i.x + i.width));
    const avgY = sortedByX.reduce((sum, i) => sum + i.y, 0) / sortedByX.length;

    lines.push({
      page: pageNumber,
      y: avgY,
      x0,
      x1,
      text: lineText.trim(),
    });
  }

  return lines.sort((a, b) => a.y - b.y);
}

function calculateAvgCharWidth(items: PositionedItem[]): number {
  const charWidths: number[] = [];

  for (const item of items) {
    const chars = Math.max(item.text.length, 1);
    charWidths.push(item.width / chars);
  }

  if (charWidths.length === 0) return 8;

  charWidths.sort((a, b) => a - b);
  const mid = Math.floor(charWidths.length / 2);
  return charWidths.length % 2 !== 0 
    ? charWidths[mid] 
    : (charWidths[mid - 1] + charWidths[mid]) / 2;
}

export function buildAllLines(itemsPerPage: PositionedItem[][]): Line[][] {
  return itemsPerPage.map((items, idx) => buildLines(items, idx + 1));
}
