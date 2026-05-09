import prisma from "@/lib/prisma";

export const DEFAULT_STORAGE_CONFIG = {
  maxFileSizeMB: 100,
  storageQuotaGB: 100,
  sessionTimeoutMinutes: 30,
  forceMfa: false,
};

export const STORAGE_CONFIG_KEYS = {
  MAX_FILE_SIZE_MB: "storage.maxFileSizeMB",
  STORAGE_QUOTA_GB: "storage.storageQuotaGB",
  SESSION_TIMEOUT_MINUTES: "storage.sessionTimeoutMinutes",
  FORCE_MFA: "storage.forceMfa",
} as const;

export type StorageConfigKey = typeof STORAGE_CONFIG_KEYS[keyof typeof STORAGE_CONFIG_KEYS];

export interface StorageConfig {
  maxFileSizeMB: number;
  storageQuotaGB: number;
  sessionTimeoutMinutes: number;
  forceMfa: boolean;
}

export interface PublicStorageConfig {
  maxFileSizeMB: number;
  storageQuotaGB: number;
  sessionTimeoutMinutes: number;
  forceMfa: boolean;
  defaultConfig: typeof DEFAULT_STORAGE_CONFIG;
}

function parseNumber(value: string | null, defaultValue: number): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseBoolean(value: string | null, defaultValue: boolean): boolean {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  return value === "true";
}

export async function getStorageConfig(): Promise<StorageConfig> {
  const configKeys = Object.values(STORAGE_CONFIG_KEYS);
  const configs = await prisma.systemConfig.findMany({
    where: {
      configKey: {
        in: configKeys,
      },
    },
  });

  const configMap: Record<string, string> = {};
  for (const config of configs) {
    configMap[config.configKey] = config.configValue;
  }

  return {
    maxFileSizeMB: parseNumber(
      configMap[STORAGE_CONFIG_KEYS.MAX_FILE_SIZE_MB],
      DEFAULT_STORAGE_CONFIG.maxFileSizeMB
    ),
    storageQuotaGB: parseNumber(
      configMap[STORAGE_CONFIG_KEYS.STORAGE_QUOTA_GB],
      DEFAULT_STORAGE_CONFIG.storageQuotaGB
    ),
    sessionTimeoutMinutes: parseNumber(
      configMap[STORAGE_CONFIG_KEYS.SESSION_TIMEOUT_MINUTES],
      DEFAULT_STORAGE_CONFIG.sessionTimeoutMinutes
    ),
    forceMfa: parseBoolean(
      configMap[STORAGE_CONFIG_KEYS.FORCE_MFA],
      DEFAULT_STORAGE_CONFIG.forceMfa
    ),
  };
}

export async function getPublicStorageConfig(): Promise<PublicStorageConfig> {
  const config = await getStorageConfig();
  return {
    ...config,
    defaultConfig: DEFAULT_STORAGE_CONFIG,
  };
}

export async function saveStorageConfig(config: Partial<StorageConfig>): Promise<void> {
  const updates: { configKey: string; configValue: string; description?: string }[] = [];

  if (config.maxFileSizeMB !== undefined) {
    updates.push({
      configKey: STORAGE_CONFIG_KEYS.MAX_FILE_SIZE_MB,
      configValue: String(config.maxFileSizeMB),
      description: "单文件大小限制（MB）",
    });
  }
  if (config.storageQuotaGB !== undefined) {
    updates.push({
      configKey: STORAGE_CONFIG_KEYS.STORAGE_QUOTA_GB,
      configValue: String(config.storageQuotaGB),
      description: "总存储配额（GB），0 表示无限制",
    });
  }
  if (config.sessionTimeoutMinutes !== undefined) {
    updates.push({
      configKey: STORAGE_CONFIG_KEYS.SESSION_TIMEOUT_MINUTES,
      configValue: String(config.sessionTimeoutMinutes),
      description: "会话超时时间（分钟）",
    });
  }
  if (config.forceMfa !== undefined) {
    updates.push({
      configKey: STORAGE_CONFIG_KEYS.FORCE_MFA,
      configValue: String(config.forceMfa),
      description: "是否强制双因素认证",
    });
  }

  for (const update of updates) {
    await prisma.systemConfig.upsert({
      where: { configKey: update.configKey },
      update: {
        configValue: update.configValue,
        description: update.description,
      },
      create: {
        configKey: update.configKey,
        configValue: update.configValue,
        description: update.description,
      },
    });
  }
}

export function getMaxFileSizeBytes(maxFileSizeMB: number): number {
  return maxFileSizeMB * 1024 * 1024;
}

export function getStorageQuotaBytes(storageQuotaGB: number): number {
  if (storageQuotaGB === 0) {
    return Number.MAX_SAFE_INTEGER;
  }
  return storageQuotaGB * 1024 * 1024 * 1024;
}
