"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BackButton from "@/components/ui/BackButton";
import NavButtons from "@/components/ui/NavButtons";

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
  PENDING: "待审核",
  ACTIVE: "活跃",
  BANNED: "禁用",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ACTIVE: "bg-green-100 text-green-800",
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

function BatchConfirmModal({
  isOpen,
  action,
  count,
  onConfirm,
  onCancel,
  isLoading,
}: {
  isOpen: boolean;
  action: "approve" | "ban" | "delete";
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  if (!isOpen) return null;

  const actionLabels: Record<string, { title: string; message: string; button: string }> = {
    approve: {
      title: "确认批量审核通过",
      message: `您确定要审核通过选中的 ${count} 个用户吗？`,
      button: "确认通过",
    },
    ban: {
      title: "确认批量禁用",
      message: `您确定要禁用选中的 ${count} 个用户吗？`,
      button: "确认禁用",
    },
    delete: {
      title: "确认批量删除",
      message: `您确定要删除选中的 ${count} 个用户吗？此操作不可恢复。`,
      button: "确认删除",
    },
  };

  const config = actionLabels[action];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onCancel}></div>
        <div className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left shadow-xl transition-all">
          <div className="flex flex-col items-center text-center">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${action === "delete" ? "bg-red-100" : "bg-yellow-100"}`}>
              <svg
                className={`h-6 w-6 ${action === "delete" ? "text-red-600" : "text-yellow-600"}`}
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
                {config.title}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  {config.message}
                </p>
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
              className={`flex-1 inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${action === "delete" ? "bg-red-600 hover:bg-red-700" : action === "ban" ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"}`}
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
                  处理中...
                </>
              ) : (
                config.button
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ActionMenuProps {
  user: User;
  position: { 
    top?: number; 
    bottom?: number; 
    left?: number; 
    right?: number;
  };
  actionLoading: string | null;
  onRoleChange: (userId: string, newRole: string) => void;
  onStatusChange: (userId: string, newStatus: string) => void;
  onDeleteClick: (user: User) => void;
  onClose: () => void;
}

function ActionMenu({
  user,
  position,
  actionLoading,
  onRoleChange,
  onStatusChange,
  onDeleteClick,
  onClose,
}: ActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    ...(position.top !== undefined ? { top: position.top } : {}),
    ...(position.bottom !== undefined ? { bottom: position.bottom } : {}),
    ...(position.left !== undefined ? { left: position.left } : {}),
    ...(position.right !== undefined ? { right: position.right } : {}),
  };

  const isActionLoading = actionLoading === user.id;

  const portalContent = (
    <div 
      ref={menuRef}
      style={style}
      className="w-52 bg-white rounded-lg shadow-2xl ring-1 ring-black ring-opacity-10 focus:outline-none overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="py-1">
        <div className="px-4 py-2 text-xs text-gray-500 font-semibold bg-gray-50 border-b border-gray-100">
          更改角色
        </div>
        {["ADMIN", "EDITOR", "VIEWER"].map((role) => (
          <button
            key={role}
            onClick={() => onRoleChange(user.id, role)}
            disabled={user.role === role || isActionLoading}
            className={`w-full text-left px-4 py-3 text-sm transition-colors duration-150 flex items-center justify-between group ${
              user.role === role || isActionLoading 
                ? "text-gray-400 cursor-not-allowed bg-gray-50" 
                : "text-gray-700 hover:bg-blue-50"
            }`}
          >
            <span className="flex items-center">
              <span className={`w-4 h-4 mr-3 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                user.role === role 
                  ? "border-green-500 bg-green-500" 
                  : "border-gray-300 group-hover:border-blue-400"
              }`}>
                {user.role === role && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className={`${user.role === role ? "font-semibold text-green-700" : ""}`}>
                {ROLE_LABELS[role]}
              </span>
            </span>
            {user.role === role && (
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        ))}

        <div className="border-t border-gray-200 my-0"></div>

        <div className="px-4 py-2 text-xs text-gray-500 font-semibold bg-gray-50 border-b border-gray-100">
          更改状态
        </div>
        {["PENDING", "ACTIVE", "BANNED"].map((status) => (
          <button
            key={status}
            onClick={() => onStatusChange(user.id, status)}
            disabled={user.status === status || isActionLoading}
            className={`w-full text-left px-4 py-3 text-sm transition-colors duration-150 flex items-center justify-between group ${
              user.status === status || isActionLoading 
                ? "text-gray-400 cursor-not-allowed bg-gray-50" 
                : "text-gray-700 hover:bg-blue-50"
            }`}
          >
            <span className="flex items-center">
              <span className={`w-4 h-4 mr-3 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                user.status === status 
                  ? "border-green-500 bg-green-500" 
                  : "border-gray-300 group-hover:border-blue-400"
              }`}>
                {user.status === status && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className={`${user.status === status ? "font-semibold text-green-700" : ""}`}>
                {STATUS_LABELS[status]}
              </span>
            </span>
            {user.status === status && (
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        ))}

        <div className="border-t border-gray-200 my-0"></div>

        <button
          onClick={() => onDeleteClick(user)}
          disabled={isActionLoading}
          className={`w-full text-left px-4 py-3 text-sm transition-colors duration-150 flex items-center group ${
            isActionLoading 
              ? "text-gray-400 cursor-not-allowed bg-gray-50" 
              : "text-red-600 hover:bg-red-50"
          }`}
        >
          <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          删除用户
        </button>
      </div>
    </div>
  );

  if (typeof window !== 'undefined' && document.body) {
    return createPortal(portalContent, document.body);
  }

  return null;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);

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
  const [dropdownPosition, setDropdownPosition] = useState<Record<string, { 
    top?: number; 
    bottom?: number; 
    left?: number; 
    right?: number;
  }>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    userId: "",
    userName: null,
    userEmail: "",
  });
  const [batchModal, setBatchModal] = useState<{
    isOpen: boolean;
    action: "approve" | "ban" | "delete";
  }>({
    isOpen: false,
    action: "approve",
  });

  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const fetchUsers = useCallback(async (page: number, searchQuery: string) => {
    setLoading(true);
    setError(null);
    setSelectedUsers(new Set());
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

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map((u) => u.id)));
    }
  };

  const pendingUsers = users.filter((u) => u.status === "PENDING");
  const selectedPendingIds = Array.from(selectedUsers).filter(
    (id) => users.find((u) => u.id === id)?.status === "PENDING"
  );

  const openBatchModal = (action: "approve" | "ban" | "delete") => {
    if (action === "approve" && selectedPendingIds.length === 0) {
      alert("请选择至少一个待审核的用户");
      return;
    }
    if (action !== "approve" && selectedUsers.size === 0) {
      alert("请选择至少一个用户");
      return;
    }
    setBatchModal({ isOpen: true, action });
  };

  const handleBatchConfirm = async () => {
    const targetIds = batchModal.action === "approve" 
      ? selectedPendingIds 
      : Array.from(selectedUsers);
    
    if (targetIds.length === 0) return;

    setBatchLoading(true);
    setActiveDropdown(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: batchModal.action,
          userIds: targetIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "批量操作失败");
      }

      const result = await response.json();
      
      if (batchModal.action === "delete") {
        setUsers((prev) => prev.filter((u) => !targetIds.includes(u.id)));
        setPagination((prev) => ({
          ...prev,
          total: prev.total - result.count,
          totalPages: Math.ceil((prev.total - result.count) / prev.limit),
        }));
      } else {
        setUsers((prev) =>
          prev.map((u) => {
            if (targetIds.includes(u.id)) {
              return {
                ...u,
                status: batchModal.action === "approve" ? "ACTIVE" : "BANNED",
                updatedAt: new Date().toISOString(),
              };
            }
            return u;
          })
        );
      }

      setSelectedUsers(new Set());
      alert(result.message);
      setBatchModal({ isOpen: false, action: "approve" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "批量操作失败");
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchCancel = () => {
    setBatchModal({ isOpen: false, action: "approve" });
  };

  const toggleDropdown = (userId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (activeDropdown === userId) {
      setActiveDropdown(null);
      setDropdownPosition(prev => {
        const newPos = { ...prev };
        delete newPos[userId];
        return newPos;
      });
    } else {
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const menuWidth = 208;
      const menuHeight = 350;
      const padding = 16;
      
      let top: number | undefined;
      let bottom: number | undefined;
      let left: number | undefined;
      let right: number | undefined;
      
      const spaceBelow = viewportHeight - rect.bottom - padding;
      const spaceAbove = rect.top - padding;
      
      if (spaceBelow >= menuHeight) {
        top = rect.bottom + 4;
      } else if (spaceAbove >= menuHeight) {
        bottom = viewportHeight - rect.top + 4;
      } else {
        if (spaceBelow >= spaceAbove) {
          top = rect.bottom + 4;
        } else {
          bottom = viewportHeight - rect.top + 4;
        }
      }
      
      const spaceToRight = viewportWidth - rect.right - padding;
      const spaceToLeft = rect.left - padding;
      
      if (spaceToRight >= menuWidth) {
        left = rect.left;
      } else if (spaceToLeft >= menuWidth) {
        right = viewportWidth - rect.right;
      } else {
        if (spaceToRight >= spaceToLeft) {
          left = padding;
        } else {
          right = padding;
        }
      }
      
      setActiveDropdown(userId);
      setDropdownPosition(prev => ({ 
        ...prev, 
        [userId]: { top, bottom, left, right } 
      }));
    }
  };

  const handleCloseDropdown = useCallback(() => {
    setActiveDropdown(null);
    setDropdownPosition({});
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [activeDropdown]);

  const activeUser = users.find(u => u.id === activeDropdown);
  const activePosition = activeDropdown ? dropdownPosition[activeDropdown] : null;

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

      <BatchConfirmModal
        isOpen={batchModal.isOpen}
        action={batchModal.action}
        count={batchModal.action === "approve" ? selectedPendingIds.length : selectedUsers.size}
        onConfirm={handleBatchConfirm}
        onCancel={handleBatchCancel}
        isLoading={batchLoading}
      />

      {activeUser && activePosition && (
        <ActionMenu
          user={activeUser}
          position={activePosition}
          actionLoading={actionLoading}
          onRoleChange={handleRoleChange}
          onStatusChange={handleStatusChange}
          onDeleteClick={handleDeleteClick}
          onClose={handleCloseDropdown}
        />
      )}

      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <BackButton href="/admin" label="返回管理后台" />
            <h1 className="text-xl font-bold text-gray-900">用户管理</h1>
          </div>
          <NavButtons />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-medium text-gray-900">用户列表</h2>
                {selectedUsers.size > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    已选择 {selectedUsers.size} 项
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {selectedPendingIds.length > 0 && (
                  <button
                    onClick={() => openBatchModal("approve")}
                    disabled={batchLoading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    批量审核通过 ({selectedPendingIds.length})
                  </button>
                )}
                {selectedUsers.size > 0 && (
                  <>
                    <button
                      onClick={() => openBatchModal("ban")}
                      disabled={batchLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      批量禁用 ({selectedUsers.size})
                    </button>
                    <button
                      onClick={() => openBatchModal("delete")}
                      disabled={batchLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      批量删除 ({selectedUsers.size})
                    </button>
                  </>
                )}
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
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                        <input
                          type="checkbox"
                          checked={selectedUsers.size === users.length && users.length > 0}
                          onChange={toggleAllSelection}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
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
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(user.id)}
                            onChange={() => toggleUserSelection(user.id)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDropdown(user.id, e);
                            }}
                            disabled={actionLoading === user.id}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
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
