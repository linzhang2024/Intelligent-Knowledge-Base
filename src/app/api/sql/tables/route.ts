import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { inferAndSaveRelations, InferredRelation } from "@/lib/sqlParser";

export interface TableInfo {
  id: string;
  name: string;
  schemaName: string | null;
  tableComment: string | null;
  columnCount: number;
  relationCount: number;
  columns: ColumnInfo[];
  relations: RelationInfo[];
}

export interface ColumnInfo {
  id: string;
  name: string;
  dataType: string;
  columnType: string | null;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  defaultValue: string | null;
  columnComment: string | null;
}

export interface RelationInfo {
  id: string;
  fromTableName: string;
  fromColumnName: string;
  toTableName: string;
  toColumnName: string;
  relationType: string;
  joinCondition: string | null;
}

export interface TablesResponse {
  success: boolean;
  tables: TableInfo[];
  totalTables: number;
  totalColumns: number;
  totalRelations: number;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    const { searchParams } = new URL(request.url);
    const knowledgeBaseId = searchParams.get("knowledgeBaseId") || undefined;
    const tableId = searchParams.get("tableId") || undefined;

    const whereClause: any = {};
    if (knowledgeBaseId) {
      whereClause.knowledgeBaseId = knowledgeBaseId;
    }
    if (tableId) {
      whereClause.id = tableId;
    }

    const tables = await prisma.databaseTable.findMany({
      where: whereClause,
      include: {
        columns: {
          orderBy: { ordinalPosition: "asc" },
        },
        relationsFrom: {
          include: {
            toTable: true,
          },
        },
        relationsTo: {
          include: {
            fromTable: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    let totalColumns = 0;
    let totalRelations = 0;

    const tableInfos: TableInfo[] = tables.map(table => {
      const columns: ColumnInfo[] = table.columns.map(col => ({
        id: col.id,
        name: col.name,
        dataType: col.dataType,
        columnType: col.columnType,
        isNullable: col.isNullable,
        isPrimaryKey: col.isPrimaryKey,
        isAutoIncrement: col.isAutoIncrement,
        defaultValue: col.defaultValue,
        columnComment: col.columnComment,
      }));

      const relations: RelationInfo[] = [];

      for (const rel of table.relationsFrom) {
        relations.push({
          id: rel.id,
          fromTableName: table.name,
          fromColumnName: rel.fromColumnName,
          toTableName: rel.toTable?.name || "",
          toColumnName: rel.toColumnName,
          relationType: rel.relationType,
          joinCondition: rel.joinCondition,
        });
      }

      for (const rel of table.relationsTo) {
        relations.push({
          id: rel.id,
          fromTableName: rel.fromTable?.name || "",
          fromColumnName: rel.fromColumnName,
          toTableName: table.name,
          toColumnName: rel.toColumnName,
          relationType: rel.relationType,
          joinCondition: rel.joinCondition,
        });
      }

      totalColumns += columns.length;
      totalRelations += relations.length;

      return {
        id: table.id,
        name: table.name,
        schemaName: table.schemaName,
        tableComment: table.tableComment,
        columnCount: columns.length,
        relationCount: relations.length,
        columns,
        relations,
      };
    });

    const response: TablesResponse = {
      success: true,
      tables: tableInfos,
      totalTables: tables.length,
      totalColumns,
      totalRelations,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[获取表结构API] 错误:", error);

    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { success: false, message: "未登录，请先登录" },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        message: `获取失败: ${error instanceof Error ? error.message : "未知错误"}`,
      },
      { status: 500 }
    );
  }
}

export interface InferRelationsResponse {
  success: boolean;
  inferred: number;
  saved: number;
  relations: InferredRelation[];
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    const body = await request.json();
    const { knowledgeBaseId, action } = body;

    if (action === "inferRelations") {
      const result = await inferAndSaveRelations(knowledgeBaseId);

      const response: InferRelationsResponse = {
        success: true,
        inferred: result.inferred,
        saved: result.saved,
        relations: result.relations,
      };

      return NextResponse.json(response, { status: 200 });
    }

    return NextResponse.json(
      { success: false, message: "未知的操作类型" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[表关系推断API] 错误:", error);

    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { success: false, message: "未登录，请先登录" },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        message: `操作失败: ${error instanceof Error ? error.message : "未知错误"}`,
      },
      { status: 500 }
    );
  }
}
