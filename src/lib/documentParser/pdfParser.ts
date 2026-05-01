import { readFile } from "fs/promises";
import { extractText, getDocumentProxy } from "unpdf";
import {
  DocumentParseError,
  EncryptedPDFError,
  ScannedPDFError,
  CorruptedFileError,
  EmptyContentError,
  Parser,
  ParserContext,
} from "./types";

function validatePDFHeader(buffer: Buffer): boolean {
  if (buffer.length < 5) {
    return false;
  }
  const header = buffer.slice(0, 5).toString("ascii");
  return header === "%PDF-";
}

function logInfo(context: ParserContext, message: string): void {
  console.log(`[${context.parserType.toUpperCase()}解析器] [${context.filePath}] ${message}`);
}

function logError(context: ParserContext, message: string, error?: unknown): void {
  console.error(`[${context.parserType.toUpperCase()}解析器] [${context.filePath}] ${message}`, error || "");
}

function logWarn(context: ParserContext, message: string, error?: unknown): void {
  console.warn(`[${context.parserType.toUpperCase()}解析器] [${context.filePath}] ${message}`, error || "");
}

function isEncryptedError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("encrypt") ||
      message.includes("password") ||
      message.includes("需要密码") ||
      message.includes("加密")
    );
  }
  return false;
}

function isCorruptedError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("corrupt") ||
      message.includes("invalid") ||
      message.includes("格式错误") ||
      message.includes("损坏") ||
      message.includes("stream must have data") ||
      message.includes("unexpected end of file") ||
      message.includes("header signature mismatch")
    );
  }
  return false;
}

export const pdfParser: Parser = {
  type: "pdf",

  async parse(filePath: string): Promise<string> {
    const context: ParserContext = {
      parserType: "pdf",
      filePath,
      startTime: Date.now(),
    };

    try {
      logInfo(context, "开始解析 PDF 文件");

      const dataBuffer = await readFile(filePath);
      logInfo(context, `读取 PDF 文件成功，大小: ${dataBuffer.length} bytes`);

      if (dataBuffer.length === 0) {
        throw new CorruptedFileError("PDF");
      }

      if (!validatePDFHeader(dataBuffer)) {
        logError(context, "PDF 文件头验证失败");
        throw new CorruptedFileError("PDF");
      }

      logInfo(context, "PDF 文件头验证通过");

      const pdfData = new Uint8Array(dataBuffer);
      const pdf = await getDocumentProxy(pdfData);
      logInfo(context, "PDF 文档代理创建成功");

      const extractResult = await extractText(pdf, { mergePages: true });
      const totalPages = extractResult.totalPages;
      const textData = extractResult.text as string | string[];
      const fullText = typeof textData === "string" 
        ? textData 
        : Array.isArray(textData) 
          ? textData.join("\n\n") 
          : "";

      logInfo(context, `PDF 解析完成，页数: ${totalPages}, 文本长度: ${fullText.length} 字符`);

      const trimmedText = fullText.trim();
      logInfo(context, `有效文本长度: ${trimmedText.length} 字符`);

      if (trimmedText.length < 10) {
        if (totalPages > 0 && trimmedText.length === 0) {
          logInfo(context, "PDF 有页数但无文本，可能是扫描版 PDF");
          throw new ScannedPDFError();
        }
        throw new EmptyContentError("PDF");
      }

      const elapsed = Date.now() - context.startTime;
      logInfo(context, `PDF 解析完成，耗时: ${elapsed}ms`);

      return fullText;
    } catch (error) {
      logError(context, "解析过程中出错:", error);

      if (error instanceof DocumentParseError) {
        throw error;
      }

      if (isEncryptedError(error)) {
        throw new EncryptedPDFError(error instanceof Error ? error : undefined);
      }

      if (isCorruptedError(error)) {
        throw new CorruptedFileError("PDF", error instanceof Error ? error : undefined);
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      logError(context, `文本提取失败: ${errorMessage}`);
      throw new DocumentParseError(`PDF 解析失败: ${errorMessage}`, "pdf", error instanceof Error ? error : undefined);
    }
  },
};

export default pdfParser;
