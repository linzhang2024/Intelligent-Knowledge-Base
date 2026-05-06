import { createReadStream, readFileSync, ReadStream } from "fs";
import { createInterface } from "readline";
import { PassThrough, Transform } from "stream";
import * as iconv from "iconv-lite";
import * as chardet from "chardet";
import { ParsedTable, SQLParseResult, ParseError, SQLDialect } from "../sqlParser/types";
import { EncodingType, CHINESE_ENCODINGS, removeBOM, normalizeNewlines } from "@/lib/encodingUtils";

export type { EncodingType };

const MULTI_LINE_COMMENT_REGEX = /\/\*[\s\S]*?\*\//g;
const SINGLE_LINE_COMMENT_REGEX = /--.*$/gm;

const STATEMENT_END_MARKERS = [";", "GO", "go"];

export interface StreamParseProgress {
  linesProcessed: number;
  statementsFound: number;
  tablesFound: number;
  currentBufferSize: number;
}

export interface StreamParseResult {
  tables: ParsedTable[];
  views: any[];
  functions: any[];
  procedures: any[];
  errors: ParseError[];
  progress: StreamParseProgress;
}

export class SQLStreamParser {
  private dialect: SQLDialect;
  private errors: ParseError[] = [];
  private tables: ParsedTable[] = [];
  private lineNumber: number = 0;
  private statementBuffer: string = "";
  private inMultiLineComment: boolean = false;
  private progress: StreamParseProgress = {
    linesProcessed: 0,
    statementsFound: 0,
    tablesFound: 0,
    currentBufferSize: 0,
  };

  private onProgress?: (progress: StreamParseProgress) => void;

  constructor(
    dialect: SQLDialect = "generic",
    onProgress?: (progress: StreamParseProgress) => void
  ) {
    this.dialect = dialect;
    this.onProgress = onProgress;
  }

  private detectFileEncoding(filePath: string, sampleSize: number = 64 * 1024): EncodingType {
    try {
      const sampleBuffer = readFileSync(filePath, { 
        flag: 'r', 
        encoding: null 
      } as any).slice(0, sampleSize);
      
      const detected = chardet.detect(sampleBuffer);
      
      if (!detected) {
        return "utf-8";
      }

      const detectedLower = detected.toLowerCase();

      if (detectedLower === "gbk" || detectedLower === "cp936") {
        return "gbk";
      } else if (detectedLower === "gb2312") {
        return "gb2312";
      } else if (detectedLower === "big5" || detectedLower === "cp950") {
        return "big5";
      } else if (detectedLower === "utf-8" || detectedLower === "utf8") {
        return "utf-8";
      } else if (detectedLower === "utf-16le" || detectedLower === "utf16le") {
        return "utf-16le";
      } else if (detectedLower === "utf-16be" || detectedLower === "utf16be") {
        return "utf-16be";
      }

      return "utf-8";
    } catch (error) {
      console.warn("[SQL流式解析] 编码检测失败，使用默认 UTF-8:", error);
      return "utf-8";
    }
  }

  private createDecodedStream(
    filePath: string, 
    encoding: EncodingType, 
    chunkSize: number = 64 * 1024
  ): NodeJS.ReadableStream {
    const rawStream = createReadStream(filePath, {
      highWaterMark: chunkSize,
    });

    if (
      CHINESE_ENCODINGS.has(encoding) || 
      encoding === "utf-16le" || 
      encoding === "utf-16be" ||
      encoding === "iso-8859-1" ||
      encoding === "windows-1252"
    ) {
      console.log(`[SQL流式解析] 使用编码转换: ${encoding} -> UTF-8`);
      const decodeStream = iconv.decodeStream(encoding);
      return rawStream.pipe(decodeStream);
    }

    if (encoding === "ascii") {
      console.log(`[SQL流式解析] 检测到ASCII编码，使用UTF-8模式读取`);
      return rawStream.setEncoding("utf-8");
    }

    console.log(`[SQL流式解析] 使用默认UTF-8编码`);
    return rawStream.setEncoding("utf-8");
  }

