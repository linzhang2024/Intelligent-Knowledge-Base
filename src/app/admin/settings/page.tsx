"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [maxFileSize, setMaxFileSize] = useState("10");
  const [storageQuota, setStorageQuota] = useState("100");
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [forceMfa, setForceMfa] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900 mr-4">
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

        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">系统配置</h2>
          </div>

          <div className="divide-y divide-gray-200">
            <div className="px-6 py-6">
              <h3 className="text-base font-medium text-gray-900 mb-4">存储设置</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">单文件大小限制</p>
                    <p className="text-sm text-gray-500">设置允许上传的单个文件最大大小</p>
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
                    <p className="text-sm font-medium text-gray-700">总存储配额</p>
                    <p className="text-sm text-gray-500">设置系统总存储容量上限</p>
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
              <h3 className="text-base font-medium text-gray-900 mb-4">安全设置</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">会话超时</p>
                    <p className="text-sm text-gray-500">用户无操作后自动登出的时间</p>
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
                    <p className="text-sm font-medium text-gray-700">强制双因素认证</p>
                    <p className="text-sm text-gray-500">要求所有用户启用双因素认证</p>
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
              <h3 className="text-base font-medium text-gray-900 mb-4">RAG 配置</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">文本分片大小</p>
                    <p className="text-sm text-gray-500">RAG 处理时的文本切片大小（字符数）</p>
                  </div>
                  <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded">
                    500 字符
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">分片重叠大小</p>
                    <p className="text-sm text-gray-500">相邻分片之间的重叠字符数</p>
                  </div>
                  <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded">
                    50 字符
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">向量数据库</p>
                    <p className="text-sm text-gray-500">用于存储文档向量的数据库类型</p>
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
