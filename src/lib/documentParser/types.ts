export type DocumentType = "pdf" | "docx" | "txt";

export interface ParseResult {
  text: string;
  fileType: DocumentType;
}

export interface ParserContext {
  parserType: DocumentType;
  filePath: string;
  startTime: number;
}

export class DocumentParseError extends Error {
  public readonly parserType?: DocumentType;
  public readonly cause?: Error;

  constructor(message: string, parserType?: DocumentType, cause?: Error) {
    super(message);
    this.name = "DocumentParseError";
    this.parserType = parserType;
    this.cause = cause;
    Object.setPrototypeOf(this, DocumentParseError.prototype);
  }
}

export class EncryptedPDFError extends DocumentParseError {
  constructor(cause?: Error) {
    super("PDF 文件已加密，无法解析，请提供未加密的文件", "pdf", cause);
    this.name = "EncryptedPDFError";
    Object.setPrototypeOf(this, EncryptedPDFError.prototype);
  }
}

export class ScannedPDFError extends DocumentParseError {
  constructor(cause?: Error) {
    super("PDF 文件为扫描版（仅图片），无法提取文本，请提供可编辑的 PDF 文档", "pdf", cause);
    this.name = "ScannedPDFError";
    Object.setPrototypeOf(this, ScannedPDFError.prototype);
  }
}

export class CorruptedFileError extends DocumentParseError {
  constructor(fileType: DocumentType | string, cause?: Error) {
    super(`${fileType} 文件已损坏，无法解析，请检查文件完整性`, fileType as DocumentType, cause);
    this.name = "CorruptedFileError";
    Object.setPrototypeOf(this, CorruptedFileError.prototype);
  }
}

export class UnsupportedFormatError extends DocumentParseError {
  constructor(format: string, cause?: Error) {
    super(`不支持的文件格式 "${format}"，仅支持 PDF、DOCX、TXT 格式`, undefined, cause);
    this.name = "UnsupportedFormatError";
    Object.setPrototypeOf(this, UnsupportedFormatError.prototype);
  }
}

export class EmptyContentError extends DocumentParseError {
  constructor(fileType: DocumentType | string, cause?: Error) {
    super(`解析失败:${fileType} 内容为空`, fileType as DocumentType, cause);
    this.name = "EmptyContentError";
    Object.setPrototypeOf(this, EmptyContentError.prototype);
  }
}

export interface Parser {
  type: DocumentType;
  parse(filePath: string): Promise<string>;
}
