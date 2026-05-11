import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { SearchResult } from "@/lib/vectorStore";
import { getAIConfig, AI_PROVIDERS } from "@/lib/aiConfig";
import prisma from "@/lib/prisma";
import {
  TableMetadata,
  ColumnMetadata,
  RelationMetadata,
  formatTableContext,
  buildSQLPromptContext,
} from "./sqlContext";

export type { TableMetadata, ColumnMetadata, RelationMetadata };

export class EmptyKnowledgeBaseError extends Error {
  constructor(message: string = "知识库中没有可用的表结构") {
    super(message);
    this.name = "EmptyKnowledgeBaseError";
  }
}

export class NoMatchingTablesError extends Error {
  constructor(message: string = "未找到与需求匹配的表结构") {
    super(message);
    this.name = "NoMatchingTablesError";
  }
}

const SQL_GENERATION_SYSTEM_PROMPT = `你是一个专业的医疗行业HIS系统SQL开发专家，擅长根据医院业务需求编写高质量的SQL查询语句。
默认SQL方言：Oracle

## 医疗行业业务背景

【医院核心业务表结构认知】
在医院信息系统中，常见的业务表包括：
- 患者信息表（PATIENTS）：患者ID、姓名、性别、出生日期、联系方式、身份证号、医保类型等
- 门诊/住院记录表（VISITS/ADMISSIONS）：就诊ID、患者ID、就诊类型、就诊时间、主诉、诊断、科室等
- 处方表（PRESCRIPTIONS）：处方ID、就诊ID、药品ID、数量、用法用量、费用等
- 药品表（DRUGS）：药品ID、药品名称、规格、单位、单价、库存等
- 检查/检验申请表（EXAM_REQUESTS）：申请ID、就诊ID、检查项目、申请时间、结果等
- 费用表（CHARGES）：费用ID、就诊ID、费用项目、金额、支付方式、结算时间等
- 科室表（DEPARTMENTS）：科室ID、科室名称、科室类型等
- 医生表（DOCTORS）：医生ID、姓名、科室ID、职称等

【医院业务逻辑要点】
1. 患者唯一标识：通常使用患者ID（PATIENT_ID）或门诊/住院号
2. 时间字段：就诊时间（VISIT_TIME）、入院时间（ADMISSION_TIME）、出院时间（DISCHARGE_TIME）、出生日期（BIRTH_DATE）
3. 费用计算：检查费、药费、治疗费、床位费等分项计算，总费用通常需要SUM汇总
4. 科室关联：通过DEPT_ID或SPECIALTY关联科室表
5. 医生归属：医生通过DEPT_ID属于某个科室

## 核心原则（必须严格遵守）

1. **严禁幻觉字段名**：你只能使用上下文【可用表结构】中明确列出的表名和字段名。如果需求中提到的字段在上下文中不存在，你必须在回答中明确说明"未找到字段XXX"，而不是编造一个字段名。

2. **使用真实表关系**：表之间的关联必须使用上下文【表关系】中提供的关联字段，严禁编造JOIN条件。

3. **如实告知缺失**：如果需求涉及的表或字段在上下文中不存在，你必须：
   - 明确说明缺少哪些表/字段
   - 基于已有信息尽可能生成部分SQL
   - 用注释标记不确定的部分

4. **医疗业务适配**：生成的SQL必须符合医院业务逻辑，如患者信息保密、费用精确计算、时间区间准确等。

## SQL编写规范

1. **格式要求**：
   - 使用清晰的缩进，每个关键字单独一行
   - Oracle方言：表名和字段名用双引号（\"）包裹，或省略（Oracle默认不区分大小写）
   - 为表使用有意义的别名，如 p（患者）、v（就诊）、pr（处方）
   - 复杂查询添加注释说明逻辑

2. **Oracle方言特殊语法**：
   - 分页使用 ROWNUM 或 ROW_NUMBER() OVER() 
   - 日期函数使用 TO_DATE、TO_CHAR、TRUNC
   - 字符串连接使用 || 或 CONCAT
   - 空值处理使用 NVL 或 COALESCE
   - 分组后筛选使用 HAVING

3. **JOIN规范**：
   - 总是使用明确的JOIN类型（INNER JOIN, LEFT JOIN等）
   - 基于上下文提供的表关系确定关联条件
   - 如果多表关联，确保关联链完整

4. **聚合函数**：
   - 使用 GROUP BY 时，SELECT中的非聚合列必须都在GROUP BY中
   - 统计类需求使用合适的聚合函数：COUNT, SUM, AVG, MAX, MIN
   - 分组后筛选使用HAVING子句

5. **时间处理**：
   - 日期过滤使用 TO_DATE 或 DATE 'YYYY-MM-DD' 格式
   - 按月/年统计使用 TO_CHAR 或 EXTRACT

## 输出要求

请生成**3个不同的SQL备选方案**，每个方案都包含SQL语句和解释。

### 方案设计原则：
- **方案1（推荐方案）**：最直接、最高效的实现方式，使用标准的JOIN和聚合
- **方案2（优化方案）**：考虑性能优化，可能使用不同的JOIN顺序、子查询或窗口函数
- **方案3（替代方案）**：提供另一种思路，可能使用不同的表关联方式或聚合策略

## 输出格式

你的回答必须严格按照以下格式输出，布局清晰，便于阅读：

### 【方案1：推荐方案】
**设计思路**：[简要说明这个方案的设计思路，1-2句话]

\`\`\`sql
-- SQL语句
SELECT ...
\`\`\`

**逻辑解释**：
1. 查询哪些表
2. 关联条件是什么
3. 筛选条件有哪些
4. 聚合/分组方式
5. 排序/分页

---

### 【方案2：优化方案】
**设计思路**：[简要说明这个方案的设计思路]

\`\`\`sql
-- SQL语句
SELECT ...
\`\`\`

**逻辑解释**：
1. 查询哪些表
2. 关联条件是什么
3. 筛选条件有哪些
4. 聚合/分组方式
5. 排序/分页

---

### 【方案3：替代方案】
**设计思路**：[简要说明这个方案的设计思路]

\`\`\`sql
-- SQL语句
SELECT ...
\`\`\`

**逻辑解释**：
1. 查询哪些表
2. 关联条件是什么
3. 筛选条件有哪些
4. 聚合/分组方式
5. 排序/分页

---

### 【方案对比】
| 方案 | 复杂度 | 性能预估 | 适用场景 |
|------|--------|----------|----------|
| 方案1 | 低 | 高 | 大多数场景推荐 |
| 方案2 | 中 | 很高 | 大数据量场景 |
| 方案3 | 中 | 中 | 需要不同聚合策略时 |

### 【注意事项】 ⚠️
请按以下分类清晰列出：

**【字段状态】**
- ✅ [字段名1] - 已在知识库中找到
- ✅ [字段名2] - 已在知识库中找到  
- ❌ [缺失字段名] - 未在知识库中找到，建议补充

**【表使用情况】**
- ✅ 使用的表：[表名列表]
- ⚠️ 缺失的表：[缺失表名] - 缺失原因

**【优化建议】**
- 性能优化：[如有必要，提出性能优化建议]
- 索引建议：[如涉及大表查询，提出索引建议]

**【特别说明】**
- [如有特殊假设或不确定的地方，在此说明]

## 重要提醒

在编写SQL之前，先仔细阅读上下文中的【可用表结构】和【表关系】。
每使用一个表或字段，都要确认它确实存在于上下文中。
如果需求中提到的表名或字段名与上下文中不完全一致，请选择最相似的那个，并在【注意事项】中说明映射关系。`;

