"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BackButton from "@/components/ui/BackButton";
import {
  SplitChunk,
  SplitProgress,
  splitSQLFile,
  needsSplitting,
  getFileSizeMB,
  generateChunkName,
  MAX_CHUNK_SIZE,
} from "@/lib/sqlSplitter";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/sql",
  "text/sql",
  "application/x-sql",
];
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".sql"];
const DEFAULT_MAX_FILE_SIZE_MB = 100;
const CHUNK_SIZE = 5 * 1024 * 1024;

function getMaxFileSizeBytes(maxFileSizeMB: number): number {
  return maxFileSizeMB * 1024 * 1024;
}

type UploadStage =
  | "idle"
  | "initializing"
  | "splitting"
  | "uploading"
  | "encoding"
  | "parsing"
  | "chunking"
  | "storing"
  | "embedding"
  | "sqlImporting"
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

interface ProgressResponse {
  uploadId: string;
  stage: UploadStage;
  progress: number;
  message: string;
  totalItems?: number;
  processedItems?: number;
  error?: string;
  updatedAt: number;
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
  progressMessage?: string;
  totalItems?: number;
  processedItems?: number;
  hasProgressError?: boolean;
  isSQLFile?: boolean;
  needsSplitting?: boolean;
  userChoseSplit?: boolean;
  isSplit?: boolean;
  totalSplitChunks?: number;
  processedSplitChunks?: number;
  splitChunks?: SplitChunk[];
}

