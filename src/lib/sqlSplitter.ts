const MAX_CHUNK_SIZE = 1 * 1024 * 1024;

const STATEMENT_END_MARKERS = [";", "GO", "go"];

export interface SplitChunk {
  index: number;
  name: string;
  blob: Blob;
  size: number;
}

export interface SplitProgress {
  stage: "reading" | "splitting" | "complete";
  progress: number;
  chunksCreated: number;
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

export function generateChunkName(originalName: string, index: number): string {
  const ext = getFileExtension(originalName);
  const baseName = getFileNameWithoutExtension(originalName);
  return `${baseName}_${index}${ext}`;
}

export function needsSplitting(file: File, maxChunkSize: number = MAX_CHUNK_SIZE): boolean {
  return file.size > maxChunkSize;
}

export function getFileSizeMB(file: File): number {
  return file.size / (1024 * 1024);
}

export async function splitSQLFile(
  file: File,
  maxChunkSize: number = MAX_CHUNK_SIZE,
  onProgress?: SplitProgressCallback
): Promise<SplitChunk[]> {
  const chunks: SplitChunk[] = [];
  const totalSize = file.size;
  let processedSize = 0;
  let chunkIndex = 1;

  const updateProgress = (
    stage: SplitProgress["stage"],
    message: string,
    chunksCreated: number = 0
  ) => {
    if (onProgress) {
      const progress = totalSize > 0 ? (processedSize / totalSize) * 100 : 0;
      onProgress({
        stage,
        progress: Math.min(progress, 100),
        chunksCreated,
        totalSize,
        processedSize,
        message,
      });
    }
  };

  updateProgress("reading", "正在读取文件...", 0);

  const text = await readFileAsText(file);

  updateProgress("splitting", "正在分析 SQL 语句...", 0);

  const statements = splitIntoStatements(text);

  let currentChunkContent = "";
  let currentChunkSize = 0;

  for (const statement of statements) {
    const statementSize = new Blob([statement]).size;

    if (statementSize > maxChunkSize) {
      const subChunks = splitLargeStatement(statement, maxChunkSize);
      for (const subChunk of subChunks) {
        const subChunkSize = new Blob([subChunk]).size;
        
        if (currentChunkSize + subChunkSize > maxChunkSize && currentChunkContent.length > 0) {
          chunks.push(createChunk(file.name, chunkIndex, currentChunkContent));
          chunkIndex++;
          updateProgress("splitting", `已创建 ${chunkIndex - 1} 个片段...`, chunks.length);
          currentChunkContent = "";
          currentChunkSize = 0;
        }

        currentChunkContent += subChunk;
        currentChunkSize += subChunkSize;
        processedSize += subChunkSize;
      }
    } else {
      if (currentChunkSize + statementSize > maxChunkSize && currentChunkContent.length > 0) {
        chunks.push(createChunk(file.name, chunkIndex, currentChunkContent));
        chunkIndex++;
        updateProgress("splitting", `已创建 ${chunkIndex - 1} 个片段...`, chunks.length);
        currentChunkContent = "";
        currentChunkSize = 0;
      }

      currentChunkContent += statement;
      currentChunkSize += statementSize;
      processedSize += statementSize;
    }
  }

  if (currentChunkContent.length > 0) {
    chunks.push(createChunk(file.name, chunkIndex, currentChunkContent));
    chunkIndex++;
  }

  processedSize = totalSize;
  updateProgress("complete", `拆分完成，共 ${chunks.length} 个片段`, chunks.length);

  return chunks;
}

function createChunk(originalName: string, index: number, content: string): SplitChunk {
  const blob = new Blob([content], { type: "text/plain" });
  return {
    index,
    name: generateChunkName(originalName, index),
    blob,
    size: blob.size,
  };
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

function splitLargeStatement(statement: string, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  let currentChunk = "";
  let currentSize = 0;

  const lines = statement.split("\n");

  for (const line of lines) {
    const lineWithNewline = line + "\n";
    const lineSize = new Blob([lineWithNewline]).size;

    if (currentSize + lineSize > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = "";
      currentSize = 0;
    }

    currentChunk += lineWithNewline;
    currentSize += lineSize;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      resolve(text);
    };
    reader.onerror = () => {
      reject(new Error("读取文件失败"));
    };
    reader.readAsText(file);
  });
}

export function formatSplitProgress(progress: SplitProgress): string {
  const stageLabels: Record<SplitProgress["stage"], string> = {
    reading: "读取文件",
    splitting: "拆分文件",
    complete: "拆分完成",
  };

  return `${stageLabels[progress.stage]}: ${Math.round(progress.progress)}% (已创建 ${progress.chunksCreated} 个片段)`;
}

export { MAX_CHUNK_SIZE };
