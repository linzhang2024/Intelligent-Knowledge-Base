import prisma from "@/lib/prisma";

export const DEFAULT_RAG_CONFIG = {
  chunkSize: 500,
  chunkOverlap: 50,
  maxSingleChunkSize: 2000,
};

export const DEFAULT_SQL_RAG_CONFIG = {
  chunkSize: 4000,
  chunkOverlap: 0,
  maxSingleChunkSize: 8000,
};

export const RAG_CONFIG_KEYS = {
  CHUNK_SIZE: "rag.chunkSize",
  CHUNK_OVERLAP: "rag.chunkOverlap",
  MAX_SINGLE_CHUNK_SIZE: "rag.maxSingleChunkSize",
  SQL_CHUNK_SIZE: "rag.sqlChunkSize",
  SQL_CHUNK_OVERLAP: "rag.sqlChunkOverlap",
  SQL_MAX_SINGLE_CHUNK_SIZE: "rag.sqlMaxSingleChunkSize",
} as const;

export type RAGConfigKey = typeof RAG_CONFIG_KEYS[keyof typeof RAG_CONFIG_KEYS];

export interface RAGConfig {
  chunkSize: number;
  chunkOverlap: number;
  maxSingleChunkSize: number;
  sqlChunkSize: number;
  sqlChunkOverlap: number;
  sqlMaxSingleChunkSize: number;
}

export interface PublicRAGConfig {
  chunkSize: number;
  chunkOverlap: number;
  maxSingleChunkSize: number;
  sqlChunkSize: number;
  sqlChunkOverlap: number;
  sqlMaxSingleChunkSize: number;
  defaultConfig: typeof DEFAULT_RAG_CONFIG;
  defaultSQLConfig: typeof DEFAULT_SQL_RAG_CONFIG;
}

function parseNumber(value: string | null, defaultValue: number): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export async function getRAGConfig(): Promise<RAGConfig> {
  const configKeys = Object.values(RAG_CONFIG_KEYS);
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
    chunkSize: parseNumber(configMap[RAG_CONFIG_KEYS.CHUNK_SIZE], DEFAULT_RAG_CONFIG.chunkSize),
    chunkOverlap: parseNumber(configMap[RAG_CONFIG_KEYS.CHUNK_OVERLAP], DEFAULT_RAG_CONFIG.chunkOverlap),
    maxSingleChunkSize: parseNumber(configMap[RAG_CONFIG_KEYS.MAX_SINGLE_CHUNK_SIZE], DEFAULT_RAG_CONFIG.maxSingleChunkSize),
    sqlChunkSize: parseNumber(configMap[RAG_CONFIG_KEYS.SQL_CHUNK_SIZE], DEFAULT_SQL_RAG_CONFIG.chunkSize),
    sqlChunkOverlap: parseNumber(configMap[RAG_CONFIG_KEYS.SQL_CHUNK_OVERLAP], DEFAULT_SQL_RAG_CONFIG.chunkOverlap),
    sqlMaxSingleChunkSize: parseNumber(configMap[RAG_CONFIG_KEYS.SQL_MAX_SINGLE_CHUNK_SIZE], DEFAULT_SQL_RAG_CONFIG.maxSingleChunkSize),
  };
}

export async function getPublicRAGConfig(): Promise<PublicRAGConfig> {
  const config = await getRAGConfig();
  return {
    ...config,
    defaultConfig: DEFAULT_RAG_CONFIG,
    defaultSQLConfig: DEFAULT_SQL_RAG_CONFIG,
  };
}

export async function saveRAGConfig(config: Partial<RAGConfig>): Promise<void> {
  const updates: { configKey: string; configValue: string; description?: string }[] = [];

  if (config.chunkSize !== undefined) {
    updates.push({
      configKey: RAG_CONFIG_KEYS.CHUNK_SIZE,
      configValue: String(config.chunkSize),
      description: "普通文档分块大小（字符数）",
    });
  }
  if (config.chunkOverlap !== undefined) {
    updates.push({
      configKey: RAG_CONFIG_KEYS.CHUNK_OVERLAP,
      configValue: String(config.chunkOverlap),
      description: "普通文档分块重叠大小（字符数）",
    });
  }
  if (config.maxSingleChunkSize !== undefined) {
    updates.push({
      configKey: RAG_CONFIG_KEYS.MAX_SINGLE_CHUNK_SIZE,
      configValue: String(config.maxSingleChunkSize),
      description: "普通文档最大单块大小（字符数）",
    });
  }
  if (config.sqlChunkSize !== undefined) {
    updates.push({
      configKey: RAG_CONFIG_KEYS.SQL_CHUNK_SIZE,
      configValue: String(config.sqlChunkSize),
      description: "SQL文档分块大小（字符数）",
    });
  }
  if (config.sqlChunkOverlap !== undefined) {
    updates.push({
      configKey: RAG_CONFIG_KEYS.SQL_CHUNK_OVERLAP,
      configValue: String(config.sqlChunkOverlap),
      description: "SQL文档分块重叠大小（字符数）",
    });
  }
  if (config.sqlMaxSingleChunkSize !== undefined) {
    updates.push({
      configKey: RAG_CONFIG_KEYS.SQL_MAX_SINGLE_CHUNK_SIZE,
      configValue: String(config.sqlMaxSingleChunkSize),
      description: "SQL文档最大单块大小（字符数）",
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
