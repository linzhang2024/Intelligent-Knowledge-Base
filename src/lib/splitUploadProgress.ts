interface SplitUploadProgress {
  uploadId: string;
  totalFiles: number;
  currentFileIndex: number;
  currentFileName: string;
  stage: 'parsing' | 'importing' | 'chunking' | 'embedding' | 'finalizing' | 'success' | 'error';
  progress: number;
  message: string;
  tablesImported: number;
  columnsImported: number;
  errors: string[];
  updatedAt: number;
}

const progressMap = new Map<string, SplitUploadProgress>();

export function createSplitUploadProgress(
  uploadId: string,
  totalFiles: number
): SplitUploadProgress {
  const progress: SplitUploadProgress = {
    uploadId,
    totalFiles,
    currentFileIndex: 0,
    currentFileName: '',
    stage: 'parsing',
    progress: 0,
    message: '准备开始...',
    tablesImported: 0,
    columnsImported: 0,
    errors: [],
    updatedAt: Date.now(),
  };
  
  progressMap.set(uploadId, progress);
  return progress;
}

export function updateSplitUploadProgress(
  uploadId: string,
  updates: Partial<SplitUploadProgress>
): SplitUploadProgress | undefined {
  const progress = progressMap.get(uploadId);
  if (!progress) return undefined;
  
  Object.assign(progress, updates, { updatedAt: Date.now() });
  return progress;
}

export function getSplitUploadProgress(uploadId: string): SplitUploadProgress | undefined {
  return progressMap.get(uploadId);
}

export function deleteSplitUploadProgress(uploadId: string): boolean {
  return progressMap.delete(uploadId);
}

// 清理超过 1 小时的进度记录
export function cleanupOldProgress(maxAgeMinutes: number = 60): number {
  const now = Date.now();
  const maxAgeMs = maxAgeMinutes * 60 * 1000;
  let deleted = 0;
  
  for (const [uploadId, progress] of progressMap.entries()) {
    if (now - progress.updatedAt > maxAgeMs) {
      progressMap.delete(uploadId);
      deleted++;
    }
  }
  
  return deleted;
}
