import Link from "next/link";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatFileSize, formatDate, formatDateTime } from "@/lib/format";

interface DocumentDetailPageProps {
  params: {
    id: string;
  };
}

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const documentId = params.id;

  const document = await prisma.document.findUnique({
    where: {
      id: documentId,
    },
  });

  if (!document) {
    notFound();
  }

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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Link
              href="/dashboard"
              className="text-gray-500 hover:text-gray-700 mr-4"
            >
              ← 返回
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{document.title}</h1>
              <div className="flex items-center space-x-4 mt-1">
                <span className="text-sm text-gray-500">创建于: {formatDate(document.createdAt)}</span>
                <span className="text-sm text-gray-500">更新于: {formatDate(document.updatedAt)}</span>
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {document.content && (
          <div className="bg-white shadow-sm rounded-lg p-8 mb-8">
            <div className="prose max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                {document.content}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">文档信息</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">文档ID</dt>
                <dd className="text-sm text-gray-900 font-mono">{document.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">创建时间</dt>
                <dd className="text-sm text-gray-900">{formatDateTime(document.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">最后更新</dt>
                <dd className="text-sm text-gray-900">{formatDateTime(document.updatedAt)}</dd>
              </div>
              {document.fileType && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">附件类型</dt>
                  <dd className="text-sm text-gray-900">{document.fileType}</dd>
                </div>
              )}
              {document.fileSize && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">文件大小</dt>
                  <dd className="text-sm text-gray-900">{formatFileSize(document.fileSize)}</dd>
                </div>
              )}
              {document.knowledgeBaseId && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">所属知识库</dt>
                  <dd className="text-sm text-gray-900">{document.knowledgeBaseId}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-white shadow-sm rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">操作记录</h3>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 text-sm">✏️</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-900">内容已更新</p>
                  <p className="text-xs text-gray-500">{formatDateTime(document.updatedAt)}</p>
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
                  <p className="text-xs text-gray-500">{formatDateTime(document.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
