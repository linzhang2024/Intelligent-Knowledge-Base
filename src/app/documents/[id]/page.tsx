"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

export default function DocumentDetailPage() {
  const params = useParams();
  const documentId = params.id as string;

  const mockDocument = {
    id: documentId,
    title: "API 接口规范 v2.0",
    content: `# API 接口规范 v2.0

## 1. 概述
本文档描述了系统 API 接口的设计规范和使用指南。

## 2. 接口规范

### 2.1 RESTful 风格
所有接口遵循 RESTful 架构风格：
- GET: 获取资源
- POST: 创建资源
- PUT: 更新资源
- DELETE: 删除资源

### 2.2 数据格式
- 请求和响应均使用 JSON 格式
- 日期时间格式: ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)

## 3. 认证方式
所有 API 请求需要在 Header 中携带认证信息：
\`\`\`
Authorization: Bearer <token>
\`\`\`

## 4. 错误处理
服务器返回标准的 HTTP 状态码：
- 200: 成功
- 400: 请求参数错误
- 401: 未认证
- 403: 无权限
- 404: 资源不存在
- 500: 服务器错误`,
    author: "张三",
    createdAt: "2024-01-10",
    updatedAt: "2024-01-15",
    status: "已发布",
    fileUrl: "/files/api-spec.pdf",
    fileType: "PDF",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Link
              href="/dashboard"
              className="text-gray-500 hover:text-gray-700 mr-4"
            >
              ← 返回
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{mockDocument.title}</h1>
              <div className="flex items-center space-x-4 mt-1">
                <span className="text-sm text-gray-500">作者: {mockDocument.author}</span>
                <span className="text-sm text-gray-500">更新于: {mockDocument.updatedAt}</span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${mockDocument.status === "已发布" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                >
                  {mockDocument.status}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {mockDocument.fileUrl && (
              <button className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                📥 下载附件
              </button>
            )}
            <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
              ✏️ 编辑
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-sm rounded-lg p-8">
          <div className="prose max-w-none">
            <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
              {mockDocument.content}
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">文档信息</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">创建时间</dt>
                <dd className="text-sm text-gray-900">{mockDocument.createdAt}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">最后更新</dt>
                <dd className="text-sm text-gray-900">{mockDocument.updatedAt}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">附件类型</dt>
                <dd className="text-sm text-gray-900">{mockDocument.fileType || "无"}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white shadow-sm rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">操作记录</h3>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-900">文档已发布</p>
                  <p className="text-xs text-gray-500">2024-01-15 10:30</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 text-sm">✏️</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-900">内容已更新</p>
                  <p className="text-xs text-gray-500">2024-01-12 14:20</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-600 text-sm">+</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-900">文档已创建</p>
                  <p className="text-xs text-gray-500">2024-01-10 09:15</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
