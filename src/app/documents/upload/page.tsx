"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ALLOWED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type UploadStage = "idle" | "uploading" | "parsing" | "chunking" | "success" | "error";

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  documentCount: number;
  createdAt: string;
}

interface UploadResult {
  success: boolean;
  documentId?: string;
  warning?: string;
  warningType?: string;
  error?: string;
}

const STAGE_LABELS: Record<UploadStage, string> = {
  idle: "准备上传",
  uploading: "正在上传文件...",
  parsing: "正在解析文档内容...",
  chunking: "正在创建向量切片...",
  success: "上传成功！",
  error: "上传失败",
};

export default function UploadPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [knowledgeBaseId, setKnowledgeBaseId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loadingKb, setLoadingKb] = useState(true);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchKnowledgeBases = async () => {
      try {
        const response = await fetch("/api/kb");
        if (response.ok) {
          const data = await response.json();
          setKnowledgeBases(data.knowledgeBases || []);
        }
      } catch (err) {
        console.error("获取知识库列表失败:", err);
      } finally {
        setLoadingKb(false);
      }
    };

    fetchKnowledgeBases();
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `文件大小不能超过 10MB，当前文件大小为 ${formatFileSize(file.size)}` };
    }

    const isMimeTypeAllowed = ALLOWED_TYPES.includes(file.type);
    const fileExtension = "." + (file.name.split(".").pop()?.toLowerCase() || "");
    const isExtensionAllowed = ALLOWED_EXTENSIONS.includes(fileExtension);

    if (!isMimeTypeAllowed && !isExtensionAllowed) {
      return { valid: false, error: `不支持的文件格式 "${fileExtension}"，仅支持 PDF、DOCX、TXT 格式` };
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
      setWarning("");
    }
  };

  const simulateProgress = useCallback((targetStage: UploadStage, startProgress: number, endProgress: number, duration: number) => {
    return new Promise<void>((resolve) => {
      setUploadStage(targetStage);
      const steps = 20;
      const stepDuration = duration / steps;
      const progressIncrement = (endProgress - startProgress) / steps;
      let currentProgress = startProgress;

      const interval = setInterval(() => {
        currentProgress += progressIncrement;
        setUploadProgress(Math.min(currentProgress, endProgress));
        
        if (currentProgress >= endProgress) {
          clearInterval(interval);
          resolve();
        }
      }, stepDuration);
    });
  }, []);

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

    setError("");
    setWarning("");
    setUploadResult(null);
    setUploadProgress(0);

    try {
      await simulateProgress("uploading", 0, 30, 500);

      const formData = new FormData();
      formData.append("title", title);
      formData.append("content", content);
      formData.append("knowledgeBaseId", knowledgeBaseId);
      formData.append("file", selectedFile);

      const xhr = new XMLHttpRequest();
      
      const uploadPromise = new Promise<{ response: Response; data: any }>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const uploadPercent = (event.loaded / event.total) * 30;
            setUploadProgress(uploadPercent);
          }
        });

        xhr.addEventListener("load", async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve({
                response: new Response(xhr.responseText, { status: xhr.status }),
                data,
              });
            } catch (parseError) {
              reject(new Error("解析响应失败"));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.message || `上传失败 (${xhr.status})`));
            } catch {
              reject(new Error(`上传失败 (${xhr.status})`));
            }
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("网络错误，请检查网络连接"));
        });

        xhr.open("POST", "/api/documents/upload");
        xhr.send(formData);
      });

      await simulateProgress("parsing", 30, 70, 800);
      
      const { data } = await uploadPromise;

      await simulateProgress("chunking", 70, 95, 400);

      if (data.parseWarning) {
        setWarning(data.parseWarning);
        setUploadResult({
          success: true,
          documentId: data.document.id,
          warning: data.parseWarning,
          warningType: data.warningType,
        });
      } else {
        setUploadResult({
          success: true,
          documentId: data.document.id,
        });
      }

      await simulateProgress("success", 95, 100, 200);

      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);

    } catch (err) {
      setUploadStage("error");
      const errorMessage = err instanceof Error ? err.message : "上传失败，请稍后重试";
      setError(errorMessage);
      setUploadResult({
        success: false,
        error: errorMessage,
      });
    }
  };

  const handleRetry = () => {
    setUploadStage("idle");
    setUploadProgress(0);
    setError("");
    setWarning("");
    setUploadResult(null);
  };

  const getProgressBarColor = () => {
    switch (uploadStage) {
      case "error":
        return "bg-red-500";
      case "success":
        return "bg-green-500";
      default:
        return "bg-indigo-500";
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
        {error && uploadStage !== "idle" && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-red-500 text-xl">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">上传失败</h3>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {warning && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-yellow-500 text-xl">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">解析警告</h3>
                <p className="text-sm text-yellow-600 mt-1">{warning}</p>
              </div>
            </div>
          </div>
        )}

        {uploadResult?.success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-green-500 text-xl">✓</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">上传成功！</h3>
                <p className="text-sm text-green-600 mt-1">
                  文档已成功上传，2秒后将自动跳转回列表页...
                </p>
              </div>
            </div>
          </div>
        )}

        {uploadStage !== "idle" && (
          <div className="mb-6 bg-white shadow-sm rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">
                {STAGE_LABELS[uploadStage]}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round(uploadProgress)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <div className="mt-4 flex space-x-2">
              {["uploading", "parsing", "chunking", "success"].map((stage, index) => (
                <div key={stage} className="flex-1">
                  <div className={`h-1 rounded ${
                    uploadStage === stage || 
                    ["success", "chunking", "parsing", "uploading"].indexOf(uploadStage) > index
                      ? "bg-indigo-500"
                      : "bg-gray-200"
                  }`}></div>
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    {stage === "uploading" && "上传"}
                    {stage === "parsing" && "解析"}
                    {stage === "chunking" && "切片"}
                    {stage === "success" && "完成"}
                  </p>
                </div>
              ))}
            </div>
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
                  disabled={uploadStage !== "idle" && uploadStage !== "error"}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="请输入文档标题"
                />
              </div>

              <div>
                <label htmlFor="knowledgeBase" className="block text-sm font-medium text-gray-700">
                  所属知识库
                </label>
                {loadingKb ? (
                  <div className="mt-1 flex items-center px-3 py-2 text-sm text-gray-500">
                    <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    加载中...
                  </div>
                ) : (
                  <select
                    id="knowledgeBase"
                    value={knowledgeBaseId}
                    onChange={(e) => setKnowledgeBaseId(e.target.value)}
                    disabled={uploadStage !== "idle" && uploadStage !== "error"}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">请选择知识库（可选）</option>
                    {knowledgeBases.map((kb) => (
                      <option key={kb.id} value={kb.id}>
                        {kb.name}
                      </option>
                    ))}
                  </select>
                )}
                {knowledgeBaseId && (
                  <p className="mt-1 text-xs text-indigo-600">
                    💡 选择知识库后，文档将自动进行向量化切片，用于后续的智能问答
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="content" className="block text-sm font-medium text-gray-700">
                  文档内容（可选，将与解析结果合并）
                </label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                  disabled={uploadStage !== "idle" && uploadStage !== "error"}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="可手动输入补充内容，或仅上传附件让系统自动解析..."
                />
              </div>
            </div>
          </div>

          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">附件上传</h2>
            
            <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
              selectedFile 
                ? "border-indigo-300 bg-indigo-50" 
                : "border-gray-300 hover:border-indigo-400"
            }`}>
              <input
                type="file"
                id="file"
                onChange={handleFileChange}
                accept=".pdf,.docx,.txt"
                className="hidden"
                disabled={uploadStage !== "idle" && uploadStage !== "error"}
              />
              <label
                htmlFor="file"
                className={`cursor-pointer ${
                  uploadStage !== "idle" && uploadStage !== "error" ? "pointer-events-none" : ""
                }`}
              >
                <div className="text-5xl text-gray-400 mb-4">
                  {selectedFile ? "📄" : "📁"}
                </div>
                <p className="text-sm text-gray-600">
                  {selectedFile 
                    ? `已选择: ${selectedFile.name}` 
                    : "点击选择文件或拖拽文件到此处"
                  }
                </p>
                {selectedFile && (
                  <p className="text-sm text-indigo-600 mt-1">
                    {formatFileSize(selectedFile.size)}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  支持 PDF, DOCX, TXT 格式，最大 10MB
                </p>
              </label>
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">📋 支持的文件格式说明</h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• <strong>PDF</strong>: 可编辑的 PDF 文档（扫描版 PDF 可能无法提取文本）</li>
                <li>• <strong>DOCX</strong>: Microsoft Word 2007+ 文档</li>
                <li>• <strong>TXT</strong>: 纯文本文件（推荐使用 UTF-8 编码）</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            {uploadStage === "error" ? (
              <>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  返回列表
                </Link>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  重新上传
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-disabled={uploadStage !== "idle"}
                  tabIndex={uploadStage !== "idle" ? -1 : 0}
                  onClick={(e) => {
                    if (uploadStage !== "idle") {
                      e.preventDefault();
                    }
                  }}
                >
                  取消
                </Link>
                <button
                  type="submit"
                  disabled={uploadStage !== "idle" || !title || !selectedFile}
                  className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadStage !== "idle" ? "处理中..." : "上传文档"}
                </button>
              </>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
