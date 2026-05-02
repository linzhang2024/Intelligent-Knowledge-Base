export interface ReportRequirement {
  rawInput: string;
  parsedElements: SQLElements;
  ambiguousParts: AmbiguousPart[];
  confidence: number;
  suggestions: Suggestion[];
}

export interface SQLElements {
  selectColumns: SelectColumn[];
  fromTables: FromTable[];
  whereConditions: WhereCondition[];
  joinConditions: JoinCondition[];
  groupByColumns: string[];
  havingConditions: HavingCondition[];
  orderBy: OrderBy[];
  limit: LimitClause | null;
  aggregates: AggregateFunction[];
  dateRange: DateRange | null;
  keywords: string[];
}

export interface SelectColumn {
  columnName: string;
  tableName?: string;
  alias?: string;
  isAggregate: boolean;
  aggregateType?: AggregateType;
  rawExpression?: string;
  confidence: number;
}

export interface FromTable {
  tableName: string;
  alias?: string;
  isSubquery?: boolean;
  confidence: number;
}

export interface WhereCondition {
  columnName: string;
  tableName?: string;
  operator: ComparisonOperator;
  value: string | number | boolean | null;
  valueType: "string" | "number" | "date" | "boolean" | "null" | "column";
  rawCondition?: string;
  logicalOperator: "AND" | "OR";
  confidence: number;
}

export interface JoinCondition {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  joinType: JoinType;
  condition?: string;
  confidence: number;
}

export interface HavingCondition {
  aggregateType: AggregateType;
  columnName: string;
  operator: ComparisonOperator;
  value: string | number;
  confidence: number;
}

export interface OrderBy {
  columnName: string;
  tableName?: string;
  direction: "ASC" | "DESC";
  confidence: number;
}

export interface LimitClause {
  limit: number;
  offset?: number;
}

export interface AggregateFunction {
  type: AggregateType;
  columnName: string;
  alias?: string;
  confidence: number;
}

export interface DateRange {
  columnName: string;
  startDate?: string;
  endDate?: string;
  period?: string;
  confidence: number;
}

export interface AmbiguousPart {
  text: string;
  possibleInterpretations: Interpretation[];
  suggestion: string;
}

export interface Interpretation {
  interpretation: string;
  sqlElement: string;
  confidence: number;
}

export interface Suggestion {
  type: "clarification" | "alternative" | "improvement";
  message: string;
  alternativeQuery?: string;
}

export type AggregateType = "SUM" | "COUNT" | "AVG" | "MAX" | "MIN" | "FIRST" | "LAST" | "DISTINCT_COUNT";
export type ComparisonOperator = "=" | "!=" | "<>" | ">" | "<" | ">=" | "<=" | "LIKE" | "NOT LIKE" | "IN" | "NOT IN" | "IS NULL" | "IS NOT NULL" | "BETWEEN";
export type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS";

const AGGREGATE_KEYWORDS: Record<string, AggregateType> = {
  "总和": "SUM",
  "总金额": "SUM",
  "总数": "COUNT",
  "数量": "COUNT",
  "条数": "COUNT",
  "平均": "AVG",
  "平均值": "AVG",
  "最大": "MAX",
  "最大值": "MAX",
  "最小": "MIN",
  "最小值": "MIN",
  "sum": "SUM",
  "total": "SUM",
  "count": "COUNT",
  "number": "COUNT",
  "average": "AVG",
  "avg": "AVG",
  "max": "MAX",
  "maximum": "MAX",
  "min": "MIN",
  "minimum": "MIN",
  "distinct count": "DISTINCT_COUNT",
  "去重计数": "DISTINCT_COUNT",
};

const COMPARISON_OPERATORS: Record<string, ComparisonOperator> = {
  "等于": "=",
  "是": "=",
  "为": "=",
  "不等于": "!=",
  "不是": "!=",
  "大于": ">",
  "超过": ">",
  "小于": "<",
  "低于": "<",
  "大于等于": ">=",
  "不小于": ">=",
  "小于等于": "<=",
  "不大于": "<=",
  "包含": "LIKE",
  "包含于": "LIKE",
  "不包含": "NOT LIKE",
  "在": "IN",
  "在...中": "IN",
  "不在": "NOT IN",
  "为空": "IS NULL",
  "是null": "IS NULL",
  "不为空": "IS NOT NULL",
  "不是null": "IS NOT NULL",
  "之间": "BETWEEN",
  "在...之间": "BETWEEN",
  "=": "=",
  "==": "=",
  "!=": "!=",
  "<>": "<>",
  ">": ">",
  "<": "<",
  ">=": ">=",
  "<=": "<=",
};

