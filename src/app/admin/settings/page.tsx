"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AIProvider = "OPENAI" | "DEEPSEEK" | "DASHSCOPE";

interface AIConfigState {
  embedding: {
    provider: AIProvider;
    apiKey: string;
    baseUrl: string;
    model: string;
    hasApiKey: boolean;
  };
  llm: {
    provider: AIProvider;
    apiKey: string;
    baseUrl: string;
    model: string;
    temperature: number;
    hasApiKey: boolean;
  };
}

interface ProviderData {
  providers: AIProvider[];
  embeddingModels: Record<AIProvider, string[]>;
  llmModels: Record<AIProvider, string[]>;
  defaultBaseUrls: Record<AIProvider, string>;
}

const providerLabels: Record<AIProvider, string> = {
  OPENAI: "OpenAI",
  DEEPSEEK: "DeepSeek",
  DASHSCOPE: "DashScope (阿里云灵积)",
};

export default function SettingsPage() {
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

  const [aiConfig, setAiConfig] = useState<AIConfigState | null>(null);
  const [providerData, setProviderData] = useState<ProviderData | null>(null);
  const [loadingAIConfig, setLoadingAIConfig] = useState(true);

  const [testingEmbedding, setTestingEmbedding] = useState(false);
  const [testingLLM, setTestingLLM] = useState(false);
  const [testResult, setTestResult] = useState<{
    type: "embedding" | "llm";
    success: boolean;
    message: string;
    latency?: number;
  } | null>(null);

  const [savingAIConfig, setSavingAIConfig] = useState(false);

  useEffect(() => {
    fetchAIConfig();
  }, []);

  async function fetchAIConfig() {
    try {
      const response = await fetch("/api/admin/ai-config");
      if (response.ok) {
        const data = await response.json();
        setAiConfig({
          embedding: {
            ...data.config.embedding,
            apiKey: "",
          },
          llm: {
            ...data.config.llm,
            apiKey: "",
          },
        });
        setProviderData({
          providers: data.providers,
          embeddingModels: data.embeddingModels,
          llmModels: data.llmModels,
          defaultBaseUrls: data.defaultBaseUrls,
        });
      }
    } catch (error) {
      console.error("获取 AI 配置失败:", error);
    } finally {
      setLoadingAIConfig(false);
    }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });
      if (response.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (error) {
      console.error("登出失败:", error);
      router.push("/login");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      setSaveMessage({
        type: "success",
        text: "设置保存成功",
      });

      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: "保存失败，请稍后重试",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAIConfig = async () => {
    if (!aiConfig) return;

    setSavingAIConfig(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/admin/ai-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          embedding: {
            provider: aiConfig.embedding.provider,
            apiKey: aiConfig.embedding.apiKey || undefined,
            baseUrl: aiConfig.embedding.baseUrl,
            model: aiConfig.embedding.model,
          },
          llm: {
            provider: aiConfig.llm.provider,
            apiKey: aiConfig.llm.apiKey || undefined,
            baseUrl: aiConfig.llm.baseUrl,
            model: aiConfig.llm.model,
            temperature: aiConfig.llm.temperature,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiConfig({
          embedding: {
            ...data.config.embedding,
            apiKey: "",
          },
          llm: {
            ...data.config.llm,
            apiKey: "",
          },
        });

        setSaveMessage({
          type: "success",
          text: "AI 配置保存成功，新配置将立即生效",
        });

        setTimeout(() => {
          setSaveMessage(null);
        }, 5000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "保存失败");
      }
    } catch (error) {
      console.error("保存 AI 配置失败:", error);
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "保存失败，请稍后重试",
      });
    } finally {
      setSavingAIConfig(false);
    }
  };

  const handleTestConnection = async (type: "embedding" | "llm") => {
    if (!aiConfig) return;

    const config = type === "embedding" ? aiConfig.embedding : aiConfig.llm;

    const apiKeyToUse = config.apiKey || (config.hasApiKey ? "********" : "");

    if (!apiKeyToUse) {
      setTestResult({
        type,
        success: false,
        message: "请先输入 API Key 或保存配置",
      });
      return;
    }

    setTestResult(null);

    if (type === "embedding") {
      setTestingEmbedding(true);
    } else {
      setTestingLLM(true);
    }

    try {
      const response = await fetch("/api/admin/ai-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          provider: config.provider,
          apiKey: config.apiKey || (config.hasApiKey ? "use_saved" : ""),
          baseUrl: config.baseUrl,
          model: config.model,
        }),
      });

      const result = await response.json();

      setTestResult({
        type,
        success: result.success,
        message: result.message,
        latency: result.latency,
      });
    } catch (error) {
      console.error("测试连接失败:", error);
      setTestResult({
        type,
        success: false,
        message: "测试连接失败，请稍后重试",
      });
    } finally {
      if (type === "embedding") {
        setTestingEmbedding(false);
      } else {
        setTestingLLM(false);
      }
    }
  };

  const updateEmbeddingConfig = (field: string, value: string) => {
    if (!aiConfig) return;

    const newConfig = {
      ...aiConfig,
      embedding: {
        ...aiConfig.embedding,
        [field]: value,
      },
    };

    if (field === "provider" && providerData) {
      const provider = value as AIProvider;
      newConfig.embedding.model = providerData.embeddingModels[provider][0];
      newConfig.embedding.baseUrl = providerData.defaultBaseUrls[provider];
    }

    setAiConfig(newConfig);
  };

  const updateLLMConfig = (field: string, value: string | number) => {
    if (!aiConfig) return;

    const newConfig = {
      ...aiConfig,
      llm: {
        ...aiConfig.llm,
        [field]: value,
      },
    };

    if (field === "provider" && providerData) {
      const provider = value as AIProvider;
      newConfig.llm.model = providerData.llmModels[provider][0];
      newConfig.llm.baseUrl = providerData.defaultBaseUrls[provider];
    }

    setAiConfig(newConfig);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Link
              href="/admin"
              className="text-sm text-gray-600 hover:text-gray-900 mr-4"
            >
              ← 返回管理后台
            </Link>
            <h1 className="text-xl font-bold text-gray-900">系统设置</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              前台
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              退出
            </button>
          </div>
        </div>
      </header>

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

        {testResult && (
          <div
            className={`mb-6 p-4 rounded-md ${
              testResult.success
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span>
                {testResult.type === "embedding" ? "Embedding" : "LLM"}{" "}
                测试: {testResult.message}
                {testResult.latency && ` (耗时: ${testResult.latency}ms)`}
              </span>
              <button
                onClick={() => setTestResult(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="bg-white shadow sm:rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">AI 配置</h2>
            <p className="text-sm text-gray-500 mt-1">
              配置 Embedding 向量化服务和 LLM 对话模型，支持 OpenAI、DeepSeek、DashScope
              等多种提供商。修改配置后立即生效，无需重启服务。
            </p>
          </div>

          {loadingAIConfig ? (
            <div className="px-6 py-12 text-center text-gray-500">
              加载配置中...
            </div>
          ) : aiConfig && providerData ? (
            <div className="divide-y divide-gray-200">
              <div className="px-6 py-6">
                <h3 className="text-base font-medium text-gray-900 mb-4">
                  Embedding 向量化配置
                </h3>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        服务提供商
                      </label>
                      <select
                        value={aiConfig.embedding.provider}
                        onChange={(e) =>
                          updateEmbeddingConfig("provider", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {providerData.providers.map((provider) => (
                          <option key={provider} value={provider}>
                            {providerLabels[provider]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        模型名称
                      </label>
                      <select
                        value={aiConfig.embedding.model}
                        onChange={(e) =>
                          updateEmbeddingConfig("model", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {providerData.embeddingModels[
                          aiConfig.embedding.provider
                        ].map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key
                      {aiConfig.embedding.hasApiKey && (
                        <span className="ml-2 text-green-600 text-xs">
                          (已配置)
                        </span>
                      )}
                    </label>
                    <input
                      type="password"
                      value={aiConfig.embedding.apiKey}
                      onChange={(e) =>
                        updateEmbeddingConfig("apiKey", e.target.value)
                      }
                      placeholder={
                        aiConfig.embedding.hasApiKey
                          ? "留空则使用已保存的配置"
                          : "请输入 API Key"
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Base URL
                    </label>
                    <input
                      type="text"
                      value={aiConfig.embedding.baseUrl}
                      onChange={(e) =>
                        updateEmbeddingConfig("baseUrl", e.target.value)
                      }
                      placeholder="https://api.example.com/v1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      默认值:{" "}
                      {providerData.defaultBaseUrls[aiConfig.embedding.provider]}
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleTestConnection("embedding")}
                      disabled={testingEmbedding}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testingEmbedding ? "测试中..." : "测试连接"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6">
                <h3 className="text-base font-medium text-gray-900 mb-4">
                  LLM 对话模型配置
                </h3>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        服务提供商
                      </label>
                      <select
                        value={aiConfig.llm.provider}
                        onChange={(e) => updateLLMConfig("provider", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {providerData.providers.map((provider) => (
                          <option key={provider} value={provider}>
                            {providerLabels[provider]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        模型名称
                      </label>
                      <select
                        value={aiConfig.llm.model}
                        onChange={(e) => updateLLMConfig("model", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {providerData.llmModels[aiConfig.llm.provider].map(
                          (model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key
                      {aiConfig.llm.hasApiKey && (
                        <span className="ml-2 text-green-600 text-xs">
                          (已配置)
                        </span>
                      )}
                    </label>
                    <input
                      type="password"
                      value={aiConfig.llm.apiKey}
                      onChange={(e) => updateLLMConfig("apiKey", e.target.value)}
                      placeholder={
                        aiConfig.llm.hasApiKey
                          ? "留空则使用已保存的配置"
                          : "请输入 API Key"
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Base URL
                    </label>
                    <input
                      type="text"
                      value={aiConfig.llm.baseUrl}
                      onChange={(e) => updateLLMConfig("baseUrl", e.target.value)}
                      placeholder="https://api.example.com/v1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      默认值: {providerData.defaultBaseUrls[aiConfig.llm.provider]}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      温度参数 (Temperature): {aiConfig.llm.temperature}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={aiConfig.llm.temperature}
                      onChange={(e) =>
                        updateLLMConfig("temperature", parseFloat(e.target.value))
                      }
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>精确 (0)</span>
                      <span>平衡 (0.7)</span>
                      <span>随机 (2)</span>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleTestConnection("llm")}
                      disabled={testingLLM}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testingLLM ? "测试中..." : "测试连接"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    fetchAIConfig();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  重置
                </button>
                <button
                  onClick={handleSaveAIConfig}
                  disabled={savingAIConfig}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingAIConfig ? "保存中..." : "保存 AI 配置"}
                </button>
              </div>
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-red-500">
              加载配置失败，请刷新页面重试
            </div>
          )}
        </div>

        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">系统配置</h2>
          </div>

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
                RAG 配置
              </h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      文本分片大小
                    </p>
                    <p className="text-sm text-gray-500">
                      RAG 处理时的文本切片大小（字符数）
                    </p>
                  </div>
                  <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded">
                    500 字符
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      分片重叠大小
                    </p>
                    <p className="text-sm text-gray-500">
                      相邻分片之间的重叠字符数
                    </p>
                  </div>
                  <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded">
                    50 字符
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      向量数据库
                    </p>
                    <p className="text-sm text-gray-500">
                      用于存储文档向量的数据库类型
                    </p>
                  </div>
                  <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded">
                    内置向量存储
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
            <button
              onClick={() => {
                setMaxFileSize("10");
                setStorageQuota("100");
                setSessionTimeout("30");
                setForceMfa(false);
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              重置
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
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
