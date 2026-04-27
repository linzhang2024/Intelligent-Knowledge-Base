"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface DeleteModalState {
  isOpen: boolean;
  userId: string;
  userName: string | null;
  userEmail: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "管理员",
  EDITOR: "编辑者",
  VIEWER: "查看者",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-800",
  EDITOR: "bg-blue-100 text-blue-800",
  VIEWER: "bg-gray-100 text-gray-800",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "活跃",
  INACTIVE: "禁用",
  BANNED: "封禁",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  BANNED: "bg-red-100 text-red-800",
};

function DeleteModal({
  isOpen,
  userId,
  userName,
  userEmail,
  onConfirm,
  onCancel,
  isLoading,
}: DeleteModalState & {
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onCancel}></div>
        <div className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left shadow-xl transition-all">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="mt-4">
              <h3 className="text-lg font-medium text-gray-900">
                确认删除用户
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  您确定要删除以下用户吗？此操作不可恢复。
                </p>
                <div className="mt-3 rounded-md bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-900">
                    {userName || "--"}
                  </p>
                  <p className="text-sm text-gray-500">{userEmail}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex space-x-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                  删除中...
                </>
              ) : (
                "确认删除"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
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
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    userId: "",
    userName: null,
    userEmail: "",
  });

  const fetchUsers = useCallback(async (page: number, searchQuery: string) => {
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

      const response = await fetch(`/api/admin/users?${params.toString()}`);

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
        throw new Error(data.message || "获取用户列表失败");
      }

      const data = await response.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取用户列表失败");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(1, "");
  }, [fetchUsers]);

  const handleSearch = () => {
    setSearch(searchInput);
    fetchUsers(1, searchInput);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchUsers(newPage, search);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionLoading(userId);
    setActiveDropdown(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "更新角色失败");
      }

      const result = await response.json();
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, role: newRole, updatedAt: result.user.updatedAt } : u
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新角色失败");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    setActionLoading(userId);
    setActiveDropdown(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "更新状态失败");
      }

      const result = await response.json();
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, status: newStatus, updatedAt: result.user.updatedAt } : u
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新状态失败");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteClick = (user: User) => {
    setActiveDropdown(null);
    setDeleteModal({
      isOpen: true,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
    });
  };

  const handleDeleteConfirm = async () => {
    const { userId } = deleteModal;
    setActionLoading(userId);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "删除用户失败");
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setPagination((prev) => ({
        ...prev,
        total: prev.total - 1,
        totalPages: Math.ceil((prev.total - 1) / prev.limit),
      }));

      setDeleteModal({
        isOpen: false,
        userId: "",
        userName: null,
        userEmail: "",
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除用户失败");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModal({
      isOpen: false,
      userId: "",
      userName: null,
      userEmail: "",
    });
  };

  const toggleDropdown = (userId: string) => {
    setActiveDropdown(activeDropdown === userId ? null : userId);
  };

  useEffect(() => {
    const handleClickOutside = () => {
      if (activeDropdown) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [activeDropdown]);

  return (
    <div className="min-h-screen bg-gray-50">
      <DeleteModal
        isOpen={deleteModal.isOpen}
        userId={deleteModal.userId}
        userName={deleteModal.userName}
        userEmail={deleteModal.userEmail}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isLoading={actionLoading === deleteModal.userId}
      />

      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900 mr-4">
              ← 返回管理后台
            </Link>
            <h1 className="text-xl font-bold text-gray-900">用户管理</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              前台
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              退出
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-lg font-medium text-gray-900">用户列表</h2>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="搜索姓名或邮箱..."
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
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  搜索
                </button>
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
                onClick={() => fetchUsers(pagination.page, search)}
                className="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                重试
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-4xl mb-4">📭</div>
              <p className="text-sm text-gray-500">暂无用户数据</p>
            </div>
          ) : (
            <>
              <div className="overflow-visible">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        用户
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        邮箱
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        角色
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        注册时间
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-600 font-medium">
                                {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {user.name || "--"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] || "bg-gray-100 text-gray-800"}`}
                          >
                            {ROLE_LABELS[user.role] || user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[user.status] || "bg-gray-100 text-gray-800"}`}
                          >
                            {STATUS_LABELS[user.status] || user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="relative inline-block">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDropdown(user.id);
                              }}
                              disabled={actionLoading === user.id}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {actionLoading === user.id ? (
                                <svg
                                  className="animate-spin h-4 w-4"
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
                              ) : (
                                <>
                                  操作
                                  <svg
                                    className="ml-1 h-4 w-4"
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </>
                              )}
                            </button>

                            {activeDropdown === user.id && (
                              <div
                                className="absolute right-0 z-10 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="py-1">
                                  <div className="px-4 py-2 text-xs text-gray-400">
                                    更改角色
                                  </div>
                                  {["ADMIN", "EDITOR", "VIEWER"].map((role) => (
                                    <button
                                      key={role}
                                      onClick={() => handleRoleChange(user.id, role)}
                                      disabled={user.role === role || actionLoading === user.id}
                                      className={`w-full text-left px-4 py-2 text-sm ${user.role === role || actionLoading === user.id ? "text-gray-400 cursor-not-allowed bg-gray-50" : "text-gray-700 hover:bg-gray-100"}`}
                                    >
                                      {ROLE_LABELS[role]}
                                      {user.role === role && " ✓"}
                                    </button>
                                  ))}

                                  <div className="border-t border-gray-100 my-1"></div>

                                  <div className="px-4 py-2 text-xs text-gray-400">
                                    更改状态
                                  </div>
                                  {["ACTIVE", "INACTIVE", "BANNED"].map((status) => (
                                    <button
                                      key={status}
                                      onClick={() => handleStatusChange(user.id, status)}
                                      disabled={user.status === status || actionLoading === user.id}
                                      className={`w-full text-left px-4 py-2 text-sm ${user.status === status || actionLoading === user.id ? "text-gray-400 cursor-not-allowed bg-gray-50" : "text-gray-700 hover:bg-gray-100"}`}
                                    >
                                      {STATUS_LABELS[status]}
                                      {user.status === status && " ✓"}
                                    </button>
                                  ))}

                                  <div className="border-t border-gray-100 my-1"></div>

                                  <button
                                    onClick={() => handleDeleteClick(user)}
                                    disabled={actionLoading === user.id}
                                    className={`w-full text-left px-4 py-2 text-sm ${actionLoading === user.id ? "text-gray-400 cursor-not-allowed bg-gray-50" : "text-red-600 hover:bg-red-50"}`}
                                  >
                                    删除用户
                                  </button>
                                </div>
                              </div>
                            )}
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
