"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<{ kbId: string; data: unknown } | null>(null);

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

  const mockKnowledgeBases = [
    { id: "1", name: "产品文档库", docCount: 24, description: "产品相关的文档和规范" },
    { id: "2", name: "技术文档库", docCount: 56, description: "技术架构和开发指南" },
    { id: "3", name: "培训材料库", docCount: 12, description: "新员工培训和入职资料" },
  ];

  const handleExport = async (kbId: string, kbName: string) => {
    setExportingId(kbId);
    setExportResult(null);
    try {
      const response = await fetch(`/api/kb/${kbId}/export`);
      const data = await response.json();
      
      if (response.ok) {
        setExportResult({ kbId, data });
        console.log(`导出 ${kbName} 成功:`, data);
      } else {
        console.error(`导出失败:`, data.message);
        alert(`导出失败: ${data.message}`);
      }
    } catch (error) {
      console.error("导出请求失败:", error);
      alert("导出请求失败，请稍后重试");
    } finally {
      setExportingId(null);
    }
  };

  const mockRecentDocs = [
    { id: "1", title: "API 接口规范 v2.0", updatedAt: "2024-01-15", status: "已发布" },
    { id: "2", title: "数据库设计文档", updatedAt: "2024-01-14", status: "草稿" },
    { id: "3", title: "前端代码规范", updatedAt: "2024-01-13", status: "已发布" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">智能知识库</h1>
          <div className="flex items-center space-x-4">
            <Link
              href="/documents/upload"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              上传文档
            </Link>
            <Link
              href="/admin"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              管理后台
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">我的知识库</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {mockKnowledgeBases.map((kb) => (
              <div
                key={kb.id}
                className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">{kb.name}</h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {kb.docCount} 文档
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{kb.description}</p>
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => handleExport(kb.id, kb.name)}
                      disabled={exportingId === kb.id}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {exportingId === kb.id ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          导出中...
                        </>
                      ) : (
                        "导出为 PDF"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {exportResult && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-green-800">
                  ✅ 导出成功！知识库 ID: {exportResult.kbId}
                </h3>
                <button
                  onClick={() => setExportResult(null)}
                  className="text-sm text-green-600 hover:text-green-800"
                >
                  关闭
                </button>
              </div>
              <details className="text-xs text-green-700">
                <summary className="cursor-pointer hover:text-green-900">查看导出数据预览</summary>
                <pre className="mt-2 p-2 bg-green-100 rounded overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(exportResult.data, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">最近文档</h2>
            <Link
              href="#"
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              查看全部
            </Link>
          </div>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {mockRecentDocs.map((doc) => (
                <li key={doc.id}>
                  <Link
                    href={`/documents/${doc.id}`}
                    className="block hover:bg-gray-50"
                  >
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-indigo-600 truncate">
                          {doc.title}
                        </p>
                        <div className="ml-2 flex-shrink-0 flex">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${doc.status === "已发布" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                          >
                            {doc.status}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex"></div>
                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                          <p>更新于 {doc.updatedAt}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
