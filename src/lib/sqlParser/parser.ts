import {
  ParsedTable,
  ParsedColumn,
  ParsedForeignKey,
  ParsedIndex,
  ParsedView,
  ParsedFunction,
  ParsedProcedure,
  FunctionParameter,
  SQLParseResult,
  ParseError,
  SQLDialect,
} from "./types";

const MULTI_LINE_COMMENT_REGEX = /\/\*[\s\S]*?\*\//g;
const SINGLE_LINE_COMMENT_REGEX = /--.*$/gm;
const STRING_LITERAL_REGEX = /'[^']*'(?:'[^']*')*/g;

export class SQLParser {
  private dialect: SQLDialect;
  private errors: ParseError[] = [];

  constructor(dialect: SQLDialect = "generic") {
    this.dialect = dialect;
  }

  parse(sql: string): SQLParseResult {
    this.errors = [];
    const normalizedSQL = this.normalizeSQL(sql);

    const tables = this.parseCreateTableStatements(normalizedSQL);
    const views = this.parseCreateViewStatements(normalizedSQL);
    const functions = this.parseCreateFunctionStatements(normalizedSQL);
    const procedures = this.parseCreateProcedureStatements(normalizedSQL);

    this.parseAlterTableStatements(normalizedSQL, tables);

    return {
      tables,
      views,
      functions,
      procedures,
      rawSQL: sql,
      errors: this.errors,
    };
  }

  private normalizeSQL(sql: string): string {
    let normalized = sql.replace(MULTI_LINE_COMMENT_REGEX, " ");
    normalized = normalized.replace(SINGLE_LINE_COMMENT_REGEX, " ");
    normalized = normalized.replace(/\s+/g, " ").trim();
    return normalized;
  }

  private parseCreateTableStatements(sql: string): ParsedTable[] {
    const tables: ParsedTable[] = [];
    const createTableRegex = /CREATE\s+(?:TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`([^`]+)`\.`([^`]+)`|`([^`]+)`|"([^"]+)"\."([^"]+)"|"([^"]+)"|([^\s(,]+)\.([^\s(,]+)|([^\s(,]+))\s*\(([\s\S]*?)\)(?:\s*ENGINE\s*=\s*\w+)?(?:\s*DEFAULT\s+CHARSET\s*=\s*\w+)?(?:\s*COLLATE\s*=\s*\w+)?(?:\s*COMMENT\s*=\s*'([^']*)')?\s*;/gi;

    let match;
    while ((match = createTableRegex.exec(sql)) !== null) {
      const table = this.parseTableDefinition(match);
      tables.push(table);
    }

    return tables;
  }

  private parseTableDefinition(match: RegExpExecArray): ParsedTable {
    const fullMatch = match[0];
    const schemaName = match[1] || match[4] || match[7];
    const tableName = match[2] || match[3] || match[5] || match[6] || match[8] || match[9];
    const columnDefinitions = match[10];
    const tableComment = match[11];

    const columns: ParsedColumn[] = [];
    const primaryKeys: string[] = [];
    const foreignKeys: ParsedForeignKey[] = [];
    const indexes: ParsedIndex[] = [];

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
        } else if (trimmedPart.toUpperCase().startsWith("INDEX") || trimmedPart.toUpperCase().startsWith("KEY")) {
          const idx = this.parseIndexDefinition(trimmedPart);
          if (idx) indexes.push(idx);
        } else if (trimmedPart.toUpperCase().startsWith("UNIQUE")) {
          const idx = this.parseIndexDefinition(trimmedPart, true);
          if (idx) indexes.push(idx);
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

  private parseColumnDefinition(definition: string, ordinalPosition: number): ParsedColumn | null {
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

  private parseForeignKeyDefinition(definition: string): ParsedForeignKey | null {
    const fkColumnMatch = definition.match(/FOREIGN\s+KEY\s*\(([^)]+)\)/i);
    const refTableMatch = definition.match(/REFERENCES\s+(?:`([^`]+)`|"([^"]+)"|([^\s(]+))(?:\s*\(([^)]+)\))?/i);

    if (!fkColumnMatch || !refTableMatch) return null;

