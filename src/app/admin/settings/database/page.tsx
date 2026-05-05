"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/ui/AdminHeader";

type DBType = "SQLITE" | "POSTGRESQL" | "MYSQL" | "ORACLE";

interface DatabaseConfigState {
  type: DBType;
  sqlitePath: string;
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  serviceName: string;
  sid: string;
  hasPassword: boolean;
}

const dbTypeLabels: Record<DBType, string> = {
  SQLITE: "SQLite（轻量级，无需 Docker）",
  POSTGRESQL: "PostgreSQL（生产环境推荐）",
  MYSQL: "MySQL（广泛使用）",
  ORACLE: "Oracle Database（企业级）",
};

export default function DatabaseSettingsPage() {
  const router = useRouter();

  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [databaseConfig, setDatabaseConfig] = useState<DatabaseConfigState | null>(null);
  const [loadingDatabaseConfig, setLoadingDatabaseConfig] = useState(true);
  const [testingDatabase, setTestingDatabase] = useState(false);
  const [savingDatabaseConfig, setSavingDatabaseConfig] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{
    success: boolean;
    message: string;
    errorType?: string;
    suggestion?: string;
    latency?: number;
  } | null>(null);

  useEffect(() => {
    fetchDatabaseConfig();
  }, []);

  async function fetchDatabaseConfig() {
    try {
      const response = await fetch("/api/admin/database-config");
      if (response.ok) {
        const data = await response.json();
        setDatabaseConfig({
          type: data.config.type,
          sqlitePath: data.config.type === "SQLITE" ? data.config.databaseUrl.replace("file:", "") : "./dev.db",
          host: data.config.host || "localhost",
          port: data.config.port || 
            (data.config.type === "MYSQL" ? "3306" : 
             data.config.type === "ORACLE" ? "1521" : "5432"),
          user: data.config.user || 
            (data.config.type === "MYSQL" ? "root" : 
             data.config.type === "ORACLE" ? "system" : "postgres"),
          password: "",
          database: data.config.database || 
            (data.config.type === "ORACLE" ? "ORCL" : "intelligent_knowledge_base"),
          serviceName: data.config.serviceName || "",
          sid: data.config.sid || "",
          hasPassword: data.config.hasPassword,
        });
      }
    } catch (error) {
      console.error("获取数据库配置失败:", error);
    } finally {
      setLoadingDatabaseConfig(false);
    }
  }

  const updateDatabaseConfig = (field: string, value: string) => {
    if (!databaseConfig) return;

    let newConfig: DatabaseConfigState;

    if (field === "type") {
      const newType = value as DBType;
      
      newConfig = {
        ...databaseConfig,
        type: newType,
      };

      if (newType === "SQLITE") {
        newConfig.sqlitePath = "./dev.db";
      } else {
        const defaultPorts: Record<DBType, string> = {
          SQLITE: "",
          POSTGRESQL: "5432",
          MYSQL: "3306",
          ORACLE: "1521",
        };

        const defaultUsers: Record<DBType, string> = {
          SQLITE: "",
          POSTGRESQL: "postgres",
          MYSQL: "root",
          ORACLE: "system",
        };

        const defaultDatabases: Record<DBType, string> = {
          SQLITE: "",
          POSTGRESQL: "intelligent_knowledge_base",
          MYSQL: "intelligent_knowledge_base",
          ORACLE: "ORCL",
        };

        newConfig.host = "localhost";
        newConfig.port = defaultPorts[newType];
        newConfig.user = defaultUsers[newType];
        newConfig.database = defaultDatabases[newType];
        newConfig.password = "";
        newConfig.hasPassword = false;
        
        if (newType === "ORACLE") {
          newConfig.sid = "ORCL";
          newConfig.serviceName = "";
        }
      }
    } else {
      newConfig = {
        ...databaseConfig,
        [field]: value,
      };
    }

    setDatabaseConfig(newConfig);
  };

  const handleSaveDatabaseConfig = async () => {
    if (!databaseConfig) return;

    setSavingDatabaseConfig(true);
    setDbTestResult(null);

    try {
      const bodyData: Record<string, unknown> = {
        type: databaseConfig.type,
      };

      if (databaseConfig.type === "SQLITE") {
        bodyData.sqlitePath = `file:${databaseConfig.sqlitePath}`;
      } else {
        bodyData.host = databaseConfig.host;
        bodyData.port = databaseConfig.port;
        bodyData.user = databaseConfig.user;
        bodyData.password = databaseConfig.password || undefined;
        bodyData.database = databaseConfig.database;
        
        if (databaseConfig.type === "ORACLE") {
          bodyData.serviceName = databaseConfig.serviceName || undefined;
          bodyData.sid = databaseConfig.sid || undefined;
        }
      }

      const response = await fetch("/api/admin/database-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyData),
      });

      if (response.ok) {
        const data = await response.json();
        
        setDatabaseConfig({
          ...databaseConfig,
          password: "",
          hasPassword: data.config.hasPassword,
        });

        let message = "数据库配置保存成功，请重启服务以应用新配置";
        if (data.warnings && data.warnings.length > 0) {
          message = `${message}。警告：${data.warnings.join(" ")}`;
        }

        setSaveMessage({
          type: "success",
          text: message,
        });

        setTimeout(() => {
          setSaveMessage(null);
        }, 8000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "保存失败");
      }
    } catch (error) {
      console.error("保存数据库配置失败:", error);
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "保存失败，请稍后重试",
      });
    } finally {
      setSavingDatabaseConfig(false);
    }
  };

  const handleTestDatabaseConnection = async () => {
    if (!databaseConfig) return;

    setDbTestResult(null);
    setTestingDatabase(true);

    try {
      const bodyData: Record<string, unknown> = {
        type: databaseConfig.type,
      };

      if (databaseConfig.type === "SQLITE") {
        bodyData.sqlitePath = `file:${databaseConfig.sqlitePath}`;
      } else {
        bodyData.host = databaseConfig.host;
        bodyData.port = databaseConfig.port;
        bodyData.user = databaseConfig.user;
        bodyData.password = databaseConfig.password || (databaseConfig.hasPassword ? "use_saved" : "");
        bodyData.database = databaseConfig.database;
        
        if (databaseConfig.type === "ORACLE") {
          bodyData.serviceName = databaseConfig.serviceName || undefined;
          bodyData.sid = databaseConfig.sid || undefined;
        }
      }

      const response = await fetch("/api/admin/database-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyData),
      });

      const result = await response.json();

      setDbTestResult({
        success: result.success,
        message: result.message,
        errorType: result.errorType,
        suggestion: result.suggestion,
        latency: result.latency,
      });
    } catch (error) {
      console.error("测试数据库连接失败:", error);
      setDbTestResult({
        success: false,
        message: "测试连接失败，请稍后重试",
      });
    } finally {
      setTestingDatabase(false);
    }
  };

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

        {dbTestResult && (
          <div
            className={`mb-6 p-4 rounded-md ${
              dbTestResult.success
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div
                  className={`font-medium ${
                    dbTestResult.success ? "text-green-800" : "text-red-800"
                  }`}
                >
                  🗄️ 数据库连接测试结果
                </div>
                <div
                  className={`mt-1 ${
                    dbTestResult.success ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {dbTestResult.message}
                  {dbTestResult.latency && (
                    <span className="ml-2 text-sm opacity-75">
                      (响应时间: {dbTestResult.latency}ms)
                    </span>
                  )}
                </div>

                {!dbTestResult.success && dbTestResult.errorType && (
                  <div className="mt-2 text-sm text-red-600">
                    <span className="font-medium">错误类型:</span> {dbTestResult.errorType}
                  </div>
                )}

                {!dbTestResult.success && dbTestResult.suggestion && (
                  <div className="mt-3 p-3 bg-white rounded border border-red-100">
                    <div className="flex items-start">
                      <span className="text-amber-500 mr-2">💡</span>
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">操作建议:</span> {dbTestResult.suggestion}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setDbTestResult(null)}
                className="text-gray-400 hover:text-gray-600 ml-4"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">数据库配置</h2>
            <p className="text-sm text-gray-500 mt-1">
              配置数据库连接，支持 SQLite、PostgreSQL、MySQL 和 Oracle。修改配置后需要重启服务才能生效。
              <span className="text-amber-600 ml-1">
                注意：Prisma 不直接支持 Oracle，Oracle 配置仅用于测试连接。
              </span>
            </p>
          </div>

          {loadingDatabaseConfig ? (
            <div className="px-6 py-12 text-center text-gray-500">
              加载配置中...
            </div>
          ) : databaseConfig ? (
            <div className="divide-y divide-gray-200">
              <div className="px-6 py-6">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      数据库类型
                    </label>
                    <select
                      value={databaseConfig.type}
                      onChange={(e) =>
                        updateDatabaseConfig("type", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {(["SQLITE", "POSTGRESQL", "MYSQL", "ORACLE"] as DBType[]).map((type) => (
                        <option key={type} value={type}>
                          {dbTypeLabels[type]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {databaseConfig.type === "SQLITE" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        数据库文件路径
                      </label>
                      <input
                        type="text"
                        value={databaseConfig.sqlitePath}
                        onChange={(e) =>
                          updateDatabaseConfig("sqlitePath", e.target.value)
                        }
                        placeholder="./dev.db"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        SQLite 数据库文件的相对路径，从项目根目录开始
                      </p>
                    </div>
                  )}

                  {(databaseConfig.type === "POSTGRESQL" || databaseConfig.type === "MYSQL") && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            主机地址
                          </label>
                          <input
                            type="text"
                            value={databaseConfig.host}
                            onChange={(e) =>
                              updateDatabaseConfig("host", e.target.value)
                            }
                            placeholder="localhost"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            端口
                          </label>
                          <input
                            type="text"
                            value={databaseConfig.port}
                            onChange={(e) =>
                              updateDatabaseConfig("port", e.target.value)
                            }
                            placeholder={databaseConfig.type === "MYSQL" ? "3306" : "5432"}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            用户名
                          </label>
                          <input
                            type="text"
                            value={databaseConfig.user}
                            onChange={(e) =>
                              updateDatabaseConfig("user", e.target.value)
                            }
                            placeholder={databaseConfig.type === "MYSQL" ? "root" : "postgres"}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            数据库名
                          </label>
                          <input
                            type="text"
                            value={databaseConfig.database}
                            onChange={(e) =>
                              updateDatabaseConfig("database", e.target.value)
                            }
                            placeholder="intelligent_knowledge_base"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          密码
                          {databaseConfig.hasPassword && (
                            <span className="ml-2 text-green-600 text-xs">
                              (已配置)
                            </span>
                          )}
                        </label>
                        <input
                          type="password"
                          value={databaseConfig.password}
                          onChange={(e) =>
                            updateDatabaseConfig("password", e.target.value)
                          }
                          placeholder={
                            databaseConfig.hasPassword
                              ? "留空则使用已保存的配置"
                              : "请输入数据库密码"
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {databaseConfig.type === "ORACLE" && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            主机地址
                          </label>
                          <input
                            type="text"
                            value={databaseConfig.host}
                            onChange={(e) =>
                              updateDatabaseConfig("host", e.target.value)
                            }
                            placeholder="localhost"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            端口
                          </label>
                          <input
                            type="text"
                            value={databaseConfig.port}
                            onChange={(e) =>
                              updateDatabaseConfig("port", e.target.value)
                            }
                            placeholder="1521"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            用户名
                          </label>
                          <input
                            type="text"
                            value={databaseConfig.user}
                            onChange={(e) =>
                              updateDatabaseConfig("user", e.target.value)
                            }
                            placeholder="system"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            密码
                            {databaseConfig.hasPassword && (
                              <span className="ml-2 text-green-600 text-xs">
                                (已配置)
                              </span>
                            )}
                          </label>
                          <input
                            type="password"
                            value={databaseConfig.password}
                            onChange={(e) =>
                              updateDatabaseConfig("password", e.target.value)
                            }
                            placeholder={
                              databaseConfig.hasPassword
                                ? "留空则使用已保存的配置"
                                : "请输入数据库密码"
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            SID（数据库实例名）
                          </label>
                          <input
                            type="text"
                            value={databaseConfig.sid}
                            onChange={(e) =>
                              updateDatabaseConfig("sid", e.target.value)
                            }
                            placeholder="ORCL"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Oracle 数据库实例名，如 ORCL、XE 等
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Service Name（服务名）
                          </label>
                          <input
                            type="text"
                            value={databaseConfig.serviceName}
                            onChange={(e) =>
                              updateDatabaseConfig("serviceName", e.target.value)
                            }
                            placeholder="ORCL"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            可选，用于 Oracle 12c+ 的服务名连接
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                        <div className="flex items-start">
                          <span className="text-amber-500 mr-2">⚠️</span>
                          <div className="text-sm text-amber-700">
                            <span className="font-medium">重要提示：</span> Prisma ORM 不直接支持 Oracle 数据库。
                            此处配置仅用于测试数据库连接，实际使用需要额外配置或使用其他 ORM 框架。
                            如需使用 Oracle，需要安装 oracledb 驱动：<code className="bg-amber-100 px-1 rounded">npm install oracledb</code>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleTestDatabaseConnection}
                      disabled={testingDatabase}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testingDatabase ? "测试中..." : "测试连接"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    fetchDatabaseConfig();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  重置
                </button>
                <button
                  onClick={handleSaveDatabaseConfig}
                  disabled={savingDatabaseConfig}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingDatabaseConfig ? "保存中..." : "保存数据库配置"}
                </button>
              </div>
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-red-500">
              加载配置失败，请刷新页面重试
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
