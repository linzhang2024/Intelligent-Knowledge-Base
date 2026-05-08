import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from "fs";
import path from "path";

const PROGRESS_DIR = path.join(process.cwd(), "upload_progress");
const PROGRESS_TTL = 24 * 60 * 60 * 1000;

function ensureProgressDir() {
  if (!existsSync(PROGRESS_DIR)) {
    mkdirSync(PROGRESS_DIR, { recursive: true });
  }
}

function getProgressFilePath(uploadId: string): string {
  return path.join(PROGRESS_DIR, `${uploadId}.json`);
}

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

function serializeProgress(progress: UploadProgress): string {
  return JSON.stringify(progress);
}

function deserializeProgress(data: string): UploadProgress {
  return JSON.parse(data);
}

export function getUploadProgress(uploadId: string): UploadProgress | undefined {
  ensureProgressDir();
  const filePath = getProgressFilePath(uploadId);

  if (!existsSync(filePath)) {
    return undefined;
  }

  try {
    const data = readFileSync(filePath, "utf-8");
    const progress = deserializeProgress(data);

    if (Date.now() - progress.updatedAt > PROGRESS_TTL) {
      rmSync(filePath, { force: true });
      return undefined;
    }

    return progress;
  } catch (error) {
    console.error("Failed to read progress:", error);
    return undefined;
  }
}

export function initUploadProgress(uploadId: string): UploadProgress {
  ensureProgressDir();
  const progress: UploadProgress = {
    uploadId,
    stage: "idle",
    progress: 0,
    message: PROGRESS_STAGE_CONFIG.idle.defaultMessage,
    updatedAt: Date.now(),
  };

  const filePath = getProgressFilePath(uploadId);
  writeFileSync(filePath, serializeProgress(progress), "utf-8");

  return progress;
}

export function updateUploadProgress(
  uploadId: string,
  updates: Partial<Omit<UploadProgress, "uploadId" | "updatedAt">>
): UploadProgress {
  let current = getUploadProgress(uploadId);

  if (!current) {
    const newProgress: UploadProgress = {
      uploadId,
      stage: updates.stage || "idle",
      progress: updates.progress || 0,
      message: updates.message || PROGRESS_STAGE_CONFIG[updates.stage || "idle"].defaultMessage,
      updatedAt: Date.now(),
      ...updates,
    };

    const filePath = getProgressFilePath(uploadId);
    writeFileSync(filePath, serializeProgress(newProgress), "utf-8");
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

  const filePath = getProgressFilePath(uploadId);
  writeFileSync(filePath, serializeProgress(updated), "utf-8");

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
  const filePath = getProgressFilePath(uploadId);
  if (existsSync(filePath)) {
    rmSync(filePath, { force: true });
  }
}

export function cleanupExpiredProgress(): void {
  ensureProgressDir();

  try {
    const files = readdirSync(PROGRESS_DIR);
    const now = Date.now();

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(PROGRESS_DIR, file);
      try {
        const data = readFileSync(filePath, "utf-8");
        const progress = deserializeProgress(data);

        if (now - progress.updatedAt > PROGRESS_TTL) {
          rmSync(filePath, { force: true });
        }
      } catch {
        rmSync(filePath, { force: true });
      }
    }
  } catch (error) {
    console.error("Failed to cleanup progress:", error);
  }
}

cleanupExpiredProgress();
setInterval(cleanupExpiredProgress, 30 * 60 * 1000);
