import prisma from "@/lib/prisma";
import {
  SQLElements,
  SelectColumn,
  FromTable,
  WhereCondition,
  JoinCondition,
  OrderBy,
  HavingCondition,
  AggregateFunction,
  ComparisonOperator,
  JoinType,
  AggregateType,
} from "./reportParser";

export interface GeneratedSQL {
  sql: string;
  explanation: string;
  tablesUsed: string[];
  columnsUsed: string[];
  joinCount: number;
  complexity: "simple" | "medium" | "complex";
  confidence: number;
  dialect: string;
}

export interface SQLGenerationOptions {
  dialect?: "mysql" | "postgresql" | "sqlite" | "mssql" | "oracle";
  includeComments?: boolean;
  useAlias?: boolean;
  quoteIdentifiers?: boolean;
  limitDefault?: number;
}

export interface TableMetadata {
  id: string;
  name: string;
  schemaName?: string | null;
  tableComment?: string | null;
  columns: ColumnMetadata[];
  relations: RelationMetadata[];
}

export interface ColumnMetadata {
  id: string;
  name: string;
  dataType: string;
  columnType?: string | null;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  columnComment?: string | null;
}

export interface RelationMetadata {
  id: string;
  fromTableId: string;
  fromColumnName: string;
  toTableId: string;
  toColumnName: string;
  relationType: string;
  constraintName?: string | null;
  joinCondition?: string | null;
}

const DEFAULT_OPTIONS: SQLGenerationOptions = {
  dialect: "mysql",
  includeComments: true,
  useAlias: true,
  quoteIdentifiers: false,
  limitDefault: 1000,
};

export class SQLGenerator {
  private options: SQLGenerationOptions;
  private tables: Map<string, TableMetadata> = new Map();
  private relations: RelationMetadata[] = [];

