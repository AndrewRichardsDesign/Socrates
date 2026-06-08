interface ScoreInput {
  extractedChars: number;
  pageCount: number;
  joinedLineBreaks: number;
  headersRemoved: number;
  columnsDetectedPages: number;
  isScanned: boolean;
}

export function calculateQualityScore(input: ScoreInput): number {
  const {
    extractedChars,
    pageCount,
    joinedLineBreaks,
    headersRemoved,
    columnsDetectedPages,
    isScanned,
  } = input;

  if (isScanned) {
    return 0.1;
  }

  if (pageCount === 0) {
    return 0;
  }

  const charsPerPage = extractedChars / pageCount;
  const charScore = Math.min(charsPerPage / 2000, 1) * 0.4;

  const joinsPerPage = joinedLineBreaks / pageCount;
  const joinScore = Math.min(joinsPerPage / 20, 1) * 0.25;

  const headerScore = headersRemoved > 0 ? 0.1 : 0;

  const columnRatio = columnsDetectedPages / pageCount;
  const columnScore = columnRatio > 0.1 ? 0.1 : columnRatio;

  const baseScore = 0.15;

  const totalScore = baseScore + charScore + joinScore + headerScore + columnScore;

  return Math.min(Math.max(totalScore, 0), 1);
}
