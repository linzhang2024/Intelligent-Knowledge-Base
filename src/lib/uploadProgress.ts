export type UploadProgressStage = 
  | "idle"
  | "initializing"
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

export interface UploadProgress {
  uploadId: string;
  stage: UploadProgressStage;
  progress: number;
  message: string;
  totalChunks?: number;
  uploadedChunks?: number;
  totalItems?: number;
  processedItems?: number;
  error?: string;
  updatedAt: number;
}

export const PROGRESS_STAGE_CONFIG: Record<UploadProgressStage, { 
  minProgress: number; 
  maxProgress: number; 
  defaultMessage: string;
}> = {
  idle: { 
    minProgress: 0, 
    maxProgress: 0, 
    defaultMessage: "等待上传" 
  },
  initializing: { 
    minProgress: 0, 
    maxProgress: 5, 
    defaultMessage: "初始化上传会话..." 
  },
  uploading: { 
    minProgress: 0, 
    maxProgress: 30, 
    defaultMessage: "文件上传中..." 
  },
  encoding: { 
    minProgress: 30, 
    maxProgress: 50, 
    defaultMessage: "正在识别文件编码并转换为 UTF-8" 
  },
  parsing: { 
    minProgress: 50, 
    maxProgress: 75, 
    defaultMessage: "正在解析文档内容..." 
  },
  chunking: { 
    minProgress: 75, 
    maxProgress: 80, 
    defaultMessage: "正在创建文本切片..." 
  },
  storing: { 
    minProgress: 80, 
    maxProgress: 85, 
    defaultMessage: "正在将片段批量写入数据库..." 
  },
  embedding: { 
    minProgress: 85, 
    maxProgress: 95, 
    defaultMessage: "正在向量化文本片段..." 
  },
  sqlImporting: { 
    minProgress: 80, 
    maxProgress: 95, 
    defaultMessage: "正在导入SQL表结构..." 
  },
  finalizing: { 
    minProgress: 95, 
    maxProgress: 100, 
    defaultMessage: "正在完成处理..." 
  },
  success: { 
    minProgress: 100, 
    maxProgress: 100, 
    defaultMessage: "入库完成" 
  },
  error: { 
    minProgress: 0, 
    maxProgress: 0, 
    defaultMessage: "上传失败" 
  },
};

const uploadProgressMap = new Map<string, UploadProgress>();

export function getUploadProgress(uploadId: string): UploadProgress | undefined {
  return uploadProgressMap.get(uploadId);
}

export function initUploadProgress(uploadId: string): UploadProgress {
  const progress: UploadProgress = {
    uploadId,
    stage: "idle",
    progress: 0,
    message: PROGRESS_STAGE_CONFIG.idle.defaultMessage,
    updatedAt: Date.now(),
  };
  uploadProgressMap.set(uploadId, progress);
  return progress;
}

export function updateUploadProgress(
  uploadId: string,
  updates: Partial<Omit<UploadProgress, "uploadId" | "updatedAt">>
): UploadProgress {
  const current = uploadProgressMap.get(uploadId);
  if (!current) {
    const newProgress: UploadProgress = {
      uploadId,
      stage: updates.stage || "idle",
      progress: updates.progress || 0,
      message: updates.message || PROGRESS_STAGE_CONFIG[updates.stage || "idle"].defaultMessage,
      updatedAt: Date.now(),
      ...updates,
    };
    uploadProgressMap.set(uploadId, newProgress);
    return newProgress;
  }

  const newStage = updates.stage || current.stage;
  const config = PROGRESS_STAGE_CONFIG[newStage];
  
  let newProgress = updates.progress ?? current.progress;
  
  if (updates.processedItems !== undefined && updates.totalItems !== undefined && updates.totalItems > 0) {
    const itemProgress = (updates.processedItems / updates.totalItems) * (config.maxProgress - config.minProgress);
    newProgress = config.minProgress + itemProgress;
  }

  const updated: UploadProgress = {
    ...current,
    stage: newStage,
    progress: Math.min(Math.max(newProgress, 0), 100),
    message: updates.message || current.message,
    totalChunks: updates.totalChunks ?? current.totalChunks,
    uploadedChunks: updates.uploadedChunks ?? current.uploadedChunks,
    totalItems: updates.totalItems ?? current.totalItems,
    processedItems: updates.processedItems ?? current.processedItems,
    error: updates.error ?? current.error,
    updatedAt: Date.now(),
  };

  uploadProgressMap.set(uploadId, updated);
  return updated;
}

export function setUploadProgressStage(
  uploadId: string,
  stage: UploadProgressStage,
  customMessage?: string
): UploadProgress {
  const config = PROGRESS_STAGE_CONFIG[stage];
  return updateUploadProgress(uploadId, {
    stage,
    progress: config.minProgress,
    message: customMessage || config.defaultMessage,
  });
}

export function deleteUploadProgress(uploadId: string): void {
  uploadProgressMap.delete(uploadId);
}

setInterval(() => {
  const now = Date.now();
  const expireMs = 2 * 60 * 60 * 1000;
  
  for (const [uploadId, progress] of uploadProgressMap) {
    if (now - progress.updatedAt > expireMs) {
      uploadProgressMap.delete(uploadId);
    }
  }
}, 30 * 60 * 1000);