const STAGE_LABELS: Record<UploadStage, string> = {
  idle: "等待上传",
  initializing: "初始化...",
  splitting: "正在拆分大文件...",
  uploading: "正在上传...",
  encoding: "正在识别文件编码并转换为 UTF-8",
  parsing: "正在解析文档内容...",
  chunking: "正在创建文本切片...",
  storing: "正在将片段批量写入数据库...",
  embedding: "正在向量化文本片段...",
  sqlImporting: "正在导入SQL表结构...",
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

async function getUploadProgress(uploadId: string): Promise<ProgressResponse | null> {
  try {
    const response = await fetch(`/api/documents/chunk/progress?uploadId=${encodeURIComponent(uploadId)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.warn("获取进度失败:", error);
    return null;
  }
}

function startProgressPolling(
  uploadId: string,
  onProgress: (progress: ProgressResponse) => void,
  onComplete: () => void,
  interval: number = 1000
): () => void {
  let isStopped = false;
  
  const poll = async () => {
    if (isStopped) return;
    
    const progress = await getUploadProgress(uploadId);
    
    if (progress) {
      onProgress(progress);
      
      if (progress.stage === "success" || progress.stage === "error") {
        onComplete();
        return;
      }
    }
    
    if (!isStopped) {
      setTimeout(poll, interval);
    }
  };
  
  poll();
  
  return () => {
    isStopped = true;
  };
}

export default function UploadPage() {
  const [knowledgeBaseId, setKnowledgeBaseId] = useState("");
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loadingKb, setLoadingKb] = useState(true);
  const [maxFileSizeMB, setMaxFileSizeMB] = useState(DEFAULT_MAX_FILE_SIZE_MB);
  const router = useRouter();

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const [kbResponse, storageResponse] = await Promise.all([
          fetch("/api/kb"),
          fetch("/api/storage-config"),
        ]);

        if (kbResponse.ok) {
          const data = await kbResponse.json();
          setKnowledgeBases(data.knowledgeBases || []);
        }

        if (storageResponse.ok) {
          const storageData = await storageResponse.json();
          if (storageData.config && storageData.config.maxFileSizeMB) {
            setMaxFileSizeMB(storageData.config.maxFileSizeMB);
          }
        }
      } catch (err) {
        console.error("获取配置失败:", err);
      } finally {
        setLoadingKb(false);
      }
    };

    fetchConfigs();
  }, []);

  const validateFile = (
    file: File
  ): { valid: boolean; error?: string } => {
    const maxFileSizeBytes = getMaxFileSizeBytes(maxFileSizeMB);
    if (file.size > maxFileSizeBytes) {
      return {
        valid: false,
        error: `文件大小不能超过 ${maxFileSizeMB}MB，当前文件大小为 ${formatFileSize(file.size)}`,
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
          const fileExtension = "." + (file.name.split(".").pop()?.toLowerCase() || "");
          const isSQLFile = fileExtension === ".sql";
          const needsSplit = isSQLFile && file.size > 2 * 1024 * 1024;

          newFiles.push({
            id: generateId(),
            file,
            name: file.name,
            size: file.size,
            status: "idle",
            progress: 0,
            isSQLFile,
            needsSplitting: needsSplit,
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

  const handleSplitFile = async (id: string) => {
    const fileItem = files.find(f => f.id === id);
    if (!fileItem || !fileItem.file) return;

    try {
      updateFile(id, {
        status: "splitting",
        progress: 0,
        progressMessage: "正在分析 SQL 文件并准备拆分...",
      });

      const splitChunks = await splitSQLFile(fileItem.file, 200 * 1024, (progress) => {
        const stageMessages: Record<SplitProgress["stage"], string> = {
          reading: "正在读取 SQL 文件...",
          splitting: `正在拆分 SQL 文件 (已创建 ${progress.chunksCreated} 个片段)...`,
          complete: `拆分完成，共 ${progress.chunksCreated} 个片段`,
        };

        updateFile(id, {
          progress: progress.progress * 0.1,
          progressMessage: stageMessages[progress.stage],
        });
      });

      const totalSplitChunks = splitChunks.length;

      console.log(`[SQL拆分] 拆分为 ${totalSplitChunks} 个片段`);

      updateFile(id, {
        splitChunks,
        totalSplitChunks,
        processedSplitChunks: 0,
        progress: 10,
        progressMessage: `拆分完成，共 ${totalSplitChunks} 个片段，准备上传`,
        status: "idle",
        userChoseSplit: true,
        isSplit: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "拆分失败";
      updateFile(id, {
        status: "error",
        error: errorMessage,
        progressMessage: errorMessage,
      });
    }
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

  const uploadSplitChunk = async (
    originalFileId: string,
    chunk: SplitChunk,
    chunkIndex: number,
    totalChunks: number,
    knowledgeBaseId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      const chunkFile = new File([chunk.blob], chunk.name, { type: "text/plain" });

      updateFile(originalFileId, {
        processedSplitChunks: chunkIndex,
        progressMessage: `正在上传片段 ${chunkIndex + 1}/${totalChunks} (${chunk.name})`,
        progress: 10 + ((chunkIndex / totalChunks) * 80),
      });

      const formData = new FormData();
      formData.append("title", chunk.name.replace(/\.[^/.]+$/, ""));
      formData.append("content", "");
      formData.append("knowledgeBaseId", knowledgeBaseId);
      formData.append("file", chunkFile);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.message || `上传失败 (${response.status})` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "上传失败" };
    }
  };

  const uploadSingleFileChunked = async (fileItem: FileUploadItem) => {
    const { id, file, isSQLFile, needsSplitting: needsSplit, userChoseSplit, isSplit, splitChunks } = fileItem;
    const useChunked = shouldUseChunkedUpload(file);

    try {
      if (isSQLFile && userChoseSplit && isSplit && splitChunks) {
        console.log(
          `[SQL拆分上传] 用户已选择拆分，开始上传 ${splitChunks.length} 个片段`
        );

        const totalSplitChunks = splitChunks.length;

        updateFile(id, {
          status: "uploading",
          progress: 10,
          progressMessage: `开始上传 ${totalSplitChunks} 个片段...`,
        });

        let allSuccess = true;
        const results: any[] = [];

        for (let i = 0; i < totalSplitChunks; i++) {
          const result = await uploadSplitChunk(
            id,
            splitChunks[i],
            i,
            totalSplitChunks,
            knowledgeBaseId
          );

          if (result.success && result.data) {
            results.push(result.data);
          } else {
            allSuccess = false;
            console.error(`[SQL拆分上传] 片段 ${i + 1} 上传失败:`, result.error);
          }
        }

        updateFile(id, {
          progress: 100,
          status: allSuccess ? "success" : "error",
          progressMessage: allSuccess
            ? `所有 ${totalSplitChunks} 个片段上传成功！`
            : `部分片段上传失败`,
          result: {
            success: allSuccess,
            chunkCount: totalSplitChunks,
          },
        });

        return;
      }

      if (isSQLFile && needsSplit && !userChoseSplit) {
        console.log(
          `[SQL上传] 文件较大 (${formatFileSize(file.size)})，使用普通上传`
        );
      }

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
          const uploadProgress = 5 + (uploadedChunks / totalChunks) * 25;

          updateFile(id, {
            uploadedChunks,
            progress: uploadProgress,
          });
        }

        let completeResult: any = null;
        let pollError: Error | null = null;

        const progressPolling = new Promise<void>((resolve) => {
          let pollCount = 0;
          const maxPolls = 600;
          
          const poll = async () => {
            pollCount++;
            
            if (pollCount > maxPolls || completeResult !== null) {
              resolve();
              return;
            }

            try {
              const progress = await getUploadProgress(uploadId);
              
              if (progress) {
                const currentFile = files.find(f => f.id === id);
                if (currentFile && currentFile.status !== "success" && currentFile.status !== "error") {
                  const updates: Partial<FileUploadItem> = {
                    status: progress.stage,
                    progress: Math.min(Math.max(progress.progress, 0), 100),
                    progressMessage: progress.message,
                    hasProgressError: false,
                  };
                  
                  if (progress.totalItems !== undefined) {
                    updates.totalItems = progress.totalItems;
                  }
                  if (progress.processedItems !== undefined) {
                    updates.processedItems = progress.processedItems;
                  }
                  
                  updateFile(id, updates);
                }

                if (progress.stage === "success" || progress.stage === "error") {
                  resolve();
                  return;
                }
              }
            } catch (e) {
              console.warn("进度轮询失败:", e);
              const currentFile = files.find(f => f.id === id);
              if (currentFile && !currentFile.hasProgressError) {
                updateFile(id, {
                  hasProgressError: true,
                  progressMessage: "遇到错误，正在处理中，请稍候...",
                });
              }
            }

            setTimeout(poll, 800);
          };

          setTimeout(poll, 500);
        });

        updateFile(id, { status: "encoding", progress: 30, progressMessage: "正在识别文件编码并转换为 UTF-8" });

        try {
          completeResult = await completeChunkUpload(
            uploadId,
            file.name.replace(/\.[^/.]+$/, ""),
            knowledgeBaseId
          );
        } catch (err) {
          pollError = err instanceof Error ? err : new Error("上传处理失败");
        }

        await progressPolling;

        if (pollError) {
          throw pollError;
        }

        const isParseError =
          completeResult &&
          completeResult.warningType &&
          (completeResult.warningType === "EmptyContentError" ||
            completeResult.warningType === "ScannedPDFError" ||
            completeResult.warningType === "EncryptedPDFError" ||
            completeResult.warningType === "CorruptedFileError");

        if (isParseError && completeResult) {
          const errorMessage =
            completeResult.parseWarning || "文档解析失败";
          updateFile(id, {
            status: "error",
            progress: 100,
            error: errorMessage,
            progressMessage: errorMessage,
            result: {
              success: false,
              error: errorMessage,
            },
          });
        } else if (completeResult) {
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

          updateFile(id, { 
            status: "success", 
            progress: 100, 
            progressMessage: "数据已就绪，上传成功！",
            result 
          });
        }
      } else {
        console.log(
          `[普通上传] 文件较小 (${formatFileSize(file.size)})，使用普通上传`
        );

        updateFile(id, { status: "uploading", progress: 0 });

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
                const uploadPercent = (event.loaded / event.total) * 30;
                updateFile(id, { progress: uploadPercent });
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

        updateFile(id, { status: "encoding", progress: 30, progressMessage: "正在识别文件编码并转换为 UTF-8" });

        const { data } = await uploadPromise;

        updateFile(id, { status: "parsing", progress: 50, progressMessage: "正在解析文档内容..." });

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
      progressMessage: undefined,
      totalItems: undefined,
      processedItems: undefined,
      hasProgressError: undefined,
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
    if (fileItem.hasProgressError && fileItem.progressMessage) {
      return fileItem.progressMessage;
    }

    if (fileItem.isSQLFile && fileItem.needsSplitting) {
      if (fileItem.status === "splitting") {
        if (fileItem.progressMessage) {
          return fileItem.progressMessage;
        }
        return `正在拆分大SQL文件 (${Math.round(fileItem.progress)}%)`;
      }

      if (
        fileItem.status === "uploading" &&
        fileItem.totalSplitChunks !== undefined &&
        fileItem.processedSplitChunks !== undefined
      ) {
        if (fileItem.progressMessage) {
          return fileItem.progressMessage;
        }
        return `正在上传片段 (${fileItem.processedSplitChunks + 1}/${fileItem.totalSplitChunks})`;
      }
    }

    if (fileItem.status === "storing") {
      if (fileItem.processedItems !== undefined && fileItem.totalItems !== undefined && fileItem.totalItems > 0) {
        const percentage = Math.round((fileItem.processedItems / fileItem.totalItems) * 100);
        return `正在存入知识库: ${fileItem.processedItems}/${fileItem.totalItems} 片段 (${percentage}%)`;
      }
      if (fileItem.progressMessage) {
        return fileItem.progressMessage;
      }
      return STAGE_LABELS[fileItem.status];
    }

    if (fileItem.progressMessage && fileItem.status !== "idle" && fileItem.status !== "success" && fileItem.status !== "error") {
      return fileItem.progressMessage;
    }
    
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
                  支持 PDF, DOCX, TXT, SQL 格式，单文件最大 {maxFileSizeMB}MB，可选择多个文件。
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
                            {fileItem.isSQLFile && fileItem.needsSplitting && fileItem.isSplit && (
                              <span className="ml-2 text-indigo-600">
                                (已拆分，共 {fileItem.totalSplitChunks} 个片段)
                              </span>
                            )}
                            {fileItem.isSQLFile && fileItem.needsSplitting && !fileItem.isSplit && (
                              <span className="ml-2 text-amber-600">
                                (文件较大，建议拆分)
                              </span>
                            )}
                            {!fileItem.isSQLFile && fileItem.size > 10 * 1024 * 1024 && (
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
                        {fileItem.isSQLFile && fileItem.needsSplitting && fileItem.status === "idle" && !fileItem.isSplit && !isUploading && (
                          <button
                            type="button"
                            onClick={() => handleSplitFile(fileItem.id)}
                            className="mr-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors"
                          >
                            拆分文件
                          </button>
                        )}
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
                  的文件将自动使用分块上传，支持最大 {maxFileSizeMB}MB
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
