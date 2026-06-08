import React from "react";

export function getBionicBoldCount(word: string): number {
  const letters = word.replace(/[^a-zA-Z]/g, "");
  const n = letters.length;
  
  if (n === 0) return 0;
  
  let boldCount = Math.ceil(n * 0.4);
  boldCount = Math.max(1, Math.min(6, boldCount));
  
  return boldCount;
}

export function renderBionicWord(word: string): React.ReactNode {
  if (!word) return null;
  
  const letters = word.replace(/[^a-zA-Z]/g, "");
  const n = letters.length;
  
  if (n === 0) return word;
  
  let boldCount = Math.ceil(n * 0.4);
  boldCount = Math.max(1, Math.min(6, boldCount));
  
  let letterIndex = 0;
  let boldedLetters = 0;
  const result: React.ReactNode[] = [];
  let currentBoldChars = "";
  let currentNormalChars = "";
  
  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    const isLetter = /[a-zA-Z]/.test(char);
    
    if (isLetter) {
      if (boldedLetters < boldCount) {
        if (currentNormalChars) {
          result.push(currentNormalChars);
          currentNormalChars = "";
        }
        currentBoldChars += char;
        boldedLetters++;
      } else {
        if (currentBoldChars) {
          result.push(<b key={`b-${i}`}>{currentBoldChars}</b>);
          currentBoldChars = "";
        }
        currentNormalChars += char;
      }
      letterIndex++;
    } else {
      if (boldedLetters < boldCount) {
        currentBoldChars += char;
      } else {
        if (currentBoldChars) {
          result.push(<b key={`b-${i}`}>{currentBoldChars}</b>);
          currentBoldChars = "";
        }
        currentNormalChars += char;
      }
    }
  }
  
  if (currentBoldChars) {
    result.push(<b key="b-end">{currentBoldChars}</b>);
  }
  if (currentNormalChars) {
    result.push(currentNormalChars);
  }
  
  return <>{result}</>;
}
