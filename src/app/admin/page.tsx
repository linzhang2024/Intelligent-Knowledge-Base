"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatFileSize } from "@/lib/format";
import AdminHeader from "@/components/ui/AdminHeader";

interface Stats {
  totalUsers: number;
  totalDocuments: number;
  totalKnowledgeBases: number;
  totalStorageBytes: number;
}

interface QuickAccessItem {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: string;
  color: string;
}

const quickAccessItems: QuickAccessItem[] = [
  {
    id: "users",
    title: "用户管理",
    description: "管理系统用户、审核注册、设置角色",
    href: "/admin/users",
    icon: "👥",
    color: "bg-blue-50 border-blue-200",
  },
  {
    id: "documents",
    title: "文档管理",
    description: "查看和管理所有文档、预览内容、修改状态",
    href: "/admin/documents",
    icon: "📄",
    color: "bg-green-50 border-green-200",
  },
  {
    id: "knowledge-bases",
    title: "知识库管理",
    description: "管理知识库、创建和删除知识库",
    href: "/admin/knowledge-bases",
    icon: "📚",
    color: "bg-purple-50 border-purple-200",
  },
  {
    id: "settings",
    title: "系统设置",
    description: "配置 AI 参数、系统设置",
    href: "/admin/settings",
    icon: "⚙️",
    color: "bg-orange-50 border-orange-200",
  },
];

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  description?: string;
}

function StatCard({ title, value, icon, color, description }: StatCardProps) {
  return (
    <div className={`rounded-lg border ${color} p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {description && (
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          )}
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/admin/stats");

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (response.status === 403) {
          setError("您没有权限访问管理后台，请联系管理员");
          setLoading(false);
          return;
        }

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || "获取统计数据失败");
        }

        const data = await response.json();
        setStats(data.stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "获取统计数据失败");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const retryFetch = () => {
    setLoading(true);
    setError(null);
    setStats(null);
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/admin/stats");
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || "获取统计数据失败");
        }
        const data = await response.json();
        setStats(data.stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "获取统计数据失败");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="管理后台概览" showBackButton={false} showNavMenu={true} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
                    <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-32"></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-32"></div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-24 bg-gray-200 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white shadow sm:rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={retryFetch}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              重新加载
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">系统概览</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="用户总数"
                  value={stats?.totalUsers || 0}
                  icon="👥"
                  color="bg-blue-50 border-blue-200"
                  description="活跃用户数量"
                />
                <StatCard
                  title="文档总数"
                  value={stats?.totalDocuments || 0}
                  icon="📄"
                  color="bg-green-50 border-green-200"
                  description="已上传文档数量"
                />
                <StatCard
                  title="知识库总数"
                  value={stats?.totalKnowledgeBases || 0}
                  icon="📚"
                  color="bg-purple-50 border-purple-200"
                  description="已创建知识库数量"
                />
                <StatCard
                  title="存储使用"
                  value={formatFileSize(stats?.totalStorageBytes || 0)}
                  icon="💾"
                  color="bg-orange-50 border-orange-200"
                  description="文档总存储空间"
                />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">快捷访问</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {quickAccessItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="group"
                  >
                    <div className={`rounded-lg border ${item.color} p-6 hover:shadow-md transition-all duration-200 cursor-pointer`}>
                      <div className="flex items-start justify-between">
                        <div className="text-3xl">{item.icon}</div>
                        <svg
                          className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                      <h3 className="mt-4 text-lg font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">快速操作</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Link
                    href="/admin/users"
                    className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <span className="mr-2">👥</span>
                    管理用户
                  </Link>
                  <Link
                    href="/admin/documents"
                    className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <span className="mr-2">📄</span>
                    浏览文档
                  </Link>
                  <Link
                    href="/admin/knowledge-bases"
                    className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <span className="mr-2">📚</span>
                    管理知识库
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