  constructor(options: SQLGenerationOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async loadMetadata(knowledgeBaseId?: string): Promise<void> {
    const whereClause = knowledgeBaseId
      ? { knowledgeBaseId }
      : {};

    const tables = await prisma.databaseTable.findMany({
      where: whereClause,
      include: {
        columns: true,
        relationsFrom: true,
        relationsTo: true,
      },
    });

    for (const table of tables) {
      const relations: RelationMetadata[] = [
        ...table.relationsFrom,
        ...table.relationsTo,
      ];

      this.tables.set(table.name.toLowerCase(), {
        id: table.id,
        name: table.name,
        schemaName: table.schemaName,
        tableComment: table.tableComment,
        columns: table.columns.map(col => ({
          id: col.id,
          name: col.name,
          dataType: col.dataType,
          columnType: col.columnType,
          isNullable: col.isNullable,
          isPrimaryKey: col.isPrimaryKey,
          isAutoIncrement: col.isAutoIncrement,
          columnComment: col.columnComment,
        })),
        relations,
      });

      this.relations.push(...relations);
    }
  }

  setMetadata(tables: TableMetadata[], relations: RelationMetadata[]): void {
    this.tables.clear();
    for (const table of tables) {
      this.tables.set(table.name.toLowerCase(), table);
    }
    this.relations = [...relations];
  }

  generate(elements: SQLElements): GeneratedSQL[] {
    const results: GeneratedSQL[] = [];

    const baseSQL = this.generateBaseSQL(elements);
    if (baseSQL) {
      results.push(baseSQL);
    }

    const variations = this.generateVariations(elements);
    results.push(...variations);

    return results.filter(r => r.sql.trim().length > 0);
  }

  private generateBaseSQL(elements: SQLElements): GeneratedSQL | null {
    const parts: string[] = [];
    const explanationParts: string[] = [];
    const tablesUsed: string[] = [];
    const columnsUsed: string[] = [];
    let joinCount = 0;

    if (this.options.includeComments) {
      parts.push("-- 自动生成的SQL查询");
      parts.push("-- 基于报表需求分析生成");
      parts.push("");
    }

    const selectClause = this.buildSelectClause(elements, columnsUsed);
    parts.push(selectClause);

    const fromClause = this.buildFromClause(elements, tablesUsed);
    if (fromClause) {
      parts.push(fromClause);
    }

    const joinClauses = this.buildJoinClauses(elements, tablesUsed);
    for (const join of joinClauses) {
      parts.push(join);
      joinCount++;
    }

    const whereClause = this.buildWhereClause(elements, columnsUsed);
    if (whereClause) {
      parts.push(whereClause);
    }

    const groupByClause = this.buildGroupByClause(elements, columnsUsed);
    if (groupByClause) {
      parts.push(groupByClause);
    }

    const havingClause = this.buildHavingClause(elements);
    if (havingClause) {
      parts.push(havingClause);
    }

    const orderByClause = this.buildOrderByClause(elements);
    if (orderByClause) {
      parts.push(orderByClause);
    }

    const limitClause = this.buildLimitClause(elements);
    if (limitClause) {
      parts.push(limitClause);
    }

    const sql = parts.join("\n");

    explanationParts.push("此SQL查询基于您的报表需求自动生成。");
    explanationParts.push(`查询涉及 ${tablesUsed.length} 个表: ${tablesUsed.join(", ")}`);
    if (joinCount > 0) {
      explanationParts.push(`包含 ${joinCount} 个表关联（JOIN）`);
    }
    if (elements.aggregates.length > 0) {
      explanationParts.push(`使用聚合函数: ${elements.aggregates.map(a => a.type).join(", ")}`);
    }
    if (elements.dateRange) {
      explanationParts.push(`包含日期范围过滤: ${elements.dateRange.period || "自定义范围"}`);
    }

    const complexity = this.evaluateComplexity(elements, joinCount);
    const confidence = this.evaluateConfidence(elements);

    return {
      sql,
      explanation: explanationParts.join("\n"),
      tablesUsed,
      columnsUsed,
      joinCount,
      complexity,
      confidence,
      dialect: this.options.dialect!,
    };
  }

  private buildSelectClause(elements: SQLElements, columnsUsed: string[]): string {
    const selectItems: string[] = [];

    if (elements.aggregates.length > 0) {
      for (const agg of elements.aggregates) {
        const aggSql = this.formatAggregate(agg);
        selectItems.push(aggSql);
        
        if (agg.columnName !== "*") {
          columnsUsed.push(agg.columnName);
        }
      }
    }

    for (const col of elements.selectColumns) {
      if (col.isAggregate) continue;
      
      const colName = this.formatIdentifier(col.columnName, col.tableName);
      selectItems.push(colName);
      columnsUsed.push(col.columnName);
    }

    if (selectItems.length === 0) {
      return "SELECT *";
    }

    return `SELECT ${selectItems.join(", ")}`;
  }

  private formatAggregate(agg: AggregateFunction): string {
    const aggType = this.getAggregateKeyword(agg.type);
    
    if (agg.columnName === "*") {
      return `${aggType}(*)`;
    }

    return `${aggType}(${this.formatIdentifier(agg.columnName)})`;
  }

  private getAggregateKeyword(type: AggregateType): string {
    const mapping: Record<AggregateType, string> = {
      SUM: "SUM",
      COUNT: "COUNT",
      AVG: "AVG",
      MAX: "MAX",
      MIN: "MIN",
      FIRST: "FIRST_VALUE",
      LAST: "LAST_VALUE",
      DISTINCT_COUNT: "COUNT(DISTINCT",
    };
    return mapping[type] || type;
  }

  private buildFromClause(elements: SQLElements, tablesUsed: string[]): string | null {
    if (elements.fromTables.length === 0) {
      return null;
    }

    const tableItems: string[] = [];
    
    for (const table of elements.fromTables) {
      const tableName = this.formatIdentifier(table.tableName);
      if (this.options.useAlias) {
        const alias = this.generateTableAlias(table.tableName);
        tableItems.push(`${tableName} AS ${alias}`);
      } else {
        tableItems.push(tableName);
      }
      tablesUsed.push(table.tableName);
    }

    return `FROM ${tableItems.join(", ")}`;
  }

  private buildJoinClauses(elements: SQLElements, tablesUsed: string[]): string[] {
    const joins: string[] = [];
    const tableNames = elements.fromTables.map(t => t.tableName.toLowerCase());

    for (const tableName of tableNames) {
      const table = this.tables.get(tableName);
      if (!table) continue;

      for (const relation of this.relations) {
        const fromTable = this.tables.get(
          [...this.tables.values()].find(t => t.id === relation.fromTableId)?.name.toLowerCase() || ""
        );
        const toTable = this.tables.get(
          [...this.tables.values()].find(t => t.id === relation.toTableId)?.name.toLowerCase() || ""
        );

        if (!fromTable || !toTable) continue;

        const fromInQuery = tableNames.includes(fromTable.name.toLowerCase());
        const toInQuery = tableNames.includes(toTable.name.toLowerCase());

        if (fromInQuery && toInQuery && fromTable.name.toLowerCase() !== toTable.name.toLowerCase()) {
          const joinType = this.getJoinKeyword(relation.relationType);
          const joinCondition = relation.joinCondition || 
            `${this.formatIdentifier(fromTable.name, this.generateTableAlias(fromTable.name))}.${relation.fromColumnName} = ${this.formatIdentifier(toTable.name, this.generateTableAlias(toTable.name))}.${relation.toColumnName}`;

          if (!joins.some(j => j.includes(joinCondition))) {
            joins.push(`${joinType} JOIN ${this.formatIdentifier(toTable.name)} AS ${this.generateTableAlias(toTable.name)} ON ${joinCondition}`);
            
            if (!tablesUsed.includes(toTable.name)) {
              tablesUsed.push(toTable.name);
            }
          }
        }
      }
    }

    return joins;
  }

  private getJoinKeyword(relationType: string): string {
    const mapping: Record<string, string> = {
      "ONE_TO_ONE": "INNER",
      "ONE_TO_MANY": "INNER",
      "MANY_TO_ONE": "INNER",
      "MANY_TO_MANY": "INNER",
      "INNER": "INNER",
      "LEFT": "LEFT",
      "RIGHT": "RIGHT",
      "FULL": "FULL",
    };
    return mapping[relationType] || "INNER";
  }

  private buildWhereClause(elements: SQLElements, columnsUsed: string[]): string | null {
    const conditions: string[] = [];

    for (const cond of elements.whereConditions) {
      const conditionSql = this.formatCondition(cond);
      if (conditionSql) {
        conditions.push(conditionSql);
        columnsUsed.push(cond.columnName);
      }
    }

    if (elements.dateRange) {
      const dateCondition = this.formatDateRange(elements.dateRange);
      if (dateCondition) {
        conditions.push(dateCondition);
      }
    }

    if (conditions.length === 0) {
      return null;
    }

    return `WHERE ${conditions.join(" AND ")}`;
  }

  private formatCondition(cond: WhereCondition): string | null {
    const column = this.formatIdentifier(cond.columnName, cond.tableName);
    const operator = this.getOperatorKeyword(cond.operator);

    if (cond.operator === "IS NULL") {
      return `${column} IS NULL`;
    }
    if (cond.operator === "IS NOT NULL") {
      return `${column} IS NOT NULL`;
    }

    const value = this.formatValue(cond.value, cond.valueType);

    if (cond.operator === "IN" || cond.operator === "NOT IN") {
      const values = Array.isArray(cond.value) 
        ? cond.value.map(v => this.formatValue(v, cond.valueType)).join(", ")
        : value;
      return `${column} ${operator} (${values})`;
    }

    if (cond.operator === "BETWEEN") {
      const values = Array.isArray(cond.value) && cond.value.length >= 2
        ? `${this.formatValue(cond.value[0], cond.valueType)} AND ${this.formatValue(cond.value[1], cond.valueType)}`
        : `${value} AND ${value}`;
      return `${column} ${operator} ${values}`;
    }

    if (cond.operator === "LIKE" || cond.operator === "NOT LIKE") {
      const likeValue = typeof cond.value === "string" && !cond.value.includes("%")
        ? `%${cond.value}%`
        : cond.value;
      return `${column} ${operator} ${this.formatValue(likeValue, "string")}`;
    }

    return `${column} ${operator} ${value}`;
  }

  private getOperatorKeyword(operator: ComparisonOperator): string {
    return operator;
  }

  private formatValue(value: unknown, valueType: string): string {
    if (value === null || value === undefined) {
      return "NULL";
    }

    if (valueType === "number") {
      return String(value);
    }

    if (valueType === "boolean") {
      return value ? "TRUE" : "FALSE";
    }

    const strValue = String(value);
    if (this.options.dialect === "mysql" || this.options.dialect === "sqlite") {
      return `'${strValue.replace(/'/g, "''")}'`;
    }

    return `'${strValue.replace(/'/g, "''")}'`;
  }

  private formatDateRange(dateRange: { columnName: string; startDate?: string; endDate?: string; period?: string }): string | null {
    const column = this.formatIdentifier(dateRange.columnName);

    if (dateRange.period) {
      switch (dateRange.period) {
        case "今天":
        case "今日":
          return `DATE(${column}) = CURDATE()`;
        case "昨天":
        case "昨日":
          return `DATE(${column}) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`;
        case "本周":
          return `YEARWEEK(${column}, 1) = YEARWEEK(CURDATE(), 1)`;
        case "本月":
          return `YEAR(${column}) = YEAR(CURDATE()) AND MONTH(${column}) = MONTH(CURDATE())`;
        case "今年":
          return `YEAR(${column}) = YEAR(CURDATE())`;
        case "最近一周":
        case "近一周":
          return `${column} >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
        case "最近一月":
        case "近一个月":
          return `${column} >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)`;
        case "最近三个月":
        case "近三个月":
          return `${column} >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)`;
      }
    }

    const conditions: string[] = [];
    if (dateRange.startDate) {
      conditions.push(`${column} >= ${this.formatValue(dateRange.startDate, "date")}`);
    }
    if (dateRange.endDate) {
      conditions.push(`${column} <= ${this.formatValue(dateRange.endDate, "date")}`);
    }

    return conditions.length > 0 ? conditions.join(" AND ") : null;
  }

  private buildGroupByClause(elements: SQLElements, columnsUsed: string[]): string | null {
    if (elements.groupByColumns.length === 0) {
      return null;
    }

    const groupItems = elements.groupByColumns.map(col => {
      columnsUsed.push(col);
      return this.formatIdentifier(col);
    });

    return `GROUP BY ${groupItems.join(", ")}`;
  }

  private buildHavingClause(elements: SQLElements): string | null {
    if (elements.havingConditions.length === 0) {
      return null;
    }

    const conditions = elements.havingConditions.map(cond => {
      const aggType = this.getAggregateKeyword(cond.aggregateType);
      const column = this.formatIdentifier(cond.columnName);
      const operator = this.getOperatorKeyword(cond.operator);
      const value = this.formatValue(cond.value, typeof cond.value === "number" ? "number" : "string");
      
      return `${aggType}(${column}) ${operator} ${value}`;
    });

    return `HAVING ${conditions.join(" AND ")}`;
  }

  private buildOrderByClause(elements: SQLElements): string | null {
    if (elements.orderBy.length === 0) {
      return null;
    }

    const orderItems = elements.orderBy.map(order => {
      const column = this.formatIdentifier(order.columnName, order.tableName);
      return `${column} ${order.direction}`;
    });

    return `ORDER BY ${orderItems.join(", ")}`;
  }

  private buildLimitClause(elements: SQLElements): string | null {
    if (!elements.limit && !this.options.limitDefault) {
      return null;
    }

    const limit = elements.limit?.limit || this.options.limitDefault;
    const offset = elements.limit?.offset;

    if (this.options.dialect === "mysql" || this.options.dialect === "sqlite") {
      if (offset !== undefined) {
        return `LIMIT ${offset}, ${limit}`;
      }
      return `LIMIT ${limit}`;
    }

    if (this.options.dialect === "postgresql") {
      if (offset !== undefined) {
        return `LIMIT ${limit} OFFSET ${offset}`;
      }
      return `LIMIT ${limit}`;
    }

    if (this.options.dialect === "mssql") {
      return `TOP ${limit}`;
    }

    if (this.options.dialect === "oracle") {
      return `FETCH FIRST ${limit} ROWS ONLY`;
    }

    return `LIMIT ${limit}`;
  }

  private formatIdentifier(name: string, tableName?: string): string {
    let formatted = name;

    if (tableName && this.options.useAlias) {
      const alias = this.generateTableAlias(tableName);
      formatted = `${alias}.${name}`;
    } else if (tableName) {
      formatted = `${tableName}.${name}`;
    }

    if (this.options.quoteIdentifiers) {
      if (this.options.dialect === "mysql") {
        return `\`${formatted}\``;
      }
      if (this.options.dialect === "postgresql" || this.options.dialect === "oracle") {
        return `"${formatted}"`;
      }
      if (this.options.dialect === "mssql") {
        return `[${formatted}]`;
      }
    }

