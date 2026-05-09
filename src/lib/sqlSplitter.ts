const MAX_CHUNK_SIZE = 1 * 1024 * 1024;

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
  console.log(`[SQL拆分] === 开始拆分 ===`);
  console.log(`[SQL拆分] 文件名: ${file.name}`);
  console.log(`[SQL拆分] 文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
  console.log(`[SQL拆分] maxChunkSize: ${maxChunkSize / 1024}KB`);

  const chunks: SplitChunk[] = [];
  const totalSize = file.size;
  let processedSize = 0;
  let chunkIndex = 1;

  const updateProgress = (
    stage: SplitProgress["stage"],
    message: string,
    chunksCreated: number = 0
  ) => {
    console.log(`[SQL拆分] 进度更新: ${stage} - ${message}`);
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

  updateProgress("reading", "正在读取 SQL 文件...", 0);

  console.log(`[SQL拆分] 开始读取文件...`);
  
  let text: string;
  try {
    text = await readFileAsText(file);
    console.log(`[SQL拆分] 文件读取完成，长度: ${text.length} 字符`);
  } catch (error) {
    console.error(`[SQL拆分] 读取文件失败:`, error);
    throw error;
  }

  updateProgress("splitting", "正在分析 SQL 语句...", 0);

  console.log(`[SQL拆分] 开始解析语句...`);
  
  let statements: string[];
  try {
    statements = splitIntoStatements(text);
    console.log(`[SQL拆分] 解析完成，共 ${statements.length} 条语句`);
  } catch (error) {
    console.error(`[SQL拆分] 解析语句失败:`, error);
    throw error;
  }

  let currentChunkContent = "";
  let currentChunkSize = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const statementSize = new Blob([statement]).size;

    if (i % 100 === 0) {
      console.log(`[SQL拆分] 处理语句 ${i}/${statements.length}`);
      updateProgress("splitting", `正在拆分 SQL 文件 (${i}/${statements.length})...`, chunks.length);
    }

    if (statementSize > maxChunkSize) {
      console.log(`[SQL拆分] 语句 ${i} 超过大小限制 (${statementSize} > ${maxChunkSize})，拆分`);
      const subChunks = splitLargeStatement(statement, maxChunkSize);
      for (const subChunk of subChunks) {
        const subChunkSize = new Blob([subChunk]).size;

        if (currentChunkSize + subChunkSize > maxChunkSize && currentChunkContent.length > 0) {
          chunks.push(createChunk(file.name, chunkIndex, currentChunkContent));
          chunkIndex++;
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

  console.log(`[SQL拆分] === 拆分完成 ===`);
  console.log(`[SQL拆分] 共 ${chunks.length} 个片段`);

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
  console.log(`[SQL拆分] splitIntoStatements: 开始分割文本`);
  const statements: string[] = [];
  let currentStatement = "";

  let charCount = 0;
  const totalChars = text.length;
  
  for (let i = 0; i < text.length; i++) {
    charCount++;
    if (charCount % 100000 === 0) {
      console.log(`[SQL拆分] splitIntoStatements: 已处理 ${charCount}/${totalChars} 字符`);
    }

    const char = text[i];

    if (char === "/" && i + 1 < text.length && text[i + 1] === "*") {
      let commentEnd = text.indexOf("*/", i + 2);
      if (commentEnd !== -1) {
        currentStatement += text.substring(i, commentEnd + 2);
        i = commentEnd + 1;
      } else {
        currentStatement += char;
      }
      continue;
    }

    if (char === "-" && i + 1 < text.length && text[i + 1] === "-") {
      let lineEnd = text.indexOf("\n", i);
      if (lineEnd !== -1) {
        currentStatement += text.substring(i, lineEnd);
        i = lineEnd;
      } else {
        currentStatement += text.substring(i);
        break;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      const quote = char;
      currentStatement += char;
      i++;
      while (i < text.length) {
        const c = text[i];
        if (c === "\\" && i + 1 < text.length) {
          currentStatement += c + text[i + 1];
          i += 2;
        } else if (c === quote) {
          currentStatement += c;
          i++;
          break;
        } else {
          currentStatement += c;
          i++;
        }
      }
      continue;
    }

    currentStatement += char;

    if (char === ";") {
      const trimmed = currentStatement.trim();
      if (trimmed.length > 0 && trimmed !== ";") {
        statements.push(currentStatement);
      }
      currentStatement = "";
    }
  }

  const remaining = currentStatement.trim();
  if (remaining.length > 0 && remaining !== ";") {
    statements.push(currentStatement);
  }

  console.log(`[SQL拆分] splitIntoStatements: 完成，共 ${statements.length} 条语句`);
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
      console.log(`[SQL拆分] FileReader onload 触发`);
      const text = event.target?.result as string;
      if (text) {
        console.log(`[SQL拆分] FileReader 读取成功，长度: ${text.length}`);
        resolve(text);
      } else {
        console.error(`[SQL拆分] FileReader result 为空`);
        reject(new Error("读取文件内容为空"));
      }
    };
    
    reader.onerror = (event) => {
      console.error(`[SQL拆分] FileReader onerror:`, event);
      reject(new Error("读取文件失败"));
    };
    
    reader.onabort = () => {
      console.error(`[SQL拆分] FileReader onabort`);
      reject(new Error("读取文件被中止"));
    };

    console.log(`[SQL拆分] FileReader 开始读取文件`);
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
