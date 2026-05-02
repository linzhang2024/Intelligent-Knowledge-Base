import { Parser, DocumentType, ParseResult, DocumentParseError } from "./types";
import { readFile } from "fs/promises";

export const sqlParser: Parser = {
  type: "sql",
  async parse(filePath: string): Promise<string> {
    try {
      const content = await readFile(filePath, "utf-8");
      return content;
    } catch (error) {
      if (error instanceof Error) {
        throw new DocumentParseError(`SQL文件读取失败: ${error.message}`, "sql", error);
      }
      throw new DocumentParseError("SQL文件读取失败", "sql");
    }
  },
};

export async function parseSQLFile(filePath: string): Promise<ParseResult> {
  const text = await sqlParser.parse(filePath);
  return {
    text,
    fileType: "sql",
  };
}

export function detectSQLDialect(content: string): "mysql" | "postgresql" | "sqlite" | "generic" {
  const lowerContent = content.toLowerCase();

  if (lowerContent.includes("engine=") ||
      lowerContent.includes("auto_increment") ||
      lowerContent.includes("unsigned") ||
      lowerContent.includes("limit ") ||
      lowerContent.includes("show tables")) {
    return "mysql";
  }

  if (lowerContent.includes("serial") ||
      lowerContent.includes("nextval") ||
      lowerContent.includes("schema") ||
      lowerContent.includes("::regclass") ||
      lowerContent.includes("plpgsql")) {
    return "postgresql";
  }

  if (lowerContent.includes("sqlite_") ||
      lowerContent.includes("autoincrement") ||
      (lowerContent.includes("integer primary key") && !lowerContent.includes("auto_increment"))) {
    return "sqlite";
  }

  return "generic";
}