    const fkColumn = fkColumnMatch[1].trim().replace(/^[`"]|[`"]$/g, "");
    const refTable = refTableMatch[1] || refTableMatch[2] || refTableMatch[3];
    const refColumn = refTableMatch[4]?.trim().replace(/^[`"]|[`"]$/g, "") || "id";

    const constraintMatch = definition.match(/CONSTRAINT\s+(?:`([^`]+)`|"([^"]+)"|([^\s]+))/i);
    const constraintName = constraintMatch ? (constraintMatch[1] || constraintMatch[2] || constraintMatch[3]) : undefined;

    const onDeleteMatch = definition.match(/ON\s+DELETE\s+(CASCADE|SET\s+NULL|NO\s+ACTION|RESTRICT|SET\s+DEFAULT)/i);
    const onUpdateMatch = definition.match(/ON\s+UPDATE\s+(CASCADE|SET\s+NULL|NO\s+ACTION|RESTRICT|SET\s+DEFAULT)/i);

    return {
      constraintName,
      columnName: fkColumn,
      referencedTableName: refTable,
      referencedColumnName: refColumn,
      onDelete: onDeleteMatch ? onDeleteMatch[1] : undefined,
      onUpdate: onUpdateMatch ? onUpdateMatch[1] : undefined,
    };
  }

  private parseConstraintForeignKey(definition: string): ParsedForeignKey | null {
    return this.parseForeignKeyDefinition(definition);
  }

  private parseIndexDefinition(definition: string, isUnique: boolean = false): ParsedIndex | null {
    const indexNameMatch = definition.match(/(?:INDEX|KEY|UNIQUE(?:\s+INDEX)?)\s+(?:`([^`]+)`|"([^"]+)"|([^\s(]+))/i);
    const columnsMatch = definition.match(/\(([^)]+)\)/);

    if (!columnsMatch) return null;

    const indexName = indexNameMatch ? (indexNameMatch[1] || indexNameMatch[2] || indexNameMatch[3]) : "idx_" + Date.now();
    const columns: string[] = [];

    const columnList = columnsMatch[1].split(",");
    for (const col of columnList) {
      const trimmed = col.trim().replace(/^[`"]|[`"]$/g, "").replace(/\s+(ASC|DESC)$/i, "");
      if (trimmed) columns.push(trimmed);
    }

    const uniqueMatch = definition.match(/UNIQUE/i);
    const isUniqueIndex = isUnique || !!uniqueMatch;

    return {
      name: indexName,
      columns,
      isUnique: isUniqueIndex,
      isPrimary: false,
    };
  }

  private parseAlterTableStatements(sql: string, tables: ParsedTable[]): void {
    const alterTableRegex = /ALTER\s+TABLE\s+(?:`([^`]+)`|"([^"]+)"|([^\s]+))\s+(?:ADD|MODIFY|CHANGE|DROP|RENAME|ADD\s+CONSTRAINT)([^;]+);/gi;

    let match;
    while ((match = alterTableRegex.exec(sql)) !== null) {
      const tableName = match[1] || match[2] || match[3];
      const alterContent = match[4];

      const table = tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
      if (!table) continue;

      const addForeignKeyMatch = alterContent.match(/ADD\s+(?:CONSTRAINT\s+(?:`([^`]+)`|"([^"]+)"|([^\s]+))\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:`([^`]+)`|"([^"]+)"|([^\s(]+))\s*\(([^)]+)\)(?:\s+ON\s+(DELETE|UPDATE)\s+(CASCADE|SET\s+NULL|NO\s+ACTION|RESTRICT))?/i);

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
            onDelete: addForeignKeyMatch[9] === "DELETE" ? addForeignKeyMatch[10] : undefined,
            onUpdate: addForeignKeyMatch[9] === "UPDATE" ? addForeignKeyMatch[10] : undefined,
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

      const addCommentMatch = alterContent.match(/COMMENT\s*=\s*(?:'([^']*)'|"([^"]*)")/i);
      if (addCommentMatch && !table.comment) {
        table.comment = addCommentMatch[1] || addCommentMatch[2];
      }
    }
  }

  private parseCreateViewStatements(sql: string): ParsedView[] {
    const views: ParsedView[] = [];
    const createViewRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP(?:ORARY)?\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`([^`]+)`\.`([^`]+)`|`([^`]+)`|"([^"]+)"\."([^"]+)"|"([^"]+)"|([^\s(]+)\.([^\s(]+)|([^\s(,]+))\s*(?:\(([^)]+)\))?\s+AS\s+([\s\S]*?)(?:\s+(?:WITH\s+(?:CASCADED|LOCAL)\s+CHECK\s+OPTION|CHECK\s+OPTION))?\s*;/gi;

    let match;
    while ((match = createViewRegex.exec(sql)) !== null) {
      const schemaName = match[1] || match[4] || match[7];
      const viewName = match[2] || match[3] || match[5] || match[6] || match[8] || match[9];
      const columnsPart = match[10];
      const definition = match[11];

      const columns: string[] = [];
      if (columnsPart) {
        const colList = columnsPart.split(",");
        for (const col of colList) {
          const trimmed = col.trim().replace(/^[`"]|[`"]$/g, "");
          if (trimmed) columns.push(trimmed);
        }
      }

      views.push({
        name: viewName,
        schemaName,
        definition: definition?.trim() || "",
        columns,
        comment: undefined,
      });
    }

    return views;
  }

  private parseCreateFunctionStatements(sql: string): ParsedFunction[] {
    const functions: ParsedFunction[] = [];
    return functions;
  }

  private parseCreateProcedureStatements(sql: string): ParsedProcedure[] {
    const procedures: ParsedProcedure[] = [];
    return procedures;
  }
}

export function parseSQL(sql: string, dialect: SQLDialect = "generic"): SQLParseResult {
  const parser = new SQLParser(dialect);
  return parser.parse(sql);
}

export function extractTableMetadata(sql: string): { tables: ParsedTable[]; relations: ParsedForeignKey[] } {
  const result = parseSQL(sql);
  const allRelations: ParsedForeignKey[] = [];

  for (const table of result.tables) {
    for (const fk of table.foreignKeys) {
      allRelations.push({
        ...fk,
        columnName: `${table.name}.${fk.columnName}`,
      });
    }
  }

  return {
    tables: result.tables,
    relations: allRelations,
  };
}
