"use client";

import { useState } from "react";
import Link from "next/link";

type TabType = "overview" | "users" | "documents" | "knowledge-bases" | "settings";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const mockStats = {
    totalUsers: 156,
    totalDocuments: 1248,
    totalKnowledgeBases: 24,
    storageUsed: "2.4 GB",
  };

  const mockUsers = [
    { id: "1", name: "张三", email: "zhangsan@company.com", role: "ADMIN", status: "active" },
    { id: "2", name: "李四", email: "lisi@company.com", role: "USER", status: "active" },
    { id: "3", name: "王五", email: "wangwu@company.com", role: "USER", status: "inactive" },
    { id: "4", name: "赵六", email: "zhaoliu@company.com", role: "USER", status: "active" },
  ];

  const mockDocuments = [
    { id: "1", title: "API 接口规范 v2.0", author: "张三", status: "PUBLISHED", updatedAt: "2024-01-15" },
    { id: "2", title: "数据库设计文档", author: "李四", status: "DRAFT", updatedAt: "2024-01-14" },
    { id: "3", title: "前端代码规范", author: "王五", status: "PUBLISHED", updatedAt: "2024-01-13" },
    { id: "4", title: "系统架构说明", author: "张三", status: "ARCHIVED", updatedAt: "2024-01-10" },
  ];

  const mockKnowledgeBases = [
    { id: "1", name: "产品文档库", owner: "张三", docCount: 24, createdAt: "2023-10-01" },
    { id: "2", name: "技术文档库", owner: "李四", docCount: 56, createdAt: "2023-09-15" },
    { id: "3", name: "培训材料库", owner: "王五", docCount: 12, createdAt: "2023-11-20" },
  ];

  const tabs = [
    { id: "overview" as TabType, label: "概览" },
    { id: "users" as TabType, label: "用户管理" },
    { id: "documents" as TabType, label: "文档管理" },
    { id: "knowledge-bases" as TabType, label: "知识库管理" },
    { id: "settings" as TabType, label: "系统设置" },
  ];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
      PUBLISHED: "bg-green-100 text-green-800",
      DRAFT: "bg-yellow-100 text-yellow-800",
      ARCHIVED: "bg-gray-100 text-gray-800",
    };
    const labels: Record<string, string> = {
      active: "活跃",
      inactive: "禁用",
      PUBLISHED: "已发布",
      DRAFT: "草稿",
      ARCHIVED: "已归档",
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${role === "ADMIN" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
        {role === "ADMIN" ? "管理员" : "普通用户"}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">管理后台</h1>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← 返回前台
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "overview" && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-6">系统概览</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-blue-50 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="text-3xl">👥</div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">总用户数</p>
                        <p className="text-2xl font-semibold text-gray-900">{mockStats.totalUsers}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="text-3xl">📄</div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">总文档数</p>
                        <p className="text-2xl font-semibold text-gray-900">{mockStats.totalDocuments}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="text-3xl">📚</div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">知识库数量</p>
                        <p className="text-2xl font-semibold text-gray-900">{mockStats.totalKnowledgeBases}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="text-3xl">💾</div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">存储使用</p>
                        <p className="text-2xl font-semibold text-gray-900">{mockStats.storageUsed}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "users" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-medium text-gray-900">用户列表</h2>
                  <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                    + 添加用户
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">邮箱</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {mockUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <span className="text-gray-600 font-medium">{user.name.charAt(0)}</span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getRoleBadge(user.role)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(user.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-indigo-600 hover:text-indigo-900 mr-4">编辑</button>
                            <button className="text-red-600 hover:text-red-900">删除</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "documents" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-medium text-gray-900">文档列表</h2>
                  <div className="flex space-x-3">
                    <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                      <option>全部状态</option>
                      <option>已发布</option>
                      <option>草稿</option>
                      <option>已归档</option>
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">文档标题</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">作者</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">更新时间</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {mockDocuments.map((doc) => (
                        <tr key={doc.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{doc.title}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{doc.author}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(doc.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {doc.updatedAt}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-indigo-600 hover:text-indigo-900 mr-4">查看</button>
                            <button className="text-red-600 hover:text-red-900">删除</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "knowledge-bases" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-medium text-gray-900">知识库列表</h2>
                  <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                    + 创建知识库
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {mockKnowledgeBases.map((kb) => (
                    <div key={kb.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-2xl">📚</div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {kb.docCount} 文档
                        </span>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{kb.name}</h3>
                      <p className="text-sm text-gray-500 mb-4">所有者: {kb.owner}</p>
                      <p className="text-xs text-gray-400">创建于 {kb.createdAt}</p>
                      <div className="mt-4 flex space-x-2">
                        <button className="flex-1 text-sm text-indigo-600 hover:text-indigo-900 py-2 border border-indigo-600 rounded">
                          编辑
                        </button>
                        <button className="flex-1 text-sm text-red-600 hover:text-red-900 py-2 border border-red-600 rounded">
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-6">系统设置</h2>
                <div className="space-y-8">
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">存储设置</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700">单文件大小限制</p>
                          <p className="text-sm text-gray-500">设置允许上传的单个文件最大大小</p>
                        </div>
                        <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                          <option>10 MB</option>
                          <option>50 MB</option>
                          <option>100 MB</option>
                          <option>500 MB</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700">总存储配额</p>
                          <p className="text-sm text-gray-500">设置系统总存储容量上限</p>
                        </div>
                        <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                          <option>10 GB</option>
                          <option>50 GB</option>
                          <option>100 GB</option>
                          <option>无限制</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">安全设置</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700">会话超时</p>
                          <p className="text-sm text-gray-500">用户无操作后自动登出的时间</p>
                        </div>
                        <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                          <option>30 分钟</option>
                          <option>1 小时</option>
                          <option>2 小时</option>
                          <option>4 小时</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700">强制双因素认证</p>
                          <p className="text-sm text-gray-500">要求所有用户启用双因素认证</p>
                        </div>
                        <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-6">
                    <button className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                      取消
                    </button>
                    <button className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                      保存设置
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
