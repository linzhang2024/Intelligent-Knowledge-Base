import { readFile } from "fs/promises";
import {
  DocumentParseError,
  CorruptedFileError,
  EmptyContentError,
  Parser,
  ParserContext,
} from "./types";
import { decodeFileWithRetry, cleanText } from "@/lib/encodingUtils";

function logInfo(context: ParserContext, message: string): void {
  console.log(`[${context.parserType.toUpperCase()}解析器] [${context.filePath}] ${message}`);
}

function logError(context: ParserContext, message: string, error?: unknown): void {
  console.error(`[${context.parserType.toUpperCase()}解析器] [${context.filePath}] ${message}`, error || "");
}

function logWarn(context: ParserContext, message: string, error?: unknown): void {
  console.warn(`[${context.parserType.toUpperCase()}解析器] [${context.filePath}] ${message}`, error || "");
}

export const txtParser: Parser = {
  type: "txt",

  async parse(filePath: string): Promise<string> {
    const context: ParserContext = {
      parserType: "txt",
      filePath,
      startTime: Date.now(),
    };

    try {
      logInfo(context, "开始解析 TXT 文件");

      const decodeResult = await decodeFileWithRetry(filePath);
      
      logInfo(context, `文件编码检测: ${decodeResult.originalEncoding}, 转码: ${decodeResult.hadConversion ? "是" : "否"}, 非法字符: ${decodeResult.invalidByteCount}`);
      
      const content = cleanText(decodeResult.text);

      logInfo(context, `TXT 解析完成，文本长度: ${content.length}`);

      const trimmedContent = content.trim();
      if (trimmedContent.length < 10) {
        logWarn(context, `TXT 文件内容过短或为空，长度: ${trimmedContent.length}`);
        throw new EmptyContentError("TXT");
      }

      const elapsed = Date.now() - context.startTime;
      logInfo(context, `TXT 解析完成，耗时: ${elapsed}ms`);

      return content;
    } catch (error) {
      if (error instanceof DocumentParseError) {
        throw error;
      }

      logError(context, "文本提取失败:", error);

      if (error instanceof Error && error.message.includes("encoding")) {
        throw new DocumentParseError("TXT 文件编码不支持，请使用 UTF-8 编码", "txt", error);
      }

      throw new CorruptedFileError("TXT", error instanceof Error ? error : undefined);
    }
  },
};

export default txtParser;
