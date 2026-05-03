"use client";

import { useState, useEffect, useRef } from "react";
import AppHeader from "@/components/ui/AppHeader";

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
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
}

interface ColumnInfo {
  id: string;
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  columnComment: string | null;
}

interface SQLAlternative {
  id: number;
  sql: string;
  explanation: string;
  approach: string;
  confidence: number;
}

interface SQLGenerationResult {
  sql: string;
  explanation: string;
  warnings: string[];
  tablesUsed: string[];
  columnsUsed: string[];
  confidence: number;
  alternatives?: SQLAlternative[];
}

interface ErrorResponse {
  success: boolean;
  message: string;
  tablesAvailable: number;
  errorType?: string;
  suggestions?: string[];
}

interface SSEEvent {
  event: string;
  data: unknown;
}

export default function ReportSQLPage() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string>("");
  const [requirement, setRequirement] = useState("");
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<SQLGenerationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorResponse, setErrorResponse] = useState<ErrorResponse | null>(null);
  const [dialect, setDialect] = useState<"mysql" | "postgresql" | "sqlite" | "mssql" | "oracle">("mysql");
  const [showTooltip, setShowTooltip] = useState(false);
  const [selectedAlternativeId, setSelectedAlternativeId] = useState<number>(1);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultEndRef = useRef<HTMLDivElement>(null);

  const hasNoTables = tables.length === 0;
  const isGenerateDisabled = isLoading || !requirement.trim() || hasNoTables;

  const getDisabledReason = (): string => {
    if (hasNoTables) {
      if (selectedKbId) {
        return "当前知识库中暂无 DDL 数据，请先上传 SQL 文件";
      }
      return "系统中暂无可用的表结构，请先上传 SQL 文件到知识库";
    }
    if (!requirement.trim()) {
      return "请输入报表需求描述";
    }
    return "";
  };

  useEffect(() => {
    const fetchKnowledgeBases = async () => {
      try {
        const response = await fetch("/api/kb");
        if (response.ok) {
          const data = await response.json();
          setKnowledgeBases(data.knowledgeBases || []);
        }
      } catch (err) {
        console.error("获取知识库列表失败:", err);
      }
    };

    fetchKnowledgeBases();
  }, []);

  useEffect(() => {
    loadTables();
  }, [selectedKbId]);

  const loadTables = async () => {
    try {
      const url = selectedKbId
        ? `/api/sql/tables?knowledgeBaseId=${encodeURIComponent(selectedKbId)}`
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

  const exampleRequirements = [
    "查询订单表中金额大于1000的订单，按创建时间降序排列",
    "统计每个用户的订单数量和总金额，按订单数降序排列",
    "查询本月的订单，关联用户表获取用户姓名和电话",
    "统计每个月的销售额，包含订单数和平均金额",
    "查询最近30天内注册的用户及其订单统计",
  ];

  const handleGenerate = async () => {
    if (!requirement.trim()) {
      setError("请输入报表需求");
      return;
    }

    if (hasNoTables) {
      setErrorResponse({
        success: false,
        message: getDisabledReason(),
        tablesAvailable: 0,
        errorType: "EMPTY_KNOWLEDGE_BASE",
        suggestions: [
          "前往「文档管理」上传 SQL DDL 文件（CREATE TABLE 语句）",
          "确保 SQL 文件包含表结构定义（表名、字段名、字段类型、注释）",
          "上传后系统会自动解析表结构和字段信息",
        ],
      });
      return;
    }

    setIsLoading(true);
    setIsStreaming(true);
    setError(null);
    setErrorResponse(null);
    setGeneratedResult(null);
    setStreamingContent("");

    try {
      const response = await fetch("/api/qa/sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requirement: requirement.trim(),
          knowledgeBaseId: selectedKbId || undefined,
          dialect,
          streaming: true,
        }),
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json().catch(() => ({
          success: false,
          message: `请求失败: ${response.status}`,
          tablesAvailable: 0,
        }));
        setErrorResponse(errorData);
        setError(errorData.message);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("无法读取响应流");
      }

      let currentContent = "";
      let buffer = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7);
            continue;
          }

          if (line.startsWith("data: ")) {
            try {
              const dataStr = line.slice(6);
              const dataObj = JSON.parse(dataStr) as Record<string, unknown>;

              switch (currentEvent) {
                case "info":
                  console.log("[SQL生成] 信息:", dataObj.message);
                  break;

                case "content":
                  if (typeof dataObj.content === "string") {
                    currentContent += dataObj.content;
                    setStreamingContent(currentContent);
                  }
                  break;

                case "done":
                  setIsStreaming(false);
                  parseAndSetResult(currentContent);
                  break;

                case "error": {
                  const message = typeof dataObj.message === "string" ? dataObj.message : "未知错误";
                  const errorType = typeof dataObj.errorType === "string" ? dataObj.errorType : "GENERATION_ERROR";
                  const suggestions = Array.isArray(dataObj.suggestions) ? dataObj.suggestions : undefined;

                  setErrorResponse({
                    success: false,
                    message,
                    tablesAvailable: 0,
                    errorType,
                    suggestions,
                  });
                  setError(message);
                  return;
                }
              }
            } catch (parseError) {
              if (parseError instanceof Error) {
                throw parseError;
              }
            }
            continue;
          }

          if (line === "") {
            currentEvent = "";
            continue;
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "未知错误";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const parseSingleAlternative = (
    content: string,
    id: number,
    schemeLabel: string
  ): SQLAlternative | null => {
    const approachMatch = content.match(/设计思路[：:]\s*([\s\S]*?)(?=\n\s*```sql|$)/i);
    const approach = approachMatch ? approachMatch[1].trim() : schemeLabel;

    const sqlMatch = content.match(/```sql\s*([\s\S]*?)\s*```/i);
    const sql = sqlMatch ? sqlMatch[1].trim() : extractSQLFromContent(content);

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
  };

  const parseAndSetResult = (content: string) => {
    const alternatives: SQLAlternative[] = [];

    const scheme1Match = content.match(/【方案1[：:]\s*([^】]*?)】\s*([\s\S]*?)(?=---|【方案2|$)/i);
    if (scheme1Match) {
      const alt = parseSingleAlternative(scheme1Match[2], 1, "推荐方案");
      if (alt) alternatives.push({ ...alt, confidence: 0.9 });
    }

    const scheme2Match = content.match(/【方案2[：:]\s*([^】]*?)】\s*([\s\S]*?)(?=---|【方案3|$)/i);
    if (scheme2Match) {
      const alt = parseSingleAlternative(scheme2Match[2], 2, "优化方案");
      if (alt) alternatives.push({ ...alt, confidence: 0.85 });
    }

    const scheme3Match = content.match(/【方案3[：:]\s*([^】]*?)】\s*([\s\S]*?)(?=---|【方案对比|【注意事项】|$)/i);
    if (scheme3Match) {
      const alt = parseSingleAlternative(scheme3Match[2], 3, "替代方案");
      if (alt) alternatives.push({ ...alt, confidence: 0.75 });
    }

    const warnings: string[] = [];
    const notesMatch = content.match(/【注意事项】([\s\S]*)$/i);
    if (notesMatch) {
      const notes = notesMatch[1].trim();
      if (notes) {
        warnings.push(notes);
      }
    }

    if (alternatives.length > 0) {
      setGeneratedResult({
        sql: alternatives[0].sql,
        explanation: alternatives[0].explanation,
        warnings,
        tablesUsed: extractTablesFromSQL(alternatives[0].sql),
        columnsUsed: [],
        confidence: alternatives[0].confidence,
        alternatives,
      });
      setSelectedAlternativeId(1);
    } else {
      const sqlMatch = content.match(/【SQL查询】\s*```sql\s*([\s\S]*?)\s*```/i);
      const sql = sqlMatch ? sqlMatch[1].trim() : extractSQLFromContent(content);

      const explanationMatch = content.match(/【逻辑解释】([\s\S]*?)(?=【注意事项】|$)/i);
      const explanation = explanationMatch
        ? explanationMatch[1].trim()
        : "AI 已完成SQL生成，详情请查看生成的SQL语句。";

      const tablesUsed = extractTablesFromSQL(sql);

      let confidence = 0.7;
      if (warnings.length === 0 && sql.length > 0) {
        confidence = 0.9;
      } else if (warnings.some((w) => w.includes("缺失") || w.includes("未找到"))) {
        confidence = 0.5;
      }

      setGeneratedResult({
        sql,
        explanation,
        warnings,
        tablesUsed,
        columnsUsed: [],
        confidence,
      });
    }
  };

  const extractSQLFromContent = (content: string): string => {
    const codeBlockMatch = content.match(/```sql\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    const simpleCodeMatch = content.match(/```\s*([\s\S]*?)\s*```/i);
    if (simpleCodeMatch) {
      return simpleCodeMatch[1].trim();
    }

    const lines = content.split("\n");
    const sqlLines: string[] = [];
    let inSQL = false;

    for (const line of lines) {
      const upperLine = line.trim().toUpperCase();
      if (
        upperLine.startsWith("SELECT") ||
        upperLine.startsWith("WITH") ||
        upperLine.startsWith("INSERT") ||
        upperLine.startsWith("UPDATE") ||
        upperLine.startsWith("DELETE")
      ) {
        inSQL = true;
      }
      if (inSQL) {
        sqlLines.push(line);
      }
    }

    return sqlLines.join("\n").trim();
  };

  const extractTablesFromSQL = (sql: string): string[] => {
    const tables: string[] = [];
    const fromMatch = sql.match(/FROM\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/i);
    if (fromMatch) {
      tables.push(fromMatch[1]);
    }

    const joinMatches = sql.match(/JOIN\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi);
    if (joinMatches) {
      for (const match of joinMatches) {
        const tableMatch = match.match(/JOIN\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/i);
        if (tableMatch && !tables.includes(tableMatch[1])) {
          tables.push(tableMatch[1]);
        }
      }
    }

    return tables;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleCopySQL = () => {
    const sqlToCopy = currentAlternative?.sql || generatedResult?.sql;
    if (sqlToCopy) {
      navigator.clipboard.writeText(sqlToCopy);
    }
  };

  const toggleTable = (tableName: string) => {
    setExpandedTable(expandedTable === tableName ? null : tableName);
  };

  const loadExample = (example: string) => {
    setRequirement(example);
  };

  const clearAll = () => {
    setRequirement("");
    setGeneratedResult(null);
    setStreamingContent("");
    setError(null);
    setSelectedAlternativeId(1);
  };

  const getCurrentAlternative = (): SQLAlternative | null => {
    if (!generatedResult?.alternatives || generatedResult.alternatives.length === 0) {
      return null;
    }
    return (
      generatedResult.alternatives.find((a) => a.id === selectedAlternativeId) ||
      generatedResult.alternatives[0]
    );
  };

  const handleAlternativeChange = (id: number) => {
    setSelectedAlternativeId(id);
  };

  useEffect(() => {
    resultEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamingContent, generatedResult]);

  const currentAlternative = getCurrentAlternative();
  const hasAlternatives = generatedResult?.alternatives && generatedResult.alternatives.length > 0;

  const displaySQL = isStreaming
    ? extractSQLFromContent(streamingContent) || streamingContent
    : currentAlternative?.sql || generatedResult?.sql || "";

  const displayExplanation = isStreaming
    ? ""
    : currentAlternative?.explanation || generatedResult?.explanation || "";

  const displayApproach = currentAlternative?.approach || "";
  const displayConfidence = currentAlternative?.confidence || generatedResult?.confidence || 0;
  const displayTablesUsed = currentAlternative
    ? extractTablesFromSQL(currentAlternative.sql)
    : generatedResult?.tablesUsed || [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader
        activePage="report-sql"
        showTabs={true}
        showDashboardLink={true}
        reportSqlPageActions={{
          onClear: clearAll,
          isLoading: isLoading,
        }}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <span className="mr-2">✍️</span>
                报表需求
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                请描述您需要的报表，AI 将根据知识库中的表结构生成 SQL
              </p>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      选择知识库
                    </label>
                    <select
                      value={selectedKbId}
                      onChange={(e) => setSelectedKbId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    >
                      <option value="">全部知识库</option>
                      {knowledgeBases.map((kb) => (
                        <option key={kb.id} value={kb.id}>
                          {kb.name} ({kb.documentCount} 文档)
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
                      onChange={(e) =>
                        setDialect(
                          e.target.value as "mysql" | "postgresql" | "sqlite" | "mssql" | "oracle"
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
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
                    需求描述
                  </label>
                  <textarea
                    ref={textareaRef}
                    value={requirement}
                    onChange={(e) => setRequirement(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="例如：查询订单表中金额大于1000的订单，按创建时间降序排列，关联用户表获取用户姓名"
                    rows={8}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    按 Ctrl + Enter 快速生成
                  </p>
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
                        disabled={isLoading}
                        className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 rounded-full text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {example.substring(0, 18)}...
                      </button>
                    ))}
                  </div>
                </div>

                {errorResponse && (
                  <div className={`p-4 rounded-lg border ${
                    errorResponse.errorType === "EMPTY_KNOWLEDGE_BASE" || errorResponse.errorType === "NO_MATCHING_TABLES"
                      ? "bg-yellow-50 border-yellow-200"
                      : "bg-red-50 border-red-200"
                  }`}>
                    <div className="flex items-start">
                      <span className={`mr-2 text-lg ${
                        errorResponse.errorType === "EMPTY_KNOWLEDGE_BASE" || errorResponse.errorType === "NO_MATCHING_TABLES"
                          ? "text-yellow-500"
                          : "text-red-500"
                      }`}>
                        {errorResponse.errorType === "EMPTY_KNOWLEDGE_BASE" ? "📭" :
                         errorResponse.errorType === "NO_MATCHING_TABLES" ? "🔍" : "⚠️"}
                      </span>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          errorResponse.errorType === "EMPTY_KNOWLEDGE_BASE" || errorResponse.errorType === "NO_MATCHING_TABLES"
                            ? "text-yellow-800"
                            : "text-red-700"
                        }`}>
                          {errorResponse.message}
                        </p>
                        {errorResponse.suggestions && errorResponse.suggestions.length > 0 && (
                          <div className="mt-3">
                            <p className={`text-xs font-medium mb-1 ${
                              errorResponse.errorType === "EMPTY_KNOWLEDGE_BASE" || errorResponse.errorType === "NO_MATCHING_TABLES"
                                ? "text-yellow-700"
                                : "text-red-600"
                            }`}>
                              建议步骤：
                            </p>
                            <ol className={`list-decimal list-inside text-xs space-y-1 ${
                              errorResponse.errorType === "EMPTY_KNOWLEDGE_BASE" || errorResponse.errorType === "NO_MATCHING_TABLES"
                                ? "text-yellow-700"
                                : "text-red-600"
                            }`}>
                              {errorResponse.suggestions.map((suggestion, index) => (
                                <li key={index}>{suggestion}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {error && !errorResponse && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-red-500 mr-2">⚠️</span>
                      <span className="text-sm text-red-700">{error}</span>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerateDisabled}
                    onMouseEnter={() => {
                      if (isGenerateDisabled && hasNoTables) {
                        setShowTooltip(true);
                      }
                    }}
                    onMouseLeave={() => setShowTooltip(false)}
                    className={`w-full px-4 py-3 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 relative ${
                      isGenerateDisabled
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        {isStreaming ? "生成中..." : "准备中..."}
                      </>
                    ) : hasNoTables ? (
                      <>
                        <span>📭</span>
                        暂无可用表结构
                      </>
                    ) : (
                      <>
                        <span>⚡</span>
                        生成 SQL
                      </>
                    )}
                  </button>

                  {showTooltip && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50">
                      {getDisabledReason()}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200">
              <div className="px-6 py-4">
                <h3 className="text-sm font-medium text-gray-900 flex items-center mb-3">
                  <span className="mr-2">📋</span>
                  可用表结构 ({tables.length})
                </h3>
                {tables.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    <p>暂无可用的表结构</p>
                    <p className="text-xs mt-1">请先导入 SQL 文件到知识库</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {tables.map((table) => (
                      <div
                        key={table.id}
                        className="border border-gray-200 rounded-lg overflow-hidden"
                      >
                        <button
                          onClick={() => toggleTable(table.name)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between text-sm"
                        >
                          <div>
                            <span className="font-medium text-gray-900">
                              {table.name}
                            </span>
                            {table.tableComment && (
                              <span className="text-gray-500 text-xs ml-2">
                                ({table.tableComment})
                              </span>
                            )}
                            <span className="text-gray-400 text-xs ml-2">
                              {table.columnCount} 列
                            </span>
                          </div>
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${expandedTable === table.name ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>

                        {expandedTable === table.name && (
                          <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
                            <div className="space-y-1">
                              {table.columns.map((col) => (
                                <div
                                  key={col.id}
                                  className="text-xs flex items-center gap-2"
                                >
                                  {col.isPrimaryKey && (
                                    <span className="text-yellow-600">🔑</span>
                                  )}
                                  <span
                                    className={`font-mono ${col.isPrimaryKey ? "text-yellow-700" : "text-gray-700"}`}
                                  >
                                    {col.name}
                                  </span>
                                  <span className="text-gray-400">
                                    {col.dataType}
                                  </span>
                                  {col.columnComment && (
                                    <span className="text-gray-500 ml-auto">
                                      {col.columnComment}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-blue-50 border-t border-blue-100 rounded-b-xl">
                <h4 className="text-sm font-medium text-blue-900 mb-2">
                  💡 使用提示
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• 描述需求时尽量明确涉及的表和筛选条件</li>
                  <li>• 如"统计每个用户的订单数量和总金额"</li>
                  <li>• AI 会严格使用知识库中的真实字段名</li>
                  <li>• 如果缺少必要字段，AI 会明确提示</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <span className="mr-2">📝</span>
                    生成结果
                  </h2>
                </div>
                {displaySQL && !isStreaming && (
                  <button
                    onClick={handleCopySQL}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-200 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    <span className="mr-2">📋</span>
                    复制 SQL
                  </button>
                )}
              </div>

              {hasAlternatives && !isStreaming && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-gray-500 mr-2">选择方案:</span>
                  {generatedResult?.alternatives?.map((alt) => (
                    <button
                      key={alt.id}
                      onClick={() => handleAlternativeChange(alt.id)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        selectedAlternativeId === alt.id
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      方案{alt.id}
                      {alt.id === 1 && " (推荐)"}
                    </button>
                  ))}
                </div>
              )}

              {displayApproach && !isStreaming && (
                <div className="mb-2 p-3 bg-indigo-50 rounded-lg">
                  <span className="text-sm font-medium text-indigo-800">
                    💡 设计思路: {displayApproach}
                  </span>
                </div>
              )}

              {generatedResult && !isStreaming && (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    置信度:{" "}
                    <span
                      className={`font-medium ${
                        displayConfidence >= 0.8
                          ? "text-green-600"
                          : displayConfidence >= 0.6
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    >
                      {(displayConfidence * 100).toFixed(0)}%
                    </span>
                  </span>
                  {displayTablesUsed.length > 0 && (
                    <span className="text-sm text-gray-500">
                      涉及表: {displayTablesUsed.join(", ")}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              {!displaySQL && !isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="text-6xl mb-4">🤖</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    等待生成 SQL
                  </h3>
                  <p className="text-gray-500 max-w-md">
                    在左侧输入报表需求描述，点击"生成 SQL"按钮，
                    AI 将基于知识库中的表结构为您生成准确的 SQL 语句。
                  </p>
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg max-w-md text-sm text-gray-600">
                    <p className="font-medium mb-2">示例需求：</p>
                    <ul className="space-y-1 text-left">
                      <li>• 查询订单表中金额大于1000的订单</li>
                      <li>• 统计每个用户的订单数量和总金额</li>
                      <li>• 查询本月订单并关联用户信息</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-6">
                    {isStreaming && (
                      <div className="mb-4 flex items-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse">
                          <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                          正在生成...
                        </span>
                      </div>
                    )}

                    {displaySQL && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          SQL 语句
                        </h4>
                        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap font-mono">
                          {displaySQL}
                          {isStreaming && (
                            <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-1"></span>
                          )}
                        </pre>
                      </div>
                    )}

                    {displayExplanation && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          📖 逻辑解释
                        </h4>
                        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                          {displayExplanation}
                        </div>
                      </div>
                    )}

                    {generatedResult?.warnings &&
                      generatedResult.warnings.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-yellow-800 mb-2">
                            ⚠️ 注意事项
                          </h4>
                          <div className="space-y-2">
                            {generatedResult.warnings.map((warning, index) => (
                              <div
                                key={index}
                                className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800"
                              >
                                {warning}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>

                  {generatedResult &&
                    displayTablesUsed.length > 0 &&
                    !isStreaming && (
                      <div className="border-t border-gray-200 p-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">
                          📊 统计信息
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-3 bg-blue-50 rounded-lg text-center">
                            <div className="text-xs text-gray-500">涉及表数</div>
                            <div className="text-lg font-semibold text-blue-700">
                              {displayTablesUsed.length}
                            </div>
                          </div>
                          <div className="p-3 bg-green-50 rounded-lg text-center">
                            <div className="text-xs text-gray-500">置信度</div>
                            <div className="text-lg font-semibold text-green-700">
                              {(displayConfidence * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div className="p-3 bg-purple-50 rounded-lg text-center">
                            <div className="text-xs text-gray-500">SQL 长度</div>
                            <div className="text-lg font-semibold text-purple-700">
                              {displaySQL.length} 字符
                            </div>
                          </div>
                          <div className="p-3 bg-orange-50 rounded-lg text-center">
                            <div className="text-xs text-gray-500">警告数</div>
                            <div className="text-lg font-semibold text-orange-700">
                              {generatedResult.warnings.length}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                </>
              )}
              <div ref={resultEndRef} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
