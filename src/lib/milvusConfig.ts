import prisma from "@/lib/prisma";

export const MILVUS_CONFIG_KEYS = {
  ENABLED: "milvus.enabled",
  HOST: "milvus.host",
  PORT: "milvus.port",
  USERNAME: "milvus.username",
  PASSWORD: "milvus.password",
  COLLECTION: "milvus.collection",
  DIMENSIONS: "milvus.dimensions",
} as const;

export type MilvusConfigKey = typeof MILVUS_CONFIG_KEYS[keyof typeof MILVUS_CONFIG_KEYS];

export interface MilvusConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  collection: string;
  dimensions: number;
}

export const DEFAULT_MILVUS_CONFIG: MilvusConfig = {
  enabled: false,
  host: "localhost",
  port: 19530,
  username: "",
  password: "",
  collection: "document_chunks",
  dimensions: 1024,
};

function parseBoolean(value: string | null, defaultValue: boolean): boolean {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === "true" || value === "1";
}

function parseNumber(value: string | null, defaultValue: number): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseString(value: string | null, defaultValue: string): string {
  return value ?? defaultValue;
}

export async function getMilvusConfig(): Promise<MilvusConfig> {
  const configKeys = Object.values(MILVUS_CONFIG_KEYS);
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
    enabled: parseBoolean(configMap[MILVUS_CONFIG_KEYS.ENABLED], DEFAULT_MILVUS_CONFIG.enabled),
    host: parseString(configMap[MILVUS_CONFIG_KEYS.HOST], DEFAULT_MILVUS_CONFIG.host),
    port: parseNumber(configMap[MILVUS_CONFIG_KEYS.PORT], DEFAULT_MILVUS_CONFIG.port),
    username: parseString(configMap[MILVUS_CONFIG_KEYS.USERNAME], DEFAULT_MILVUS_CONFIG.username),
    password: parseString(configMap[MILVUS_CONFIG_KEYS.PASSWORD], DEFAULT_MILVUS_CONFIG.password),
    collection: parseString(configMap[MILVUS_CONFIG_KEYS.COLLECTION], DEFAULT_MILVUS_CONFIG.collection),
    dimensions: parseNumber(configMap[MILVUS_CONFIG_KEYS.DIMENSIONS], DEFAULT_MILVUS_CONFIG.dimensions),
  };
}

export async function saveMilvusConfig(config: Partial<MilvusConfig>): Promise<void> {
  const updates: { configKey: string; configValue: string; description?: string }[] = [];

  if (config.enabled !== undefined) {
    updates.push({
      configKey: MILVUS_CONFIG_KEYS.ENABLED,
      configValue: String(config.enabled),
      description: "是否启用 Milvus 向量数据库",
    });
  }
  if (config.host !== undefined) {
    updates.push({
      configKey: MILVUS_CONFIG_KEYS.HOST,
      configValue: config.host,
      description: "Milvus 服务器地址",
    });
  }
  if (config.port !== undefined) {
    updates.push({
      configKey: MILVUS_CONFIG_KEYS.PORT,
      configValue: String(config.port),
      description: "Milvus 服务器端口",
    });
  }
  if (config.username !== undefined) {
    updates.push({
      configKey: MILVUS_CONFIG_KEYS.USERNAME,
      configValue: config.username,
      description: "Milvus 用户名",
    });
  }
  if (config.password !== undefined) {
    updates.push({
      configKey: MILVUS_CONFIG_KEYS.PASSWORD,
      configValue: config.password,
      description: "Milvus 密码",
    });
  }
  if (config.collection !== undefined) {
    updates.push({
      configKey: MILVUS_CONFIG_KEYS.COLLECTION,
      configValue: config.collection,
      description: "Milvus 集合名称",
    });
  }
  if (config.dimensions !== undefined) {
    updates.push({
      configKey: MILVUS_CONFIG_KEYS.DIMENSIONS,
      configValue: String(config.dimensions),
      description: "向量维度数",
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

export async function isMilvusEnabled(): Promise<boolean> {
  const config = await getMilvusConfig();
  return config.enabled;
}
