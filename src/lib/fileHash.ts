import { createHash } from "crypto";

export enum DocumentStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  DONE = "DONE",
  FAILED = "FAILED",
}

export function calculateFileHash(buffer: Buffer): string {
  const hash = createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}

export function calculateFileHashFromString(content: string): string {
  const hash = createHash("sha256");
  hash.update(content.trim());
  return hash.digest("hex");
}

export async function findExistingDocumentByHash(
  prisma: any,
  fileHash: string,
  fileSize: number | bigint
): Promise<{
  id: string;
  status: string;
  title: string;
  fileHash: string | null;
} | null> {
  const existingDoc = await prisma.document.findFirst({
    where: {
      fileHash,
      fileSize: BigInt(fileSize),
    },
    select: {
      id: true,
      status: true,
      title: true,
      fileHash: true,
    },
  });

  return existingDoc;
}

export function shouldSkipDocument(
  existingDoc: { status: string; fileHash: string | null } | null
): boolean {
  if (!existingDoc) {
    return false;
  }

  if (existingDoc.status === DocumentStatus.DONE) {
    return true;
  }

  return false;
}

export function shouldResumeDocument(
  existingDoc: { status: string; fileHash: string | null } | null
): boolean {
  if (!existingDoc) {
    return false;
  }

  if (
    existingDoc.status === DocumentStatus.FAILED ||
    existingDoc.status === DocumentStatus.PENDING ||
    existingDoc.status === DocumentStatus.PROCESSING
  ) {
    return true;
  }

  return false;
}