const DATE_KEYWORDS = ["日期", "时间", "年", "月", "日", "季度", "周", "date", "time", "year", "month", "day", "quarter", "week"];
const GROUP_KEYWORDS = ["按", "按照", "根据", "分组", "group", "group by", "per"];
const ORDER_KEYWORDS = ["排序", "按...排序", "order", "order by", "sort", "desc", "asc", "倒序", "正序", "升序", "降序"];
const LIMIT_KEYWORDS = ["前", "top", "limit", "最多", "只取"];

export class ReportRequirementParser {
  private tableKeywords: Map<string, string[]> = new Map();
  private columnKeywords: Map<string, { table: string; column: string; aliases: string[] }[]> = new Map();

  setTableMappings(tables: Array<{ name: string; comment?: string | null; columns: Array<{ name: string; comment?: string | null }> }>) {
    for (const table of tables) {
      const tableKeywords: string[] = [table.name.toLowerCase()];
      
      if (table.comment) {
        tableKeywords.push(...this.extractKeywords(table.comment));
      }
      
      const singularName = table.name.toLowerCase().replace(/s$/, "");
      if (singularName !== table.name.toLowerCase()) {
        tableKeywords.push(singularName);
      }
      
      this.tableKeywords.set(table.name.toLowerCase(), tableKeywords);
      
      for (const column of table.columns) {
        const columnKey = column.name.toLowerCase();
        const aliases: string[] = [columnKey];
        
        if (column.comment) {
          aliases.push(...this.extractKeywords(column.comment));
        }
        
        if (!this.columnKeywords.has(columnKey)) {
          this.columnKeywords.set(columnKey, []);
        }
        this.columnKeywords.get(columnKey)!.push({
          table: table.name,
          column: column.name,
          aliases,
        });
      }
    }
  }

  private extractKeywords(text: string): string[] {
    const keywords: string[] = [];
    const words = text.split(/[\s,，。、；;()（）]+/);
    
    for (const word of words) {
      const trimmed = word.trim().toLowerCase();
      if (trimmed && trimmed.length > 1) {
        keywords.push(trimmed);
      }
    }
    
    return keywords;
  }

  parse(requirement: string): ReportRequirement {
    const elements: SQLElements = {
      selectColumns: [],
      fromTables: [],
      whereConditions: [],
      joinConditions: [],
      groupByColumns: [],
      havingConditions: [],
      orderBy: [],
      limit: null,
      aggregates: [],
      dateRange: null,
      keywords: [],
    };

    const ambiguousParts: AmbiguousPart[] = [];
    const suggestions: Suggestion[] = [];
    let totalConfidence = 0;
    let confidenceCount = 0;

    const lowerRequirement = requirement.toLowerCase();
    const words = this.tokenize(requirement);

    this.parseAggregates(words, elements, lowerRequirement);
    this.parseTables(words, elements, lowerRequirement);
    this.parseColumns(words, elements, lowerRequirement);
    this.parseConditions(words, elements, lowerRequirement);
    this.parseGroupBy(words, elements, lowerRequirement);
    this.parseOrderBy(words, elements, lowerRequirement);
    this.parseLimit(words, elements, lowerRequirement);
    this.parseDateRange(words, elements, lowerRequirement);

    if (elements.fromTables.length === 0) {
      ambiguousParts.push({
        text: "未明确指定表名",
        possibleInterpretations: [],
        suggestion: "请明确指定需要查询的表名",
      });
    }

    if (elements.selectColumns.length === 0 && elements.aggregates.length === 0) {
      ambiguousParts.push({
        text: "未明确指定查询字段",
        possibleInterpretations: [
          { interpretation: "查询所有字段", sqlElement: "SELECT *", confidence: 0.5 },
          { interpretation: "查询主键或常用字段", sqlElement: "SELECT id, name...", confidence: 0.4 },
        ],
        suggestion: "建议明确指定需要查询的字段",
      });
      
      suggestions.push({
        type: "clarification",
        message: "未明确指定查询字段，系统将默认查询所有字段",
      });
    }

    for (const col of elements.selectColumns) {
      totalConfidence += col.confidence;
      confidenceCount++;
    }
    for (const cond of elements.whereConditions) {
      totalConfidence += cond.confidence;
      confidenceCount++;
    }
    for (const table of elements.fromTables) {
      totalConfidence += table.confidence;
      confidenceCount++;
    }
    for (const agg of elements.aggregates) {
      totalConfidence += agg.confidence;
      confidenceCount++;
    }

    const overallConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0.3;

    return {
      rawInput: requirement,
      parsedElements: elements,
      ambiguousParts,
      confidence: overallConfidence,
      suggestions,
    };
  }

