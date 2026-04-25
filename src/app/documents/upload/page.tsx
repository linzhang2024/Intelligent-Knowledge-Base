"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ALLOWED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function UploadPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [knowledgeBaseId, setKnowledgeBaseId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const mockKnowledgeBases = [
    { id: "1", name: "产品文档库" },
    { id: "2", name: "技术文档库" },
    { id: "3", name: "培训材料库" },
  ];

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `文件大小不能超过 10MB，当前文件大小为 ${formatFileSize(file.size)}` };
    }

    // 检查文件类型
    const isMimeTypeAllowed = ALLOWED_TYPES.includes(file.type);
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    const isExtensionAllowed = ALLOWED_EXTENSIONS.includes(fileExtension);

    if (!isMimeTypeAllowed && !isExtensionAllowed) {
      return { valid: false, error: "不支持的文件类型，只支持 PDF、DOCX、TXT 格式" };
    }

    return { valid: true };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const validation = validateFile(file);
      
      if (!validation.valid) {
        setError(validation.error || "文件校验失败");
        setSelectedFile(null);
        return;
      }
      
      setSelectedFile(file);
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title) {
      setError("请输入文档标题");
      return;
    }

    if (!selectedFile) {
      setError("请选择要上传的文件");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("content", content);
      formData.append("knowledgeBaseId", knowledgeBaseId);
      formData.append("file", selectedFile);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "上传失败" }));
        throw new Error(errorData.message || "上传失败");
      }

      const data = await response.json();
      router.push(`/documents/${data.document.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败，请稍后重试");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Link
              href="/dashboard"
              className="text-gray-500 hover:text-gray-700 mr-4"
            >
              ← 返回
            </Link>
            <h1 className="text-xl font-bold text-gray-900">上传文档</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">基本信息</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  文档标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="请输入文档标题"
                />
              </div>

              <div>
                <label htmlFor="knowledgeBase" className="block text-sm font-medium text-gray-700">
                  所属知识库
                </label>
                <select
                  id="knowledgeBase"
                  value={knowledgeBaseId}
                  onChange={(e) => setKnowledgeBaseId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">请选择知识库</option>
                  {mockKnowledgeBases.map((kb) => (
                    <option key={kb.id} value={kb.id}>
                      {kb.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="content" className="block text-sm font-medium text-gray-700">
                  文档内容
                </label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="请输入文档内容..."
                />
              </div>
            </div>
          </div>

          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">附件上传</h2>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                id="file"
                onChange={handleFileChange}
                accept=".pdf,.docx,.txt"
                className="hidden"
              />
              <label
                htmlFor="file"
                className="cursor-pointer"
              >
                <div className="text-5xl text-gray-400 mb-4">📁</div>
                <p className="text-sm text-gray-600">
                  {selectedFile 
                    ? `已选择: ${selectedFile.name} (${formatFileSize(selectedFile.size)})` 
                    : "点击选择文件或拖拽文件到此处"
                  }
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  支持 PDF, DOCX, TXT 格式，最大 10MB
                </p>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <Link
              href="/dashboard"
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              取消
            </Link>
            <button
              type="submit"
              disabled={isUploading || !title || !selectedFile}
              className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isUploading ? "上传中..." : "上传文档"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
