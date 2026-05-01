import { readFile } from "fs/promises";
import {
  DocumentParseError,
  CorruptedFileError,
  EmptyContentError,
  Parser,
  ParserContext,
} from "./types";

function logInfo(context: ParserContext, message: string): void {
  console.log(`[${context.parserType.toUpperCase()}解析器] [${context.filePath}] ${message}`);
}

function logError(context: ParserContext, message: string, error?: unknown): void {
  console.error(`[${context.parserType.toUpperCase()}解析器] [${context.filePath}] ${message}`, error || "");
}

export const docxParser: Parser = {
  type: "docx",

  async parse(filePath: string): Promise<string> {
    const context: ParserContext = {
      parserType: "docx",
      filePath,
      startTime: Date.now(),
    };

    try {
      logInfo(context, "开始解析 DOCX 文件");

      const mammothModule = await import("mammoth");
      const mammoth = mammothModule.default || mammothModule;

      const dataBuffer = await readFile(filePath);
      logInfo(context, `读取 DOCX 文件成功，大小: ${dataBuffer.length} bytes`);

      if (dataBuffer.length === 0) {
        throw new CorruptedFileError("DOCX");
      }

      if (dataBuffer.length < 4) {
        throw new CorruptedFileError("DOCX");
      }

      const signature = dataBuffer.slice(0, 4).toString("hex");
      if (signature !== "504b0304") {
        logError(context, `DOCX 文件签名验证失败，签名: ${signature}`);
        throw new CorruptedFileError("DOCX");
      }

      try {
        const result = await mammoth.extractRawText({ buffer: dataBuffer });
        const text = result.value || "";

        logInfo(context, `DOCX 解析完成，文本长度: ${text.length}`);

        const trimmedText = text.trim();
        if (trimmedText.length < 10) {
          logError(context, `DOCX 文件解析后文本过短或为空，长度: ${trimmedText.length}`);
          throw new EmptyContentError("DOCX");
        }

        const elapsed = Date.now() - context.startTime;
        logInfo(context, `DOCX 解析完成，耗时: ${elapsed}ms`);

        return text;
      } catch (docxError) {
        const errorMessage =
          docxError instanceof Error ? docxError.message : String(docxError);

        if (
          errorMessage.includes("corrupt") ||
          errorMessage.includes("Corrupt") ||
          errorMessage.includes("invalid")
        ) {
          throw new CorruptedFileError("DOCX", docxError instanceof Error ? docxError : undefined);
        }

        if (errorMessage.includes("password") || errorMessage.includes("encrypt")) {
          throw new DocumentParseError("DOCX 文件已加密或受保护，无法解析", "docx", docxError instanceof Error ? docxError : undefined);
        }

        throw docxError;
      }
    } catch (error) {
      if (error instanceof DocumentParseError) {
        throw error;
      }

      logError(context, "文本提取失败:", error);
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      throw new DocumentParseError(`DOCX 解析失败: ${errorMessage}`, "docx", error instanceof Error ? error : undefined);
    }
  },
};

export default docxParser;
