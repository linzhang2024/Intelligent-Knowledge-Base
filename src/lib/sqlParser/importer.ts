import prisma from "@/lib/prisma";
import {
  ParsedTable,
  ParsedForeignKey,
  SQLImportResult,
  SQLParseResult,
} from "./types";
import { parseSQL } from "./parser";

export interface ImportOptions {
  knowledgeBaseId?: string;
  documentId?: string;
  userId?: string;
  overwriteExisting?: boolean;
  inferRelations?: boolean;
  dialect?: "mysql" | "postgresql" | "sqlite" | "oracle" | "mssql" | "generic";
}

export class SQLImporter {
  private options: ImportOptions;

  constructor(options: ImportOptions = {}) {
    this.options = {
      overwriteExisting: false,
      inferRelations: true,
      dialect: "generic",
      ...options,
    };
  }

  async importFromSQL(
    sqlContent: string,
    options?: ImportOptions
  ): Promise<SQLImportResult> {
    const mergedOptions = { ...this.options, ...options };
    const errors: string[] = [];
    const warnings: string[] = [];
    const tableNames: string[] = [];
    let tablesImported = 0;
    let columnsImported = 0;
    let relationsImported = 0;

    try {
      const parseResult = parseSQL(sqlContent, mergedOptions.dialect);

      if (parseResult.errors.length > 0) {
        for (const err of parseResult.errors) {
          if (err.severity === "error") {
            errors.push(`行 ${err.line}: ${err.message}`);
          } else {
            warnings.push(`行 ${err.line}: ${err.message}`);
          }
        }
      }

      if (parseResult.tables.length === 0) {
        warnings.push("未在SQL文件中找到建表语句");
        return {
          success: errors.length === 0,
          tablesImported: 0,
          columnsImported: 0,
          relationsImported: 0,
          errors,
          warnings,
          tableNames: [],
        };
      }

      for (const table of parseResult.tables) {
        try {
          const result = await this.importTable(table, mergedOptions);
          if (result.success) {
            tablesImported++;
            columnsImported += result.columnsImported;
            relationsImported += result.relationsImported;
            tableNames.push(table.name);
          } else {
            errors.push(`表 ${table.name} 导入失败: ${result.error}`);
          }
        } catch (error) {
          errors.push(`表 ${table.name} 导入异常: ${error instanceof Error ? error.message : "未知错误"}`);
        }
      }

      if (mergedOptions.inferRelations) {
        const inferredRelations = await this.inferImplicitRelations(
          parseResult.tables,
          mergedOptions
        );
        relationsImported += inferredRelations;
      }
    } catch (error) {
      errors.push(`SQL解析失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }

    return {
      success: errors.length === 0,
      tablesImported,
      columnsImported,
      relationsImported,
      errors,
      warnings,
      tableNames,
    };
  }

  private async importTable(
    table: ParsedTable,
    options: ImportOptions
  ): Promise<{ success: boolean; columnsImported: number; relationsImported: number; error?: string }> {
    let columnsImported = 0;
    let relationsImported = 0;

    try {
      const existingTable = await prisma.databaseTable.findFirst({
        where: {
          name: table.name,
          schemaName: table.schemaName || null,
          knowledgeBaseId: options.knowledgeBaseId || null,
        },
      });

      if (existingTable && !options.overwriteExisting) {
        return { success: true, columnsImported: 0, relationsImported: 0 };
      }

      let databaseTable;

      if (existingTable) {
        databaseTable = await prisma.databaseTable.update({
          where: { id: existingTable.id },
          data: {
            tableComment: table.comment,
            databaseName: table.databaseName,
            updatedAt: new Date(),
          },
        });

        await prisma.tableColumn.deleteMany({
          where: { tableId: existingTable.id },
        });

        await prisma.tableRelation.deleteMany({
          where: {
            OR: [
              { fromTableId: existingTable.id },
              { toTableId: existingTable.id },
            ],
          },
        });
      } else {
        databaseTable = await prisma.databaseTable.create({
          data: {
            name: table.name,
            schemaName: table.schemaName,
            tableComment: table.comment,
            databaseName: table.databaseName,
            knowledgeBaseId: options.knowledgeBaseId || null,
            documentId: options.documentId || null,
          },
        });
      }

      for (const column of table.columns) {
        try {
          await prisma.tableColumn.upsert({
            where: {
              tableId_name: {
                tableId: databaseTable.id,
                name: column.name,
              },
            },
            create: {
              tableId: databaseTable.id,
              name: column.name,
              dataType: column.dataType,
              columnType: column.columnType,
              isNullable: column.isNullable,
              isPrimaryKey: column.isPrimaryKey,
              isAutoIncrement: column.isAutoIncrement,
              defaultValue: column.defaultValue,
              columnComment: column.comment,
              ordinalPosition: column.ordinalPosition,
            },
            update: {
              dataType: column.dataType,
              columnType: column.columnType,
              isNullable: column.isNullable,
              isPrimaryKey: column.isPrimaryKey,
              isAutoIncrement: column.isAutoIncrement,
              defaultValue: column.defaultValue,
              columnComment: column.comment,
              ordinalPosition: column.ordinalPosition,
            },
          });
          columnsImported++;
        } catch (columnError) {
          console.warn(`[SQL导入] 列 ${column.name} 导入失败:`, columnError instanceof Error ? columnError.message : "未知错误");
        }
      }

      for (const fk of table.foreignKeys) {
        const toTable = await prisma.databaseTable.findFirst({
          where: {
            name: fk.referencedTableName,
            knowledgeBaseId: options.knowledgeBaseId || null,
          },
        });

        if (toTable) {
          try {
            await prisma.tableRelation.upsert({
              where: {
                fromTableId_fromColumnName: {
                  fromTableId: databaseTable.id,
                  fromColumnName: fk.columnName,
                },
              },
              create: {
                fromTableId: databaseTable.id,
                fromColumnName: fk.columnName,
                toTableId: toTable.id,
                toColumnName: fk.referencedColumnName,
                relationType: "MANY_TO_ONE",
                constraintName: fk.constraintName,
                joinCondition: `${databaseTable.name}.${fk.columnName} = ${toTable.name}.${fk.referencedColumnName}`,
                knowledgeBaseId: options.knowledgeBaseId || null,
              },
              update: {
                toTableId: toTable.id,
                toColumnName: fk.referencedColumnName,
                relationType: "MANY_TO_ONE",
                constraintName: fk.constraintName,
                joinCondition: `${databaseTable.name}.${fk.columnName} = ${toTable.name}.${fk.referencedColumnName}`,
                knowledgeBaseId: options.knowledgeBaseId || null,
              },
            });
            relationsImported++;
          } catch (relationError) {
            console.warn(`[SQL导入] 关系 ${databaseTable.name}.${fk.columnName} -> ${toTable.name}.${fk.referencedColumnName} 导入失败:`, relationError instanceof Error ? relationError.message : "未知错误");
          }
        } else {
          console.warn(`引用的表 ${fk.referencedTableName} 不存在，跳过外键关系`);
        }
      }

      return { success: true, columnsImported, relationsImported };
    } catch (error) {
      return {
        success: false,
        columnsImported,
        relationsImported,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  }

  private async inferImplicitRelations(
    tables: ParsedTable[],
    options: ImportOptions
  ): Promise<number> {
    let inferredCount = 0;
    const tableMap = new Map<string, ParsedTable>();

    for (const table of tables) {
      tableMap.set(table.name.toLowerCase(), table);
    }

    for (const table of tables) {
      for (const column of table.columns) {
        const isIdColumn = column.name.toLowerCase() === "id";
        const endsWithId = column.name.toLowerCase().endsWith("_id") || column.name.toLowerCase().endsWith("id");

        if (endsWithId && !isIdColumn) {
          let referencedTableName: string | null = null;

          if (column.name.toLowerCase().endsWith("_id")) {
            referencedTableName = column.name.substring(0, column.name.length - 3);
          } else {
            referencedTableName = column.name.substring(0, column.name.length - 2);
          }

          const pluralMatch = referencedTableName.match(/^(.*?)(s|es)?$/i);
          if (pluralMatch && pluralMatch[1]) {
            referencedTableName = pluralMatch[1];
          }

          if (referencedTableName) {
            const referencedTable = tableMap.get(referencedTableName.toLowerCase());

            if (referencedTable) {
              const hasPrimaryKey = referencedTable.primaryKeys.length > 0;
              const targetColumnName = hasPrimaryKey ? referencedTable.primaryKeys[0] : "id";

              const existingDbTable = await prisma.databaseTable.findFirst({
                where: {
                  name: table.name,
                  knowledgeBaseId: options.knowledgeBaseId || null,
                },
              });

              const existingDbRefTable = await prisma.databaseTable.findFirst({
                where: {
                  name: referencedTable.name,
                  knowledgeBaseId: options.knowledgeBaseId || null,
                },
              });

              if (existingDbTable && existingDbRefTable) {
                try {
                  await prisma.tableRelation.upsert({
                    where: {
                      fromTableId_fromColumnName: {
                        fromTableId: existingDbTable.id,
                        fromColumnName: column.name,
                      },
                    },
                    create: {
                      fromTableId: existingDbTable.id,
                      fromColumnName: column.name,
                      toTableId: existingDbRefTable.id,
                      toColumnName: targetColumnName,
                      relationType: "MANY_TO_ONE",
                      constraintName: `fk_${table.name}_${column.name}`,
                      joinCondition: `${table.name}.${column.name} = ${referencedTable.name}.${targetColumnName}`,
                      knowledgeBaseId: options.knowledgeBaseId || null,
                    },
                    update: {
                      toTableId: existingDbRefTable.id,
                      toColumnName: targetColumnName,
                      relationType: "MANY_TO_ONE",
                      constraintName: `fk_${table.name}_${column.name}`,
                      joinCondition: `${table.name}.${column.name} = ${referencedTable.name}.${targetColumnName}`,
                      knowledgeBaseId: options.knowledgeBaseId || null,
                    },
                  });
                  inferredCount++;
                } catch (inferredError) {
                  console.warn(`[SQL导入] 推断关系 ${table.name}.${column.name} -> ${referencedTable.name}.${targetColumnName} 导入失败:`, inferredError instanceof Error ? inferredError.message : "未知错误");
                }
              }
            }
          }
        }
      }
    }

    return inferredCount;
  }
}

export async function importSQLFile(
  sqlContent: string,
  options: ImportOptions = {}
): Promise<SQLImportResult> {
  const importer = new SQLImporter(options);
  return importer.importFromSQL(sqlContent, options);
}
