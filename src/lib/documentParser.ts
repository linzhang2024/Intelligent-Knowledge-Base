import { readFile } from "fs/promises";
import path from "path";

export class DocumentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentParseError";
  }
}

export class EncryptedPDFError extends DocumentParseError {
  constructor() {
    super("PDF 文件已加密，无法解析，请提供未加密的文件");
    this.name = "EncryptedPDFError";
  }
}

export class ScannedPDFError extends DocumentParseError {
  constructor() {
    super("PDF 文件为扫描版（仅图片），无法提取文本，请提供可编辑的 PDF 文档");
    this.name = "ScannedPDFError";
  }
}

export class CorruptedFileError extends DocumentParseError {
  constructor(fileType: string) {
    super(`${fileType} 文件已损坏，无法解析，请检查文件完整性`);
    this.name = "CorruptedFileError";
  }
}

export class UnsupportedFormatError extends DocumentParseError {
  constructor(format: string) {
    super(`不支持的文件格式 "${format}"，仅支持 PDF、DOCX、TXT 格式`);
    this.name = "UnsupportedFormatError";
  }
}

export class EmptyContentError extends DocumentParseError {
  constructor(fileType: string) {
    super(`解析失败:${fileType} 内容为空`);
    this.name = "EmptyContentError";
  }
}

function validatePDFHeader(buffer: Buffer): boolean {
  if (buffer.length < 5) {
    return false;
  }
  const header = buffer.slice(0, 5).toString("ascii");
  return header === "%PDF-";
}

async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    console.log(`[PDF解析器] 开始解析 PDF 文件: ${filePath}`);

    const dataBuffer = await readFile(filePath);
    console.log(`[PDF解析器] 读取 PDF 文件成功，大小: ${dataBuffer.length} bytes`);

    if (dataBuffer.length === 0) {
      throw new CorruptedFileError("PDF");
    }

    if (!validatePDFHeader(dataBuffer)) {
      console.error("[PDF解析器] PDF 文件头验证失败");
      throw new CorruptedFileError("PDF");
    }

    console.log("[PDF解析器] PDF 文件头验证通过");

    const pdfParseModule = await import("pdf-parse");
    const { PDFParse, PasswordException, InvalidPDFException, FormatError } = pdfParseModule;

    console.log("[PDF解析器] pdf-parse 模块加载成功");

    const workerSrc = path.join(
      process.cwd(),
      "node_modules",
      "pdf-parse",
      "dist",
      "worker",
      "esm",
      "index.js"
    );

    console.log(`[PDF解析器] 配置 Worker: ${workerSrc}`);
    
    try {
      PDFParse.setWorker(workerSrc);
      console.log("[PDF解析器] Worker 配置完成");
    } catch (workerError) {
      console.warn("[PDF解析器] Worker 配置警告:", workerError);
    }

    const parser = new PDFParse({ 
      data: dataBuffer,
      verbosity: 0
    });

    console.log("[PDF解析器] PDFParse 实例创建成功");

    console.log("[PDF解析器] 开始提取文本...");
    const textResult = await parser.getText();
    const fullText = textResult.text || "";

    console.log(`[PDF解析器] 文本提取完成，长度: ${fullText.length} 字符`);

    let numPages = textResult.total || 0;
    
    try {
      const infoResult = await parser.getInfo({ parsePageInfo: true });
      numPages = infoResult.total || numPages;
      console.log(`[PDF解析器] PDF 解析完成，页数: ${numPages}`);
    } catch (infoError) {
      console.warn("[PDF解析器] 获取 PDF 信息失败:", infoError);
    }

    try {
      await parser.destroy();
      console.log("[PDF解析器] 解析器已销毁");
    } catch (destroyError) {
      console.warn("[PDF解析器] 解析器销毁警告:", destroyError);
    }

    const trimmedText = fullText.trim();
    console.log(`[PDF解析器] 有效文本长度: ${trimmedText.length} 字符`);

    if (trimmedText.length < 10) {
      if (numPages > 0 && trimmedText.length === 0) {
        console.log("[PDF解析器] PDF 有页数但无文本，可能是扫描版 PDF");
        throw new ScannedPDFError();
      }
      throw new EmptyContentError("PDF");
    }

    return fullText;
  } catch (pdfError) {
    console.error("[PDF解析器] 解析过程中出错:", pdfError);

    if (pdfError instanceof DocumentParseError) {
      throw pdfError;
    }

    try {
      const pdfParseModule = await import("pdf-parse");
      const { PasswordException, InvalidPDFException, FormatError } = pdfParseModule;

      if (pdfError instanceof PasswordException) {
        throw new EncryptedPDFError();
      }

      if (pdfError instanceof InvalidPDFException || pdfError instanceof FormatError) {
        throw new CorruptedFileError("PDF");
      }
    } catch (importError) {
      console.warn("[PDF解析器] 导入异常类型失败:", importError);
    }

    const errorMessage =
      pdfError instanceof Error ? pdfError.message : String(pdfError);

    if (
      errorMessage.includes("encrypt") ||
      errorMessage.includes("Encrypt") ||
      errorMessage.includes("password") ||
      errorMessage.includes("Password") ||
      errorMessage.includes("需要密码") ||
      errorMessage.includes("加密")
    ) {
      throw new EncryptedPDFError();
    }

    if (
      errorMessage.includes("corrupt") ||
      errorMessage.includes("Corrupt") ||
      errorMessage.includes("invalid") ||
      errorMessage.includes("Invalid") ||
      errorMessage.includes("Invalid PDF") ||
      errorMessage.includes("格式错误") ||
      errorMessage.includes("损坏")
    ) {
      throw new CorruptedFileError("PDF");
    }

    console.error("[PDF解析器] 文本提取失败:", pdfError);
    throw new DocumentParseError(`PDF 解析失败: ${errorMessage}`);
  }
}

