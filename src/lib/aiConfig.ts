import prisma from "@/lib/prisma";
import { encrypt, decrypt, tryDecrypt } from "@/utils/crypto";

export const AI_PROVIDERS = {
  OPENAI: "OPENAI",
  DEEPSEEK: "DEEPSEEK",
  DASHSCOPE: "DASHSCOPE",
} as const;

export type AIProvider = typeof AI_PROVIDERS[keyof typeof AI_PROVIDERS];

export const EMBEDDING_MODELS: Record<AIProvider, string[]> = {
  [AI_PROVIDERS.OPENAI]: ["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"],
  [AI_PROVIDERS.DEEPSEEK]: ["deepseek-embedding"],
  [AI_PROVIDERS.DASHSCOPE]: ["text-embedding-v4", "text-embedding-v3", "text-embedding-v2", "text-embedding-v1"],
};

export const EMBEDDING_MODEL_DIMENSIONS: Record<string, number> = {
  "text-embedding-v1": 1024,
  "text-embedding-v2": 1536,
  "text-embedding-v3": 1024,
  "text-embedding-v4": 1024,
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
  "deepseek-embedding": 1024,
};

export function getEmbeddingModelDimensions(model: string): number {
  return EMBEDDING_MODEL_DIMENSIONS[model] || 1024;
}

