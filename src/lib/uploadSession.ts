import { deleteUploadProgress } from "./uploadProgress";

export interface UploadSession {
  uploadId: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: Set<number>;
  createdAt: number;
  userId: string;
  fileExtension: string;
}

const uploadSessions = new Map<string, UploadSession>();

export function getUploadSession(uploadId: string): UploadSession | undefined {
  return uploadSessions.get(uploadId);
}

export function updateUploadSession(
  uploadId: string,
  updates: Partial<{ uploadedChunks: Set<number> }>
): void {
  const session = uploadSessions.get(uploadId);
  if (session && updates.uploadedChunks) {
    session.uploadedChunks = updates.uploadedChunks;
  }
}

export function deleteUploadSession(uploadId: string): void {
  uploadSessions.delete(uploadId);
  deleteUploadProgress(uploadId);
}

export function createUploadSession(session: UploadSession): void {
  uploadSessions.set(session.uploadId, session);
  
  setTimeout(() => {
    deleteUploadSession(session.uploadId);
  }, 24 * 60 * 60 * 1000);
}
