"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner: Owner | null;
  documentCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface DeleteModalState {
  isOpen: boolean;
  knowledgeBase: KnowledgeBase | null;
}

interface CreateModalState {
  isOpen: boolean;
}

export default function KnowledgeBasesPage() {
  const router = useRouter();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
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
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    knowledgeBase: null,
  });
  const [createModal, setCreateModal] = useState<CreateModalState>({
    isOpen: false,
  });
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
  });
  const [createLoading, setCreateLoading] = useState(false);

  const fetchKnowledgeBases = useCallback(async (page: number, searchQuery: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });
      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const response = await fetch(`/api/admin/knowledge-bases?${params.toString()}`);

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
        throw new Error(data.message || "获取知识库列表失败");
      }

      const data = await response.json();
      setKnowledgeBases(data.knowledgeBases);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取知识库列表失败");
      setKnowledgeBases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKnowledgeBases(1, "");
  }, [fetchKnowledgeBases]);

  const handleSearch = () => {
    setSearch(searchInput);
    fetchKnowledgeBases(1, searchInput);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchKnowledgeBases(newPage, search);
  };

  const handleDeleteClick = (kb: KnowledgeBase) => {
    setDeleteModal({
      isOpen: true,
      knowledgeBase: kb,
    });
  };

  const handleDeleteModalClose = () => {
    setDeleteModal({
      isOpen: false,
      knowledgeBase: null,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.knowledgeBase) return;

    const kbId = deleteModal.knowledgeBase.id;
    setActionLoading(kbId);

    try {
      const response = await fetch(`/api/admin/knowledge-bases/${kbId}`, {
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

      setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== kbId));
      setPagination((prev) => ({
        ...prev,
        total: prev.total - 1,
        totalPages: Math.ceil((prev.total - 1) / prev.limit),
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    } finally {
      setActionLoading(null);
      handleDeleteModalClose();
    }
  };

  const handleCreateClick = () => {
    setCreateForm({ name: "", description: "" });
    setCreateModal({ isOpen: true });
  };

  const handleCreateModalClose = () => {
    setCreateModal({ isOpen: false });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createForm.name.trim()) {
      alert("知识库名称不能为空");
      return;
    }

    setCreateLoading(true);
    try {
      const response = await fetch("/api/admin/knowledge-bases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          description: createForm.description.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "创建失败");
      }

      handleCreateModalClose();
      fetchKnowledgeBases(pagination.page, search);
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {deleteModal.knowledgeBase && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={handleDeleteModalClose}></div>
            <div className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left shadow-xl transition-all">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  确认删除
                </h3>
                <p className="text-sm text-gray-600">
                  确定要删除知识库 <span className="font-medium text-gray-900">"{deleteModal.knowledgeBase.name}"</span> 吗？
                </p>
                {deleteModal.knowledgeBase.documentCount > 0 && (
                  <p className="text-xs text-orange-600 mt-2">
                    该知识库下还有 {deleteModal.knowledgeBase.documentCount} 个文档，无法删除
                  </p>
                )}
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={handleDeleteModalClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={actionLoading === deleteModal.knowledgeBase.id || deleteModal.knowledgeBase.documentCount > 0}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {createModal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={handleCreateModalClose}></div>
            <div className="relative w-full max-w-lg transform overflow-hidden rounded-lg bg-white p-6 text-left shadow-xl transition-all">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  创建新知识库
                </h3>
                <form onSubmit={handleCreateSubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      知识库名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      placeholder="请输入知识库名称"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      描述
                    </label>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      placeholder="请输入知识库描述（可选）"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={handleCreateModalClose}
                      disabled={createLoading}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={createLoading || !createForm.name.trim()}
                      className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createLoading ? "创建中..." : "创建"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      <AdminHeader title="知识库管理" backHref="/admin" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-lg font-medium text-gray-900">知识库列表</h2>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleCreateClick}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  + 创建知识库
                </button>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="搜索知识库名称或描述..."
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
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
                onClick={() => fetchKnowledgeBases(pagination.page, search)}
                className="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                重试
              </button>
            </div>
          ) : knowledgeBases.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-4xl mb-4">📭</div>
              <p className="text-sm text-gray-500">暂无知识库数据</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                {knowledgeBases.map((kb) => (
                  <div key={kb.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-2xl">📚</div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {kb.documentCount} 文档
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{kb.name}</h3>
                    <p className="text-sm text-gray-500 mb-2">
                      所有者: {kb.owner?.name || kb.owner?.email || "--"}
                    </p>
                    {kb.description && (
                      <p className="text-xs text-gray-400 mb-4 line-clamp-2">{kb.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mb-4">
                      创建于 {new Date(kb.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                    <div className="mt-4 flex space-x-2">
                      <button
                        onClick={() => {}}
                        className="flex-1 text-sm text-indigo-600 hover:text-indigo-900 py-2 border border-indigo-600 rounded"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteClick(kb)}
                        disabled={actionLoading === kb.id || kb.documentCount > 0}
                        className="flex-1 text-sm text-red-600 hover:text-red-900 py-2 border border-red-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
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