  private tokenize(text: string): string[] {
    const tokens: string[] = [];
    const regex = /[\u4e00-\u9fa5]+|[a-zA-Z_][a-zA-Z0-9_]*|\d+\.?\d*|[<>=!]+|'[^']*'|"[^"]*"|\S/g;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
      tokens.push(match[0]);
    }
    
    return tokens;
  }

  private parseAggregates(tokens: string[], elements: SQLElements, lowerRequirement: string) {
    for (const [keyword, aggType] of Object.entries(AGGREGATE_KEYWORDS)) {
      const keywordIndex = lowerRequirement.indexOf(keyword.toLowerCase());
      
      if (keywordIndex !== -1) {
        const afterKeyword = lowerRequirement.substring(keywordIndex + keyword.length);
        
        let targetColumn = "";
        let confidence = 0.5;
        
        for (const [columnName, columnInfos] of this.columnKeywords.entries()) {
          for (const colInfo of columnInfos) {
            const colMatch = afterKeyword.includes(columnName);
            const aliasMatch = colInfo.aliases.some(a => afterKeyword.includes(a.toLowerCase()));
            
            if (colMatch || aliasMatch) {
              targetColumn = colInfo.column;
              confidence = aliasMatch ? 0.8 : 0.7;
              break;
            }
          }
        }
        
        if (!targetColumn) {
          const numberMatch = afterKeyword.match(/\d+/);
          if (numberMatch) {
            targetColumn = "*";
            confidence = 0.6;
          } else {
            targetColumn = "*";
            confidence = 0.4;
          }
        }
        
        elements.aggregates.push({
          type: aggType,
          columnName: targetColumn,
          confidence,
        });
        
        elements.selectColumns.push({
          columnName: targetColumn,
          isAggregate: true,
          aggregateType: aggType,
          confidence,
        });
      }
    }
  }

  private parseTables(tokens: string[], elements: SQLElements, lowerRequirement: string) {
    for (const [tableName, keywords] of this.tableKeywords.entries()) {
      let matched = false;
      let confidence = 0.5;
      
      if (lowerRequirement.includes(tableName)) {
        matched = true;
        confidence = 0.9;
      }
      
      for (const keyword of keywords) {
        if (keyword.length > 2 && lowerRequirement.includes(keyword)) {
          matched = true;
          confidence = Math.max(confidence, 0.75);
        }
      }
      
      if (matched) {
        const existing = elements.fromTables.find(t => 
          t.tableName.toLowerCase() === tableName.toLowerCase()
        );
        
        if (!existing) {
          elements.fromTables.push({
            tableName: tableName,
            confidence,
          });
        }
      }
    }
  }

  private parseColumns(tokens: string[], elements: SQLElements, lowerRequirement: string) {
    for (const [columnName, columnInfos] of this.columnKeywords.entries()) {
      for (const colInfo of columnInfos) {
        let matched = false;
        let confidence = 0.5;
        
        if (lowerRequirement.includes(colInfo.column.toLowerCase())) {
          matched = true;
          confidence = 0.85;
        }
        
        for (const alias of colInfo.aliases) {
          if (alias.length > 1 && lowerRequirement.includes(alias.toLowerCase())) {
            matched = true;
            confidence = Math.max(confidence, 0.75);
          }
        }
        
        if (matched) {
          const tableInRequirement = elements.fromTables.some(t => 
            t.tableName.toLowerCase() === colInfo.table.toLowerCase()
          );
          
          if (tableInRequirement || elements.fromTables.length === 0) {
            const existing = elements.selectColumns.find(c => 
              c.columnName.toLowerCase() === colInfo.column.toLowerCase() &&
              (!c.tableName || c.tableName.toLowerCase() === colInfo.table.toLowerCase())
            );
            
            if (!existing && !colInfo.column.toLowerCase().includes("id")) {
              elements.selectColumns.push({
                columnName: colInfo.column,
                tableName: colInfo.table,
                isAggregate: false,
                confidence,
              });
            }
          }
        }
      }
    }
  }

  private parseConditions(tokens: string[], elements: SQLElements, lowerRequirement: string) {
    for (const [operatorKeyword, operator] of Object.entries(COMPARISON_OPERATORS)) {
      const operatorIndex = lowerRequirement.indexOf(operatorKeyword.toLowerCase());
      
      if (operatorIndex !== -1) {
        const beforeOperator = lowerRequirement.substring(0, operatorIndex);
        const afterOperator = lowerRequirement.substring(operatorIndex + operatorKeyword.length);
        
        let columnName = "";
        let value: string | number = "";
        let confidence = 0.5;
        
        for (const [colName, columnInfos] of this.columnKeywords.entries()) {
          for (const colInfo of columnInfos) {
            if (beforeOperator.includes(colInfo.column.toLowerCase())) {
              columnName = colInfo.column;
              confidence = 0.8;
              break;
            }
            for (const alias of colInfo.aliases) {
              if (beforeOperator.includes(alias.toLowerCase())) {
                columnName = colInfo.column;
                confidence = 0.7;
                break;
              }
            }
          }
        }
        
        if (!columnName) {
          const beforeWords = beforeOperator.trim().split(/[\s，。,]+/);
          if (beforeWords.length > 0) {
            columnName = beforeWords[beforeWords.length - 1];
            confidence = 0.4;
          }
        }
        
        const numberMatch = afterOperator.match(/\d+\.?\d*/);
        const stringMatch = afterOperator.match(/['"]([^'"]+)['"]/);
        
        if (numberMatch) {
          value = parseFloat(numberMatch[0]);
          confidence += 0.1;
        } else if (stringMatch) {
          value = stringMatch[1];
          confidence += 0.1;
        } else {
          const afterWords = afterOperator.trim().split(/[\s，。,]+/);
          if (afterWords.length > 0) {
            value = afterWords[0];
          }
        }
        
        if (columnName) {
          const existing = elements.whereConditions.find(c =>
            c.columnName.toLowerCase() === columnName.toLowerCase() &&
            c.operator === operator
          );
          
          if (!existing) {
            elements.whereConditions.push({
              columnName,
              operator,
              value,
              valueType: typeof value === "number" ? "number" : "string",
              logicalOperator: "AND",
              confidence: Math.min(confidence, 0.95),
            });
          }
        }
      }
    }
  }

  private parseGroupBy(tokens: string[], elements: SQLElements, lowerRequirement: string) {
    for (const keyword of GROUP_KEYWORDS) {
      const keywordIndex = lowerRequirement.indexOf(keyword.toLowerCase());
      
      if (keywordIndex !== -1) {
        const afterKeyword = lowerRequirement.substring(keywordIndex + keyword.length);
        
        for (const [columnName, columnInfos] of this.columnKeywords.entries()) {
          for (const colInfo of columnInfos) {
            if (afterKeyword.includes(colInfo.column.toLowerCase()) ||
                colInfo.aliases.some(a => afterKeyword.includes(a.toLowerCase()))) {
              if (!elements.groupByColumns.includes(colInfo.column)) {
                elements.groupByColumns.push(colInfo.column);
              }
            }
          }
        }
      }
    }
  }

  private parseOrderBy(tokens: string[], elements: SQLElements, lowerRequirement: string) {
    const hasDesc = lowerRequirement.includes("降序") || 
                     lowerRequirement.includes("倒序") ||
                     lowerRequirement.includes("desc");

    for (const keyword of ORDER_KEYWORDS) {
      const keywordIndex = lowerRequirement.indexOf(keyword.toLowerCase());
      
      if (keywordIndex !== -1) {
        const aroundKeyword = lowerRequirement.substring(
          Math.max(0, keywordIndex - 30),
          keywordIndex + keyword.length + 30
        );
        
        for (const [columnName, columnInfos] of this.columnKeywords.entries()) {
          for (const colInfo of columnInfos) {
            if (aroundKeyword.includes(colInfo.column.toLowerCase()) ||
                colInfo.aliases.some(a => aroundKeyword.includes(a.toLowerCase()))) {
              const existing = elements.orderBy.find(o =>
                o.columnName.toLowerCase() === colInfo.column.toLowerCase()
              );
              
              if (!existing) {
                elements.orderBy.push({
                  columnName: colInfo.column,
                  tableName: colInfo.table,
                  direction: hasDesc ? "DESC" : "ASC",
                  confidence: 0.75,
                });
              }
            }
          }
        }
      }
    }
  }

  private parseLimit(tokens: string[], elements: SQLElements, lowerRequirement: string) {
    for (const keyword of LIMIT_KEYWORDS) {
      const keywordIndex = lowerRequirement.indexOf(keyword.toLowerCase());
      
      if (keywordIndex !== -1) {
        const afterKeyword = lowerRequirement.substring(keywordIndex + keyword.length);
        const numberMatch = afterKeyword.match(/\d+/);
        
        if (numberMatch) {
          const limit = parseInt(numberMatch[0], 10);
          
          if (!elements.limit || elements.limit.limit > limit) {
            elements.limit = { limit };
          }
        }
      }
    }
  }

  private parseDateRange(tokens: string[], elements: SQLElements, lowerRequirement: string) {
    for (const dateKeyword of DATE_KEYWORDS) {
      const keywordIndex = lowerRequirement.indexOf(dateKeyword.toLowerCase());
      
      if (keywordIndex !== -1) {
        const aroundKeyword = lowerRequirement.substring(
          Math.max(0, keywordIndex - 20),
          keywordIndex + dateKeyword.length + 50
        );
        
        const datePatterns = [
          /(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/g,
          /(\d{4})[年/-](\d{1,2})/g,
          /(\d{4})年/g,
        ];
        
        const dates: string[] = [];
        for (const pattern of datePatterns) {
          let match;
          while ((match = pattern.exec(aroundKeyword)) !== null) {
            dates.push(match[0]);
          }
        }
        
        const periodKeywords = ["本周", "本月", "本季度", "今年", "上周", "上月", "去年", "最近一周", "最近一月", "最近三个月"];
        let period: string | undefined;
        
        for (const pk of periodKeywords) {
          if (lowerRequirement.includes(pk)) {
            period = pk;
            break;
          }
        }
        
        let dateColumn = "";
        for (const [columnName, columnInfos] of this.columnKeywords.entries()) {
          for (const colInfo of columnInfos) {
            if (DATE_KEYWORDS.some(dk => 
              colInfo.column.toLowerCase().includes(dk.toLowerCase()) ||
              colInfo.aliases.some(a => a.toLowerCase().includes(dk.toLowerCase()))
            )) {
              if (aroundKeyword.includes(colInfo.column.toLowerCase()) ||
                  colInfo.aliases.some(a => aroundKeyword.includes(a.toLowerCase()))) {
                dateColumn = colInfo.column;
                break;
              }
            }
          }
        }
        
        if (dateColumn || period) {
          elements.dateRange = {
            columnName: dateColumn || "create_time",
            startDate: dates[0],
            endDate: dates[1],
            period,
            confidence: 0.7,
          };
        }
      }
    }
  }
}

export function parseReportRequirement(
  requirement: string,
  tables?: Array<{ name: string; comment?: string | null; columns: Array<{ name: string; comment?: string | null }> }>
): ReportRequirement {
  const parser = new ReportRequirementParser();
  
  if (tables) {
    parser.setTableMappings(tables);
  }
  
  return parser.parse(requirement);
}