async function extractTextFromDOCX(filePath: string): Promise<string> {
  try {
    console.log(`[DOCX解析器] 开始解析 DOCX 文件: ${filePath}`);

    const mammothModule = await import("mammoth");
    const mammoth = mammothModule.default || mammothModule;

    const dataBuffer = await readFile(filePath);
    console.log(`[DOCX解析器] 读取 DOCX 文件成功，大小: ${dataBuffer.length} bytes`);

    if (dataBuffer.length === 0) {
      throw new CorruptedFileError("DOCX");
    }

    if (dataBuffer.length < 4) {
      throw new CorruptedFileError("DOCX");
    }

    const signature = dataBuffer.slice(0, 4).toString("hex");
    if (signature !== "504b0304") {
      console.error(`[DOCX解析器] DOCX 文件签名验证失败，签名: ${signature}`);
      throw new CorruptedFileError("DOCX");
    }

    try {
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      const text = result.value || "";

      console.log(`[DOCX解析器] DOCX 解析完成，文本长度: ${text.length}`);

      const trimmedText = text.trim();
      if (trimmedText.length < 10) {
        console.warn(`[DOCX解析器] DOCX 文件解析后文本过短或为空，长度: ${trimmedText.length}`);
        throw new EmptyContentError("DOCX");
      }

      return text;
    } catch (docxError) {
      const errorMessage =
        docxError instanceof Error ? docxError.message : String(docxError);

      if (
        errorMessage.includes("corrupt") ||
        errorMessage.includes("Corrupt") ||
        errorMessage.includes("invalid")
      ) {
        throw new CorruptedFileError("DOCX");
      }

      if (errorMessage.includes("password") || errorMessage.includes("encrypt")) {
        throw new DocumentParseError("DOCX 文件已加密或受保护，无法解析");
      }

      throw docxError;
    }
  } catch (error) {
    if (error instanceof DocumentParseError) {
      throw error;
    }

    console.error("[DOCX解析器] 文本提取失败:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    throw new DocumentParseError(`DOCX 解析失败: ${errorMessage}`);
  }
}

async function extractTextFromTXT(filePath: string): Promise<string> {
  try {
    console.log(`[TXT解析器] 开始解析 TXT 文件: ${filePath}`);

    const content = await readFile(filePath, "utf-8");

    console.log(`[TXT解析器] TXT 解析完成，文本长度: ${content.length}`);

    const trimmedContent = content.trim();
    if (trimmedContent.length < 10) {
      console.warn(`[TXT解析器] TXT 文件内容过短或为空，长度: ${trimmedContent.length}`);
      throw new EmptyContentError("TXT");
    }

    return content;
  } catch (error) {
    if (error instanceof DocumentParseError) {
      throw error;
    }

    console.error("[TXT解析器] 文本提取失败:", error);

    if (error instanceof Error && error.message.includes("encoding")) {
      throw new DocumentParseError("TXT 文件编码不支持，请使用 UTF-8 编码");
    }

    throw new CorruptedFileError("TXT");
  }
}

export type DocumentType = "pdf" | "docx" | "txt";

export interface ParseResult {
  text: string;
  fileType: DocumentType;
}

export async function parseDocument(
  filePath: string,
  fileType: DocumentType
): Promise<ParseResult> {
  console.log(`[文档解析器] 开始解析文档，类型: ${fileType}, 路径: ${filePath}`);

  switch (fileType.toLowerCase()) {
    case "pdf":
      return {
        text: await extractTextFromPDF(filePath),
        fileType: "pdf",
      };
    case "docx":
      return {
        text: await extractTextFromDOCX(filePath),
        fileType: "docx",
      };
    case "txt":
      return {
        text: await extractTextFromTXT(filePath),
        fileType: "txt",
      };
    default:
      throw new UnsupportedFormatError(fileType);
  }
}

export function getDocumentTypeFromExtension(extension: string): DocumentType {
  const ext = extension.toLowerCase().replace(/^\./, "");
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "txt") return "txt";
  throw new UnsupportedFormatError(extension);
}

export function getDocumentTypeFromMimeType(mimeType: string): DocumentType | null {
  const type = mimeType.toLowerCase();
  if (type === "application/pdf") return "pdf";
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    return "docx";
  if (type === "text/plain") return "txt";
  return null;
}

export { extractTextFromPDF, extractTextFromDOCX, extractTextFromTXT };
