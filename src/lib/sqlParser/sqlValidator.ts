export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning" | "info";
  rule: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  infos: ValidationError[];
  syntaxCheck: boolean;
  tableReferences: TableReferenceCheck[];
  columnReferences: ColumnReferenceCheck[];
}

export interface TableReferenceCheck {
  tableName: string;
  alias?: string;
  exists: boolean;
  line: number;
}

export interface ColumnReferenceCheck {
  columnName: string;
  tableName?: string;
  exists: boolean;
  line: number;
}

const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "GROUP", "BY", "HAVING", "ORDER", "LIMIT", "OFFSET",
  "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL", "CROSS", "ON", "USING",
  "AND", "OR", "NOT", "IN", "LIKE", "BETWEEN", "IS", "NULL", "EXISTS",
  "UNION", "ALL", "DISTINCT", "AS", "CASE", "WHEN", "THEN", "ELSE", "END",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "TABLE",
  "ALTER", "DROP", "TRUNCATE", "COMMENT", "INDEX", "CONSTRAINT", "PRIMARY", "FOREIGN",
  "KEY", "REFERENCES", "UNIQUE", "CHECK", "DEFAULT", "AUTO_INCREMENT", "IDENTITY",
  "AVG", "COUNT", "MAX", "MIN", "SUM", "FIRST", "LAST", "UPPER", "LOWER",
  "ROUND", "COALESCE", "IFNULL", "NULLIF", "CAST", "CONVERT",
  "CURRENT_DATE", "CURRENT_TIME", "CURRENT_TIMESTAMP", "NOW", "DATE", "TIME",
];

const AGGREGATE_FUNCTIONS = ["AVG", "COUNT", "MAX", "MIN", "SUM", "FIRST", "LAST", "STDDEV", "VARIANCE"];

export class SQLValidator {
  private knownTables: Map<string, string[]> = new Map();

  constructor(tables?: Array<{ name: string; columns: string[] }>) {
    if (tables) {
      for (const table of tables) {
        this.knownTables.set(table.name.toLowerCase(), table.columns.map(c => c.toLowerCase()));
      }
    }
  }

  setKnownTables(tables: Array<{ name: string; columns: string[] }>): void {
    this.knownTables.clear();
    for (const table of tables) {
      this.knownTables.set(table.name.toLowerCase(), table.columns.map(c => c.toLowerCase()));
    }
  }