export const LLM_MODELS: Record<AIProvider, string[]> = {
  [AI_PROVIDERS.OPENAI]: ["gpt-3.5-turbo", "gpt-4", "gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  [AI_PROVIDERS.DEEPSEEK]: ["deepseek-chat", "deepseek-reasoner", "deepseek-coder", "deepseek-v4-pro", "deepseek-v4-flash"],
  [AI_PROVIDERS.DASHSCOPE]: ["qwen-turbo", "qwen-plus", "qwen-max", "qwen-7b-chat", "qwen-14b-chat", "qwen2.5-72b-instruct"],
};

export const PROVIDER_BASE_URLS: Record<AIProvider, string> = {
  [AI_PROVIDERS.OPENAI]: "https://api.openai.com/v1",
  [AI_PROVIDERS.DEEPSEEK]: "https://api.deepseek.com",
  [AI_PROVIDERS.DASHSCOPE]: "https://dashscope.aliyuncs.com/compatible-mode/v1",
};

export const CONFIG_KEYS = {
  EMBEDDING_PROVIDER: "embedding.provider",
  EMBEDDING_API_KEY: "embedding.apiKey",
  EMBEDDING_BASE_URL: "embedding.baseUrl",
  EMBEDDING_MODEL: "embedding.model",
  LLM_PROVIDER: "llm.provider",
  LLM_API_KEY: "llm.apiKey",
  LLM_BASE_URL: "llm.baseUrl",
  LLM_MODEL: "llm.model",
  LLM_TEMPERATURE: "llm.temperature",
} as const;

export type ConfigKey = typeof CONFIG_KEYS[keyof typeof CONFIG_KEYS];

const SENSITIVE_KEYS: ConfigKey[] = [CONFIG_KEYS.EMBEDDING_API_KEY, CONFIG_KEYS.LLM_API_KEY];

export interface AIConfig {
  embedding: {
    provider: AIProvider;
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  llm: {
    provider: AIProvider;
    apiKey: string;
    baseUrl: string;
    model: string;
    temperature: number;
  };
}

export interface PublicAIConfig {
  embedding: {
    provider: AIProvider;
    baseUrl: string;
    model: string;
    hasApiKey: boolean;
  };
  llm: {
    provider: AIProvider;
    baseUrl: string;
    model: string;
    temperature: number;
    hasApiKey: boolean;
  };
}

function getEnvConfig(): Partial<AIConfig> {
  const dashscopeApiKey = process.env.DASHSCOPE_API_KEY || "";

  return {
    embedding: {
      provider: AI_PROVIDERS.DASHSCOPE,
      apiKey: dashscopeApiKey,
      baseUrl: PROVIDER_BASE_URLS.DASHSCOPE,
      model: process.env.EMBEDDING_MODEL || "text-embedding-v2",
    },
    llm: {
      provider: AI_PROVIDERS.DASHSCOPE,
      apiKey: dashscopeApiKey,
      baseUrl: PROVIDER_BASE_URLS.DASHSCOPE,
      model: process.env.LLM_MODEL || "qwen-plus",
      temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.7"),
    },
  };
}

async function getConfigFromDB(): Promise<Map<ConfigKey, string>> {
  const configs = await prisma.systemConfig.findMany({
    where: {
      configKey: {
        in: Object.values(CONFIG_KEYS),
      },
    },
  });

  const configMap = new Map<ConfigKey, string>();

  for (const config of configs) {
    let value = config.configValue;

    if (SENSITIVE_KEYS.includes(config.configKey as ConfigKey)) {
      const decrypted = tryDecrypt(value);
      if (decrypted !== null) {
        value = decrypted;
      }
    }

    configMap.set(config.configKey as ConfigKey, value);
  }

  return configMap;
}

export async function getAIConfig(): Promise<AIConfig> {
  const dbConfig = await getConfigFromDB();
  const envConfig = getEnvConfig();

  const embeddingProvider = (dbConfig.get(CONFIG_KEYS.EMBEDDING_PROVIDER) as AIProvider) ||
    envConfig.embedding?.provider || AI_PROVIDERS.DASHSCOPE;

  const llmProvider = (dbConfig.get(CONFIG_KEYS.LLM_PROVIDER) as AIProvider) ||
    envConfig.llm?.provider || AI_PROVIDERS.DASHSCOPE;

  return {
    embedding: {
      provider: embeddingProvider,
      apiKey: dbConfig.get(CONFIG_KEYS.EMBEDDING_API_KEY) || envConfig.embedding?.apiKey || "",
      baseUrl: dbConfig.get(CONFIG_KEYS.EMBEDDING_BASE_URL) ||
        envConfig.embedding?.baseUrl || PROVIDER_BASE_URLS[embeddingProvider],
      model: dbConfig.get(CONFIG_KEYS.EMBEDDING_MODEL) ||
        envConfig.embedding?.model || EMBEDDING_MODELS[embeddingProvider][0],
    },
    llm: {
      provider: llmProvider,
      apiKey: dbConfig.get(CONFIG_KEYS.LLM_API_KEY) || envConfig.llm?.apiKey || "",
      baseUrl: dbConfig.get(CONFIG_KEYS.LLM_BASE_URL) ||
        envConfig.llm?.baseUrl || PROVIDER_BASE_URLS[llmProvider],
      model: dbConfig.get(CONFIG_KEYS.LLM_MODEL) ||
        envConfig.llm?.model || LLM_MODELS[llmProvider][0],
      temperature: parseFloat(dbConfig.get(CONFIG_KEYS.LLM_TEMPERATURE) ||
        String(envConfig.llm?.temperature || "0.7")),
    },
  };
}

export async function getPublicAIConfig(): Promise<PublicAIConfig> {
  const config = await getAIConfig();

  return {
    embedding: {
      provider: config.embedding.provider,
      baseUrl: config.embedding.baseUrl,
      model: config.embedding.model,
      hasApiKey: !!config.embedding.apiKey,
    },
    llm: {
      provider: config.llm.provider,
      baseUrl: config.llm.baseUrl,
      model: config.llm.model,
      temperature: config.llm.temperature,
      hasApiKey: !!config.llm.apiKey,
    },
  };
}

export async function saveAIConfig(config: Partial<AIConfig>): Promise<void> {
  const updates: { configKey: ConfigKey; configValue: string; description?: string }[] = [];

  if (config.embedding) {
    if (config.embedding.provider) {
      updates.push({
        configKey: CONFIG_KEYS.EMBEDDING_PROVIDER,
        configValue: config.embedding.provider,
        description: "Embedding 服务提供商",
      });
    }
    if (config.embedding.apiKey) {
      updates.push({
        configKey: CONFIG_KEYS.EMBEDDING_API_KEY,
        configValue: encrypt(config.embedding.apiKey),
        description: "Embedding API Key (加密存储)",
      });
    }
    if (config.embedding.baseUrl) {
      updates.push({
        configKey: CONFIG_KEYS.EMBEDDING_BASE_URL,
        configValue: config.embedding.baseUrl,
        description: "Embedding API 基础 URL",
      });
    }
    if (config.embedding.model) {
      updates.push({
        configKey: CONFIG_KEYS.EMBEDDING_MODEL,
        configValue: config.embedding.model,
        description: "Embedding 模型名称",
      });
    }
  }

  if (config.llm) {
    if (config.llm.provider) {
      updates.push({
        configKey: CONFIG_KEYS.LLM_PROVIDER,
        configValue: config.llm.provider,
        description: "LLM 服务提供商",
      });
    }
    if (config.llm.apiKey) {
      updates.push({
        configKey: CONFIG_KEYS.LLM_API_KEY,
        configValue: encrypt(config.llm.apiKey),
        description: "LLM API Key (加密存储)",
      });
    }
    if (config.llm.baseUrl) {
      updates.push({
        configKey: CONFIG_KEYS.LLM_BASE_URL,
        configValue: config.llm.baseUrl,
        description: "LLM API 基础 URL",
      });
    }
    if (config.llm.model) {
      updates.push({
        configKey: CONFIG_KEYS.LLM_MODEL,
        configValue: config.llm.model,
        description: "LLM 模型名称",
      });
    }
    if (config.llm.temperature !== undefined) {
      updates.push({
        configKey: CONFIG_KEYS.LLM_TEMPERATURE,
        configValue: String(config.llm.temperature),
        description: "LLM 温度参数",
      });
    }
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

export async function isEmbeddingConfigured(): Promise<boolean> {
  const config = await getAIConfig();
  return !!config.embedding.apiKey && config.embedding.apiKey.trim().length > 0;
}

export async function isLLMConfigured(): Promise<boolean> {
  const config = await getAIConfig();
  return !!config.llm.apiKey && config.llm.apiKey.trim().length > 0;
}
