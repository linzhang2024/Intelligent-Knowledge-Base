"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import AdminHeader from "@/components/ui/AdminHeader";

interface Owner {
  id: string;
  name: string | null;
  email: string;
}

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner: Owner | null;
  documentCount: number;
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
  author: Owner | null;
}

interface DocumentChunk {
  id: string;
  index: number;
  content: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PreviewModalState {
  isOpen: boolean;
  document: Document | null;
  chunks: DocumentChunk[];
  isLoading: boolean;
  error: string | null;
}

interface DeleteConfirmModalState {
  isOpen: boolean;
  document: Document | null;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
  FAILED: "解析失败",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  PUBLISHED: "bg-green-100 text-green-800",
  ARCHIVED: "bg-gray-100 text-gray-800",
  FAILED: "bg-red-100 text-red-800",
};

const VISIBILITY_LABELS: Record<string, string> = {
  PRIVATE: "私有",
  PUBLIC: "公开",
};

const formatFileSize = (bytesStr: string | null): string => {
  if (!bytesStr) return "未知";
  const bytes = parseInt(bytesStr, 10);
  if (isNaN(bytes)) return bytesStr;
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

function PreviewModal({
  isOpen,
  document,
  chunks,
  isLoading,
  error,
  onClose,
}: PreviewModalState & {
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"content" | "chunks">("content");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>
        <div className="relative w-full max-w-4xl transform overflow-hidden rounded-lg bg-white p-6 text-left shadow-xl transition-all">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              文档详情
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="inline-flex items-center justify-center">
                <svg
                  className="animate-spin h-10 w-10 text-indigo-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 0 014 12H0c0 3.042 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <p className="mt-4 text-sm text-gray-500">正在加载文档详情...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-sm text-red-600 font-medium">{error}</p>
              <p className="text-xs text-gray-400 mt-2">请稍后重试</p>
            </div>
          ) : document ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">文档标题</p>
                  <p className="text-sm text-gray-900 font-medium">{document.title}</p>
                </div>
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">文件类型</p>
                  <p className="text-sm text-gray-900">{document.fileType || "未知"}</p>
                </div>
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">文件大小</p>
                  <p className="text-sm text-gray-900">{formatFileSize(document.fileSize)}</p>
                </div>
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">状态</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[document.status] || "bg-gray-100 text-gray-800"}`}>
                    {STATUS_LABELS[document.status] || document.status}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">作者</p>
                  <p className="text-sm text-gray-900">{document.author?.name || document.author?.email || "--"}</p>
                </div>
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">切片数量</p>
                  <p className="text-sm text-gray-900">{chunks.length || 0} 个片段</p>
                </div>
              </div>

              <div className="border-b border-gray-200 mb-4">
                <nav className="flex space-x-8">
                  <button
                    onClick={() => setActiveTab("content")}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === "content"
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    文档内容
                  </button>
                  <button
                    onClick={() => setActiveTab("chunks")}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === "chunks"
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    数据切片 ({chunks.length || 0})
                  </button>
                </nav>
              </div>

              {activeTab === "content" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">提取的文本内容</p>
                    {document.content && (
                      <span className="text-xs text-gray-500">
                        共 {document.content.length} 字符
                      </span>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto bg-gray-50 rounded-md p-4">
                    {document.content && document.content.trim() ? (
                      <pre className="text-sm text-gray-900 whitespace-pre-wrap font-sans leading-relaxed">
                        {document.content}
                      </pre>
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-3">📄</div>
                        <p className="text-sm text-gray-600 font-medium">内容解析中或解析失败</p>
                        <p className="text-xs text-gray-400 mt-2">
                          可能原因：PDF 加密、扫描版 PDF、文本提取错误
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "chunks" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-700">
                      数据切片列表
                    </p>
                    <span className="text-xs text-gray-500">
                      共 {chunks.length || 0} 个片段
                    </span>
                  </div>
                  {chunks && chunks.length > 0 ? (
                    <div className="max-h-96 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                              索引
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              切片内容摘要（前 100 字）
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                              字符长度
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {chunks.map((chunk) => (
                            <tr key={chunk.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                                  #{chunk.index + 1}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-sm text-gray-700 line-clamp-2">
                                  {chunk.content.substring(0, 100)}
                                  {chunk.content.length > 100 ? "..." : ""}
                                </p>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
                                {chunk.content.length} 字
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-md">
                      <div className="text-4xl mb-3">📄</div>
                      <p className="text-sm text-gray-600 font-medium">该文档暂无数据切片</p>
                      <p className="text-xs text-gray-400 mt-2">
                        您可以点击"重新解析"按钮重新触发 RAG 处理流程
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  isOpen,
  document,
  onClose,
  onConfirm,
}: DeleteConfirmModalState & {
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>
        <div className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left shadow-xl transition-all">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              确认删除
            </h3>
            <p className="text-sm text-gray-600">
              确定要删除文档 <span className="font-medium text-gray-900">"{document.title}"</span> 吗？
            </p>
            <p className="text-xs text-gray-400 mt-2">
              此操作将删除该文档及其所有关联的分片数据，且不可撤销。
            </p>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
            >
              确认删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KnowledgeBaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const knowledgeBaseId = params.id as string;

  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<PreviewModalState>({
    isOpen: false,
    document: null,
    chunks: [],
    isLoading: false,
    error: null,
  });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<DeleteConfirmModalState>({
    isOpen: false,
    document: null,
  });

  const fetchKnowledgeBase = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/knowledge-bases/${knowledgeBaseId}`);

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (response.status === 403) {
        setError("您没有权限访问此页面，请联系管理员");
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "获取知识库信息失败");
      }

      const data = await response.json();
      setKnowledgeBase(data.knowledgeBase);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取知识库信息失败");
    }
  }, [knowledgeBaseId]);

  const fetchDocuments = useCallback(async (page: number, searchQuery: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        knowledgeBaseId,
      });
      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const response = await fetch(`/api/admin/documents?${params.toString()}`);

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (response.status === 403) {
        setError("您没有权限访问此页面，请联系管理员");
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "获取文档列表失败");
      }

      const data = await response.json();
      setDocuments(data.documents);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取文档列表失败");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [knowledgeBaseId]);

  useEffect(() => {
    fetchKnowledgeBase();
    fetchDocuments(1, "");
  }, [fetchKnowledgeBase, fetchDocuments]);

  const handleSearch = () => {
    setSearch(searchInput);
    fetchDocuments(1, searchInput);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchDocuments(newPage, search);
  };

  const handlePreview = async (document: Document) => {
    setPreviewModal({
      isOpen: true,
      document: null,
      chunks: [],
      isLoading: true,
      error: null,
    });

    try {
      const response = await fetch(`/api/admin/documents/${document.id}`);

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (response.status === 403) {
        setPreviewModal({
          isOpen: true,
          document: null,
          chunks: [],
          isLoading: false,
          error: "您没有权限查看此文档",
        });
        return;
      }

      if (response.status === 404) {
        setPreviewModal({
          isOpen: true,
          document: null,
          chunks: [],
          isLoading: false,
          error: "文档不存在或已被删除",
        });
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "获取文档详情失败");
      }

      const data = await response.json();

      setPreviewModal({
        isOpen: true,
        document: data.document,
        chunks: data.document.chunks || [],
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setPreviewModal({
        isOpen: true,
        document: null,
        chunks: [],
        isLoading: false,
        error: err instanceof Error ? err.message : "获取文档详情失败",
      });
    }
  };

  const handlePreviewClose = () => {
    setPreviewModal({
      isOpen: false,
      document: null,
      chunks: [],
      isLoading: false,
      error: null,
    });
  };

  const handleDeleteClick = (document: Document) => {
    setDeleteConfirmModal({
      isOpen: true,
      document,
    });
  };

  const handleDeleteModalClose = () => {
    setDeleteConfirmModal({
      isOpen: false,
      document: null,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmModal.document) return;

    const documentId = deleteConfirmModal.document.id;
    setActionLoading(documentId);

    try {
      const response = await fetch(`/api/admin/documents/${documentId}`, {
        method: "DELETE",
      });

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "删除失败");
      }

      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      setPagination((prev) => ({
        ...prev,
        total: prev.total - 1,
        totalPages: Math.ceil((prev.total - 1) / prev.limit),
      }));

      if (knowledgeBase) {
        setKnowledgeBase({
          ...knowledgeBase,
          documentCount: knowledgeBase.documentCount - 1,
        });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    } finally {
      setActionLoading(null);
      handleDeleteModalClose();
    }
  };

  const handleReparse = async (document: Document) => {
    if (!confirm(`确定要重新解析文档 "${document.title}" 吗？\n此操作将重新生成文档切片和向量化数据。`)) {
      return;
    }

    setActionLoading(document.id);

    try {
      const response = await fetch(`/api/admin/documents/${document.id}/reparse`, {
        method: "POST",
      });

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "重新解析失败");
      }

      const result = await response.json();
      alert(result.message);
      
      fetchDocuments(pagination.page, search);
    } catch (err) {
      alert(err instanceof Error ? err.message : "重新解析失败");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PreviewModal
        isOpen={previewModal.isOpen}
        document={previewModal.document}
        chunks={previewModal.chunks}
        isLoading={previewModal.isLoading}
        error={previewModal.error}
        onClose={handlePreviewClose}
      />
      <DeleteConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        document={deleteConfirmModal.document}
        onClose={handleDeleteModalClose}
        onConfirm={handleDeleteConfirm}
      />

      <AdminHeader title="知识库详情" showBackButton={true} showNavMenu={true} backHref="/admin/knowledge-bases" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {knowledgeBase && (
          <div className="bg-white shadow sm:rounded-lg mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="text-4xl">📚</div>
                  <div>
                    <h2 className="text-xl font-medium text-gray-900">{knowledgeBase.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {knowledgeBase.description || "暂无描述"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    knowledgeBase.visibility === "PUBLIC" 
                      ? "bg-green-100 text-green-800" 
                      : "bg-yellow-100 text-yellow-800"
                  }`}>
                    {VISIBILITY_LABELS[knowledgeBase.visibility] || knowledgeBase.visibility}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {knowledgeBase.documentCount} 个文档
                  </span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-md p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">所有者</p>
                <p className="text-sm text-gray-900">
                  {knowledgeBase.owner?.name || knowledgeBase.owner?.email || "--"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-md p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">创建时间</p>
                <p className="text-sm text-gray-900">
                  {new Date(knowledgeBase.createdAt).toLocaleDateString("zh-CN")}
                </p>
              </div>
              <div className="bg-gray-50 rounded-md p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">最后更新</p>
                <p className="text-sm text-gray-900">
                  {new Date(knowledgeBase.updatedAt).toLocaleDateString("zh-CN")}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-lg font-medium text-gray-900">文档列表</h2>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="搜索文档标题或内容..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-64 px-4 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    onClick={handleSearch}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    🔍
                  </button>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center">
              <div className="inline-flex items-center justify-center">
                <svg
                  className="animate-spin h-8 w-8 text-indigo-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 0 014 12H0c0 3.042 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <p className="mt-4 text-sm text-gray-500">加载中...</p>
            </div>
          ) : error ? (
            <div className="px-6 py-12 text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="text-sm text-red-600">{error}</p>
              <button
                onClick={() => fetchDocuments(pagination.page, search)}
                className="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                重试
              </button>
            </div>
          ) : documents.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-4xl mb-4">📭</div>
              <p className="text-sm text-gray-500">暂无文档数据</p>
              <p className="text-xs text-gray-400 mt-2">
                您可以通过上传文档来添加到这个知识库
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        文档标题
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        作者
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        创建时间
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-blue-600 font-medium text-lg">
                                📄
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {doc.title}
                              </div>
                              <div className="text-xs text-gray-500">
                                {doc.fileType ? `${doc.fileType} 格式 · ${formatFileSize(doc.fileSize)}` : formatFileSize(doc.fileSize)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {doc.author?.name || doc.author?.email || "--"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[doc.status] || "bg-gray-100 text-gray-800"}`}
                          >
                            {STATUS_LABELS[doc.status] || doc.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(doc.createdAt).toLocaleDateString("zh-CN")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handlePreview(doc)}
                              disabled={actionLoading === doc.id}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              查看
                            </button>
                            <button
                              onClick={() => handleReparse(doc)}
                              disabled={actionLoading === doc.id}
                              className="inline-flex items-center px-3 py-1.5 border border-indigo-300 rounded-md text-sm font-medium text-indigo-700 bg-white hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              重新解析
                            </button>
                            <button
                              onClick={() => handleDeleteClick(doc)}
                              disabled={actionLoading === doc.id}
                              className="inline-flex items-center px-3 py-1.5 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages} 页
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      上一页
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
