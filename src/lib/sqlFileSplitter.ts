import { createReadStream, readFileSync, writeFile, mkdir, unlink, existsSync, readdir, stat } from "fs";
import { createInterface } from "readline";
import * as chardet from "chardet";
import * as iconv from "iconv-lite";
import path from "path";

const MAX_CHUNK_SIZE = 200 * 1024;
const SPLIT_TMP_DIR = "upload/split-tmp";

const STATEMENT_END_MARKERS = [";", "GO", "go"];

const CREATE_STATEMENT_PATTERNS = [
  /CREATE\s+(OR\s+REPLACE\s+)?(TABLE|FUNCTION|PROCEDURE|PACKAGE|VIEW|INDEX|TRIGGER|SYNONYM|SEQUENCE|TYPE|CONTEXT|DIRECTORY|JAVA)/gi,
  /ALTER\s+TABLE/gi,
];

export type EncodingType = 
  | "utf-8" 
  | "gbk" 
  | "gb2312" 
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

export const CHINESE_ENCODINGS: Set<string> = new Set(["gbk", "gb2312", "big5"]);

export interface SplitFileInfo {
  index: number;
  fileName: string;
  filePath: string;
  size: number;
  statementCount: number;
}

export interface SplitProgress {
  stage: "reading" | "detecting_encoding" | "decoding" | "splitting" | "writing" | "complete";
  progress: number;
  filesCreated: number;
  totalSize: number;
  processedSize: number;
  message: string;
}

export type SplitProgressCallback = (progress: SplitProgress) => void;

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.substring(lastDot);
}

function getFileNameWithoutExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return filename;
  return filename.substring(0, lastDot);
}

export function generateChunkFileName(originalName: string, index: number): string {
  const ext = getFileExtension(originalName);
  const baseName = getFileNameWithoutExtension(originalName);
  return `${baseName}_${index}${ext}`;
}

export function needsSplitting(fileSize: number, maxChunkSize: number = MAX_CHUNK_SIZE): boolean {
  return fileSize > maxChunkSize;
}

