"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/ui/AdminHeader";

interface RAGConfig {
  chunkSize: number;
  chunkOverlap: number;
  maxSingleChunkSize: number;
  sqlChunkSize: number;
  sqlChunkOverlap: number;
  sqlMaxSingleChunkSize: number;
}

interface DatabaseConfig {
  type: string;
  host?: string;
  port?: string;
  user?: string;
  database?: string;
}

interface MilvusConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  collection: string;
  dimensions: number;
}

interface MilvusStats {
  enabled: boolean;
  collectionName: string;
  totalVectors: number;
  dimensions: number;
}

interface MigrationStatus {
  isRunning: boolean;
  total: number;
  processed: number;
  errors: number;
  startTime?: string;
  endTime?: string;
  errorMessage?: string;
}

interface EmbeddingConfigInfo {
  provider: string;
  model: string;
  recommendedDimensions: number;
}

const dbTypeLabels: Record<string, string> = {
  SQLITE: "SQLite",
  POSTGRESQL: "PostgreSQL",
  MYSQL: "MySQL",
  ORACLE: "Oracle",
};

export default function GeneralSettingsPage() {
  const router = useRouter();

  const [maxFileSize, setMaxFileSize] = useState("10");
  const [storageQuota, setStorageQuota] = useState("100");
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [forceMfa, setForceMfa] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [ragConfig, setRAGConfig] = useState<RAGConfig | null>(null);
  const [databaseConfig, setDatabaseConfig] = useState<DatabaseConfig | null>(null);
  const [milvusConfig, setMilvusConfig] = useState<MilvusConfig | null>(null);
  const [milvusStats, setMilvusStats] = useState<MilvusStats | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingConfigInfo | null>(null);
  const [dimensionsMatch, setDimensionsMatch] = useState<boolean | null>(null);
  const [allModelDimensions, setAllModelDimensions] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const [activeTab, setActiveTab] = useState<"basic" | "rag" | "milvus">("basic");

  useEffect(() => {
    fetchConfigs();
  }, []);

  async function fetchConfigs() {
    setLoading(true);
    try {
      const [ragResponse, dbResponse, milvusResponse, migrateResponse] = await Promise.all([
        fetch("/api/admin/rag-config"),
        fetch("/api/admin/database-config"),
        fetch("/api/admin/milvus-config"),
        fetch("/api/admin/milvus-migrate"),
      ]);

      if (ragResponse.ok) {
        const ragData = await ragResponse.json();
        setRAGConfig(ragData.config);
      }

      if (dbResponse.ok) {
        const dbData = await dbResponse.json();
        setDatabaseConfig(dbData.config);
      }

      if (milvusResponse.ok) {
        const milvusData = await milvusResponse.json();
        setMilvusConfig(milvusData.config);
        setMilvusStats(milvusData.stats);
        setEmbeddingConfig(milvusData.embeddingConfig);
        setDimensionsMatch(milvusData.dimensionsMatch);
        setAllModelDimensions(milvusData.allModelDimensions);
      }

      if (migrateResponse.ok) {
        const migrateData = await migrateResponse.json();
        setMigrationStatus(migrateData.migrationStatus);
      }
    } catch (error) {
      console.error("获取配置失败:", error);
    } finally {
      setLoading(false);
    }
  }

  const updateRAGConfig = (field: string, value: string) => {
    if (!ragConfig) return;
    setRAGConfig({
      ...ragConfig,
      [field]: parseInt(value, 10) || 0,
    });
  };

  const updateMilvusConfig = (field: string, value: string | number | boolean) => {
    if (!milvusConfig) return;
    setMilvusConfig({
      ...milvusConfig,
      [field]: value,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      if (ragConfig) {
        const response = await fetch("/api/admin/rag-config", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chunkSize: ragConfig.chunkSize,
            chunkOverlap: ragConfig.chunkOverlap,
            maxSingleChunkSize: ragConfig.maxSingleChunkSize,
            sqlChunkSize: ragConfig.sqlChunkSize,
            sqlChunkOverlap: ragConfig.sqlChunkOverlap,
            sqlMaxSingleChunkSize: ragConfig.sqlMaxSingleChunkSize,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setRAGConfig(data.config);
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "保存失败");
        }
      }

      if (milvusConfig) {
        const response = await fetch("/api/admin/milvus-config", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            enabled: milvusConfig.enabled,
            host: milvusConfig.host,
            port: milvusConfig.port,
            username: milvusConfig.username,
            password: milvusConfig.password,
            collection: milvusConfig.collection,
            dimensions: milvusConfig.dimensions,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setMilvusConfig(data.config);
          setMilvusStats(data.stats);
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "保存 Milvus 配置失败");
        }
      }

      setSaveMessage({
        type: "success",
        text: "设置保存成功，新配置将立即生效",
      });

      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "保存失败，请稍后重试",
      });
    } finally {
      setSaving(false);
    }
  };

  const testMilvusConnection = async () => {
    if (!milvusConfig) return;

    setTesting(true);
    try {
      const response = await fetch("/api/admin/milvus-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "test",
          ...milvusConfig,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSaveMessage({
          type: "success",
          text: data.message,
        });
      } else {
        setSaveMessage({
          type: "error",
          text: data.message || "连接测试失败",
        });
      }
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "连接测试失败",
      });
    } finally {
      setTesting(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const initMilvusCollection = async () => {
    try {
      const response = await fetch("/api/admin/milvus-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "initCollection",
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSaveMessage({
          type: "success",
          text: data.message,
        });
        fetchConfigs();
      } else {
        setSaveMessage({
          type: "error",
          text: data.message || "初始化集合失败",
        });
      }
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "初始化集合失败",
      });
    } finally {
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const startMigration = async () => {
    setMigrating(true);
    try {
      const response = await fetch("/api/admin/milvus-migrate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "start",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSaveMessage({
          type: "success",
          text: data.message,
        });
        setMigrationStatus(data.migrationStatus);
      } else {
        setSaveMessage({
          type: "error",
          text: data.message || "启动迁移失败",
        });
      }
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "启动迁移失败",
      });
    } finally {
      setMigrating(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleReset = () => {
    if (ragConfig) {
      setRAGConfig({
        chunkSize: 500,
        chunkOverlap: 50,
        maxSingleChunkSize: 2000,
        sqlChunkSize: 4000,
        sqlChunkOverlap: 0,
        sqlMaxSingleChunkSize: 8000,
      });
    }
    setMaxFileSize("10");
    setStorageQuota("100");
    setSessionTimeout("30");
    setForceMfa(false);
  };

  const renderInput = (
    label: string,
    description: string,
    value: number,
    field: string,
    min: number,
    max: number,
    unit: string = "字符"
  ) => (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="number"
          value={value}
          onChange={(e) => updateRAGConfig(field, e.target.value)}
          min={min}
          max={max}
          className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-right"
        />
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
    </div>
  );

  const renderDatabaseInfo = () => {
    if (!databaseConfig) {
      return (
        <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded">
          加载中...
        </div>
      );
    }

    const dbLabel = dbTypeLabels[databaseConfig.type] || databaseConfig.type;
    
    let dbInfo = dbLabel;
    if (databaseConfig.type === "SQLITE") {
      dbInfo += " (文件存储)";
    } else {
      if (databaseConfig.host) {
        dbInfo += ` (${databaseConfig.host}`;
        if (databaseConfig.port) {
          dbInfo += `:${databaseConfig.port}`;
        }
        dbInfo += ")";
      }
    }

    return (
      <div className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded">
        <div className="font-medium text-gray-800">{dbInfo}</div>
        {databaseConfig.database && databaseConfig.type !== "SQLITE" && (
          <div className="text-xs text-gray-500 mt-1">
            数据库名: {databaseConfig.database}
          </div>
        )}
        <div className="text-xs text-gray-400 mt-1">
          向量数据存储在 document_chunks 表的 embedding 字段中（JSON 格式）
        </div>
      </div>
    );
  };

  const renderVectorBackendInfo = () => {
    const isMilvusActive = milvusConfig?.enabled ?? false;
    
    return (
      <div className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded">
        <div className="font-medium text-gray-800 flex items-center">
          <span
            className={`inline-block w-2 h-2 rounded-full mr-2 ${
              isMilvusActive ? "bg-green-500" : "bg-blue-500"
            }`}
          />
          {isMilvusActive ? "Milvus 向量数据库" : "关系型数据库"}
        </div>
        {isMilvusActive && milvusStats && (
          <div className="text-xs text-gray-500 mt-1">
            集合: {milvusStats.collectionName} | 向量数量: {milvusStats.totalVectors} | 维度: {milvusStats.dimensions}
          </div>
        )}
        {!isMilvusActive && (
          <div className="text-xs text-gray-400 mt-1">
            要启用 Milvus，请在下方配置并开启
          </div>
        )}
      </div>
    );
  };

  const renderEmbeddingConfigInfo = () => {
    if (!embeddingConfig) {
      return (
        <div className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded">
          加载中...
        </div>
      );
    }

    const providerLabels: Record<string, string> = {
      OPENAI: "OpenAI",
      DEEPSEEK: "DeepSeek",
      DASHSCOPE: "DashScope (阿里云灵积)",
    };

    const providerLabel = providerLabels[embeddingConfig.provider] || embeddingConfig.provider;
    const currentDimensions = milvusConfig?.dimensions || 1024;
    const recommendedDimensions = embeddingConfig.recommendedDimensions;
    const isMatch = dimensionsMatch;

    return (
      <div className="text-sm bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="font-medium text-blue-800 mb-3 flex items-center">
          <span className="mr-2">🔍</span>
          当前 Embedding 模型配置
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
          <div>
            <p className="text-xs text-blue-600">提供商</p>
            <p className="font-medium text-blue-800">{providerLabel}</p>
          </div>
          <div>
            <p className="text-xs text-blue-600">模型名称</p>
            <p className="font-medium text-blue-800 font-mono">{embeddingConfig.model}</p>
          </div>
          <div>
            <p className="text-xs text-blue-600">推荐向量维度</p>
            <p className="font-medium text-blue-800">{recommendedDimensions} 维</p>
          </div>
        </div>

        {!isMatch && milvusConfig && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <div className="flex items-start">
              <span className="text-amber-500 mr-2 mt-0.5">⚠️</span>
              <div className="flex-1">
                <p className="font-medium text-amber-800">
                  向量维度不匹配！
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  当前 Milvus 配置维度: <span className="font-mono font-medium">{currentDimensions}</span> 维
                </p>
                <p className="text-sm text-amber-700">
                  当前模型需要维度: <span className="font-mono font-medium text-green-700">{recommendedDimensions}</span> 维
                </p>
                <p className="text-xs text-amber-600 mt-2">
                  建议：
                  <br />• 如果是新配置，请将维度改为 <span className="font-mono">{recommendedDimensions}</span>
                  <br />• 如果已初始化集合且有数据，需要：
                  <br />  1) 删除旧集合（会丢失数据）
                  <br />  2) 修改维度配置
                  <br />  3) 重新初始化集合
                  <br />  4) 重新向量化所有文档
                </p>
              </div>
            </div>
          </div>
        )}

        {isMatch && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center">
              <span className="text-green-500 mr-2">✅</span>
              <p className="text-sm text-green-700">
                向量维度配置正确！当前 Milvus 维度 ({currentDimensions} 维) 与模型推荐维度 ({recommendedDimensions} 维) 一致。
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderModelDimensionsReference = () => {
    if (!allModelDimensions) return null;

    return (
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
          📋 查看所有模型维度参考
        </summary>
        <div className="mt-2 p-3 bg-gray-50 rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-gray-600 font-medium">模型名称</th>
                <th className="text-right py-2 text-gray-600 font-medium">向量维度</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(allModelDimensions).map(([model, dimensions]) => (
                <tr key={model} className="border-b border-gray-100">
                  <td className="py-2 font-mono text-gray-700">{model}</td>
                  <td className="py-2 text-right text-gray-700">{dimensions} 维</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader title="系统设置" showBackButton={false} showNavMenu={true} />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-6 py-12 text-center text-gray-500">
              加载配置中...
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="系统设置" showBackButton={false} showNavMenu={true} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {saveMessage && (
          <div
            className={`mb-6 p-4 rounded-md ${
              saveMessage.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {saveMessage.text}
          </div>
        )}

        <div className="bg-white shadow sm:rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { key: "basic", label: "基本设置" },
                { key: "rag", label: "RAG 配置" },
                { key: "milvus", label: "Milvus 配置" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.key
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {activeTab === "basic" && (
            <div className="divide-y divide-gray-200">
              <div className="px-6 py-6">
                <h3 className="text-base font-medium text-gray-900 mb-4">
                  存储设置
                </h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        单文件大小限制
                      </p>
                      <p className="text-sm text-gray-500">
                        设置允许上传的单个文件最大大小
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <select
                        value={maxFileSize}
                        onChange={(e) => setMaxFileSize(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="10">10 MB</option>
                        <option value="50">50 MB</option>
                        <option value="100">100 MB</option>
                        <option value="500">500 MB</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        总存储配额
                      </p>
                      <p className="text-sm text-gray-500">
                        设置系统总存储容量上限
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <select
                        value={storageQuota}
                        onChange={(e) => setStorageQuota(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="10">10 GB</option>
                        <option value="50">50 GB</option>
                        <option value="100">100 GB</option>
                        <option value="0">无限制</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6">
                <h3 className="text-base font-medium text-gray-900 mb-4">
                  安全设置
                </h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        会话超时
                      </p>
                      <p className="text-sm text-gray-500">
                        用户无操作后自动登出的时间
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <select
                        value={sessionTimeout}
                        onChange={(e) => setSessionTimeout(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="15">15 分钟</option>
                        <option value="30">30 分钟</option>
                        <option value="60">1 小时</option>
                        <option value="120">2 小时</option>
                        <option value="240">4 小时</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        强制双因素认证
                      </p>
                      <p className="text-sm text-gray-500">
                        要求所有用户启用双因素认证
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForceMfa(!forceMfa)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        forceMfa ? "bg-indigo-600" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          forceMfa ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6">
                <h3 className="text-base font-medium text-gray-900 mb-4">
                  数据库配置
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  当前系统使用的数据库类型（只读）
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      数据库类型
                    </p>
                  </div>
                  {renderDatabaseInfo()}
                </div>
              </div>

              <div className="px-6 py-6">
                <h3 className="text-base font-medium text-gray-900 mb-4">
                  向量存储后端
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  当前使用的向量存储后端
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      当前后端
                    </p>
                  </div>
                  {renderVectorBackendInfo()}
                </div>
              </div>
            </div>
          )}

          {activeTab === "rag" && (
            <div className="divide-y divide-gray-200">
              <div className="px-6 py-6">
                <h3 className="text-base font-medium text-gray-900 mb-4">
                  RAG 配置 - 普通文档
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  适用于 PDF、DOCX、TXT 等普通文档的分块参数配置
                </p>
                {ragConfig && (
                  <div className="space-y-6">
                    {renderInput(
                      "文本分片大小",
                      "RAG 处理时的文本切片大小（字符数）",
                      ragConfig.chunkSize,
                      "chunkSize",
                      100,
                      50000
                    )}
                    {renderInput(
                      "分片重叠大小",
                      "相邻分片之间的重叠字符数，帮助保持上下文连续性",
                      ragConfig.chunkOverlap,
                      "chunkOverlap",
                      0,
                      5000
                    )}
                    {renderInput(
                      "最大单块大小",
                      "单个文本块的最大大小限制（字符数）",
                      ragConfig.maxSingleChunkSize,
                      "maxSingleChunkSize",
                      100,
                      100000
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-6">
                <h3 className="text-base font-medium text-gray-900 mb-4">
                  RAG 配置 - SQL 文档
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  适用于 SQL 脚本文件的分块参数配置。SQL 文件会按 CREATE 语句边界进行分割。
                </p>
                {ragConfig && (
                  <div className="space-y-6">
                    {renderInput(
                      "文本分片大小",
                      "SQL 文档的文本切片大小（字符数）",
                      ragConfig.sqlChunkSize,
                      "sqlChunkSize",
                      100,
                      100000
                    )}
                    {renderInput(
                      "分片重叠大小",
                      "SQL 文档相邻分片之间的重叠字符数",
                      ragConfig.sqlChunkOverlap,
                      "sqlChunkOverlap",
                      0,
                      5000
                    )}
                    {renderInput(
                      "最大单块大小",
                      "SQL 文档单个文本块的最大大小限制（字符数）",
                      ragConfig.sqlMaxSingleChunkSize,
                      "sqlMaxSingleChunkSize",
                      100,
                      200000
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "milvus" && milvusConfig && (
            <div className="divide-y divide-gray-200">
              <div className="px-6 py-6">
                <h3 className="text-base font-medium text-gray-900 mb-4">
                  当前 Embedding 模型配置
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  以下是当前配置的 Embedding 模型信息，以及与 Milvus 向量维度的匹配状态
                </p>
                {renderEmbeddingConfigInfo()}
                {renderModelDimensionsReference()}
              </div>

              <div className="px-6 py-6">
                <h3 className="text-base font-medium text-gray-900 mb-4">
                  Milvus 连接配置
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  配置 Milvus 向量数据库连接，启用后将使用 Milvus 进行向量存储和搜索
                </p>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        启用 Milvus
                      </p>
                      <p className="text-sm text-gray-500">
                        开启后将使用 Milvus 作为向量存储后端
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateMilvusConfig("enabled", !milvusConfig.enabled)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        milvusConfig.enabled ? "bg-indigo-600" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          milvusConfig.enabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        主机地址
                      </p>
                      <p className="text-sm text-gray-500">
                        Milvus 服务器地址
                      </p>
                    </div>
                    <input
                      type="text"
                      value={milvusConfig.host}
                      onChange={(e) => updateMilvusConfig("host", e.target.value)}
                      className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="localhost"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        端口
                      </p>
                      <p className="text-sm text-gray-500">
                        Milvus 服务器端口
                      </p>
                    </div>
                    <input
                      type="number"
                      value={milvusConfig.port}
                      onChange={(e) => updateMilvusConfig("port", parseInt(e.target.value) || 19530)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      min={1}
                      max={65535}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        用户名
                      </p>
                      <p className="text-sm text-gray-500">
                        Milvus 认证用户名（可选）
                      </p>
                    </div>
                    <input
                      type="text"
                      value={milvusConfig.username}
                      onChange={(e) => updateMilvusConfig("username", e.target.value)}
                      className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="可选"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        密码
                      </p>
                      <p className="text-sm text-gray-500">
                        Milvus 认证密码（可选）
                      </p>
                    </div>
                    <input
                      type="password"
                      value={milvusConfig.password}
                      onChange={(e) => updateMilvusConfig("password", e.target.value)}
                      className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="可选"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        集合名称
                      </p>
                      <p className="text-sm text-gray-500">
                        存储向量的集合名称
                      </p>
                    </div>
                    <input
                      type="text"
                      value={milvusConfig.collection}
                      onChange={(e) => updateMilvusConfig("collection", e.target.value)}
                      className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="document_chunks"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        向量维度
                      </p>
                      <p className="text-sm text-gray-500">
                        嵌入模型输出的向量维度（如 text-embedding-v3 为 1024）
                      </p>
                    </div>
                    <input
                      type="number"
                      value={milvusConfig.dimensions}
                      onChange={(e) => updateMilvusConfig("dimensions", parseInt(e.target.value) || 1024)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      min={1}
                      max={100000}
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center space-x-3">
                  <button
                    onClick={testMilvusConnection}
                    disabled={testing}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {testing ? "测试中..." : "测试连接"}
                  </button>
                  <button
                    onClick={initMilvusCollection}
                    className="px-4 py-2 border border-indigo-300 rounded-md text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                  >
                    初始化集合
                  </button>
                </div>
              </div>

              <div className="px-6 py-6">
                <h3 className="text-base font-medium text-gray-900 mb-4">
                  数据迁移
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  将现有向量数据从关系型数据库迁移到 Milvus
                </p>

                {milvusStats && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-md">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Milvus 状态</p>
                        <p className="font-medium">{milvusStats.enabled ? "已启用" : "未启用"}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">向量数量</p>
                        <p className="font-medium">{milvusStats.totalVectors}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">向量维度</p>
                        <p className="font-medium">{milvusStats.dimensions}</p>
                      </div>
                    </div>
                  </div>
                )}

                {migrationStatus && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-md">
                    <h4 className="font-medium text-blue-800 mb-2">迁移状态</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-blue-600">状态</p>
                        <p className="font-medium">
                          {migrationStatus.isRunning ? "运行中" : "已停止"}
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-600">进度</p>
                        <p className="font-medium">
                          {migrationStatus.processed} / {migrationStatus.total}
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-600">错误</p>
                        <p className="font-medium">{migrationStatus.errors}</p>
                      </div>
                    </div>
                    {migrationStatus.isRunning && (
                      <div className="mt-3">
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${migrationStatus.total > 0 ? (migrationStatus.processed / migrationStatus.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <button
                    onClick={startMigration}
                    disabled={migrating || migrationStatus?.isRunning || !milvusConfig.enabled}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {migrating ? "启动中..." : "开始迁移"}
                  </button>
                  <button
                    onClick={fetchConfigs}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    刷新状态
                  </button>
                </div>

                <div className="mt-4 p-4 bg-yellow-50 rounded-md">
                  <p className="text-sm text-yellow-800">
                    <strong>注意：</strong> 迁移操作会将关系型数据库中已有的向量数据复制到 Milvus。
                    建议在迁移前先测试 Milvus 连接并初始化集合。
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              重置
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "保存中..." : "保存设置"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