  async parseFromFile(filePath: string, chunkSize: number = 64 * 1024): Promise<StreamParseResult> {
    const encoding = this.detectFileEncoding(filePath);
    console.log(`[SQL流式解析] 检测到文件编码: ${encoding}`);

    return new Promise((resolve, reject) => {
      const decodedStream = this.createDecodedStream(filePath, encoding, chunkSize);

      const rl = createInterface({
        input: decodedStream,
        crlfDelay: Infinity,
      });

      rl.on("line", (line: string) => {
        this.lineNumber++;
        this.progress.linesProcessed = this.lineNumber;
        this.processLine(line);

        if (this.onProgress && this.lineNumber % 100 === 0) {
          this.onProgress({ ...this.progress });
        }
      });

      rl.on("close", () => {
        if (this.statementBuffer.trim()) {
          this.processStatement(this.statementBuffer);
        }

        if (this.onProgress) {
          this.onProgress({ ...this.progress });
        }

        resolve({
          tables: this.tables,
          views: [],
          functions: [],
          procedures: [],
          errors: this.errors,
          progress: this.progress,
        });
      });

      rl.on("error", (error) => {
        reject(error);
      });
    });
  }

  private processLine(line: string): void {
    let processedLine = line;

    if (this.lineNumber === 1) {
      processedLine = removeBOM(processedLine);
    }

    if (this.inMultiLineComment) {
      const commentEndIndex = processedLine.indexOf("*/");
      if (commentEndIndex !== -1) {
        processedLine = processedLine.substring(commentEndIndex + 2);
        this.inMultiLineComment = false;
      } else {
        return;
      }
    }

    const multiLineStart = processedLine.indexOf("/*");
    if (multiLineStart !== -1) {
      const multiLineEnd = processedLine.indexOf("*/", multiLineStart + 2);
      if (multiLineEnd === -1) {
        this.inMultiLineComment = true;
        processedLine = processedLine.substring(0, multiLineStart);
      } else {
        processedLine =
          processedLine.substring(0, multiLineStart) +
          processedLine.substring(multiLineEnd + 2);
      }
    }

    processedLine = processedLine.replace(SINGLE_LINE_COMMENT_REGEX, " ").trim();

    if (!processedLine) return;

    for (const marker of STATEMENT_END_MARKERS) {
      const markerIndex = processedLine.indexOf(marker);
      if (markerIndex !== -1) {
        const beforeMarker = processedLine.substring(0, markerIndex);
        const afterMarker = processedLine.substring(markerIndex + marker.length);

        this.statementBuffer += " " + beforeMarker;
        this.processStatement(this.statementBuffer);
        this.statementBuffer = "";

        if (afterMarker.trim()) {
          this.processLine(afterMarker);
        }
        return;
      }
    }

    this.statementBuffer += " " + processedLine;
    this.progress.currentBufferSize = this.statementBuffer.length;
  }

  private processStatement(statement: string): void {
    const trimmed = statement.trim();
    if (!trimmed) return;

    this.progress.statementsFound++;

    const upperTrimmed = trimmed.toUpperCase();

    if (upperTrimmed.includes("CREATE TABLE")) {
      this.parseCreateTableStatement(trimmed);
    } else if (upperTrimmed.includes("ALTER TABLE")) {
      this.parseAlterTableStatement(trimmed);
    }
  }

