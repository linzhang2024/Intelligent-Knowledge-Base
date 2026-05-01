"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatFileSize } from "@/lib/format";
import AdminHeader from "@/components/ui/AdminHeader";

interface Stats {
  totalUsers: number;
  totalDocuments: number;
  totalKnowledgeBases: number;
  totalStorageBytes: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  bgColor: string;
  iconBgColor: string;
}

function StatCard({ title, value, icon, bgColor, iconBgColor }: StatCardProps) {
  return (
    <div className={`${bgColor} rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200`}>
      <div className="flex items-center">
        <div className={`${iconBgColor} rounded-lg p-3`}>
          {icon}
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-gray-50 rounded-xl p-6">
      <div className="flex items-center">
        <div className="bg-gray-200 rounded-lg p-3 animate-pulse">
          <div className="w-6 h-6"></div>
        </div>
        <div className="ml-4 flex-1">
          <div className="h-4 bg-gray-200 rounded w-20 mb-2 animate-pulse"></div>
          <div className="h-6 bg-gray-200 rounded w-12 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/admin/stats");

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

  const quickActions = [
    {
      title: "用户管理",
      description: "管理系统用户、分配角色",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      href: "/admin/users",
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      title: "文档管理",
      description: "管理所有文档、审核发布",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      href: "/admin/documents",
      bgColor: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      title: "知识库管理",
      description: "创建和管理知识库",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
      href: "/admin/knowledge-bases",
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600",
    },
    {
      title: "系统设置",
      description: "配置系统参数和选项",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
      href: "/admin/settings",
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600",
    },
  ];

  const statCards = stats
    ? [
        {
          title: "总用户数",
          value: stats.totalUsers,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
          bgColor: "bg-blue-50",
          iconBgColor: "bg-blue-100 text-blue-600",
        },
        {
          title: "总文档数",
          value: stats.totalDocuments,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          ),
          bgColor: "bg-green-50",
          iconBgColor: "bg-green-100 text-green-600",
        },
        {
          title: "知识库数量",
          value: stats.totalKnowledgeBases,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          ),
          bgColor: "bg-purple-50",
          iconBgColor: "bg-purple-100 text-purple-600",
        },
        {
          title: "存储使用",
          value: formatFileSize(stats.totalStorageBytes),
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          ),
          bgColor: "bg-orange-50",
          iconBgColor: "bg-orange-100 text-orange-600",
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader 
        title="管理后台" 
        showBackButton={false}
        showFrontDesk={true}
        showLogout={true}
        frontDeskHref="/dashboard"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-6">系统概览</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-base text-red-600 font-medium">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              重试
            </button>
          </div>
        ) : stats ? (
          <>
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">系统概览</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((card, index) => (
                  <StatCard
                    key={index}
                    title={card.title}
                    value={card.value}
                    icon={card.icon}
                    bgColor={card.bgColor}
                    iconBgColor={card.iconBgColor}
                  />
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-6">快捷操作</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => router.push(action.href)}
                    className={`${action.bgColor} rounded-xl p-6 text-left hover:shadow-md transition-all duration-200 hover:scale-[1.02] group`}
                  >
                    <div className={`${action.iconColor} mb-4`}>
                      {action.icon}
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                      {action.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {action.description}
                    </p>
                    <div className="mt-4 flex items-center text-sm font-medium text-indigo-600 group-hover:translate-x-1 transition-transform">
                      进入管理
                      <svg className="ml-1.5 w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
