import prisma from "@/lib/prisma";

export interface InferredRelation {
  fromTableId: string;
  fromTableName: string;
  fromColumnName: string;
  toTableId: string;
  toTableName: string;
  toColumnName: string;
  relationType: "ONE_TO_ONE" | "ONE_TO_MANY" | "MANY_TO_ONE" | "MANY_TO_MANY";
  confidence: number;
  inferenceType: "naming_convention" | "type_match" | "comment_match" | "primary_key_match" | "junction_table";
  reason: string;
}

export interface TableInfo {
  id: string;
  name: string;
  schemaName?: string | null;
  tableComment?: string | null;
  columns: ColumnInfo[];
}

export interface ColumnInfo {
  id: string;
  name: string;
  dataType: string;
  columnType?: string | null;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  columnComment?: string | null;
}

export interface RelationInferenceResult {
  relations: InferredRelation[];
  tablesAnalyzed: number;
  existingRelations: number;
  newRelations: number;
}

const NAMING_PATTERNS = [
  {
    name: "id_suffix",
    pattern: /^(.+)_id$/i,
    extractTableName: (match: RegExpExecArray) => match[1],
    confidence: 0.9,
  },
  {
    name: "id_suffix_no_underscore",
    pattern: /^(.+)id$/i,
    extractTableName: (match: RegExpExecArray) => match[1],
    confidence: 0.7,
  },
  {
    name: "singular_table_name",
    pattern: /^(.+)$/i,
    extractTableName: (match: RegExpExecArray) => match[1],
    confidence: 0.5,
  },
];

const PLURAL_SUFFIXES = ["s", "es"];

function pluralize(word: string): string[] {
  const lower = word.toLowerCase();
  const plurals: string[] = [word, word.toLowerCase()];
  
  for (const suffix of PLURAL_SUFFIXES) {
    plurals.push(word + suffix);
    plurals.push(lower + suffix);
  }
  
  if (lower.endsWith("y")) {
    const singular = lower.slice(0, -1);
    plurals.push(singular + "ies");
  }
  
  if (lower.endsWith("f")) {
    const singular = lower.slice(0, -1);
    plurals.push(singular + "ves");
  }
  
  return plurals;
}

function singularize(word: string): string {
  const lower = word.toLowerCase();
  
  if (lower.endsWith("ies")) {
    return lower.slice(0, -3) + "y";
  }
  if (lower.endsWith("ves")) {
    return lower.slice(0, -3) + "f";
  }
  if (lower.endsWith("es")) {
    return lower.slice(0, -2);
  }
  if (lower.endsWith("s")) {
    return lower.slice(0, -1);
  }
  return lower;
}

function matchTableName(candidate: string, tableNames: string[]): { matched: boolean; tableName?: string; confidence: number } {
  const candidateLower = candidate.toLowerCase();
  const singularCandidate = singularize(candidateLower);
  const pluralVariants = pluralize(candidateLower);
  
  for (const tableName of tableNames) {
    const tableLower = tableName.toLowerCase();
    const singularTable = singularize(tableLower);
    
    if (tableLower === candidateLower) {
      return { matched: true, tableName, confidence: 0.95 };
    }
    
    if (singularTable === candidateLower) {
      return { matched: true, tableName, confidence: 0.85 };
    }
    
    if (tableLower === singularCandidate) {
      return { matched: true, tableName, confidence: 0.85 };
    }
    
    if (pluralVariants.includes(tableLower)) {
      return { matched: true, tableName, confidence: 0.75 };
    }
  }
  
  return { matched: false, confidence: 0 };
}

export class TableRelationInferrer {
  private knowledgeBaseId?: string;

  constructor(knowledgeBaseId?: string) {
    this.knowledgeBaseId = knowledgeBaseId;
  }

