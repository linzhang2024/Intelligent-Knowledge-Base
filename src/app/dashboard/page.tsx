"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, formatFileSize } from "@/lib/format";
import LogoutButton from "@/components/ui/LogoutButton";

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  documentCount: number;
  createdAt: string;
}

interface Document {
  id: string;
  title: string;
  content: string | null;
  fileUrl: string | null;
  fileType: string | null;
  fileSize: string | null;
  status: string;
  authorId: string | null;
  knowledgeBaseId: string | null;
  createdAt: string;
  updatedAt: string;
  knowledgeBase?: {
    id: string;
    name: string;
  } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingKb, setLoadingKb] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<{ kbId: string; data: unknown } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [kbResponse, docsResponse] = await Promise.all([
          fetch("/api/kb"),
          fetch("/api/documents?limit=5"),
        ]);

        if (kbResponse.ok) {
          const kbData = await kbResponse.json();
          setKnowledgeBases(kbData.knowledgeBases || []);
        }

        if (docsResponse.ok) {
          const docsData = await docsResponse.json();
          setDocuments(docsData.documents || []);
        }
      } catch (error) {
        console.error("获取数据失败:", error);
      } finally {
        setLoadingKb(false);
        setLoadingDocs(false);
      }
    };

    fetchData();
  }, []);

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

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      DRAFT: "草稿",
      PUBLISHED: "已发布",
      ARCHIVED: "已归档",
    };
    return statusMap[status] || status;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return "bg-green-100 text-green-800";
      case "ARCHIVED":
        return "bg-gray-100 text-gray-800";
      case "DRAFT":
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-bold text-gray-900">智能知识库</h1>
            <div className="flex items-center space-x-3">
              <Link
                href="/chat"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors duration-200"
              >
                <span className="mr-2">💬</span>
                智能问答
              </Link>
              <Link
                href="/report-sql"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 transition-colors duration-200"
              >
                <span className="mr-2">📊</span>
                报表SQL
              </Link>
              <Link
                href="/documents/upload"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200"
              >
                <span className="mr-2">📄</span>
                上传文档
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              href="/admin"
              className="inline-flex items-center px-3 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200"
            >
              <svg
                className="mr-2"
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              管理后台
            </Link>
            <LogoutButton iconOnly={true} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">我的知识库</h2>
          
          {loadingKb ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white overflow-hidden shadow rounded-lg p-6">
                  <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
                    <div className="h-10 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : knowledgeBases.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {knowledgeBases.map((kb) => (
                <div
                  key={kb.id}
                  className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">{kb.name}</h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {kb.documentCount} 文档
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">{kb.description || "暂无描述"}</p>
                    <div className="mt-4 flex space-x-2">
                      <Link
                        href={`/chat?kb=${encodeURIComponent(kb.id)}`}
                        className={`inline-flex items-center justify-center px-3 py-2 border text-sm font-medium rounded-md transition-colors ${
                          kb.documentCount > 0
                            ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                            : "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                        }`}
                        onClick={(e) => {
                          if (kb.documentCount === 0) {
                            e.preventDefault();
                          }
                        }}
                        title={kb.documentCount === 0 ? "该知识库没有文档" : "向此知识库提问"}
                      >
                        💬 提问
                      </Link>
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
          ) : (
            <div className="bg-white shadow-sm rounded-lg p-8 text-center">
              <span className="text-4xl">📚</span>
              <h3 className="mt-4 text-lg font-medium text-gray-900">暂无知识库</h3>
              <p className="mt-2 text-gray-500">创建知识库来组织和管理您的文档</p>
            </div>
          )}

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
              href="/admin"
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              查看全部
            </Link>
          </div>
          
          {loadingDocs ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {[1, 2, 3].map((i) => (
                  <li key={i} className="px-4 py-4 sm:px-6">
                    <div className="animate-pulse">
                      <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : documents.length > 0 ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <Link
                      href={`/documents/${doc.id}`}
                      className="block hover:bg-gray-50"
                    >
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <p className="text-sm font-medium text-indigo-600 truncate">
                              {doc.title}
                            </p>
                            {doc.fileType && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {doc.fileType.toUpperCase()}
                              </span>
                            )}
                            {doc.fileSize && (
                              <span className="text-xs text-gray-400">
                                {formatFileSize(BigInt(doc.fileSize))}
                              </span>
                            )}
                          </div>
                          <div className="ml-2 flex-shrink-0 flex">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(doc.status)}`}
                            >
                              {getStatusText(doc.status)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="sm:flex">
                            {doc.knowledgeBase && (
                              <p className="flex items-center text-sm text-gray-500">
                                <span className="mr-1">📁</span>
                                {doc.knowledgeBase.name}
                              </p>
                            )}
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                            <p>更新于 {formatDate(new Date(doc.updatedAt))}</p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-white shadow-sm rounded-lg p-8 text-center">
              <span className="text-4xl">📄</span>
              <h3 className="mt-4 text-lg font-medium text-gray-900">暂无文档</h3>
              <p className="mt-2 text-gray-500">上传您的第一个文档开始使用</p>
              <Link
                href="/documents/upload"
                className="inline-flex items-center mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                上传文档
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
