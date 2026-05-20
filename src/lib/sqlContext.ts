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
  ordinalPosition: number;
}

export interface RelationMetadata {
  id: string;
  fromTableId: string;
  fromTableName: string;
  fromColumnName: string;
  toTableId: string;
  toTableName: string;
  toColumnName: string;
  relationType: string;
  constraintName?: string | null;
  joinCondition?: string | null;
}

export interface TableDataInfo {
  tableName: string;
  columns: string[];
  rows: string[][];
  totalRows: number;
}

export function formatTableContext(
  tables: TableMetadata[],
  relations: RelationMetadata[]
): string {
  const parts: string[] = [];

  parts.push("=== 【可用表结构】 ===");
  parts.push("");

  for (const table of tables) {
    parts.push(`【表名】${table.name}`);
    if (table.tableComment) {
      parts.push(`【表注释】${table.tableComment}`);
    }

    parts.push(`【字段列表】（共 ${table.columns.length} 个字段）`);
    parts.push("");
    parts.push("| 字段名 | 数据类型 | 可空 | 主键 | 注释 |");
    parts.push("|--------|----------|------|------|------|");

    for (const col of table.columns) {
      const nullable = col.isNullable ? "是" : "否";
      const isPk = col.isPrimaryKey ? "是" : "否";
      const comment = col.columnComment || "-";
      parts.push(
        `| ${col.name} | ${col.dataType} | ${nullable} | ${isPk} | ${comment} |`
      );
    }
    parts.push("");
  }

  if (relations.length > 0) {
    parts.push("=== 【表关系】 ===");
    parts.push("");
    parts.push("| 源表.源字段 | 关联类型 | 目标表.目标字段 | 关联条件 |");
    parts.push("|-------------|----------|-----------------|----------|");

    for (const rel of relations) {
      const joinType = getRelationTypeName(rel.relationType);
      const condition = rel.joinCondition || `${rel.fromTableName}.${rel.fromColumnName} = ${rel.toTableName}.${rel.toColumnName}`;
      parts.push(
        `| ${rel.fromTableName}.${rel.fromColumnName} | ${joinType} | ${rel.toTableName}.${rel.toColumnName} | ${condition} |`
      );
    }
    parts.push("");
  }

  return parts.join("\n");
}

function getRelationTypeName(type: string): string {
  const mapping: Record<string, string> = {
    ONE_TO_ONE: "一对一",
    ONE_TO_MANY: "一对多",
    MANY_TO_ONE: "多对一",
    MANY_TO_MANY: "多对多",
    INNER: "内连接",
    LEFT: "左连接",
    RIGHT: "右连接",
  };
  return mapping[type] || type;
}

export function formatTableDataValues(dataMap: Map<string, TableDataInfo>): string {
  if (dataMap.size === 0) return "";

  const parts: string[] = [];
  parts.push("=== 【表的实际数据值（可用于精确筛选和 CASE WHEN）】 ===");
  parts.push("");
  parts.push("以下表在导入的 SQL 文件中包含了实际的 INSERT 数据。");
  parts.push("在编写 WHERE 条件或 CASE WHEN 映射时，必须使用下面列出的精确值。");
  parts.push("");

  for (const [tableName, dataInfo] of dataMap.entries()) {
    const maxDisplayRows = 50;
    const displayRows = dataInfo.rows.slice(0, maxDisplayRows);

    parts.push(`【表名】${dataInfo.tableName}`);
    parts.push(`【字段】${dataInfo.columns.join(", ")}`);
    parts.push(`【数据行数】共 ${dataInfo.totalRows} 行${dataInfo.totalRows > maxDisplayRows ? `（以下展示前 ${maxDisplayRows} 行）` : ""}`);
    parts.push("");

    if (displayRows.length === 0) continue;

    const colWidths = dataInfo.columns.map((col, ci) => {
      const headerLen = col.length;
      let maxDataLen = 0;
      for (const row of displayRows) {
        const val = (row[ci] || "").replace(/^'|'$/g, "");
        if (val.length > maxDataLen) maxDataLen = val.length;
      }
      return Math.max(headerLen, Math.min(maxDataLen, 30));
    });

    const headerLine = "| " + dataInfo.columns.map((col, i) => col.padEnd(colWidths[i])).join(" | ") + " |";
    const separatorLine = "|" + colWidths.map(w => "-".repeat(w + 2)).join("|") + "|";

    parts.push(headerLine);
    parts.push(separatorLine);

    for (const row of displayRows) {
      const rowLine = "| " + row.map((val, i) => {
        const display = (val || "NULL").replace(/^'|'$/g, "");
        return display.padEnd(colWidths[i]);
      }).join(" | ") + " |";
      parts.push(rowLine);
    }

    parts.push("");
  }

  return parts.join("\n");
}

import { SearchResult } from "@/lib/vectorStore";

export function buildSQLPromptContext(
  tables: TableMetadata[],
  relations: RelationMetadata[],
  searchResults: SearchResult[],
  tableData?: Map<string, TableDataInfo>
): string {
  const parts: string[] = [];

  if (searchResults.length > 0) {
    parts.push("=== 【语义检索到的相关文档片段】 ===");
    parts.push("");

    for (let i = 0; i < Math.min(searchResults.length, 5); i++) {
      const result = searchResults[i];
      parts.push(`【文档 ${i + 1}】${result.documentTitle}`);
      parts.push(`【知识库】${result.knowledgeBaseName || "未分类"}`);
      parts.push(`【相似度】${(result.similarity * 100).toFixed(1)}%`);
      parts.push("【内容】");
      parts.push(result.content);
      parts.push("---");
      parts.push("");
    }
  }

  if (tableData && tableData.size > 0) {
    parts.push(formatTableDataValues(tableData));
  }

  parts.push(formatTableContext(tables, relations));

  parts.push("=== 【字段映射参考】 ===");
  parts.push("");

  const allFields: Array<{
    tableName: string;
    fieldName: string;
    dataType: string;
    comment?: string | null;
    isPrimaryKey: boolean;
  }> = [];

  for (const table of tables) {
    for (const col of table.columns) {
      allFields.push({
        tableName: table.name,
        fieldName: col.name,
        dataType: col.dataType,
        comment: col.columnComment,
        isPrimaryKey: col.isPrimaryKey,
      });
    }
  }

  if (allFields.length > 0) {
    parts.push("完整字段清单（按表分组）：");
    parts.push("");

    for (const table of tables) {
      parts.push(`表: ${table.name}`);
      const tableFields = allFields.filter((f) => f.tableName === table.name);

      for (const field of tableFields) {
        const pkMark = field.isPrimaryKey ? " 🔑" : "";
        const comment = field.comment ? ` (${field.comment})` : "";
        parts.push(`  - ${field.fieldName} [${field.dataType}]${pkMark}${comment}`);
      }
      parts.push("");
    }
  }

  parts.push("=== 【使用说明】 ===");
  parts.push("");
  parts.push("1. 编写SQL时，只能使用上面列出的表名和字段名");
  parts.push("2. 如果需求中的字段名与上面的不完全一致，请选择最相似的字段");
  parts.push("3. 表之间的关联必须使用【表关系】中列出的关联条件");
  parts.push("4. 如果某个表或字段确实不存在，请在【注意事项】中说明");
  parts.push("");

  if (tables.length > 0) {
    parts.push("=== 【当前可用表名列表】 ===");
    parts.push(tables.map((t) => t.name).join(", "));
    parts.push("");
  }

  return parts.join("\n");
}
