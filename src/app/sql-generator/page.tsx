"use client";

import { useState, useEffect } from "react";

interface TableInfo {
  id: string;
  name: string;
  schemaName: string | null;
  tableComment: string | null;
  columnCount: number;
  relationCount: number;
  columns: ColumnInfo[];
  relations: RelationInfo[];
}

interface ColumnInfo {
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

interface RelationInfo {
  id: string;
  fromTableName: string;
  fromColumnName: string;
  toTableName: string;
  toColumnName: string;
  relationType: string;
  joinCondition: string | null;
}

interface GeneratedSQL {
  sql: string;
  explanation: string;
  tablesUsed: string[];
  columnsUsed: string[];
  joinCount: number;
  complexity: "simple" | "medium" | "complex";
  confidence: number;
  dialect: string;
}

interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning" | "info";
  rule: string;
  suggestion?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  infos: ValidationError[];
  syntaxCheck: boolean;
}

export default function SQLGeneratorPage() {
  const [requirement, setRequirement] = useState("");
  const [knowledgeBaseId, setKnowledgeBaseId] = useState("");
  const [dialect, setDialect] = useState<"mysql" | "postgresql" | "sqlite" | "mssql" | "oracle">("mysql");
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [generatedSQLs, setGeneratedSQLs] = useState<GeneratedSQL[]>([]);
  const [selectedSQL, setSelectedSQL] = useState(0);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [explanation, setExplanation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState("");
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  useEffect(() => {
    loadTables();
  }, [knowledgeBaseId]);

  const loadTables = async () => {
    try {
      const url = knowledgeBaseId 
        ? `/api/sql/tables?knowledgeBaseId=${encodeURIComponent(knowledgeBaseId)}`
        : "/api/sql/tables";
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setTables(data.tables);
      }
    } catch (err) {
      console.error("加载表结构失败:", err);
    }
  };

  const handleGenerate = async () => {
    if (!requirement.trim()) {
      setError("请输入报表需求");
      return;
    }

    setIsLoading(true);
    setError("");
    setGeneratedSQLs([]);
    setValidation(null);
    setExplanation("");

    try {
      const response = await fetch("/api/sql/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement,
          knowledgeBaseId: knowledgeBaseId || undefined,
          dialect,
          includeComments: true,
          useAlias: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedSQLs(data.sqlCandidates || []);
        setSelectedSQL(0);
        
        if (data.sqlCandidates && data.sqlCandidates.length > 0) {
          setExplanation(data.sqlCandidates[0].explanation);
        }
      } else {
        setError(data.message || "生成失败");
      }
    } catch (err) {
      setError(`请求失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidate = async () => {
    if (generatedSQLs.length === 0) return;

    setIsValidating(true);

    try {
      const response = await fetch("/api/sql/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: generatedSQLs[selectedSQL].sql,
          knowledgeBaseId: knowledgeBaseId || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setValidation(data.validation);
        if (data.explanation) {
          setExplanation(data.explanation);
        }
      }
    } catch (err) {
      console.error("验证失败:", err);
    } finally {
      setIsValidating(false);
    }
  };

  const handleCopySQL = () => {
    if (generatedSQLs.length > 0) {
      navigator.clipboard.writeText(generatedSQLs[selectedSQL].sql);
    }
  };

  const toggleTable = (tableName: string) => {
    setExpandedTable(expandedTable === tableName ? null : tableName);
  };

  const exampleRequirements = [
    "查询订单表中金额大于1000的订单，按创建时间排序",
    "统计每个用户的订单数量和总金额，按订单数降序排列",
    "查询本月的订单，关联用户表获取用户姓名和电话",
    "统计每个月的销售额，包含订单数和平均金额",
  ];

  const loadExample = (example: string) => {
    setRequirement(example);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            SQL 自动生成器
          </h1>
          <p className="text-gray-600">
            根据报表需求自动生成 SQL 语句，基于知识库中的表结构
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                报表需求
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SQL 方言
                  </label>
                  <select
                    value={dialect}
                    onChange={(e) => setDialect(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="mysql">MySQL</option>
                    <option value="postgresql">PostgreSQL</option>
                    <option value="sqlite">SQLite</option>
                    <option value="mssql">SQL Server</option>
                    <option value="oracle">Oracle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    知识库 ID（可选，留空使用所有可用表）
                  </label>
                  <input
                    type="text"
                    value={knowledgeBaseId}
                    onChange={(e) => setKnowledgeBaseId(e.target.value)}
                    placeholder="输入知识库 ID"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    描述您需要的报表
                  </label>
                  <textarea
                    value={requirement}
                    onChange={(e) => setRequirement(e.target.value)}
                    placeholder="例如：查询订单表中金额大于1000的订单，按创建时间降序排列，只显示前10条"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    示例需求（点击使用）
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {exampleRequirements.map((example, index) => (
                      <button
                        key={index}
                        onClick={() => loadExample(example)}
                        className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                      >
                        {example.substring(0, 20)}...
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      生成中...
                    </>
                  ) : (
                    "生成 SQL"
                  )}
                </button>
              </div>
            </div>

            {generatedSQLs.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    生成的 SQL
                  </h2>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleValidate}
                      disabled={isValidating}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
                    >
                      {isValidating ? "验证中..." : "验证语法"}
                    </button>
                    <button
                      onClick={handleCopySQL}
                      className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors"
                    >
                      复制 SQL
                    </button>
                  </div>
                </div>

                {generatedSQLs.length > 1 && (
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      选择候选方案
                    </label>
                    <select
                      value={selectedSQL}
                      onChange={(e) => {
                        setSelectedSQL(parseInt(e.target.value));
                        setValidation(null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {generatedSQLs.map((sql, index) => (
                        <option key={index} value={index}>
                          方案 {index + 1} - 复杂度: {sql.complexity}, 置信度: {(sql.confidence * 100).toFixed(1)}%
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="p-6">
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap">
                    {generatedSQLs[selectedSQL]?.sql}
                  </pre>

                  {generatedSQLs[selectedSQL] && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm text-gray-500">复杂度</div>
                        <div className="font-semibold text-blue-700 capitalize">
                          {generatedSQLs[selectedSQL].complexity}
                        </div>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="text-sm text-gray-500">置信度</div>
                        <div className="font-semibold text-green-700">
                          {(generatedSQLs[selectedSQL].confidence * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <div className="text-sm text-gray-500">涉及表数</div>
                        <div className="font-semibold text-purple-700">
                          {generatedSQLs[selectedSQL].tablesUsed.length}
                        </div>
                      </div>
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <div className="text-sm text-gray-500">JOIN 数</div>
                        <div className="font-semibold text-orange-700">
                          {generatedSQLs[selectedSQL].joinCount}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {validation && (
                  <div className="px-6 py-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      验证结果
                    </h3>
                    
                    {validation.errors.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-red-700 mb-2">
                          错误 ({validation.errors.length})
                        </h4>
                        <div className="space-y-2">
                          {validation.errors.map((err, index) => (
                            <div key={index} className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                              <span className="font-medium text-red-700">行 {err.line}: </span>
                              <span className="text-red-600">{err.message}</span>
                              {err.suggestion && (
                                <span className="text-red-500 ml-2">（建议: {err.suggestion}）</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {validation.warnings.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-yellow-700 mb-2">
                          警告 ({validation.warnings.length})
                        </h4>
                        <div className="space-y-2">
                          {validation.warnings.map((warn, index) => (
                            <div key={index} className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                              <span className="font-medium text-yellow-700">行 {warn.line}: </span>
                              <span className="text-yellow-600">{warn.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {validation.infos.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-blue-700 mb-2">
                          建议 ({validation.infos.length})
                        </h4>
                        <div className="space-y-2">
                          {validation.infos.map((info, index) => (
                            <div key={index} className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                              <span className="font-medium text-blue-700">行 {info.line}: </span>
                              <span className="text-blue-600">{info.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {validation.errors.length === 0 && validation.warnings.length === 0 && validation.infos.length === 0 && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                        ✅ SQL 语法验证通过
                      </div>
                    )}
                  </div>
                )}

                {explanation && (
                  <div className="px-6 py-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      SQL 逻辑解释
                    </h3>
                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                      {explanation}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                可用表结构 ({tables.length})
              </h2>
              
              {tables.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-2">暂无可用的表结构</p>
                  <p className="text-sm">请先导入 SQL 文件到知识库</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {tables.map((table) => (
                    <div key={table.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleTable(table.name)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium text-gray-900">
                            {table.name}
                          </div>
                          {table.tableComment && (
                            <div className="text-sm text-gray-500 mt-0.5">
                              {table.tableComment}
                            </div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            {table.columnCount} 列 · {table.relationCount} 关系
                          </div>
                        </div>
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${expandedTable === table.name ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {expandedTable === table.name && (
                        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                            字段列表
                          </h4>
                          <div className="space-y-1">
                            {table.columns.map((col) => (
                              <div key={col.id} className="text-sm flex items-center gap-2">
                                {col.isPrimaryKey && (
                                  <span className="text-yellow-600 text-xs">🔑</span>
                                )}
                                <span className={`font-mono ${col.isPrimaryKey ? "text-yellow-700" : "text-gray-700"}`}>
                                  {col.name}
                                </span>
                                <span className="text-gray-400 text-xs">
                                  {col.dataType}
                                </span>
                                {col.columnComment && (
                                  <span className="text-gray-500 text-xs ml-auto">
                                    {col.columnComment}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          
                          {table.relations.length > 0 && (
                            <>
                              <h4 className="text-xs font-medium text-gray-500 uppercase mt-4 mb-2">
                                表关系
                              </h4>
                              <div className="space-y-1">
                                {table.relations.map((rel) => (
                                  <div key={rel.id} className="text-sm text-gray-600">
                                    <span className="text-blue-600">{rel.fromTableName}.{rel.fromColumnName}</span>
                                    <span className="text-gray-400 mx-1">→</span>
                                    <span className="text-green-600">{rel.toTableName}.{rel.toColumnName}</span>
                                    <span className="text-gray-400 text-xs ml-2">
                                      ({rel.relationType})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">
                使用提示
              </h3>
              <ul className="text-sm text-blue-800 space-y-2">
                <li>• 在需求描述中明确指定需要查询的表和字段</li>
                <li>• 包含筛选条件，如"金额大于1000"</li>
                <li>• 说明排序方式，如"按创建时间降序"</li>
                <li>• 指定分组统计，如"按用户统计订单数"</li>
                <li>• 导入 SQL 文件后，系统会自动识别表关系</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
