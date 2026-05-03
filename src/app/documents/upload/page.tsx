"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BackButton from "@/components/ui/BackButton";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/sql",
  "text/sql",
  "application/x-sql",
];
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".sql"];
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const CHUNK_SIZE = 5 * 1024 * 1024;

type UploadStage =
  | "idle"
  | "initializing"
  | "uploading"
  | "parsing"
  | "chunking"
  | "finalizing"
  | "success"
  | "error";

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
  documentTitle?: string;
  fileType?: string;
  fileSize?: string;
  totalWords?: number;
  chunkCount?: number;
  warning?: string;
  warningType?: string;
  error?: string;
}

interface FileUploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: UploadStage;
  progress: number;
  error?: string;
  result?: UploadResult;
  uploadId?: string;
  totalChunks?: number;
  uploadedChunks?: number;
}

const STAGE_LABELS: Record<UploadStage, string> = {
  idle: "等待上传",
  initializing: "初始化...",
  uploading: "正在上传...",
  parsing: "正在解析...",
  chunking: "正在创建切片...",
  finalizing: "正在处理...",
  success: "上传成功",
  error: "上传失败",
};

function generateId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).substring(2)
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function initializeChunkUpload(
  file: File
): Promise<{ uploadId: string; chunkSize: number; totalChunks: number }> {
  const response = await fetch("/api/documents/chunk/init", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `初始化失败 (${response.status})`);
  }

  return response.json();
}

async function uploadChunk(
  uploadId: string,
  chunkIndex: number,
  chunk: Blob
): Promise<{ uploaded: boolean; progress: number }> {
  const formData = new FormData();
  formData.append("uploadId", uploadId);
  formData.append("chunkIndex", chunkIndex.toString());
  formData.append("chunk", chunk);

  const response = await fetch("/api/documents/chunk/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `上传块 ${chunkIndex} 失败 (${response.status})`
    );
  }

  return response.json();
}

async function completeChunkUpload(
  uploadId: string,
  title: string,
  knowledgeBaseId: string
): Promise<any> {
  const response = await fetch("/api/documents/chunk/complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      uploadId,
      title,
      knowledgeBaseId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `完成上传失败 (${response.status})`
    );
  }

  return response.json();
}