  private parseCreateTableStatement(sql: string): void {
    const createTableRegex = /CREATE\s+(?:TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`([^`]+)`\.`([^`]+)`|`([^`]+)`|"([^"]+)"\."([^"]+)"|"([^"]+)"|([^\s(,]+)\.([^\s(,]+)|([^\s(,]+))\s*\(([\s\S]*?)\)(?:\s*ENGINE\s*=\s*\w+)?(?:\s*DEFAULT\s+CHARSET\s*=\s*\w+)?(?:\s*COLLATE\s*=\s*\w+)?(?:\s*COMMENT\s*=\s*'([^']*)')?/i;

    const match = createTableRegex.exec(sql);
    if (match) {
      const table = this.parseTableDefinition(match);
      this.tables.push(table);
      this.progress.tablesFound = this.tables.length;
    }
  }

  private parseTableDefinition(match: RegExpExecArray): ParsedTable {
    const schemaName = match[1] || match[4] || match[7];
    const tableName = match[2] || match[3] || match[5] || match[6] || match[8] || match[9];
    const columnDefinitions = match[10];
    const tableComment = match[11];

    const columns: any[] = [];
    const primaryKeys: string[] = [];
    const foreignKeys: any[] = [];
    const indexes: any[] = [];

    if (columnDefinitions) {
      const parts = this.splitColumnDefinitions(columnDefinitions);
      let ordinalPosition = 1;

      for (const part of parts) {
        const trimmedPart = part.trim();
        if (!trimmedPart) continue;

        if (trimmedPart.toUpperCase().startsWith("PRIMARY KEY")) {
          const pkColumns = this.parsePrimaryKeyDefinition(trimmedPart);
          primaryKeys.push(...pkColumns);
        } else if (trimmedPart.toUpperCase().startsWith("FOREIGN KEY")) {
          const fk = this.parseForeignKeyDefinition(trimmedPart);
          if (fk) foreignKeys.push(fk);
        } else if (!trimmedPart.toUpperCase().startsWith("CONSTRAINT")) {
          const column = this.parseColumnDefinition(trimmedPart, ordinalPosition);
          if (column) {
            columns.push(column);
            if (column.isPrimaryKey) {
              primaryKeys.push(column.name);
            }
            ordinalPosition++;
          }
        } else if (trimmedPart.toUpperCase().includes("FOREIGN KEY")) {
          const fk = this.parseConstraintForeignKey(trimmedPart);
          if (fk) foreignKeys.push(fk);
        }
      }
    }

    return {
      name: tableName,
      schemaName,
      comment: tableComment,
      databaseName: undefined,
      columns,
      primaryKeys,
      foreignKeys,
      indexes,
    };
  }

  private splitColumnDefinitions(definitions: string): string[] {
    const parts: string[] = [];
    let current = "";
    let parenthesisDepth = 0;
    let inString = false;
    let stringChar = "";

    for (let i = 0; i < definitions.length; i++) {
      const char = definitions[i];

      if (!inString && (char === "'" || char === '"')) {
        inString = true;
        stringChar = char;
        current += char;
      } else if (inString && char === stringChar) {
        inString = false;
        current += char;
      } else if (!inString) {
        if (char === "(") {
          parenthesisDepth++;
          current += char;
        } else if (char === ")") {
          parenthesisDepth--;
          current += char;
        } else if (char === "," && parenthesisDepth === 0) {
          if (current.trim()) {
            parts.push(current.trim());
          }
          current = "";
        } else {
          current += char;
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  private parseColumnDefinition(definition: string, ordinalPosition: number): any | null {
    const trimmed = definition.trim();
    if (!trimmed) return null;

    const nameMatch = trimmed.match(/^`([^`]+)`|"([^"]+)"|([^\s(]+)/);
    if (!nameMatch) return null;

    const name = nameMatch[1] || nameMatch[2] || nameMatch[3];
    const remaining = trimmed.substring(nameMatch[0].length).trim();

    const typeMatch = remaining.match(/^([A-Za-z]+(?:\s+VARYING)?)(?:\s*\((\d+(?:,\s*\d+)?)\))?(?:\s+(UNSIGNED|ZEROFILL))*(?:\s+(CHARACTER SET|COLLATE)\s+[\w_]+)?/i);
    let dataType = "UNKNOWN";
    let columnType: string | undefined;
    let isAutoIncrement = false;
    let isPrimaryKey = false;
    let isNullable = true;
    let defaultValue: string | undefined;
    let comment: string | undefined;

    if (typeMatch) {
      dataType = typeMatch[1].toUpperCase();
      if (typeMatch[2]) {
        columnType = `${dataType}(${typeMatch[2]})`;
      } else {
        columnType = dataType;
      }

      const afterType = remaining.substring(typeMatch[0].length).trim();

      const autoIncrementMatch = afterType.match(/AUTO_INCREMENT|IDENTITY/i);
      isAutoIncrement = !!autoIncrementMatch;

      const primaryKeyMatch = afterType.match(/PRIMARY\s+KEY/i);
      isPrimaryKey = !!primaryKeyMatch;

      const notNullMatch = afterType.match(/NOT\s+NULL/i);
      isNullable = !notNullMatch;

      const defaultMatch = afterType.match(/DEFAULT\s+(?:'([^']*)'|"([^"]*)"|([^\s,]+))/i);
      if (defaultMatch) {
        defaultValue = defaultMatch[1] || defaultMatch[2] || defaultMatch[3];
      }

      const commentMatch = afterType.match(/COMMENT\s+(?:'([^']*)'|"([^"]*)")/i);
      if (commentMatch) {
        comment = commentMatch[1] || commentMatch[2];
      }
    }

