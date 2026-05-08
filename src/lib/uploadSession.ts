import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from "fs";
import path from "path";

const SESSION_DIR = path.join(process.cwd(), "upload_sessions");
const SESSION_TTL = 24 * 60 * 60 * 1000;

function ensureSessionDir() {
  if (!existsSync(SESSION_DIR)) {
    mkdirSync(SESSION_DIR, { recursive: true });
  }
}

function getSessionFilePath(uploadId: string): string {
  return path.join(SESSION_DIR, `${uploadId}.json`);
}

export interface UploadSession {
  uploadId: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  createdAt: number;
  userId: string;
  fileExtension: string;
}

function serializeSession(session: UploadSession): string {
  return JSON.stringify(session);
}

function deserializeSession(data: string): UploadSession {
  const parsed = JSON.parse(data);
  return {
    ...parsed,
    uploadedChunks: parsed.uploadedChunks || [],
  };
}

export function getUploadSession(uploadId: string): UploadSession | undefined {
  ensureSessionDir();
  const filePath = getSessionFilePath(uploadId);

  if (!existsSync(filePath)) {
    return undefined;
  }

  try {
    const data = readFileSync(filePath, "utf-8");
    const session = deserializeSession(data);

    if (Date.now() - session.createdAt > SESSION_TTL) {
      rmSync(filePath, { force: true });
      return undefined;
    }

    return session;
  } catch (error) {
    console.error("Failed to read session:", error);
    return undefined;
  }
}

export function createUploadSession(session: UploadSession): void {
  ensureSessionDir();
  const filePath = getSessionFilePath(session.uploadId);

  const data = serializeSession({
    ...session,
    uploadedChunks: Array.from(session.uploadedChunks || []),
  });

  writeFileSync(filePath, data, "utf-8");
}

export function updateUploadSession(
  uploadId: string,
  updates: Partial<{ uploadedChunks: Set<number> | number[] }>
): void {
  const session = getUploadSession(uploadId);
  if (!session) {
    return;
  }

  if (updates.uploadedChunks !== undefined) {
    const chunks = updates.uploadedChunks instanceof Set
      ? Array.from(updates.uploadedChunks)
      : updates.uploadedChunks;
    session.uploadedChunks = chunks;
  }

  const filePath = getSessionFilePath(uploadId);
  writeFileSync(filePath, serializeSession(session), "utf-8");
}

export function deleteUploadSession(uploadId: string): void {
  const filePath = getSessionFilePath(uploadId);
  if (existsSync(filePath)) {
    rmSync(filePath, { force: true });
  }
}

export function cleanupExpiredSessions(): void {
  ensureSessionDir();

  try {
    const files = readdirSync(SESSION_DIR);
    const now = Date.now();

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(SESSION_DIR, file);
      try {
        const data = readFileSync(filePath, "utf-8");
        const session = deserializeSession(data);

        if (now - session.createdAt > SESSION_TTL) {
          rmSync(filePath, { force: true });
        }
      } catch {
        rmSync(filePath, { force: true });
      }
    }
  } catch (error) {
    console.error("Failed to cleanup sessions:", error);
  }
}

cleanupExpiredSessions();
setInterval(cleanupExpiredSessions, 30 * 60 * 1000);
