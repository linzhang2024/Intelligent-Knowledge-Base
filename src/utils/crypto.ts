import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || generateDefaultKey();
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function generateDefaultKey(): string {
  const key = crypto
    .createHash("sha256")
    .update("intelligent-knowledge-base-default-secret-key-2024")
    .digest("hex");
  return key;
}

function getEncryptionKey(): Buffer {
  const key = crypto
    .createHash("sha256")
    .update(ENCRYPTION_KEY)
    .digest();
  return key;
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);

  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, encrypted]);

  return combined.toString("base64");
}

export function decrypt(encryptedData: string): string {
  const combined = Buffer.from(encryptedData, "base64");

  const iv = combined.slice(0, IV_LENGTH);
  const authTag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH);

  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString("utf8");
}

export function tryDecrypt(encryptedData: string): string | null {
  try {
    return decrypt(encryptedData);
  } catch (error) {
    console.error("解密失败:", error);
    return null;
  }
}

export function isEncrypted(data: string): boolean {
  try {
    const combined = Buffer.from(data, "base64");
    return combined.length > IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}