export default function UploadPage() {
  const [knowledgeBaseId, setKnowledgeBaseId] = useState("");
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loadingKb, setLoadingKb] = useState(true);
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

  const validateFile = (
    file: File
  ): { valid: boolean; error?: string } => {
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `文件大小不能超过 100MB，当前文件大小为 ${formatFileSize(file.size)}`,
      };
    }

    const isMimeTypeAllowed = ALLOWED_TYPES.includes(file.type);
    const fileExtension =
      "." + (file.name.split(".").pop()?.toLowerCase() || "");
    const isExtensionAllowed = ALLOWED_EXTENSIONS.includes(fileExtension);

    if (!isMimeTypeAllowed && !isExtensionAllowed) {
      return {
        valid: false,
        error: `不支持的文件格式 "${fileExtension}"，仅支持 PDF、DOCX、TXT、SQL 格式`,
      };
    }

    return { valid: true };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: FileUploadItem[] = [];
    const errors: string[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const validation = validateFile(file);

      if (validation.valid) {
        const isDuplicate = files.some(
          (existing) => existing.name === file.name
        );
        if (!isDuplicate) {
          newFiles.push({
            id: generateId(),
            file,
            name: file.name,
            size: file.size,
            status: "idle",
            progress: 0,
          });
        }
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    }

    if (errors.length > 0) {
      alert(errors.join("\n"));
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
    }

    e.target.value = "";
  };

  const removeFile = (id: string) => {
    if (isUploading) return;
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFile = (id: string, updates: Partial<FileUploadItem>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const shouldUseChunkedUpload = (file: File): boolean => {
    return file.size > 10 * 1024 * 1024;
  };

  const uploadSingleFileChunked = async (fileItem: FileUploadItem) => {
    const { id, file } = fileItem;
    const useChunked = shouldUseChunkedUpload(file);

    try {
      if (useChunked) {
        console.log(
          `[分块上传] 文件较大 (${formatFileSize(file.size)})，使用分块上传`
        );

        updateFile(id, { status: "initializing", progress: 0 });

        const initResult = await initializeChunkUpload(file);
        const { uploadId, totalChunks } = initResult;

        updateFile(id, {
          uploadId,
          totalChunks,
          uploadedChunks: 0,
          status: "uploading",
          progress: 5,
        });

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          await uploadChunk(uploadId, chunkIndex, chunk);

          const uploadedChunks = chunkIndex + 1;
          const uploadProgress = 5 + (uploadedChunks / totalChunks) * 70;

          updateFile(id, {
            uploadedChunks,
            progress: uploadProgress,
          });
        }

        updateFile(id, { status: "finalizing", progress: 75 });

        const completeResult = await completeChunkUpload(
          uploadId,
          file.name.replace(/\.[^/.]+$/, ""),
          knowledgeBaseId
        );

        updateFile(id, { status: "chunking", progress: 90 });

        const isParseError =
          completeResult.warningType &&
          (completeResult.warningType === "EmptyContentError" ||
            completeResult.warningType === "ScannedPDFError" ||
            completeResult.warningType === "EncryptedPDFError" ||
            completeResult.warningType === "CorruptedFileError");

        if (isParseError) {
          const errorMessage =
            completeResult.parseWarning || "文档解析失败";
          updateFile(id, {
            status: "error",
            progress: 100,
            error: errorMessage,
            result: {
              success: false,
              error: errorMessage,
            },
          });
        } else {
          const result: UploadResult = {
            success: true,
            documentId: completeResult.document?.id,
            documentTitle: completeResult.document?.title,
            fileType: completeResult.document?.fileType,
            fileSize: completeResult.document?.fileSize,
            totalWords: completeResult.document?.content?.length || 0,
            chunkCount: completeResult.rag?.chunkCount || 0,
            warning: completeResult.parseWarning,
            warningType: completeResult.warningType,
          };

          updateFile(id, { status: "success", progress: 100, result });
        }
      } else {
        console.log(
          `[普通上传] 文件较小 (${formatFileSize(file.size)})，使用普通上传`
        );

        updateFile(id, { status: "uploading", progress: 10 });

        const formData = new FormData();
        formData.append("title", file.name.replace(/\.[^/.]+$/, ""));
        formData.append("content", "");
        formData.append("knowledgeBaseId", knowledgeBaseId);
        formData.append("file", file);

        const xhr = new XMLHttpRequest();

        const uploadPromise = new Promise<{ response: Response; data: any }>(
          (resolve, reject) => {
            xhr.upload.addEventListener("progress", (event) => {
              if (event.lengthComputable) {
                const uploadPercent = (event.loaded / event.total) * 60;
                updateFile(id, { progress: 10 + uploadPercent });
              }
            });

            xhr.addEventListener("load", async () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const data = JSON.parse(xhr.responseText);
                  resolve({
                    response: new Response(xhr.responseText, {
                      status: xhr.status,
                    }),
                    data,
                  });
                } catch (parseError) {
                  reject(new Error("解析响应失败"));
                }
              } else {
                try {
                  const errorData = JSON.parse(xhr.responseText);
                  reject(
                    new Error(
                      errorData.message || `上传失败 (${xhr.status})`
                    )
                  );
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
          }
        );

        updateFile(id, { status: "parsing", progress: 70 });

        const { data } = await uploadPromise;

        updateFile(id, { status: "chunking", progress: 90 });

        const isParseError =
          data.warningType &&
          (data.warningType === "EmptyContentError" ||
            data.warningType === "ScannedPDFError" ||
            data.warningType === "EncryptedPDFError" ||
            data.warningType === "CorruptedFileError");

        if (isParseError) {
          const errorMessage = data.parseWarning || "文档解析失败";
          updateFile(id, {
            status: "error",
            progress: 100,
            error: errorMessage,
            result: {
              success: false,
              error: errorMessage,
            },
          });
        } else {
          const result: UploadResult = {
            success: true,
            documentId: data.document?.id,
            documentTitle: data.document?.title,
            fileType: data.document?.fileType,
            fileSize: data.document?.fileSize,
            totalWords: data.document?.content?.length || 0,
            chunkCount: data.rag?.chunkCount || 0,
            warning: data.parseWarning,
            warningType: data.warningType,
          };

          updateFile(id, { status: "success", progress: 100, result });
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "上传失败，请稍后重试";
      updateFile(id, {
        status: "error",
        error: errorMessage,
        result: {
          success: false,
          error: errorMessage,
        },
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (files.length === 0) {
      alert("请选择要上传的文件");
      return;
    }

    const pendingFiles = files.filter((f) => f.status === "idle");
    if (pendingFiles.length === 0) {
      alert("所有文件已处理完毕");
      return;
    }

    setIsUploading(true);

    for (const fileItem of pendingFiles) {
      await uploadSingleFileChunked(fileItem);
    }

    setIsUploading(false);
  };

  const handleRetry = (id: string) => {
    updateFile(id, {
      status: "idle",
      progress: 0,
      error: undefined,
      result: undefined,
      uploadId: undefined,
      totalChunks: undefined,
      uploadedChunks: undefined,
    });
  };

  const handleClearAll = () => {
    if (isUploading) return;
    setFiles([]);
  };

  const getProgressBarColor = (status: UploadStage) => {
    switch (status) {
      case "error":
        return "bg-red-500";
      case "success":
        return "bg-green-500";
      default:
        return "bg-indigo-500";
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return "📕";
      case "docx":
        return "📘";
      case "txt":
        return "📄";
      case "sql":
        return "🗄️";
      default:
        return "📁";
    }
  };

  const successCount = files.filter((f) => f.status === "success").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const pendingCount = files.filter((f) => f.status === "idle").length;
  const processingCount =
    files.length - successCount - errorCount - pendingCount;
  const allDone = files.length > 0 && successCount + errorCount === files.length;

  const getProgressLabel = (fileItem: FileUploadItem): string => {
    if (
      fileItem.status === "uploading" &&
      fileItem.totalChunks !== undefined &&
      fileItem.uploadedChunks !== undefined
    ) {
      return `${STAGE_LABELS[fileItem.status]} (${fileItem.uploadedChunks}/${fileItem.totalChunks} 块)`;
    }
    return STAGE_LABELS[fileItem.status];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <BackButton href="/dashboard" label="返回" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">上传文档</h1>
              {files.length > 0 && (
                <p className="text-sm text-gray-500">
                  已选择 {files.length} 个文件
                  {successCount > 0 && (
                    <span className="text-green-600">
                      {" "}
                      · {successCount} 成功
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="text-red-600">
                      {" "}
                      · {errorCount} 失败
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              上传设置
            </h2>

            <div>
              <label
                htmlFor="knowledgeBase"
                className="block text-sm font-medium text-gray-700"
              >
                所属知识库
              </label>
              {loadingKb ? (
                <div className="mt-1 flex items-center px-3 py-2 text-sm text-gray-500">
                  <svg
                    className="animate-spin h-4 w-4 mr-2"
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
                  加载中...
                </div>
              ) : (
                <select
                  id="knowledgeBase"
                  value={knowledgeBaseId}
                  onChange={(e) => setKnowledgeBaseId(e.target.value)}
                  disabled={isUploading}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                  💡 选择知识库后，文档将自动进行向量化切片，用于后续的知识库问答
                </p>
              )}
            </div>
          </div>

          <div className="bg-white shadow-sm rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">选择文件</h2>
              {files.length > 0 && !isUploading && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  清空全部
                </button>
              )}
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                files.length > 0
                  ? "border-gray-200"
                  : "border-gray-300 hover:border-indigo-400"
              }`}
            >
              <input
                type="file"
                id="file"
                multiple
                onChange={handleFileChange}
                accept=".pdf,.docx,.txt,.sql"
                className="hidden"
                disabled={isUploading}
              />
              <label
                htmlFor="file"
                className={`cursor-pointer block ${
                  isUploading ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <div className="text-5xl text-gray-400 mb-4">📁</div>
                <p className="text-sm font-medium text-gray-600">
                  点击选择文件或拖拽文件到此处
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  支持 PDF, DOCX, TXT, SQL 格式，单文件最大 100MB，可选择多个文件。
                  超过 10MB 的文件将自动使用分块上传。
                </p>
              </label>
            </div>

            {files.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-medium text-gray-700">上传列表</h3>
                {files.map((fileItem) => (
                  <div
                    key={fileItem.id}
                    className={`border rounded-lg p-4 transition-all ${
                      fileItem.status === "success"
                        ? "border-green-200 bg-green-50"
                        : fileItem.status === "error"
                        ? "border-red-200 bg-red-50"
                        : fileItem.status !== "idle"
                        ? "border-indigo-200 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center flex-1 min-w-0">
                        <div className="text-2xl mr-3 flex-shrink-0">
                          {getFileIcon(fileItem.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {fileItem.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(fileItem.size)}
                            {fileItem.size > 10 * 1024 * 1024 && (
                              <span className="ml-2 text-indigo-600">
                                (分块上传)
                              </span>
                            )}
                          </p>
                          {fileItem.error && (
                            <p className="text-xs text-red-600 mt-1">
                              {fileItem.error}
                            </p>
                          )}
                          {fileItem.result?.success &&
                            fileItem.result.chunkCount !== undefined && (
                              <p className="text-xs text-green-600 mt-1">
                                切分为 {fileItem.result.chunkCount} 个片段
                              </p>
                            )}
                        </div>
                      </div>
                      <div className="flex items-center ml-4 flex-shrink-0">
                        <span
                          className={`text-xs font-medium mr-3 ${
                            fileItem.status === "success"
                              ? "text-green-600"
                              : fileItem.status === "error"
                              ? "text-red-600"
                              : fileItem.status !== "idle"
                              ? "text-indigo-600"
                              : "text-gray-500"
                          }`}
                        >
                          {getProgressLabel(fileItem)}
                          {fileItem.status !== "idle" &&
                            fileItem.status !== "success" &&
                            fileItem.status !== "error" && (
                              <span className="ml-1">
                                ({Math.round(fileItem.progress)}%)
                              </span>
                            )}
                        </span>
                        {fileItem.status === "idle" && !isUploading && (
                          <button
                            type="button"
                            onClick={() => removeFile(fileItem.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <line
                                x1="18"
                                y1="6"
                                x2="6"
                                y2="18"
                              ></line>
                              <line
                                x1="6"
                                y1="6"
                                x2="18"
                                y2="18"
                              ></line>
                            </svg>
                          </button>
                        )}
                        {fileItem.status === "error" && !isUploading && (
                          <button
                            type="button"
                            onClick={() => handleRetry(fileItem.id)}
                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                          >
                            重试
                          </button>
                        )}
                        {fileItem.status === "success" && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-green-500"
                          >
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </div>
                    </div>
                    {fileItem.status !== "idle" &&
                      fileItem.status !== "success" &&
                      fileItem.status !== "error" && (
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(
                                fileItem.status
                              )}`}
                              style={{ width: `${fileItem.progress}%` }}
                            ></div>
                          </div>
                          {fileItem.totalChunks !== undefined &&
                            fileItem.uploadedChunks !== undefined && (
                              <p className="text-xs text-gray-500 mt-1">
                                已上传 {fileItem.uploadedChunks}/
                                {fileItem.totalChunks} 块
                              </p>
                            )}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">
                📋 支持的文件格式说明
              </h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>
                  • <strong>PDF</strong>: 可编辑的 PDF 文档（扫描版 PDF
                  可能无法提取文本）
                </li>
                <li>
                  • <strong>DOCX</strong>: Microsoft Word 2007+ 文档
                </li>
                <li>
                  • <strong>TXT</strong>: 纯文本文件（推荐使用 UTF-8 编码）
                </li>
                <li>
                  • <strong>SQL</strong>: SQL 建表脚本文件（用于导入表结构到知识库）
                </li>
                <li>
                  • <strong>大文件支持</strong>: 超过 10MB
                  的文件将自动使用分块上传，支持最大 100MB
                </li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <Link
              href="/dashboard"
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-disabled={isUploading}
              tabIndex={isUploading ? -1 : 0}
              onClick={(e) => {
                if (isUploading) {
                  e.preventDefault();
                }
              }}
            >
              取消
            </Link>
            <button
              type="submit"
              disabled={isUploading || files.length === 0 || pendingCount === 0}
              className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline"
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
                  上传中... ({successCount + errorCount}/{files.length})
                </>
              ) : allDone ? (
                "全部处理完成"
              ) : (
                `上传 ${pendingCount} 个文件`
              )}
            </button>
          </div>
        </form>

        {allDone && (
          <div
            className={`mt-8 rounded-lg p-6 ${
              errorCount > 0
                ? "bg-amber-50 border border-amber-200"
                : "bg-green-50 border border-green-200"
            }`}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span
                  className={`text-3xl ${
                    errorCount > 0 ? "text-amber-500" : "text-green-500"
                  }`}
                >
                  {errorCount > 0 ? "⚠" : "✓"}
                </span>
              </div>
              <div className="ml-4 flex-1">
                <h3
                  className={`text-lg font-medium ${
                    errorCount > 0 ? "text-amber-800" : "text-green-800"
                  }`}
                >
                  {errorCount > 0 ? "上传完成（部分失败）" : "上传完成！"}
                </h3>
                <p
                  className={`text-sm mt-1 ${
                    errorCount > 0 ? "text-amber-600" : "text-green-600"
                  }`}
                >
                  {successCount > 0 && (
                    <span>成功上传 {successCount} 个文档</span>
                  )}
                  {errorCount > 0 && (
                    <span className={successCount > 0 ? "ml-2" : ""}>
                      <span className="text-red-600">
                        {errorCount} 个文档上传失败
                      </span>
                    </span>
                  )}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {successCount > 0 && errorCount === 0 && (
                    <Link
                      href="/chat"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-sm"
                    >
                      <span className="mr-2">🚀</span>
                      立即测试问答
                    </Link>
                  )}
                  {errorCount > 0 && (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-400 cursor-not-allowed shadow-sm"
                    >
                      <span className="mr-2">🚀</span>
                      立即测试问答（存在失败文件）
                    </button>
                  )}
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    返回列表
                  </Link>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    继续上传
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
