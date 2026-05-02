"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { formatFileSize, formatDate, formatDateTime } from "@/lib/format";
import BackButton from "@/components/ui/BackButton";

interface DocumentChunk {
  id: string;
  index: number;
  content: string;
  createdAt: string;
  updatedAt: string;
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
  knowledgeBaseName: string | null;
  createdAt: string;
  updatedAt: string;
  chunks: DocumentChunk[];
}

interface KnowledgeBase {
  id: string;
  name: string;
}

export default function DocumentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const documentId = params.id as string;
  const from = searchParams.get("from");

  const backHref = from === "admin" ? "/admin/documents" : "/dashboard";
  const backLabel = from === "admin" ? "返回管理后台" : "返回";

  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChunkIndex, setActiveChunkIndex] = useState<number | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  
  const chunkRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [docResponse, kbResponse] = await Promise.all([
          fetch(`/api/documents/${documentId}`),
          fetch("/api/kb"),
        ]);

        if (!docResponse.ok) {
          if (docResponse.status === 404) {
            setError("文档不存在");
          } else {
            setError("获取文档详情失败");
          }
          return;
        }

        const docData = await docResponse.json();
        setDocument(docData.document);

        if (kbResponse.ok) {
          const kbData = await kbResponse.json();
          setKnowledgeBases(kbData.knowledgeBases || []);
        }
      } catch (err) {
        console.error("获取数据失败:", err);
        setError("获取数据失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [documentId]);

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

  const scrollToChunk = (index: number) => {
    const element = chunkRefs.current.get(index);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setActiveChunkIndex(index);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 mx-auto text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center">
              <Link
                href={backHref}
                className="text-gray-500 hover:text-gray-700 mr-4"
              >
                ← {backLabel}
              </Link>
              <h1 className="text-xl font-bold text-gray-900">文档详情</h1>
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white shadow-sm rounded-lg p-8 text-center">
            <span className="text-6xl">😢</span>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">
              {error || "文档不存在"}
            </h2>
            <Link
              href={backHref}
              className="inline-flex items-center mt-6 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              返回列表
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const hasChunks = document.chunks && document.chunks.length > 0;
  const kbName = document.knowledgeBaseName || 
    (document.knowledgeBaseId 
      ? knowledgeBases.find(kb => kb.id === document.knowledgeBaseId)?.name 
      : null);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <BackButton href={backHref} label={backLabel} />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{document.title}</h1>
              <div className="flex items-center space-x-4 mt-1">
                <span className="text-sm text-gray-500">创建于: {formatDate(new Date(document.createdAt))}</span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(document.status)}`}
                >
                  {getStatusText(document.status)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {document.fileUrl && (
              <a
                href={document.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                📥 下载附件
              </a>
            )}
            <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
              ✏️ 编辑
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white shadow-sm rounded-lg p-6 sticky top-24">
              <h3 className="text-lg font-medium text-gray-900 mb-4">文档信息</h3>
              
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-gray-500 mb-1">文档ID</dt>
                  <dd className="text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">{document.id}</dd>
                </div>

                {document.fileType && (
                  <div>
                    <dt className="text-sm text-gray-500 mb-1">文件格式</dt>
                    <dd className="text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {document.fileType.toUpperCase()}
                      </span>
                    </dd>
                  </div>
                )}

                {document.fileSize && (
                  <div>
                    <dt className="text-sm text-gray-500 mb-1">文件大小</dt>
                    <dd className="text-sm text-gray-900">{formatFileSize(BigInt(document.fileSize))}</dd>
                  </div>
                )}

                {kbName && (
                  <div>
                    <dt className="text-sm text-gray-500 mb-1">所属知识库</dt>
                    <dd className="text-sm text-gray-900">{kbName}</dd>
                  </div>
                )}

                <div>
                  <dt className="text-sm text-gray-500 mb-1">上传时间</dt>
                  <dd className="text-sm text-gray-900">{formatDateTime(new Date(document.createdAt))}</dd>
                </div>

                <div>
                  <dt className="text-sm text-gray-500 mb-1">最后更新</dt>
                  <dd className="text-sm text-gray-900">{formatDateTime(new Date(document.updatedAt))}</dd>
                </div>

                {hasChunks && (
                  <div>
                    <dt className="text-sm text-gray-500 mb-1">切片数量</dt>
                    <dd className="text-sm text-gray-900">{document.chunks.length} 个片段</dd>
                  </div>
                )}

                {document.content && (
                  <div>
                    <dt className="text-sm text-gray-500 mb-1">总字数</dt>
                    <dd className="text-sm text-gray-900">{document.content.length.toLocaleString()} 字符</dd>
                  </div>
                )}
              </dl>

              {hasChunks && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">切片导航</h4>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {document.chunks.map((chunk) => (
                      <button
                        key={chunk.id}
                        onClick={() => scrollToChunk(chunk.index)}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                          activeChunkIndex === chunk.index
                            ? "bg-indigo-100 text-indigo-900 font-medium"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <span className="text-xs text-gray-400 mr-2">#{chunk.index + 1}</span>
                        <span className="truncate block">
                          {chunk.content.substring(0, 30)}{chunk.content.length > 30 ? "..." : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            {document.content && (
              <div className="bg-white shadow-sm rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">文档内容</h3>
                <div className="prose max-w-none">
                  <div className="whitespace-pre-wrap text-gray-700 leading-relaxed text-sm">
                    {document.content}
                  </div>
                </div>
              </div>
            )}

            {hasChunks && (
              <div className="bg-white shadow-sm rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    切片可视化
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({document.chunks.length} 个片段)
                    </span>
                  </h3>
                  <div className="text-sm text-gray-500">
                    RAG 预处理结果
                  </div>
                </div>

                <div className="space-y-4">
                  {document.chunks.map((chunk, idx) => (
                    <div
                      key={chunk.id}
                      ref={(el) => {
                        chunkRefs.current.set(chunk.index, el);
                      }}
                      className={`border rounded-lg p-4 transition-all ${
                        activeChunkIndex === chunk.index
                          ? "border-indigo-300 bg-indigo-50 shadow-sm"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            片段 #{chunk.index + 1}
                          </span>
                          <span className="text-xs text-gray-500">
                            {chunk.content.length} 字符
                          </span>
                        </div>
                        {activeChunkIndex === chunk.index && (
                          <span className="text-xs text-indigo-600 font-medium">
                            当前选中
                          </span>
                        )}
                      </div>
                      
                      <div className="bg-gray-50 rounded p-3">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                          {chunk.content}
                        </pre>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                        <span>创建于: {formatDateTime(new Date(chunk.createdAt))}</span>
                        <span>更新于: {formatDateTime(new Date(chunk.updatedAt))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!hasChunks && (
              <div className="bg-white shadow-sm rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">切片可视化</h3>
                <div className="text-center py-8">
                  <span className="text-4xl">📄</span>
                  <p className="mt-2 text-gray-500">该文档尚未进行向量化切片</p>
                  <p className="mt-1 text-sm text-gray-400">
                    将文档添加到知识库后，系统会自动进行 RAG 预处理
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
