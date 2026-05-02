import {
  DocumentParseError,
  EncryptedPDFError,
  ScannedPDFError,
  CorruptedFileError,
  UnsupportedFormatError,
  EmptyContentError,
  DocumentType,
  ParseResult,
  Parser,
} from "./types";
import { pdfParser } from "./pdfParser";
import { docxParser } from "./docxParser";
import { txtParser } from "./txtParser";
import { sqlParser, detectSQLDialect } from "./sqlParser";

const parsers: Record<DocumentType, Parser> = {
  pdf: pdfParser,
  docx: docxParser,
  txt: txtParser,
  sql: sqlParser,
};

function getParser(fileType: DocumentType): Parser {
  const parser = parsers[fileType];
  if (!parser) {
    throw new UnsupportedFormatError(fileType);
  }
  return parser;
}

export function getDocumentTypeFromExtension(extension: string): DocumentType {
  const ext = extension.toLowerCase().replace(/^\./, "");
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "txt") return "txt";
  if (ext === "sql") return "sql";
  throw new UnsupportedFormatError(extension);
}

export function getDocumentTypeFromMimeType(mimeType: string): DocumentType | null {
  const type = mimeType.toLowerCase();
  if (type === "application/pdf") return "pdf";
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    return "docx";
  if (type === "text/plain") return "txt";
  if (type === "application/sql" || type === "text/sql" || type === "application/x-sql")
    return "sql";
  return null;
}

export async function parseDocument(
  filePath: string,
  fileType: DocumentType
): Promise<ParseResult> {
  console.log(`[文档解析器] 开始解析文档，类型: ${fileType}, 路径: ${filePath}`);

  const parser = getParser(fileType);

  const text = await parser.parse(filePath);

  return {
    text,
    fileType,
  };
}

export async function extractTextFromPDF(filePath: string): Promise<string> {
  return pdfParser.parse(filePath);
}

export async function extractTextFromDOCX(filePath: string): Promise<string> {
  return docxParser.parse(filePath);
}

export async function extractTextFromTXT(filePath: string): Promise<string> {
  return txtParser.parse(filePath);
}

export async function extractTextFromSQL(filePath: string): Promise<string> {
  return sqlParser.parse(filePath);
}

export function validatePDFHeader(buffer: Buffer): boolean {
  if (buffer.length < 5) {
    return false;
  }
  const header = buffer.slice(0, 5).toString("ascii");
  return header === "%PDF-";
}

export {
  DocumentParseError,
  EncryptedPDFError,
  ScannedPDFError,
  CorruptedFileError,
  UnsupportedFormatError,
  EmptyContentError,
  sqlParser,
  detectSQLDialect,
};

export type { DocumentType, ParseResult };

export { pdfParser, docxParser, txtParser };