  async inferRelations(): Promise<RelationInferenceResult> {
    const tables = await this.loadTables();
    const existingRelations = await this.loadExistingRelations();
    
    const inferredRelations: InferredRelation[] = [];
    const tableNames = tables.map(t => t.name);
    
    for (const table of tables) {
      for (const column of table.columns) {
        if (column.isPrimaryKey) continue;
        
        const relations = this.inferRelationsForColumn(column, table, tables, tableNames, existingRelations);
        inferredRelations.push(...relations);
      }
    }
    
    const junctionTableRelations = await this.inferJunctionTableRelations(tables, existingRelations);
    inferredRelations.push(...junctionTableRelations);
    
    const dedupedRelations = this.deduplicateRelations(inferredRelations);
    const newRelations = this.filterExistingRelations(dedupedRelations, existingRelations);
    
    return {
      relations: newRelations,
      tablesAnalyzed: tables.length,
      existingRelations: existingRelations.length,
      newRelations: newRelations.length,
    };
  }

  private async loadTables(): Promise<TableInfo[]> {
    const whereClause = this.knowledgeBaseId
      ? { knowledgeBaseId: this.knowledgeBaseId }
      : {};

    const tables = await prisma.databaseTable.findMany({
      where: whereClause,
      include: {
        columns: true,
      },
    });

    return tables.map(table => ({
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
    }));
  }

  private async loadExistingRelations(): Promise<Array<{
    fromTableId: string;
    fromColumnName: string;
    toTableId: string;
    toColumnName: string;
  }>> {
    const whereClause = this.knowledgeBaseId
      ? { knowledgeBaseId: this.knowledgeBaseId }
      : {};

    const relations = await prisma.tableRelation.findMany({
      where: whereClause,
      select: {
        fromTableId: true,
        fromColumnName: true,
        toTableId: true,
        toColumnName: true,
      },
    });

    return relations;
  }

  private inferRelationsForColumn(
    column: ColumnInfo,
    table: TableInfo,
    tables: TableInfo[],
    tableNames: string[],
    existingRelations: Array<{ fromTableId: string; fromColumnName: string; toTableId: string; toColumnName: string }>
  ): InferredRelation[] {
    const relations: InferredRelation[] = [];
    const columnLower = column.name.toLowerCase();
    
    for (const pattern of NAMING_PATTERNS) {
      const match = pattern.pattern.exec(column.name);
      if (!match) continue;
      
      const candidateTableName = pattern.extractTableName(match);
      if (!candidateTableName) continue;
      
      const tableMatch = matchTableName(candidateTableName, tableNames);
      
      if (tableMatch.matched && tableMatch.tableName) {
        const targetTable = tables.find(t => 
          t.name.toLowerCase() === tableMatch.tableName!.toLowerCase()
        );
        
        if (targetTable) {
          const primaryKeys = targetTable.columns.filter(c => c.isPrimaryKey);
          
          if (primaryKeys.length > 0) {
            for (const pk of primaryKeys) {
              if (this.dataTypesMatch(column.dataType, pk.dataType)) {
                const confidence = Math.min(
                  pattern.confidence * tableMatch.confidence,
                  0.98
                );
                
                const isExists = existingRelations.some(r => 
                  r.fromTableId === table.id &&
                  r.fromColumnName === column.name &&
                  r.toTableId === targetTable.id &&
                  r.toColumnName === pk.name
                );
                
                if (!isExists) {
                  relations.push({
                    fromTableId: table.id,
                    fromTableName: table.name,
                    fromColumnName: column.name,
                    toTableId: targetTable.id,
                    toTableName: targetTable.name,
                    toColumnName: pk.name,
                    relationType: "MANY_TO_ONE",
                    confidence,
                    inferenceType: "naming_convention",
                    reason: `字段名 ${column.name} 匹配命名模式，推测关联表 ${targetTable.name} 的主键 ${pk.name}`,
                  });
                }
              }
            }
          } else {
            const idColumn = targetTable.columns.find(c => 
              c.name.toLowerCase() === "id"
            );
            
            if (idColumn && this.dataTypesMatch(column.dataType, idColumn.dataType)) {
              const confidence = Math.min(
                pattern.confidence * tableMatch.confidence * 0.8,
                0.9
              );
              
              relations.push({
                fromTableId: table.id,
                fromTableName: table.name,
                fromColumnName: column.name,
                toTableId: targetTable.id,
                toTableName: targetTable.name,
                toColumnName: idColumn.name,
                relationType: "MANY_TO_ONE",
                confidence,
                inferenceType: "naming_convention",
                reason: `字段名 ${column.name} 匹配命名模式，推测关联表 ${targetTable.name} 的 id 字段`,
              });
            }
          }
        }
      }
    }
    
    const commentRelations = this.inferFromComment(column, table, tables);
    relations.push(...commentRelations);
    
    return relations;
  }