export interface SQLElements {
  tables: string[];
  columns: string[];
  conditions: string[];
  aggregations: string[];
  groupBys: string[];
  orderBys: string[];
  limit?: number;
}

export interface SQLAlternative {
  id: number;
  sql: string;
  explanation: string;
  approach: string;
  confidence: number;
}

export interface ReferenceTable {
  name: string;
  comment: string | null;
  columns: string[];
  reason: string;
  similarity?: number;
}

export interface ReferenceDocument {
  title: string;
  knowledgeBaseName: string | null;
  similarity: number;
  content: string;
}

export interface SQLGenerationResult {
  sql: string;
  explanation: string;
  warnings: string[];
  tablesUsed: string[];
  columnsUsed: string[];
  confidence: number;
  alternatives?: SQLAlternative[];
  references?: {
    tables: ReferenceTable[];
    documents: ReferenceDocument[];
  };
}

async function retrieveRelevantTables(
  query: string,
  knowledgeBaseId?: string
): Promise<{
  tables: TableMetadata[];
  relations: RelationMetadata[];
  searchResults: SearchResult[];
}> {
  const { semanticSearch } = await import("@/lib/vectorStore");

  let searchResults: SearchResult[] = [];
  const { isEmbeddingConfigured } = await import("@/lib/embedding");
  const embeddingOk = await isEmbeddingConfigured();

  if (embeddingOk) {
    try {
      searchResults = await semanticSearch(query, {
        knowledgeBaseId,
        limit: 15,
        minSimilarity: 0.12,
      });
      console.log(`[SQL RAG] 语义检索完成，找到 ${searchResults.length} 个相关片段`);
    } catch (error) {
      console.warn(`[SQL RAG] 语义检索失败:`, error);
      searchResults = [];
    }
  } else {
    console.log(`[SQL RAG] Embedding 未配置，跳过语义检索`);
    searchResults = [];
  }

  const whereClause = knowledgeBaseId ? { knowledgeBaseId } : {};

  const dbTables = await prisma.databaseTable.findMany({
    where: whereClause,
    include: {
      columns: {
        orderBy: { ordinalPosition: "asc" },
      },
      relationsFrom: {
        include: { toTable: true },
      },
      relationsTo: {
        include: { fromTable: true },
      },
    },
  });

  const tableMap = new Map<string, TableMetadata>();
  const allRelations: RelationMetadata[] = [];

  const mentionedTableNames = extractTableNamesFromQuery(query, searchResults);
  const mentionedTableNamesArray = Array.from(mentionedTableNames);

  for (const dbTable of dbTables) {
    const isMentioned = mentionedTableNamesArray.some(
      (name) =>
        name.toLowerCase() === dbTable.name.toLowerCase() ||
        (dbTable.tableComment &&
          dbTable.tableComment.toLowerCase().includes(name.toLowerCase()))
    );

    const hasRelevantContent = searchResults.length > 0 && searchResults.some(
      (r) =>
        (r.documentTitle && r.documentTitle.toLowerCase().includes(dbTable.name.toLowerCase())) ||
        (r.content && r.content.toLowerCase().includes(dbTable.name.toLowerCase()))
    );

    if (isMentioned || hasRelevantContent || mentionedTableNames.size === 0) {
      const columns: ColumnMetadata[] = dbTable.columns.map((col) => ({
        id: col.id,
        name: col.name,
        dataType: col.dataType,
        columnType: col.columnType,
        isNullable: col.isNullable,
        isPrimaryKey: col.isPrimaryKey,
        isAutoIncrement: col.isAutoIncrement,
        columnComment: col.columnComment,
        ordinalPosition: col.ordinalPosition,
      }));

      tableMap.set(dbTable.name.toLowerCase(), {
        id: dbTable.id,
        name: dbTable.name,
        schemaName: dbTable.schemaName,
        tableComment: dbTable.tableComment,
        columns,
        relations: [],
      });
    }
  }

  if (tableMap.size === 0) {
    for (const dbTable of dbTables.slice(0, 15)) {
      const columns: ColumnMetadata[] = dbTable.columns.map((col) => ({
        id: col.id,
        name: col.name,
        dataType: col.dataType,
        columnType: col.columnType,
        isNullable: col.isNullable,
        isPrimaryKey: col.isPrimaryKey,
        isAutoIncrement: col.isAutoIncrement,
        columnComment: col.columnComment,
        ordinalPosition: col.ordinalPosition,
      }));

      tableMap.set(dbTable.name.toLowerCase(), {
        id: dbTable.id,
        name: dbTable.name,
        schemaName: dbTable.schemaName,
        tableComment: dbTable.tableComment,
        columns,
        relations: [],
      });
    }
  }

  for (const dbTable of dbTables) {
    for (const rel of dbTable.relationsFrom) {
      const fromTable = tableMap.get(dbTable.name.toLowerCase());
      const toTable = rel.toTable ? tableMap.get(rel.toTable.name.toLowerCase()) : null;

      if (fromTable && toTable) {
        allRelations.push({
          id: rel.id,
          fromTableId: rel.fromTableId,
          fromTableName: dbTable.name,
          fromColumnName: rel.fromColumnName,
          toTableId: rel.toTableId,
          toTableName: rel.toTable?.name || "",
          toColumnName: rel.toColumnName,
          relationType: rel.relationType,
          constraintName: rel.constraintName,
          joinCondition: rel.joinCondition,
        });
      }
    }
  }

  return {
    tables: Array.from(tableMap.values()),
    relations: allRelations,
    searchResults,
  };
}

