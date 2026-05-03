"use client";

import { useState, useEffect, useRef } from "react";

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  documentCount: number;
}

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

interface ReferenceTable {
  name: string;
  comment: string | null;
  columns: string[];
  reason: string;
}

interface ReferenceDocument {
  title: string;
  knowledgeBaseName: string | null;
  similarity: number;
  content: string;
}

interface GeneratedResult {
  sql: string;
  explanation: string;
  tablesUsed: string[];
  columnsUsed: string[];
  references: {
    tables: ReferenceTable[];
    documents: ReferenceDocument[];
  };
  confidence: number;
  dialect: string;
}

export default function SQLGeneratorPage() {
  const [requirement, setRequirement] = useState("");
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<string>("");
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [dialect, setDialect] = useState<"mysql" | "postgresql" | "sqlite" | "mssql" | "oracle">("mysql");
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState("");
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [showReferences, setShowReferences] = useState(true);
  const streamingContentRef = useRef<string>("");
  const tablesRef = useRef<TableInfo[]>([]);

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  useEffect(() => {
    if (knowledgeBaseId) {
      loadTables();
    } else {
      setTables([]);
    }
  }, [knowledgeBaseId]);

  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  const loadKnowledgeBases = async () => {
    try {
      const response = await fetch("/api/kb");
      const data = await response.json();
      
      if (data.knowledgeBases) {
        setKnowledgeBases(data.knowledgeBases);
      }
    } catch (err) {
      console.error("加载知识库列表失败:", err);
    }
  };

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

  const parseStreamingResponse = (content: string): { sql: string; explanation: string } => {
    let sql = "";
    let explanation = "";
    
    const sqlMatch = content.match(/```sql\s*([\s\S]*?)\s*```/);
    if (sqlMatch) {
      sql = sqlMatch[1].trim();
    }
    
    const explanationMatch = content.match(/逻辑解释[：:]\s*([\s\S]*?)(?=\n---|$)/i);
    if (explanationMatch) {
      explanation = explanationMatch[1].trim();
    }
    
    return { sql, explanation };
  };

  const extractTablesFromContent = (content: string): string[] => {
    const tables: string[] = [];
    const tablePattern = /【表名】\s*(\w+)/g;
    let match;
    while ((match = tablePattern.exec(content)) !== null) {
      if (!tables.includes(match[1])) {
        tables.push(match[1]);
      }
    }
    return tables;
  };

  const handleGenerate = async () => {
    if (!requirement.trim()) {
      setError("请输入需求描述");
      return;
    }

    setIsLoading(true);
    setIsStreaming(true);
    setError("");
    setGeneratedResult(null);
    setStreamingContent("");
    streamingContentRef.current = "";

    try {
      const response = await fetch("/api/qa/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement,
          knowledgeBaseId: knowledgeBaseId || undefined,
          dialect,
          streaming: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "请求失败");
      }

      const contentType = response.headers.get("content-type") || "";
      
      if (contentType.includes("text/event-stream")) {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("无法读取响应流");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              const eventMatch = line.match(/event:\s*(\w+)/);
              const dataMatch = line.match(/data:\s*(.+)/);
              
              if (eventMatch && dataMatch) {
                const event = eventMatch[1];
                const data = JSON.parse(dataMatch[1]);
                
                if (event === "content") {
                  streamingContentRef.current += data.content;
                  setStreamingContent(streamingContentRef.current);
                } else if (event === "info") {
                  console.log("Info:", data.message);
                } else if (event === "error") {
                  setError(data.message);
                  setIsLoading(false);
                  setIsStreaming(false);
                  return;
                } else if (event === "done") {
                  const finalContent = streamingContentRef.current;
                  const currentTables = tablesRef.current;
                  const { sql, explanation } = parseStreamingResponse(finalContent);
                  const tablesUsed = extractTablesFromContent(finalContent);
                  
                  const referenceTables: ReferenceTable[] = currentTables
                    .filter(t => tablesUsed.includes(t.name))
                    .map(t => ({
                      name: t.name,
                      comment: t.tableComment,
                      columns: t.columns.slice(0, 5).map(c => c.name),
                      reason: "语义检索匹配，与需求相关度高",
                    }));

                  setGeneratedResult({
                    sql: sql || finalContent,
                    explanation: explanation || "AI生成的SQL查询",
                    tablesUsed,
                    columnsUsed: [],
                    references: {
                      tables: referenceTables,
                      documents: [],
                    },
                    confidence: 0.8,
                    dialect,
                  });
                  
                  setIsLoading(false);
                  setIsStreaming(false);
                  return;
                }
              }
            }
          }
        }
      } else {
        const data = await response.json();
        const currentTables = tablesRef.current;
        
        if (data.success && data.result) {
          const referenceTables: ReferenceTable[] = currentTables
            .filter(t => data.result.tablesUsed?.includes(t.name))
            .map(t => ({
              name: t.name,
              comment: t.tableComment,
              columns: t.columns.slice(0, 5).map(c => c.name),
              reason: "语义检索匹配，与需求相关度高",
            }));

          setGeneratedResult({
            sql: data.result.sql,
            explanation: data.result.explanation,
            tablesUsed: data.result.tablesUsed || [],
            columnsUsed: data.result.columnsUsed || [],
            references: {
              tables: referenceTables,
              documents: data.result.references?.documents || [],
            },
            confidence: data.result.confidence || 0.7,
            dialect,
          });
        } else {
          throw new Error(data.message || "生成失败");
        }
      }
    } catch (err) {
      setError(`请求失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleCopySQL = () => {
    if (generatedResult?.sql) {
      navigator.clipboard.writeText(generatedResult.sql);
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
            基于RAG技术，从知识库中检索相关表结构，智能生成SQL语句
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                需求描述
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      选择知识库
                    </label>
                    <select
                      value={knowledgeBaseId}
                      onChange={(e) => setKnowledgeBaseId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">全部可用知识库</option>
                      {knowledgeBases.map((kb) => (
                        <option key={kb.id} value={kb.id}>
                          {kb.name} ({kb.documentCount} 个文档)
                        </option>
                      ))}
                    </select>
                  </div>

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
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    描述您需要的查询
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
                      {isStreaming ? "生成中..." : "检索相关表结构..."}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      生成 SQL
                    </>
                  )}
                </button>
              </div>
            </div>

            {isStreaming && streamingContent && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    实时生成中...
                  </h2>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-500">流式输出</span>
                  </div>
                </div>
                <div className="p-6">
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap max-h-96">
                    {streamingContent}
                  </pre>
                </div>
              </div>
            )}

            {generatedResult && !isStreaming && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    生成结果
                  </h2>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">置信度:</span>
                      <span className={`font-medium ${
                        generatedResult.confidence >= 0.8 ? "text-green-600" :
                        generatedResult.confidence >= 0.6 ? "text-yellow-600" :
                        "text-red-600"
                      }`}>
                        {(generatedResult.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <button
                      onClick={handleCopySQL}
                      className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors"
                    >
                      复制 SQL
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap">
                    {generatedResult.sql}
                  </pre>

                  {generatedResult.tablesUsed.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        涉及表:
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {generatedResult.tablesUsed.map((table, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {table}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {generatedResult.explanation && (
                  <div className="px-6 py-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      SQL 逻辑解释
                    </h3>
                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                      {generatedResult.explanation}
                    </div>
                  </div>
                )}

                {showReferences && (
                  <div className="px-6 py-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      引用标记
                    </h3>

                    {generatedResult.references.tables.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                          参考的物理表
                        </h4>
                        <div className="space-y-2">
                          {generatedResult.references.tables.map((table, index) => (
                            <div
                              key={index}
                              className="p-3 bg-blue-50 border border-blue-200 rounded-lg"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono font-medium text-blue-800">
                                  {table.name}
                                </span>
                                <span className="text-xs text-blue-600">
                                  {table.reason}
                                </span>
                              </div>
                              {table.comment && (
                                <p className="text-xs text-blue-600 mb-2">
                                  {table.comment}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {table.columns.map((col, colIndex) => (
                                  <span
                                    key={colIndex}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700"
                                  >
                                    {col}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {generatedResult.references.documents.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                          参考的文档片段
                        </h4>
                        <div className="space-y-2">
                          {generatedResult.references.documents.map((doc, index) => (
                            <div
                              key={index}
                              className="p-3 bg-green-50 border border-green-200 rounded-lg"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-green-800">
                                  {doc.title}
                                </span>
                                <span className="text-xs text-green-600">
                                  相似度: {(doc.similarity * 100).toFixed(1)}%
                                </span>
                              </div>
                              {doc.knowledgeBaseName && (
                                <p className="text-xs text-green-600 mb-2">
                                  来自: {doc.knowledgeBaseName}
                                </p>
                              )}
                              <p className="text-sm text-green-700 line-clamp-3">
                                {doc.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {generatedResult.references.tables.length === 0 &&
                     generatedResult.references.documents.length === 0 && (
                      <p className="text-sm text-gray-500">
                        暂无引用信息
                      </p>
                    )}
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
                <li>• 选择包含表结构的知识库</li>
                <li>• 用自然语言描述您的查询需求</li>
                <li>• 系统会自动检索相关的表结构</li>
                <li>• AI基于检索到的信息生成SQL</li>
                <li>• 查看"引用标记"了解参考了哪些表</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