  private inferFromComment(
    column: ColumnInfo,
    table: TableInfo,
    tables: TableInfo[]
  ): InferredRelation[] {
    const relations: InferredRelation[] = [];
    
    if (!column.columnComment) return relations;
    
    const comment = column.columnComment.toLowerCase();
    
    const referencePatterns = [
      /引用\s*['"]?([^\s'"]+)['"]?/i,
      /关联\s*['"]?([^\s'"]+)['"]?/i,
      /指向\s*['"]?([^\s'"]+)['"]?/i,
      /外键\s*['"]?([^\s'"]+)['"]?/i,
      /reference\s+(\w+)/i,
      /foreign\s+key\s+to\s+(\w+)/i,
    ];
    
    for (const pattern of referencePatterns) {
      const match = pattern.exec(comment);
      if (match) {
        const referencedName = match[1];
        const targetTable = tables.find(t => 
          t.name.toLowerCase() === referencedName.toLowerCase() ||
          singularize(t.name.toLowerCase()) === referencedName.toLowerCase()
        );
        
        if (targetTable) {
          const primaryKeys = targetTable.columns.filter(c => c.isPrimaryKey);
          const targetColumn = primaryKeys.length > 0 
            ? primaryKeys[0] 
            : targetTable.columns.find(c => c.name.toLowerCase() === "id");
          
          if (targetColumn && this.dataTypesMatch(column.dataType, targetColumn.dataType)) {
            relations.push({
              fromTableId: table.id,
              fromTableName: table.name,
              fromColumnName: column.name,
              toTableId: targetTable.id,
              toTableName: targetTable.name,
              toColumnName: targetColumn.name,
              relationType: "MANY_TO_ONE",
              confidence: 0.8,
              inferenceType: "comment_match",
              reason: `字段注释 "${column.columnComment}" 中提及引用表 ${targetTable.name}`,
            });
          }
        }
      }
    }
    
    return relations;
  }

  private async inferJunctionTableRelations(
    tables: TableInfo[],
    existingRelations: Array<{ fromTableId: string; fromColumnName: string; toTableId: string; toColumnName: string }>
  ): Promise<InferredRelation[]> {
    const relations: InferredRelation[] = [];
    
    for (const table of tables) {
      const columns = table.columns;
      const foreignKeyCandidates = columns.filter(c => !c.isPrimaryKey);
      
      const idColumns = columns.filter(c => 
        c.name.toLowerCase().endsWith("_id") || 
        c.name.toLowerCase() === "id"
      );
      
      const nonIdColumns = columns.filter(c => 
        !c.name.toLowerCase().endsWith("_id") && 
        c.name.toLowerCase() !== "id"
      );
      
      const isJunctionTable = 
        (idColumns.length >= 2 && nonIdColumns.length <= 2) ||
        (foreignKeyCandidates.length >= 2 && columns.length <= 5);
      
      if (isJunctionTable) {
        const referencedTables: Array<{ table: TableInfo; column: ColumnInfo }> = [];
        
        for (const column of idColumns) {
          if (column.name.toLowerCase() === "id") continue;
          
          for (const pattern of NAMING_PATTERNS.slice(0, 2)) {
            const match = pattern.pattern.exec(column.name);
            if (match) {
              const candidateTableName = pattern.extractTableName(match);
              const targetTable = tables.find(t => {
                const singular = singularize(t.name.toLowerCase());
                return singular === candidateTableName.toLowerCase() ||
                       t.name.toLowerCase() === candidateTableName.toLowerCase();
              });
              
              if (targetTable) {
                const primaryKeys = targetTable.columns.filter(c => c.isPrimaryKey);
                const targetColumn = primaryKeys.length > 0 
                  ? primaryKeys[0] 
                  : targetTable.columns.find(c => c.name.toLowerCase() === "id");
                
                if (targetColumn) {
                  referencedTables.push({ table: targetTable, column: targetColumn });
                }
              }
            }
          }
        }
        
        if (referencedTables.length >= 2) {
          for (let i = 0; i < referencedTables.length; i++) {
            for (let j = i + 1; j < referencedTables.length; j++) {
              const table1 = referencedTables[i];
              const table2 = referencedTables[j];
              
              const exists1 = existingRelations.some(r =>
                r.fromTableId === table1.table.id &&
                r.toTableId === table2.table.id
              );
              
              if (!exists1) {
                relations.push({
                  fromTableId: table1.table.id,
                  fromTableName: table1.table.name,
                  fromColumnName: table1.column.name,
                  toTableId: table2.table.id,
                  toTableName: table2.table.name,
                  toColumnName: table2.column.name,
                  relationType: "MANY_TO_MANY",
                  confidence: 0.85,
                  inferenceType: "junction_table",
                  reason: `表 ${table.name} 被识别为关联表，建立 ${table1.table.name} 和 ${table2.table.name} 之间的多对多关系`,
                });
              }
            }
          }
        }
      }
    }
    
    return relations;
  }