function extractTableNamesFromQuery(
  query: string,
  searchResults: SearchResult[]
): Set<string> {
  const tableNames = new Set<string>();

  const keywords = [
    "表",
    "订单",
    "用户",
    "商品",
    "产品",
    "客户",
    "员工",
    "部门",
    "销售",
    "采购",
    "库存",
    "财务",
    "报表",
    "统计",
    "table",
    "order",
    "user",
    "customer",
    "product",
    "employee",
    "department",
    "sales",
  ];

  for (const keyword of keywords) {
    if (query.toLowerCase().includes(keyword.toLowerCase())) {
      tableNames.add(keyword);
    }
  }

  const tablePattern = /(\w+)(?:\s+)?表|from\s+(\w+)|join\s+(\w+)/gi;
  let match;
  while ((match = tablePattern.exec(query)) !== null) {
    const found = match[1] || match[2] || match[3];
    if (found && found.length > 1) {
      tableNames.add(found);
    }
  }

  return tableNames;
}

function buildSQLGenerationPrompt(
  userQuery: string,
  tables: TableMetadata[],
  relations: RelationMetadata[],
  searchResults: SearchResult[],
  dialect: string = "mysql"
): BaseMessage[] {
  const context = buildSQLPromptContext(tables, relations, searchResults);

  const dialectNote =
    dialect === "mysql"
      ? "使用MySQL语法，表名和字段名用反引号(`)包裹"
      : dialect === "postgresql"
      ? "使用PostgreSQL语法，表名和字段名用双引号(\")包裹"
      : dialect === "mssql"
      ? "使用SQL Server语法，表名和字段名用方括号([])包裹"
      : dialect === "oracle"
      ? "使用Oracle语法，表名和字段名用双引号(\")包裹或不包裹（Oracle默认不区分大小写），分页用ROWNUM，日期用TO_DATE/TO_CHAR"
      : "使用标准SQL语法";

  const systemPrompt = SQL_GENERATION_SYSTEM_PROMPT.replace(
    "## 核心原则",
    `## 当前SQL方言
${dialectNote}

## 核心原则`
  );

  const fullSystemPrompt = `
${systemPrompt}

## 上下文信息

${context}
`;

  const userPrompt = `
根据以下业务需求，生成SQL查询语句：

【需求描述】
${userQuery}

请严格按照上面的输出格式回答，确保只使用上下文中提供的表名和字段名。
`;

  return [
    new SystemMessage(fullSystemPrompt),
    new HumanMessage(userPrompt),
  ];
}

