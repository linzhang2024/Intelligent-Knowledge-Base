export interface SanitizeResult {
  text: string;
  hadInvalidSurrogates: boolean;
  invalidPositions: number[];
  replacementCharCount: number;
  invalidSurrogateCount: number;
}

const REPLACEMENT_CHAR = "\uFFFD";
const REPLACEMENT_CHAR_CODE = 0xFFFD;

function isHighSurrogate(charCode: number): boolean {
  return charCode >= 0xd800 && charCode <= 0xdbff;
}

function isLowSurrogate(charCode: number): boolean {
  return charCode >= 0xdc00 && charCode <= 0xdfff;
}

function isControlCharacter(charCode: number): boolean {
  return (
    (charCode >= 0x0000 && charCode <= 0x0008) ||
    (charCode >= 0x000b && charCode <= 0x000c) ||
    (charCode >= 0x000e && charCode <= 0x001f) ||
    charCode === 0x007f
  );
}

export function sanitizeText(text: string): SanitizeResult {
  if (!text || typeof text !== "string") {
    return { 
      text: "", 
      hadInvalidSurrogates: false, 
      invalidPositions: [],
      replacementCharCount: 0,
      invalidSurrogateCount: 0
    };
  }

  const invalidPositions: number[] = [];
  let hadInvalidSurrogates = false;
  let replacementCharCount = 0;
  let invalidSurrogateCount = 0;
  const result: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);

    if (charCode === REPLACEMENT_CHAR_CODE) {
      replacementCharCount++;
      result.push(REPLACEMENT_CHAR);
      continue;
    }

    if (isHighSurrogate(charCode)) {
      if (i + 1 < text.length) {
        const nextCharCode = text.charCodeAt(i + 1);
        if (isLowSurrogate(nextCharCode)) {
          result.push(text[i] + text[i + 1]);
          i++;
          continue;
        }
      }
      hadInvalidSurrogates = true;
      invalidSurrogateCount++;
      invalidPositions.push(i);
      result.push(REPLACEMENT_CHAR);
      continue;
    }

    if (isLowSurrogate(charCode)) {
      hadInvalidSurrogates = true;
      invalidSurrogateCount++;
      invalidPositions.push(i);
      result.push(REPLACEMENT_CHAR);
      continue;
    }

    if (isControlCharacter(charCode)) {
      continue;
    }

    result.push(text[i]);
  }

  return {
    text: result.join(""),
    hadInvalidSurrogates,
    invalidPositions,
    replacementCharCount,
    invalidSurrogateCount,
  };
}

export function hasEncodingIssues(result: SanitizeResult, textLength: number): boolean {
  if (textLength === 0) return false;
  
  const totalIssues = result.replacementCharCount + result.invalidSurrogateCount;
  const ratio = totalIssues / textLength;
  
  return ratio > 0.01;
}

export function getEncodingIssueRatio(result: SanitizeResult, textLength: number): number {
  if (textLength === 0) return 0;
  
  const totalIssues = result.replacementCharCount + result.invalidSurrogateCount;
  return totalIssues / textLength;
}

export function splitLargeChunk(
  chunk: string,
  maxSize: number = 1000,
  overlap: number = 50
): string[] {
  if (!chunk || chunk.length <= maxSize) {
    return [chunk];
  }

  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < chunk.length) {
    const endIndex = Math.min(currentIndex + maxSize, chunk.length);
    let actualEndIndex = endIndex;

    if (endIndex < chunk.length) {
      const breakPoints = [
        chunk.lastIndexOf("\n", endIndex),
        chunk.lastIndexOf(";", endIndex),
        chunk.lastIndexOf("。", endIndex),
        chunk.lastIndexOf("！", endIndex),
        chunk.lastIndexOf("？", endIndex),
        chunk.lastIndexOf("!", endIndex),
        chunk.lastIndexOf("?", endIndex),
        chunk.lastIndexOf(".", endIndex),
      ];

      const validBreakPoint = breakPoints.find(
        (pos) => pos > currentIndex && pos < endIndex
      );

      if (validBreakPoint !== undefined) {
        actualEndIndex = validBreakPoint + 1;
      }
    }

    const currentChunk = chunk.slice(currentIndex, actualEndIndex).trim();
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    if (actualEndIndex >= chunk.length) {
      break;
    }

    if (overlap > 0 && actualEndIndex > overlap) {
      currentIndex = actualEndIndex - overlap;
    } else {
      currentIndex = actualEndIndex;
    }
  }

  return chunks;
}

export function sanitizeAndSplitChunks(
  originalChunks: string[],
  maxChunkSize: number = 500,
  maxSingleChunkSize: number = 2000
): {
  chunks: string[];
  skippedChunks: number[];
  sanitizationErrors: number;
} {
  const processedChunks: string[] = [];
  const skippedChunks: number[] = [];
  let sanitizationErrors = 0;

  for (let i = 0; i < originalChunks.length; i++) {
    const originalChunk = originalChunks[i];

    try {
      const sanitizeResult = sanitizeText(originalChunk);

      if (sanitizeResult.hadInvalidSurrogates) {
        sanitizationErrors++;
        console.warn(
          `[文本清洗] 片段 ${i} 包含无效字符，已修复。位置: ${sanitizeResult.invalidPositions.slice(0, 10).join(", ")}`
        );
      }

      if (!sanitizeResult.text || sanitizeResult.text.trim().length === 0) {
        console.warn(`[文本清洗] 片段 ${i} 清洗后为空，跳过`);
        skippedChunks.push(i);
        continue;
      }

      if (sanitizeResult.text.length > maxSingleChunkSize) {
        console.log(
          `[片段拆分] 片段 ${i} 过大 (${sanitizeResult.text.length} 字符)，进行拆分`
        );
        const splitChunks = splitLargeChunk(
          sanitizeResult.text,
          maxChunkSize,
          50
        );
        processedChunks.push(...splitChunks);
      } else {
        processedChunks.push(sanitizeResult.text);
      }
    } catch (error) {
      console.error(`[文本清洗] 片段 ${i} 处理失败，跳过:`, error);
      skippedChunks.push(i);
      sanitizationErrors++;
    }
  }

  return {
    chunks: processedChunks,
    skippedChunks,
    sanitizationErrors,
  };
}