  private dataTypesMatch(type1: string, type2: string): boolean {
    const t1 = type1.toLowerCase();
    const t2 = type2.toLowerCase();
    
    const integerTypes = ["int", "integer", "bigint", "smallint", "tinyint", "mediumint"];
    const stringTypes = ["varchar", "char", "text", "longtext", "mediumtext", "tinytext", "string"];
    const uuidTypes = ["uuid", "uniqueidentifier"];
    const datetimeTypes = ["datetime", "timestamp", "date", "time"];
    const decimalTypes = ["decimal", "numeric", "float", "double", "real"];
    const booleanTypes = ["boolean", "bool", "bit"];
    
    const typeGroups = [integerTypes, stringTypes, uuidTypes, datetimeTypes, decimalTypes, booleanTypes];
    
    for (const group of typeGroups) {
      const t1InGroup = group.some(t => t1.includes(t));
      const t2InGroup = group.some(t => t2.includes(t));
      
      if (t1InGroup && t2InGroup) return true;
    }
    
    if (t1 === t2) return true;
    
    return false;
  }

  private deduplicateRelations(relations: InferredRelation[]): InferredRelation[] {
    const seen = new Map<string, InferredRelation>();
    
    for (const relation of relations) {
      const key = `${relation.fromTableId}:${relation.fromColumnName}:${relation.toTableId}:${relation.toColumnName}`;
      
      const existing = seen.get(key);
      if (!existing || relation.confidence > existing.confidence) {
        seen.set(key, relation);
      }
    }
    
    return Array.from(seen.values());
  }

  private filterExistingRelations(
    relations: InferredRelation[],
    existingRelations: Array<{ fromTableId: string; fromColumnName: string; toTableId: string; toColumnName: string }>
  ): InferredRelation[] {
    return relations.filter(relation => {
      return !existingRelations.some(existing =>
        existing.fromTableId === relation.fromTableId &&
        existing.fromColumnName === relation.fromColumnName &&
        existing.toTableId === relation.toTableId &&
        existing.toColumnName === relation.toColumnName
      );
    });
  }

  async saveInferredRelations(relations: InferredRelation[]): Promise<number> {
    let savedCount = 0;
    
    for (const relation of relations) {
      try {
        await prisma.tableRelation.create({
          data: {
            fromTableId: relation.fromTableId,
            fromColumnName: relation.fromColumnName,
            toTableId: relation.toTableId,
            toColumnName: relation.toColumnName,
            relationType: relation.relationType,
            joinCondition: `${relation.fromTableName}.${relation.fromColumnName} = ${relation.toTableName}.${relation.toColumnName}`,
            knowledgeBaseId: this.knowledgeBaseId || null,
          },
        });
        savedCount++;
      } catch (error) {
        console.warn(`保存关系失败: ${relation.fromTableName}.${relation.fromColumnName} -> ${relation.toTableName}.${relation.toColumnName}`, error);
      }
    }
    
    return savedCount;
  }
}

export async function inferAndSaveRelations(knowledgeBaseId?: string): Promise<{
  inferred: number;
  saved: number;
  relations: InferredRelation[];
}> {
  const inferrer = new TableRelationInferrer(knowledgeBaseId);
  const result = await inferrer.inferRelations();
  const saved = await inferrer.saveInferredRelations(result.relations);
  
  return {
    inferred: result.newRelations,
    saved,
    relations: result.relations,
  };
}