    return {
      name,
      dataType,
      columnType,
      isNullable,
      isPrimaryKey,
      isAutoIncrement,
      defaultValue,
      comment,
      ordinalPosition,
    };
  }

  private parsePrimaryKeyDefinition(definition: string): string[] {
    const columns: string[] = [];
    const columnsMatch = definition.match(/\(([^)]+)\)/);
    if (columnsMatch) {
      const columnList = columnsMatch[1].split(",");
      for (const col of columnList) {
        const trimmed = col.trim().replace(/^[`"]|[`"]$/g, "");
        if (trimmed) columns.push(trimmed);
      }
    }
    return columns;
  }

  private parseForeignKeyDefinition(definition: string): any | null {
    const fkColumnMatch = definition.match(/FOREIGN\s+KEY\s*\(([^)]+)\)/i);
    const refTableMatch = definition.match(/REFERENCES\s+(?:`([^`]+)`|"([^"]+)"|([^\s(]+))(?:\s*\(([^)]+)\))?/i);

    if (!fkColumnMatch || !refTableMatch) return null;

    const fkColumn = fkColumnMatch[1].trim().replace(/^[`"]|[`"]$/g, "");
    const refTable = refTableMatch[1] || refTableMatch[2] || refTableMatch[3];
    const refColumn = refTableMatch[4]?.trim().replace(/^[`"]|[`"]$/g, "") || "id";

    const constraintMatch = definition.match(/CONSTRAINT\s+(?:`([^`]+)`|"([^"]+)"|([^\s]+))/i);
    const constraintName = constraintMatch ? (constraintMatch[1] || constraintMatch[2] || constraintMatch[3]) : undefined;

    return {
      constraintName,
      columnName: fkColumn,
      referencedTableName: refTable,
      referencedColumnName: refColumn,
      onDelete: undefined,
      onUpdate: undefined,
    };
  }

  private parseConstraintForeignKey(definition: string): any | null {
    return this.parseForeignKeyDefinition(definition);
  }

  private parseAlterTableStatement(sql: string): void {
    const alterTableRegex = /ALTER\s+TABLE\s+(?:`([^`]+)`|"([^"]+)"|([^\s]+))\s+(?:ADD|MODIFY|CHANGE|DROP|RENAME|ADD\s+CONSTRAINT)([^;]+)/i;

    const match = alterTableRegex.exec(sql);
    if (!match) return;

    const tableName = match[1] || match[2] || match[3];
    const alterContent = match[4];

    const table = this.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
    if (!table) return;

    const addForeignKeyMatch = alterContent.match(/ADD\s+(?:CONSTRAINT\s+(?:`([^`]+)`|"([^"]+)"|([^\s]+))\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:`([^`]+)`|"([^"]+)"|([^\s(]+))\s*\(([^)]+)\)/i);

    if (addForeignKeyMatch) {
      const constraintName = addForeignKeyMatch[1] || addForeignKeyMatch[2] || addForeignKeyMatch[3];
      const fkColumn = addForeignKeyMatch[4]?.trim().replace(/^[`"]|[`"]$/g, "");
      const refTable = addForeignKeyMatch[5] || addForeignKeyMatch[6] || addForeignKeyMatch[7];
      const refColumn = addForeignKeyMatch[8]?.trim().replace(/^[`"]|[`"]$/g, "");

      if (fkColumn && refTable && refColumn) {
        table.foreignKeys.push({
          constraintName,
          columnName: fkColumn,
          referencedTableName: refTable,
          referencedColumnName: refColumn,
          onDelete: undefined,
          onUpdate: undefined,
        });
      }
    }

    const addPrimaryKeyMatch = alterContent.match(/ADD\s+PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (addPrimaryKeyMatch) {
      const pkColumns = addPrimaryKeyMatch[1].split(",").map(c => c.trim().replace(/^[`"]|[`"]$/g, ""));
      table.primaryKeys.push(...pkColumns);
      for (const pkCol of pkColumns) {
        const col = table.columns.find(c => c.name.toLowerCase() === pkCol.toLowerCase());
        if (col) col.isPrimaryKey = true;
      }
    }
  }
}

export async function parseSQLStream(
  filePath: string,
  dialect: SQLDialect = "generic",
  onProgress?: (progress: StreamParseProgress) => void
): Promise<StreamParseResult> {
  const parser = new SQLStreamParser(dialect, onProgress);
  return parser.parseFromFile(filePath);
}