export function detectEncoding(buffer: Buffer): EncodingDetectionResult {
  const detected = chardet.detect(buffer);
  
  if (!detected) {
    return {
      encoding: "utf-8",
      confidence: 0,
      isChineseEncoding: false,
    };
  }

  let encoding: EncodingType;
  const detectedLower = detected.toLowerCase();

  if (detectedLower === "gbk" || detectedLower === "cp936") {
    encoding = "gbk";
  } else if (detectedLower === "gb2312") {
    encoding = "gb2312";
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
    confidence: 0.8,
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

  if (
    CHINESE_ENCODINGS.has(encoding) || 
    encoding === "utf-16le" || 
    encoding === "utf-16be" ||
    encoding === "iso-8859-1" ||
    encoding === "windows-1252"
  ) {
    try {
      text = iconv.decode(buffer, encoding);
      hadConversion = true;
      invalidByteCount = countInvalidCharacters(text);
    } catch (error) {
      text = buffer.toString("utf-8");
      invalidByteCount = countInvalidCharacters(text);
    }
  } else if (encoding === "ascii") {
    try {
      text = iconv.decode(buffer, "ascii");
      hadConversion = true;
      invalidByteCount = countInvalidCharacters(text);
    } catch (error) {
      text = buffer.toString("utf-8");
      invalidByteCount = countInvalidCharacters(text);
    }
  } else {
    try {
      text = iconv.decode(buffer, encoding);
      hadConversion = true;
      invalidByteCount = countInvalidCharacters(text);
    } catch (error) {
      text = buffer.toString("utf-8");
      invalidByteCount = countInvalidCharacters(text);
    }
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

function hasHighInvalidByteRate(result: DecodeResult, threshold: number = 0.01): boolean {
  if (result.text.length === 0) return false;
  const ratio = result.invalidByteCount / result.text.length;
  return ratio > threshold;
}

export function readAndDecodeFile(
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

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function removeBOM(text: string): string {
  if (text.charCodeAt(0) === 0xFEFF) {
    return text.slice(1);
  }
  return text;
}

function cleanText(text: string): string {
  let cleaned = removeBOM(text);
  cleaned = normalizeNewlines(cleaned);
  return cleaned;
}

function isCreateStatement(statement: string): boolean {
  const upperStatement = statement.toUpperCase();
  return upperStatement.includes("CREATE TABLE") ||
         upperStatement.includes("CREATE OR REPLACE") ||
         upperStatement.includes("CREATE FUNCTION") ||
         upperStatement.includes("CREATE PROCEDURE") ||
         upperStatement.includes("CREATE PACKAGE") ||
         upperStatement.includes("CREATE VIEW") ||
         upperStatement.includes("CREATE INDEX") ||
         upperStatement.includes("CREATE TRIGGER") ||
         upperStatement.includes("ALTER TABLE");
}

function splitIntoStatements(text: string): string[] {
  const statements: string[] = [];
  let currentStatement = "";
  let inMultiLineComment = false;
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (!inString) {
      if (char === "/" && nextChar === "*") {
        inMultiLineComment = true;
        currentStatement += char;
        continue;
      }
      if (inMultiLineComment && char === "*" && nextChar === "/") {
        inMultiLineComment = false;
        currentStatement += char + nextChar;
        i++;
        continue;
      }
      if (char === "-" && nextChar === "-") {
        while (i < text.length && text[i] !== "\n") {
          currentStatement += text[i];
          i++;
        }
        if (i < text.length) currentStatement += text[i];
        continue;
      }

      if (!inMultiLineComment) {
        if (char === "'" || char === '"') {
          inString = true;
          stringChar = char;
          currentStatement += char;
          continue;
        }
      }
    } else {
      if (char === stringChar && text[i - 1] !== "\\") {
        inString = false;
        currentStatement += char;
        continue;
      }
    }

    currentStatement += char;

    if (!inString && !inMultiLineComment) {
      if (char === ";") {
        const trimmed = currentStatement.trim();
        if (trimmed.length > 0) {
          statements.push(currentStatement);
        }
        currentStatement = "";
        continue;
      }

      if (char === "G" || char === "g") {
        const remaining = text.substring(i + 1);
        const goMatch = remaining.match(/^[oO]\s*(\n|$)/);
        if (goMatch) {
          currentStatement += remaining.substring(0, goMatch[0].length);
          const trimmed = currentStatement.trim();
          if (trimmed.length > 0) {
            statements.push(currentStatement);
          }
          currentStatement = "";
          i += goMatch[0].length;
          continue;
        }
      }
    }
  }

  const trimmed = currentStatement.trim();
  if (trimmed.length > 0) {
    statements.push(currentStatement);
  }

  return statements;
}

export async function ensureSplitTmpDir(): Promise<string> {
  const splitTmpDir = path.join(process.cwd(), SPLIT_TMP_DIR);
  if (!existsSync(splitTmpDir)) {
    await mkdir(splitTmpDir, { recursive: true });
  }
  return splitTmpDir;
}

export interface SplitResult {
  success: boolean;
  files: SplitFileInfo[];
  originalFile: string;
  originalEncoding: EncodingType;
  totalFiles: number;
  error?: string;
}

export async function splitSQLFile(
  filePath: string,
  maxChunkSize: number = MAX_CHUNK_SIZE,
  onProgress?: SplitProgressCallback
): Promise<SplitResult> {
  const files: SplitFileInfo[] = [];
  let totalSize = 0;
  let processedSize = 0;

  const updateProgress = (
    stage: SplitProgress["stage"],
    message: string,
    filesCreated: number = 0
  ) => {
    if (onProgress) {
      const progress = totalSize > 0 ? (processedSize / totalSize) * 100 : 0;
      onProgress({
        stage,
        progress: Math.min(progress, 100),
        filesCreated,
        totalSize,
        processedSize,
        message,
      });
    }
  };

  try {
    const fileStats = stat(filePath);
    totalSize = fileStats.size;

    updateProgress("reading", "正在读取文件...", 0);

    if (!needsSplitting(totalSize, maxChunkSize)) {
      return {
        success: true,
        files: [],
        originalFile: filePath,
        originalEncoding: "utf-8",
        totalFiles: 0,
      };
    }

    updateProgress("detecting_encoding", "正在检测文件编码...", 0);

    const decodeResult = readAndDecodeFile(filePath);
    const text = cleanText(decodeResult.text);

    updateProgress("decoding", `正在解码文件 (编码: ${decodeResult.originalEncoding})...`, 0);

    const statements = splitIntoStatements(text);

    updateProgress("splitting", `正在分析 SQL 语句 (共 ${statements.length} 条语句)...`, 0);

    const splitTmpDir = await ensureSplitTmpDir();
    const originalFileName = path.basename(filePath);

    let currentChunkStatements: string[] = [];
    let currentChunkSize = 0;
    let chunkIndex = 1;

    let currentCreateStatement: string[] = [];
    let inCreateStatement = false;

    for (const statement of statements) {
      const statementSize = Buffer.byteLength(statement, "utf-8");

      if (isCreateStatement(statement)) {
        if (inCreateStatement && currentCreateStatement.length > 0) {
          const createStatement = currentCreateStatement.join("\n");
          const createStatementSize = Buffer.byteLength(createStatement, "utf-8");

          if (currentChunkSize + createStatementSize > maxChunkSize && currentChunkStatements.length > 0) {
            const chunkContent = currentChunkStatements.join("\n\n");
            const chunkFileName = generateChunkFileName(originalFileName, chunkIndex);
            const chunkFilePath = path.join(splitTmpDir, chunkFileName);
            
            await writeFile(chunkFilePath, chunkContent, "utf-8");
            
            const chunkFileStats = stat(chunkFilePath);
            files.push({
              index: chunkIndex,
              fileName: chunkFileName,
              filePath: chunkFilePath,
              size: chunkFileStats.size,
              statementCount: currentChunkStatements.length,
            });

            processedSize += currentChunkSize;
            updateProgress("writing", `正在写入片段 ${chunkIndex}...`, files.length);

            chunkIndex++;
            currentChunkStatements = [];
            currentChunkSize = 0;
          }

          currentChunkStatements.push(createStatement);
          currentChunkSize += createStatementSize;
        }

        currentCreateStatement = [statement];
        inCreateStatement = true;
      } else {
        if (inCreateStatement) {
          currentCreateStatement.push(statement);
        } else {
          if (currentChunkSize + statementSize > maxChunkSize && currentChunkStatements.length > 0) {
            const chunkContent = currentChunkStatements.join("\n\n");
            const chunkFileName = generateChunkFileName(originalFileName, chunkIndex);
            const chunkFilePath = path.join(splitTmpDir, chunkFileName);
            
            await writeFile(chunkFilePath, chunkContent, "utf-8");
            
            const chunkFileStats = stat(chunkFilePath);
            files.push({
              index: chunkIndex,
              fileName: chunkFileName,
              filePath: chunkFilePath,
              size: chunkFileStats.size,
              statementCount: currentChunkStatements.length,
            });

            processedSize += currentChunkSize;
            updateProgress("writing", `正在写入片段 ${chunkIndex}...`, files.length);

            chunkIndex++;
            currentChunkStatements = [];
            currentChunkSize = 0;
          }

          currentChunkStatements.push(statement);
          currentChunkSize += statementSize;
        }
      }

      processedSize += statementSize;
    }

    if (inCreateStatement && currentCreateStatement.length > 0) {
      const createStatement = currentCreateStatement.join("\n");
      const createStatementSize = Buffer.byteLength(createStatement, "utf-8");

      if (currentChunkSize + createStatementSize > maxChunkSize && currentChunkStatements.length > 0) {
        const chunkContent = currentChunkStatements.join("\n\n");
        const chunkFileName = generateChunkFileName(originalFileName, chunkIndex);
        const chunkFilePath = path.join(splitTmpDir, chunkFileName);
        
        await writeFile(chunkFilePath, chunkContent, "utf-8");
        
        const chunkFileStats = stat(chunkFilePath);
        files.push({
          index: chunkIndex,
          fileName: chunkFileName,
          filePath: chunkFilePath,
          size: chunkFileStats.size,
          statementCount: currentChunkStatements.length,
        });

        processedSize += currentChunkSize;
        updateProgress("writing", `正在写入片段 ${chunkIndex}...`, files.length);

        chunkIndex++;
        currentChunkStatements = [];
        currentChunkSize = 0;
      }

      currentChunkStatements.push(createStatement);
      currentChunkSize += createStatementSize;
    }

    if (currentChunkStatements.length > 0) {
      const chunkContent = currentChunkStatements.join("\n\n");
      const chunkFileName = generateChunkFileName(originalFileName, chunkIndex);
      const chunkFilePath = path.join(splitTmpDir, chunkFileName);
      
      await writeFile(chunkFilePath, chunkContent, "utf-8");
      
      const chunkFileStats = stat(chunkFilePath);
      files.push({
        index: chunkIndex,
        fileName: chunkFileName,
        filePath: chunkFilePath,
        size: chunkFileStats.size,
        statementCount: currentChunkStatements.length,
      });

      processedSize = totalSize;
      updateProgress("writing", `正在写入片段 ${chunkIndex}...`, files.length);
    }

    processedSize = totalSize;
    updateProgress("complete", `拆分完成，共 ${files.length} 个片段`, files.length);

    return {
      success: true,
      files,
      originalFile: filePath,
      originalEncoding: decodeResult.originalEncoding,
      totalFiles: files.length,
    };
  } catch (error) {
    return {
      success: false,
      files,
      originalFile: filePath,
      originalEncoding: "utf-8",
      totalFiles: files.length,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

export async function deleteSplitFiles(files: SplitFileInfo[]): Promise<{ success: boolean; deleted: number; errors: string[] }> {
  const errors: string[] = [];
  let deleted = 0;

  for (const file of files) {
    try {
      if (existsSync(file.filePath)) {
        await unlink(file.filePath);
        deleted++;
      }
    } catch (error) {
      errors.push(`删除文件 ${file.filePath} 失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  return {
    success: errors.length === 0,
    deleted,
    errors,
  };
}

export async function deleteSplitFile(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

export async function listSplitFiles(): Promise<SplitFileInfo[]> {
  const splitTmpDir = path.join(process.cwd(), SPLIT_TMP_DIR);
  
  if (!existsSync(splitTmpDir)) {
    return [];
  }

  const files: SplitFileInfo[] = [];
  const fileNames = readdir(splitTmpDir);

  for (let i = 0; i < fileNames.length; i++) {
    const fileName = fileNames[i];
    const filePath = path.join(splitTmpDir, fileName);
    const fileStats = stat(filePath);

    if (fileStats.isFile()) {
      files.push({
        index: i + 1,
        fileName,
        filePath,
        size: fileStats.size,
        statementCount: 0,
      });
    }
  }

  return files;
}

export async function cleanupOldSplitFiles(maxAgeHours: number = 24): Promise<{ deleted: number; errors: string[] }> {
  const splitTmpDir = path.join(process.cwd(), SPLIT_TMP_DIR);
  const errors: string[] = [];
  let deleted = 0;

  if (!existsSync(splitTmpDir)) {
    return { deleted, errors };
  }

  const now = Date.now();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  const fileNames = readdir(splitTmpDir);

  for (const fileName of fileNames) {
    try {
      const filePath = path.join(splitTmpDir, fileName);
      const fileStats = stat(filePath);

      if (fileStats.isFile()) {
        const fileAgeMs = now - fileStats.mtimeMs;

        if (fileAgeMs > maxAgeMs) {
          await unlink(filePath);
          deleted++;
        }
      }
    } catch (error) {
      errors.push(`清理文件 ${fileName} 失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  return { deleted, errors };
}

export { MAX_CHUNK_SIZE, SPLIT_TMP_DIR };