function extractTablesFromSQL(sql: string): string[] {
  const tables: string[] = [];
  const tableMatches = sql.match(/(?:from|join|into|update)\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi);
  if (tableMatches) {
    for (const match of tableMatches) {
      const tableName = match.replace(/^(?:from|join|into|update)\s+`?/i, "").replace(/`?$/, "");
      if (!tables.includes(tableName) && !tableName.toLowerCase().includes("select")) {
        tables.push(tableName);
      }
    }
  }
  return tables;
}

function parseSingleAlternative(
  content: string,
  id: number,
  schemeLabel: string
): SQLAlternative | null {
  const approachMatch = content.match(/设计思路[：:]\s*([\s\S]*?)(?=\n\s*```sql|$)/i);
  const approach = approachMatch ? approachMatch[1].trim() : schemeLabel;

  const sqlMatch = content.match(/```sql\s*([\s\S]*?)\s*```/i);
  const sql = sqlMatch ? sqlMatch[1].trim() : "";

  const explanationMatch = content.match(/逻辑解释[：:]\s*([\s\S]*)/i);
  const explanation = explanationMatch
    ? explanationMatch[1].trim()
    : `这是${schemeLabel}，SQL逻辑已完整展示。`;

  if (!sql) {
    return null;
  }

  return {
    id,
    sql,
    explanation,
    approach,
    confidence: 0.7,
  };
}

function parseLLMResponse(response: string): SQLGenerationResult {
  const result: SQLGenerationResult = {
    sql: "",
    explanation: "",
    warnings: [],
    tablesUsed: [],
    columnsUsed: [],
    confidence: 0.7,
    alternatives: [],
  };

  const alternatives: SQLAlternative[] = [];

  const scheme1Match = response.match(/【方案1[：:]\s*([^】]*?)】\s*([\s\S]*?)(?=---|【方案2|$)/i);
  if (scheme1Match) {
    const alt = parseSingleAlternative(scheme1Match[2], 1, "推荐方案");
    if (alt) alternatives.push({ ...alt, confidence: 0.9 });
  }

  const scheme2Match = response.match(/【方案2[：:]\s*([^】]*?)】\s*([\s\S]*?)(?=---|【方案3|$)/i);
  if (scheme2Match) {
    const alt = parseSingleAlternative(scheme2Match[2], 2, "优化方案");
    if (alt) alternatives.push({ ...alt, confidence: 0.85 });
  }

  const scheme3Match = response.match(/【方案3[：:]\s*([^】]*?)】\s*([\s\S]*?)(?=---|【方案对比|【注意事项】|$)/i);
  if (scheme3Match) {
    const alt = parseSingleAlternative(scheme3Match[2], 3, "替代方案");
    if (alt) alternatives.push({ ...alt, confidence: 0.75 });
  }

  if (alternatives.length > 0) {
    result.alternatives = alternatives;
    result.sql = alternatives[0].sql;
    result.explanation = alternatives[0].explanation;
    result.tablesUsed = extractTablesFromSQL(alternatives[0].sql);
    result.confidence = alternatives[0].confidence;
  } else {
    const sqlMatch = response.match(/【SQL查询】\s*```sql\s*([\s\S]*?)\s*```/i);
    if (sqlMatch) {
      result.sql = sqlMatch[1].trim();
    } else {
      const fallbackSqlMatch = response.match(/```sql\s*([\s\S]*?)\s*```/i);
      if (fallbackSqlMatch) {
        result.sql = fallbackSqlMatch[1].trim();
      }
    }

    const explanationMatch = response.match(/【逻辑解释】([\s]*?)(?=【注意事项】|$)/i);
    if (explanationMatch) {
      result.explanation = explanationMatch[1].trim();
    }

    result.tablesUsed = extractTablesFromSQL(result.sql);
  }

  const notesMatch = response.match(/【注意事项】([\s\S]*)$/i);
  if (notesMatch) {
    const notes = notesMatch[1].trim();
    if (notes.includes("缺失") || notes.includes("未找到") || notes.includes("不确定")) {
      result.warnings.push(notes);
      result.confidence = 0.5;
    }
    if (notes.includes("所有字段均已在知识库中找到")) {
      result.confidence = 0.9;
    }
  }

  return result;
}

export interface RetrievalContext {
  tables: TableMetadata[];
  relations: RelationMetadata[];
  searchResults: SearchResult[];
}

export async function retrieveContextForQuery(
  userQuery: string,
  knowledgeBaseId?: string
): Promise<RetrievalContext> {
  const { tables, relations, searchResults } = await retrieveRelevantTables(
    userQuery,
    knowledgeBaseId
  );

  return { tables, relations, searchResults };
}

function buildReferences(
  tables: TableMetadata[],
  searchResults: SearchResult[],
  tablesUsed: string[]
): { tables: ReferenceTable[]; documents: ReferenceDocument[] } {
  const referenceTables: ReferenceTable[] = tables
    .filter((t) => tablesUsed.includes(t.name) || tablesUsed.length === 0)
    .map((t) => ({
      name: t.name,
      comment: t.tableComment || null,
      columns: t.columns.slice(0, 5).map((c) => c.name),
      reason: "语义检索匹配，与需求相关度高",
    }));

  const referenceDocuments: ReferenceDocument[] = searchResults.map((r) => ({
    title: r.documentTitle,
    knowledgeBaseName: r.knowledgeBaseName,
    similarity: r.similarity,
    content: r.content,
  }));

  return { tables: referenceTables, documents: referenceDocuments };
}

export async function generateSQLWithRAG(
  userQuery: string,
  options: {
    knowledgeBaseId?: string;
    dialect?: "mysql" | "postgresql" | "sqlite" | "mssql" | "oracle";
    streaming?: boolean;
  } = {}
): Promise<SQLGenerationResult> {
  const { knowledgeBaseId, dialect = "oracle", streaming = false } = options;

  console.log(`[SQL RAG] 开始生成SQL，需求: "${userQuery.substring(0, 80)}..."`);

  const { tables, relations, searchResults } = await retrieveRelevantTables(
    userQuery,
    knowledgeBaseId
  );

  console.log(
    `[SQL RAG] 检索到 ${tables.length} 个相关表, ${relations.length} 个关联关系`
  );

  if (tables.length === 0) {
    return {
      sql: "",
      explanation: "未找到可用的表结构，请先导入SQL文件到知识库。",
      warnings: ["知识库中没有找到任何表结构"],
      tablesUsed: [],
      columnsUsed: [],
      confidence: 0,
      references: { tables: [], documents: [] },
    };
  }

  const messages = buildSQLGenerationPrompt(
    userQuery,
    tables,
    relations,
    searchResults,
    dialect
  );

  const config = await getAIConfig();

  const { getChatModelInstance } = await import("@/lib/llm");

  const model = getChatModelInstance(
    config.llm.provider,
    config.llm.apiKey,
    config.llm.baseUrl,
    {
      model: config.llm.model,
      temperature: 0.1,
      maxTokens: 2048,
      streaming: false,
    }
  );

  console.log(
    `[SQL RAG] 调用LLM生成SQL，提供商: ${config.llm.provider}, 模型: ${config.llm.model}`
  );

  const response = await model.invoke(messages);
  const responseContent = response.content.toString();

  console.log(`[SQL RAG] LLM响应长度: ${responseContent.length}`);

  const result = parseLLMResponse(responseContent);

  result.references = buildReferences(tables, searchResults, result.tablesUsed);

  console.log(
    `[SQL RAG] SQL生成完成，使用了 ${result.tablesUsed.length} 个表，置信度: ${(result.confidence * 100).toFixed(1)}%`
  );

  return result;
}

export async function generateSQLWithRAGStream(
  userQuery: string,
  options: {
    knowledgeBaseId?: string;
    dialect?: "mysql" | "postgresql" | "sqlite" | "mssql" | "oracle";
  } = {}
): Promise<AsyncIterable<string>> {
  const { knowledgeBaseId, dialect = "oracle" } = options;

  console.log(`[SQL RAG] 开始流式生成SQL，需求: "${userQuery.substring(0, 80)}..."`);

  const { tables, relations, searchResults } = await retrieveRelevantTables(
    userQuery,
    knowledgeBaseId
  );

  console.log(
    `[SQL RAG] 检索到 ${tables.length} 个相关表, ${relations.length} 个关联关系`
  );

  const messages = buildSQLGenerationPrompt(
    userQuery,
    tables,
    relations,
    searchResults,
    dialect
  );

  const config = await getAIConfig();
  const { getChatModelInstance } = await import("@/lib/llm");

  const model = getChatModelInstance(
    config.llm.provider,
    config.llm.apiKey,
    config.llm.baseUrl,
    {
      model: config.llm.model,
      temperature: 0.1,
      maxTokens: 2048,
      streaming: true,
    }
  );

  const stream = await model.stream(messages);

  return (async function* () {
    for await (const chunk of stream) {
      const content = chunk.content.toString();
      if (content) {
        yield content;
      }
    }
  })();
}

export { formatTableContext, buildSQLPromptContext };