    return formatted;
  }

  private generateTableAlias(tableName: string): string {
    const parts = tableName.split(/[_\s]+/);
    if (parts.length > 1) {
      return parts.map(p => p[0].toLowerCase()).join("");
    }
    return tableName.substring(0, 2).toLowerCase();
  }

  private evaluateComplexity(elements: SQLElements, joinCount: number): "simple" | "medium" | "complex" {
    let score = 0;

    score += elements.fromTables.length * 2;
    score += joinCount * 3;
    score += elements.whereConditions.length;
    score += elements.groupByColumns.length * 2;
    score += elements.aggregates.length * 2;

    if (score <= 3) return "simple";
    if (score <= 8) return "medium";
    return "complex";
  }

  private evaluateConfidence(elements: SQLElements): number {
    let confidence = 0.5;

    if (elements.fromTables.length > 0) {
      confidence += 0.15;
    }

    if (elements.selectColumns.length > 0 || elements.aggregates.length > 0) {
      confidence += 0.15;
    }

    if (elements.groupByColumns.length > 0 && elements.aggregates.length > 0) {
      confidence += 0.1;
    }

    for (const table of elements.fromTables) {
      if (this.tables.has(table.tableName.toLowerCase())) {
        confidence += 0.05;
      }
    }

    return Math.min(confidence, 0.98);
  }

  private generateVariations(elements: SQLElements): GeneratedSQL[] {
    const variations: GeneratedSQL[] = [];

    if (elements.fromTables.length >= 2) {
      const leftJoinElements = { ...elements };
      const leftJoinSQL = this.generateWithDifferentJoinType(leftJoinElements, "LEFT");
      if (leftJoinSQL) {
        variations.push(leftJoinSQL);
      }
    }

    if (elements.aggregates.length > 0 || elements.groupByColumns.length > 0) {
      const countElements = { ...elements };
      const countSQL = this.generateWithCount(countElements);
      if (countSQL) {
        variations.push(countSQL);
      }
    }

    if (!elements.orderBy.length && elements.fromTables.length > 0) {
      const orderedElements = { ...elements };
      const firstTable = this.tables.get(elements.fromTables[0].tableName.toLowerCase());
      if (firstTable) {
        const primaryKey = firstTable.columns.find(c => c.isPrimaryKey);
        if (primaryKey) {
          orderedElements.orderBy = [{
            columnName: primaryKey.name,
            tableName: firstTable.name,
            direction: "ASC",
            confidence: 0.5,
          }];
          
          const orderedSQL = this.generateBaseSQL(orderedElements);
          if (orderedSQL) {
            orderedSQL.explanation += "\n（此变体添加了按主键排序）";
            variations.push(orderedSQL);
          }
        }
      }
    }

    return variations;
  }

  private generateWithDifferentJoinType(elements: SQLElements, joinType: JoinType): GeneratedSQL | null {
    return null;
  }

  private generateWithCount(elements: SQLElements): GeneratedSQL | null {
    return null;
  }
}

export async function generateSQLFromRequirement(
  requirement: string,
  knowledgeBaseId?: string,
  options: SQLGenerationOptions = {}
): Promise<GeneratedSQL[]> {
  const generator = new SQLGenerator(options);
  await generator.loadMetadata(knowledgeBaseId);

  const { parseReportRequirement } = await import("./reportParser");
  
  const tables = await prisma.databaseTable.findMany({
    where: knowledgeBaseId ? { knowledgeBaseId } : {},
    include: { columns: true },
  });

  const tableMappings = tables.map(t => ({
    name: t.name,
    comment: t.tableComment,
    columns: t.columns.map(c => ({
      name: c.name,
      comment: c.columnComment,
    })),
  }));

  const parsed = parseReportRequirement(requirement, tableMappings);
  
  return generator.generate(parsed.parsedElements);
}