  validate(sql: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const infos: ValidationError[] = [];
    const tableReferences: TableReferenceCheck[] = [];
    const columnReferences: ColumnReferenceCheck[] = [];

    const lines = sql.split("\n");

    this.checkBasicSyntax(sql, lines, errors, warnings);
    this.checkUnclosedComments(sql, lines, errors);
    this.checkUnclosedStrings(sql, lines, errors);
    this.checkTableReferences(sql, lines, tableReferences, errors);
    this.checkColumnReferences(sql, lines, columnReferences, errors, warnings);
    this.checkAggregateUsage(sql, lines, errors, warnings);
    this.checkOrderByWithGroupBy(sql, lines, errors);
    this.checkLimitUsage(sql, lines, warnings);
    this.checkPerformanceIssues(sql, lines, infos);
    this.checkStyleIssues(sql, lines, infos);

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      infos,
      syntaxCheck: isValid,
      tableReferences,
      columnReferences,
    };
  }

  private checkBasicSyntax(
    sql: string,
    lines: string[],
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    const upperSQL = sql.toUpperCase().trim();

    if (!upperSQL) {
      errors.push({
        line: 1,
        column: 1,
        message: "SQL语句为空",
        severity: "error",
        rule: "EMPTY_SQL",
      });
      return;
    }

    const validStarters = ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "WITH"];
    const hasValidStart = validStarters.some(s => upperSQL.startsWith(s));
    
    if (!hasValidStart) {
      warnings.push({
        line: 1,
        column: 1,
        message: "SQL语句可能缺少有效的开头关键字",
        severity: "warning",
        rule: "INVALID_START",
        suggestion: "SELECT语句应以SELECT开头",
      });
    }

    if (upperSQL.includes("SELECT")) {
      if (!upperSQL.includes("FROM")) {
        warnings.push({
          line: 1,
          column: 1,
          message: "SELECT语句缺少FROM子句",
          severity: "warning",
          rule: "MISSING_FROM",
        });
      }
    }

    const openParens = (sql.match(/\(/g) || []).length;
    const closeParens = (sql.match(/\)/g) || []).length;
    
    if (openParens !== closeParens) {
      errors.push({
        line: this.findParenthesisLine(lines, openParens > closeParens),
        column: 1,
        message: `括号不匹配: 有 ${openParens} 个左括号, ${closeParens} 个右括号`,
        severity: "error",
        rule: "PARENTHESIS_MISMATCH",
      });
    }
  }

  private findParenthesisLine(lines: string[], isOpen: boolean): number {
    const char = isOpen ? "(" : ")";
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes(char)) {
        return i + 1;
      }
    }
    return 1;
  }

  private checkUnclosedComments(
    sql: string,
    lines: string[],
    errors: ValidationError[]
  ): void {
    const multiLineStarts = (sql.match(/\/\*/g) || []).length;
    const multiLineEnds = (sql.match(/\*\//g) || []).length;
    
    if (multiLineStarts !== multiLineEnds) {
      errors.push({
        line: 1,
        column: 1,
        message: "多行注释未正确关闭",
        severity: "error",
        rule: "UNCLOSED_COMMENT",
      });
    }
  }

  private checkUnclosedStrings(
    sql: string,
    lines: string[],
    errors: ValidationError[]
  ): void {
    let inString = false;
    let stringChar = "";
    let stringStartLine = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (!inString && (char === "'" || char === '"')) {
          inString = true;
          stringChar = char;
          stringStartLine = lineIndex + 1;
        } else if (inString && char === stringChar) {
          if (line[i + 1] === stringChar) {
            i++;
          } else {
            inString = false;
          }
        }
      }
    }

    if (inString) {
      errors.push({
        line: stringStartLine,
        column: 1,
        message: "字符串字面量未正确关闭",
        severity: "error",
        rule: "UNCLOSED_STRING",
      });
    }
  }

  private checkTableReferences(
    sql: string,
    lines: string[],
    tableReferences: TableReferenceCheck[],
    errors: ValidationError[]
  ): void {
    if (this.knownTables.size === 0) return;

    const fromJoinRegex = /\b(?:FROM|JOIN|INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|OUTER\s+JOIN|CROSS\s+JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+(?:AS\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?/gi;

    let match;
    while ((match = fromJoinRegex.exec(sql)) !== null) {
      const tableName = match[1];
      const alias = match[2];
      const lineNum = this.getLineNumber(sql, match.index, lines);
      
      const exists = this.knownTables.has(tableName.toLowerCase());
      
      tableReferences.push({
        tableName,
        alias,
        exists,
        line: lineNum,
      });

      if (!exists) {
        const suggestions = this.findSimilarTableNames(tableName);
        errors.push({
          line: lineNum,
          column: 1,
          message: `表 "${tableName}" 不存在`,
          severity: "error",
          rule: "UNKNOWN_TABLE",
          suggestion: suggestions.length > 0 ? `是否是: ${suggestions.join(", ")}` : undefined,
        });
      }
    }
  }

  private checkColumnReferences(
    sql: string,
    lines: string[],
    columnReferences: ColumnReferenceCheck[],
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    if (this.knownTables.size === 0) return;

    const tableAliases = this.extractTableAliases(sql);
    
    const columnRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\b|(?<!\.)\b([a-zA-Z_][a-zA-Z0-9_]*)\b(?!\s*\()/g;

    let match;
    while ((match = columnRegex.exec(sql)) !== null) {
      const fullMatch = match[0];
      const withTable = match[1] && match[2];
      const tableName = withTable ? match[1] : null;
      const columnName = withTable ? match[2] : match[3];
      
      if (!columnName) continue;
      
      const upperColumnName = columnName.toUpperCase();
      if (SQL_KEYWORDS.includes(upperColumnName) || AGGREGATE_FUNCTIONS.includes(upperColumnName)) {
        continue;
      }

      const lineNum = this.getLineNumber(sql, match.index, lines);
      
      let exists = false;
      
      if (tableName) {
        const actualTable = tableAliases.get(tableName.toLowerCase()) || tableName;
        const columns = this.knownTables.get(actualTable.toLowerCase());
        exists = columns ? columns.includes(columnName.toLowerCase()) : false;
      } else {
        for (const columns of this.knownTables.values()) {
          if (columns.includes(columnName.toLowerCase())) {
            exists = true;
            break;
          }
        }
        
        if (!tableName && exists && this.knownTables.size > 1) {
          warnings.push({
            line: lineNum,
            column: 1,
            message: `列 "${columnName}" 没有指定表名，可能存在歧义`,
            severity: "warning",
            rule: "AMBIGUOUS_COLUMN",
            suggestion: "建议为列添加表名前缀",
          });
        }
      }

      columnReferences.push({
        columnName,
        tableName: tableName || undefined,
        exists,
        line: lineNum,
      });

      if (!exists && !withTable) {
        const similar = this.findSimilarColumnNames(columnName);
        if (similar.length > 0) {
          warnings.push({
            line: lineNum,
            column: 1,
            message: `列 "${columnName}" 可能不存在`,
            severity: "warning",
            rule: "UNKNOWN_COLUMN",
            suggestion: `是否是: ${similar.join(", ")}`,
          });
        }
      } else if (!exists) {
        errors.push({
          line: lineNum,
          column: 1,
          message: `表 "${tableName}" 中不存在列 "${columnName}"`,
          severity: "error",
          rule: "UNKNOWN_COLUMN_IN_TABLE",
        });
      }
    }
  }

  private extractTableAliases(sql: string): Map<string, string> {
    const aliases = new Map<string, string>();
    const aliasRegex = /\b(?:FROM|JOIN|INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+(?:AS\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?/gi;

    let match;
    while ((match = aliasRegex.exec(sql)) !== null) {
      const tableName = match[1];
      const alias = match[2];
      
      if (alias) {
        aliases.set(alias.toLowerCase(), tableName.toLowerCase());
      }
    }

    return aliases;
  }

  private checkAggregateUsage(
    sql: string,
    lines: string[],
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    const upperSQL = sql.toUpperCase();

    for (const aggFunc of AGGREGATE_FUNCTIONS) {
      const regex = new RegExp(`\\b${aggFunc}\\s*\\(\\s*\\*\\s*\\)`, "gi");
      let match;
      while ((match = regex.exec(sql)) !== null) {
        if (aggFunc === "COUNT") {
          warnings.push({
            line: this.getLineNumber(sql, match.index, lines),
            column: 1,
            message: `使用 ${aggFunc}(*) 可能效率较低`,
            severity: "warning",
            rule: "COUNT_STAR",
            suggestion: "考虑使用 COUNT(主键) 或 COUNT(1)",
          });
        }
      }
    }

    const selectRegex = /SELECT\s+([\s\S]+?)\s+FROM\s+/i;
    const selectMatch = selectRegex.exec(sql);
    
    if (selectMatch) {
      const selectClause = selectMatch[1];
      
      let hasAggregate = false;
      for (const aggFunc of AGGREGATE_FUNCTIONS) {
        if (selectClause.toUpperCase().includes(`${aggFunc}(`)) {
          hasAggregate = true;
          break;
        }
      }

      if (hasAggregate && !upperSQL.includes("GROUP BY")) {
        errors.push({
          line: 1,
          column: 1,
          message: "SELECT子句中使用了聚合函数，但缺少GROUP BY子句",
          severity: "error",
          rule: "MISSING_GROUP_BY",
          suggestion: "请添加GROUP BY子句或移除非聚合列",
        });
      }
    }
  }

  private checkOrderByWithGroupBy(
    sql: string,
    lines: string[],
    errors: ValidationError[]
  ): void {
    const upperSQL = sql.toUpperCase();
    
    if (upperSQL.includes("GROUP BY") && upperSQL.includes("ORDER BY")) {
      const groupByMatch = upperSQL.match(/GROUP\s+BY\s+([\s\S]+?)(?:\s+HAVING|\s+ORDER|\s+LIMIT|$)/i);
      const orderByMatch = upperSQL.match(/ORDER\s+BY\s+([\s\S]+?)(?:\s+LIMIT|$)/i);
      
      if (groupByMatch && orderByMatch) {
        const groupByColumns = groupByMatch[1].split(",").map(c => c.trim().toLowerCase());
        const orderByColumns = orderByMatch[1].split(",").map(c => {
          const col = c.trim().toLowerCase();
          return col.replace(/\s+(asc|desc)$/, "");
        });

        for (const orderCol of orderByColumns) {
          if (!groupByColumns.includes(orderCol) && !this.isAggregate(orderCol)) {
            errors.push({
              line: 1,
              column: 1,
              message: `ORDER BY 中的列 "${orderCol}" 不在 GROUP BY 子句中，也不是聚合函数`,
              severity: "error",
              rule: "INVALID_ORDER_BY",
            });
          }
        }
      }
    }
  }

  private checkLimitUsage(
    sql: string,
    lines: string[],
    warnings: ValidationError[]
  ): void {
    const upperSQL = sql.toUpperCase();
    
    if (upperSQL.includes("SELECT") && !upperSQL.includes("LIMIT") && !upperSQL.includes("TOP")) {
      warnings.push({
        line: 1,
        column: 1,
        message: "查询没有LIMIT限制，可能返回大量数据",
        severity: "warning",
        rule: "MISSING_LIMIT",
        suggestion: "建议添加LIMIT子句限制返回行数",
      });
    }
  }

  private checkPerformanceIssues(
    sql: string,
    lines: string[],
    infos: ValidationError[]
  ): void {
    const upperSQL = sql.toUpperCase();

    if (upperSQL.includes("SELECT *")) {
      infos.push({
        line: 1,
        column: 1,
        message: "使用 SELECT * 可能返回不必要的列",
        severity: "info",
        rule: "SELECT_ALL",
        suggestion: "建议明确列出需要的列名",
      });
    }

    const likeWithLeadingWildcard = /LIKE\s+['"]%/i;
    if (likeWithLeadingWildcard.test(sql)) {
      infos.push({
        line: 1,
        column: 1,
        message: "LIKE 查询使用前导通配符 (%)，可能无法使用索引",
        severity: "info",
        rule: "LIKE_LEADING_WILDCARD",
        suggestion: "考虑使用全文搜索或优化查询条件",
      });
    }

    if (upperSQL.includes("NOT IN")) {
      infos.push({
        line: 1,
        column: 1,
        message: "NOT IN 可能导致性能问题，特别是当子查询返回大量数据时",
        severity: "info",
        rule: "NOT_IN_USAGE",
        suggestion: "考虑使用 NOT EXISTS 或 LEFT JOIN",
      });
    }

    if (upperSQL.includes("DISTINCT")) {
      infos.push({
        line: 1,
        column: 1,
        message: "使用 DISTINCT 进行去重可能影响性能",
        severity: "info",
        rule: "DISTINCT_USAGE",
        suggestion: "检查是否可以通过优化查询避免 DISTINCT",
      });
    }
  }

  private checkStyleIssues(
    sql: string,
    lines: string[],
    infos: ValidationError[]
  ): void {
    const keywords = ["SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "JOIN", "ON", "AND", "OR"];
    
    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      const escapedKeyword = keyword.replace(/\s+/g, "\\s+");
      const regex = new RegExp(`\\b${escapedKeyword}\\b`, "gi");
      
      let match;
      while ((match = regex.exec(sql)) !== null) {
        const matched = match[0];
        if (matched !== keyword && matched !== keyword.toUpperCase()) {
          infos.push({
            line: this.getLineNumber(sql, match.index, lines),
            column: 1,
            message: `关键字 "${matched}" 建议使用大写格式 "${keyword.toUpperCase()}"`,
            severity: "info",
            rule: "KEYWORD_CASE",
          });
        }
      }
    }
  }

  private getLineNumber(sql: string, index: number, lines: string[]): number {
    let currentPos = 0;
    for (let i = 0; i < lines.length; i++) {
      currentPos += lines[i].length + 1;
      if (currentPos > index) {
        return i + 1;
      }
    }
    return lines.length;
  }

  private findSimilarTableNames(name: string): string[] {
    const similar: string[] = [];
    const lowerName = name.toLowerCase();
    
    for (const tableName of this.knownTables.keys()) {
      if (tableName.includes(lowerName) || lowerName.includes(tableName)) {
        similar.push(tableName);
      }
      
      const distance = this.levenshteinDistance(lowerName, tableName);
      if (distance <= 2 && !similar.includes(tableName)) {
        similar.push(tableName);
      }
    }
    
    return similar.slice(0, 3);
  }

  private findSimilarColumnNames(name: string): string[] {
    const similar: string[] = [];
    const lowerName = name.toLowerCase();
    
    for (const columns of this.knownTables.values()) {
      for (const col of columns) {
        if (col.includes(lowerName) || lowerName.includes(col)) {
          if (!similar.includes(col)) {
            similar.push(col);
          }
        }
        
        const distance = this.levenshteinDistance(lowerName, col);
        if (distance <= 2 && !similar.includes(col)) {
          similar.push(col);
        }
      }
    }
    
    return similar.slice(0, 5);
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  private isAggregate(expr: string): boolean {
    for (const aggFunc of AGGREGATE_FUNCTIONS) {
      if (expr.toUpperCase().includes(`${aggFunc}(`)) {
        return true;
      }
    }
    return false;
  }
}

export function validateSQL(
  sql: string,
  tables?: Array<{ name: string; columns: string[] }>
): ValidationResult {
  const validator = new SQLValidator(tables);
  return validator.validate(sql);
}

export function generateSQLEplanation(
  sql: string,
  tables?: Array<{ name: string; comment?: string; columns: Array<{ name: string; comment?: string }> }>
): string {
  const lines: string[] = [];
  const upperSQL = sql.toUpperCase().trim();

  lines.push("## SQL逻辑解释");
  lines.push("");

  if (upperSQL.startsWith("SELECT")) {
    lines.push("### 查询类型：SELECT（数据查询）");
    lines.push("");

    const selectMatch = sql.match(/SELECT\s+([\s\S]+?)\s+FROM\s+/i);
    if (selectMatch) {
      lines.push("### 选择的列：");
      const columns = selectMatch[1].split(",").map(c => c.trim());
      for (const col of columns) {
        lines.push(`- ${col}`);
      }
      lines.push("");
    }

    const fromMatch = sql.match(/FROM\s+([\s\S]+?)(?:\s+WHERE|\s+GROUP|\s+ORDER|\s+JOIN|\s+LIMIT|$)/i);
    if (fromMatch) {
      lines.push("### 涉及的表：");
      const tablesList = fromMatch[1].split(/\s*,\s*/).map(t => t.trim());
      for (const table of tablesList) {
        const tableName = table.split(/\s+/)[0];
        lines.push(`- ${tableName}`);
        
        if (tables) {
          const tableInfo = tables.find(t => 
            t.name.toLowerCase() === tableName.toLowerCase().replace(/^`|`$/g, "")
          );
          if (tableInfo && tableInfo.comment) {
            lines.push(`  说明: ${tableInfo.comment}`);
          }
        }
      }
      lines.push("");
    }

    const joinMatches = sql.match(/(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+ON\s+([^]+?)(?:\s+(?:WHERE|GROUP|ORDER|JOIN|LIMIT)|$)/gi);
    if (joinMatches && joinMatches.length > 0) {
      lines.push("### 表关联（JOIN）：");
      for (const joinMatch of joinMatches) {
        const joinTypeMatch = joinMatch.match(/(INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN/i);
        const joinType = joinTypeMatch ? joinTypeMatch[1] || "INNER" : "INNER";
        lines.push(`- ${joinType.toUpperCase()} JOIN`);
        
        const onMatch = joinMatch.match(/ON\s+([^]+?)(?:\s+(?:WHERE|GROUP|ORDER|JOIN|LIMIT)|$)/i);
        if (onMatch) {
          lines.push(`  条件: ${onMatch[1].trim()}`);
        }
      }
      lines.push("");
    }

    const whereMatch = sql.match(/WHERE\s+([\s\S]+?)(?:\s+GROUP|\s+ORDER|\s+LIMIT|$)/i);
    if (whereMatch) {
      lines.push("### 筛选条件（WHERE）：");
      const conditions = whereMatch[1].split(/\s+(AND|OR)\s+/i);
      for (const cond of conditions) {
        const trimmed = cond.trim();
        if (trimmed && trimmed !== "AND" && trimmed !== "OR") {
          lines.push(`- ${trimmed}`);
        }
      }
      lines.push("");
    }

    const groupByMatch = sql.match(/GROUP\s+BY\s+([\s\S]+?)(?:\s+HAVING|\s+ORDER|\s+LIMIT|$)/i);
    if (groupByMatch) {
      lines.push("### 分组（GROUP BY）：");
      const groups = groupByMatch[1].split(",").map(g => g.trim());
      for (const group of groups) {
        lines.push(`- ${group}`);
      }
      lines.push("");
    }

    const havingMatch = sql.match(/HAVING\s+([\s\S]+?)(?:\s+ORDER|\s+LIMIT|$)/i);
    if (havingMatch) {
      lines.push("### 分组筛选（HAVING）：");
      lines.push(`- ${havingMatch[1].trim()}`);
      lines.push("");
    }

    const orderByMatch = sql.match(/ORDER\s+BY\s+([\s\S]+?)(?:\s+LIMIT|$)/i);
    if (orderByMatch) {
      lines.push("### 排序（ORDER BY）：");
      const orders = orderByMatch[1].split(",").map(o => o.trim());
      for (const order of orders) {
        const isDesc = order.toUpperCase().includes("DESC");
        lines.push(`- ${order} (${isDesc ? "降序" : "升序"})`);
      }
      lines.push("");
    }

    const limitMatch = sql.match(/LIMIT\s+(\d+)(?:\s*,\s*(\d+))?/i);
    if (limitMatch) {
      lines.push("### 分页限制（LIMIT）：");
      const limit = limitMatch[1];
      const offset = limitMatch[2];
      if (offset) {
        lines.push(`- 跳过 ${offset} 条，返回 ${limit} 条`);
      } else {
        lines.push(`- 返回 ${limit} 条记录`);
      }
      lines.push("");
    }

    lines.push("---");
    lines.push("");
    lines.push("### 执行流程说明：");
    lines.push("1. 从 FROM 子句指定的表中获取数据");
    
    const hasJoin = upperSQL.includes("JOIN");
    const hasWhere = upperSQL.includes("WHERE");
    const hasGroupBy = upperSQL.includes("GROUP BY");
    const hasHaving = upperSQL.includes("HAVING");
    const hasOrderBy = upperSQL.includes("ORDER BY");
    const hasLimit = upperSQL.includes("LIMIT");
    
    let step = 2;
    if (hasJoin) {
      lines.push(`${step}. 根据 JOIN 条件进行表关联`);
      step++;
    }
    if (hasWhere) {
      lines.push(`${step}. 根据 WHERE 条件筛选数据`);
      step++;
    }
    if (hasGroupBy) {
      lines.push(`${step}. 按 GROUP BY 指定的列进行分组`);
      step++;
    }
    if (hasHaving) {
      lines.push(`${step}. 根据 HAVING 条件筛选分组结果`);
      step++;
    }
    lines.push(`${step}. 选择 SELECT 子句指定的列`);
    step++;
    if (hasOrderBy) {
      lines.push(`${step}. 根据 ORDER BY 进行排序`);
      step++;
    }
    if (hasLimit) {
      lines.push(`${step}. 根据 LIMIT 限制返回行数`);
    }
  } else if (upperSQL.startsWith("INSERT")) {
    lines.push("### 查询类型：INSERT（数据插入）");
    lines.push("");
    lines.push("此操作用于向表中插入新数据。");
  } else if (upperSQL.startsWith("UPDATE")) {
    lines.push("### 查询类型：UPDATE（数据更新）");
    lines.push("");
    lines.push("此操作用于更新表中的现有数据。");
  } else if (upperSQL.startsWith("DELETE")) {
    lines.push("### 查询类型：DELETE（数据删除）");
    lines.push("");
    lines.push("此操作用于删除表中的数据。");
  } else if (upperSQL.startsWith("CREATE TABLE")) {
    lines.push("### 查询类型：CREATE TABLE（创建表）");
    lines.push("");
    lines.push("此操作用于创建新的数据表。");
  } else {
    lines.push("### 查询类型：其他");
    lines.push("");
    lines.push("此SQL语句类型需要手动分析。");
  }

  return lines.join("\n");
}
