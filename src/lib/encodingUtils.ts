import * as chardet from "chardet";
import * as iconv from "iconv-lite";
import { readFile, readFileSync } from "fs";
import { promisify } from "util";

const readFileAsync = promisify(readFile);

export type EncodingType = 
  | "utf-8" 
  | "gbk" 
  | "gb2312" 
  | "gb18030"
  | "big5" 
  | "utf-16le" 
  | "utf-16be" 
  | "ascii"
  | "iso-8859-1"
  | "windows-1252";

export interface EncodingDetectionResult {
  encoding: EncodingType;
  confidence: number;
  isChineseEncoding: boolean;
}

export interface DecodeResult {
  text: string;
  originalEncoding: EncodingType;
  hadConversion: boolean;
  invalidByteCount: number;
}

export const CHINESE_ENCODINGS: Set<string> = new Set(["gbk", "gb2312", "gb18030", "big5"]);

export function detectEncoding(buffer: Buffer): EncodingDetectionResult {
  const detected = chardet.detect(buffer);
  
  if (!detected || !detected.encoding) {
    return {
      encoding: "utf-8",
      confidence: 0,
      isChineseEncoding: false,
    };
  }

  let encoding: EncodingType;
  const detectedLower = detected.encoding.toLowerCase();
  const confidence = detected.confidence || 0.5;

  if (detectedLower === "gbk" || detectedLower === "cp936" || detectedLower === "windows-1252") {
    encoding = "gbk";
  } else if (detectedLower === "gb2312") {
    encoding = "gb2312";
  } else if (detectedLower === "gb18030") {
    encoding = "gb18030";
  } else if (detectedLower === "big5" || detectedLower === "cp950") {
    encoding = "big5";
  } else if (detectedLower === "utf-8" || detectedLower === "utf8") {
    encoding = "utf-8";
  } else if (detectedLower === "utf-16le" || detectedLower === "utf16le") {
    encoding = "utf-16le";
  } else if (detectedLower === "utf-16be" || detectedLower === "utf16be") {
    encoding = "utf-16be";
  } else if (detectedLower === "ascii") {
    encoding = "ascii";
  } else if (detectedLower === "iso-8859-1" || detectedLower === "latin1") {
    encoding = "iso-8859-1";
  } else if (detectedLower === "windows-1252") {
    encoding = "windows-1252";
  } else {
    encoding = "utf-8";
  }

  return {
    encoding,
    confidence,
    isChineseEncoding: CHINESE_ENCODINGS.has(encoding),
  };
}

export function decodeBuffer(
  buffer: Buffer, 
  encoding: EncodingType
): DecodeResult {
  let text: string;
  let hadConversion = false;
  let invalidByteCount = 0;

  try {
    text = iconv.decode(buffer, encoding);
    hadConversion = true;
    invalidByteCount = countInvalidCharacters(text);
  } catch (error) {
    text = buffer.toString("utf-8");
    invalidByteCount = countInvalidCharacters(text);
  }

  return {
    text,
    originalEncoding: encoding,
    hadConversion,
    invalidByteCount,
  };
}

function countInvalidCharacters(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    if (charCode === 0xFFFD) {
      count++;
    }
  }
  return count;
}

export function hasHighInvalidByteRate(result: DecodeResult, threshold: number = 0.01): boolean {
  if (result.text.length === 0) return false;
  const ratio = result.invalidByteCount / result.text.length;
  return ratio > threshold;
}

export function tryMultipleEncodings(buffer: Buffer): DecodeResult {
  const results: DecodeResult[] = [];
  
  const encodingsToTry: EncodingType[] = ["utf-8", "gbk", "gb2312", "gb18030", "big5", "ascii"];
  
  for (const encoding of encodingsToTry) {
    const result = decodeBuffer(buffer, encoding);
    result.confidence = 1 - (result.invalidByteCount / Math.max(buffer.length, 1));
    results.push(result);
  }
  
  const validResults = results.filter(r => r.invalidByteCount < buffer.length * 0.05);
  
  if (validResults.length === 0) {
    return results[0];
  }
  
  validResults.sort((a, b) => b.confidence - a.confidence);
  
  return validResults[0];
}

export async function decodeFileWithRetry(
  filePath: string,
  sampleSize: number = 1024 * 64
): Promise<DecodeResult> {
  const fullBuffer = await readFileAsync(filePath);
  
  const sampleBuffer = fullBuffer.slice(0, Math.min(sampleSize, fullBuffer.length));
  
  const detection = detectEncoding(sampleBuffer);
  
  let result = decodeBuffer(fullBuffer, detection.encoding);
  
  if (hasHighInvalidByteRate(result) && !detection.isChineseEncoding) {
    const gbkResult = decodeBuffer(fullBuffer, "gbk");
    
    if (gbkResult.invalidByteCount < result.invalidByteCount) {
      return gbkResult;
    }
  }
  
  if (hasHighInvalidByteRate(result) && detection.encoding !== "gb2312") {
    const gb2312Result = decodeBuffer(fullBuffer, "gb2312");
    
    if (gb2312Result.invalidByteCount < result.invalidByteCount) {
      return gb2312Result;
    }
  }
  
  return result;
}

export function decodeFileWithRetrySync(
  filePath: string,
  sampleSize: number = 1024 * 64
): DecodeResult {
  const fullBuffer = readFileSync(filePath);
  
  const sampleBuffer = fullBuffer.slice(0, Math.min(sampleSize, fullBuffer.length));
  
  const detection = detectEncoding(sampleBuffer);
  
  let result = decodeBuffer(fullBuffer, detection.encoding);
  
  if (hasHighInvalidByteRate(result) && !detection.isChineseEncoding) {
    const gbkResult = decodeBuffer(fullBuffer, "gbk");
    
    if (gbkResult.invalidByteCount < result.invalidByteCount) {
      return gbkResult;
    }
  }
  
  if (hasHighInvalidByteRate(result) && detection.encoding !== "gb2312") {
    const gb2312Result = decodeBuffer(fullBuffer, "gb2312");
    
    if (gb2312Result.invalidByteCount < result.invalidByteCount) {
      return gb2312Result;
    }
  }
  
  return result;
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function removeBOM(text: string): string {
  if (text.charCodeAt(0) === 0xFEFF) {
    return text.slice(1);
  }
  return text;
}

export function cleanText(text: string): string {
  let cleaned = removeBOM(text);
  cleaned = normalizeNewlines(cleaned);
  return cleaned;
}
