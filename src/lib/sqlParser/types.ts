export interface ParsedColumn {
  name: string;
  dataType: string;
  columnType?: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  defaultValue?: string;
  comment?: string;
  ordinalPosition: number;
}

export interface ParsedTable {
  name: string;
  schemaName?: string;
  comment?: string;
  databaseName?: string;
  columns: ParsedColumn[];
  primaryKeys: string[];
  foreignKeys: ParsedForeignKey[];
  indexes: ParsedIndex[];
}

export interface ParsedForeignKey {
  constraintName?: string;
  columnName: string;
  referencedTableName: string;
  referencedColumnName: string;
  onDelete?: string;
  onUpdate?: string;
}

export interface ParsedIndex {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
}

export interface SQLParseResult {
  tables: ParsedTable[];
  views: ParsedView[];
  functions: ParsedFunction[];
  procedures: ParsedProcedure[];
  rawSQL: string;
  errors: ParseError[];
}

export interface ParsedView {
  name: string;
  schemaName?: string;
  definition: string;
  columns: string[];
  comment?: string;
}

export interface ParsedFunction {
  name: string;
  schemaName?: string;
  returnType: string;
  parameters: FunctionParameter[];
  definition: string;
  comment?: string;
}

export interface ParsedProcedure {
  name: string;
  schemaName?: string;
  parameters: FunctionParameter[];
  definition: string;
  comment?: string;
}

export interface FunctionParameter {
  name: string;
  dataType: string;
  mode: "IN" | "OUT" | "INOUT";
  defaultValue?: string;
}

export interface ParseError {
  line: number;
  position: number;
  message: string;
  severity: "error" | "warning";
}

export interface SQLImportResult {
  success: boolean;
  tablesImported: number;
  columnsImported: number;
  relationsImported: number;
  errors: string[];
  warnings: string[];
  tableNames: string[];
}

export type SQLDialect = "mysql" | "postgresql" | "sqlite" | "oracle" | "mssql" | "generic";
