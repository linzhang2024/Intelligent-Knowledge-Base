import { OpenAIEmbeddings } from "@langchain/openai";
import { getAIConfig, AI_PROVIDERS, AIProvider, getEmbeddingModelDimensions } from "@/lib/aiConfig";

export interface EmbeddingResult {
  vectors: number[][];
  model: string;
  dimensions: number;
}

function getEmbeddingsInstance(
  provider: AIProvider, 
  apiKey: string, 
  baseUrl: string, 
  model: string,
  dimension?: number
) {
  const actualDimension = dimension ? getEmbeddingModelDimensions(model, dimension) : undefined;
  
  switch (provider) {
    case AI_PROVIDERS.OPENAI:
    case AI_PROVIDERS.DEEPSEEK:
    case AI_PROVIDERS.DASHSCOPE:
      const options: ConstructorParameters<typeof OpenAIEmbeddings>[0] = {
        model,
        apiKey,
        configuration: {
          baseURL: baseUrl,
        },
      };
      
      if (actualDimension) {
        (options as any).dimensions = actualDimension;
      }
      
      return new OpenAIEmbeddings(options);

    default:
      throw new Error(`不支持的 Embedding 提供商: ${provider}`);
  }
}

export async function isEmbeddingConfigured(): Promise<boolean> {
  const config = await getAIConfig();
  return !!config.embedding.apiKey && config.embedding.apiKey.trim().length > 0;
}

async function getEmbeddings() {
  const config = await getAIConfig();

  if (!config.embedding.apiKey) {
    throw new Error("Embedding API Key 未配置，请在系统设置中配置");
  }

  return getEmbeddingsInstance(
    config.embedding.provider,
    config.embedding.apiKey,
    config.embedding.baseUrl,
    config.embedding.model,
    config.embedding.dimension
  );
}

export async function embedDocuments(texts: string[]): Promise<EmbeddingResult> {
  const configured = await isEmbeddingConfigured();
  if (!configured) {
    throw new Error("Embedding 服务未配置，无法进行向量化");
  }

  const config = await getAIConfig();
  const embeddings = await getEmbeddings();
  const model = config.embedding.model;

  console.log(`[Embedding] 开始向量化 ${texts.length} 个文本片段，模型: ${model}, 提供商: ${config.embedding.provider}`);

  const vectors = await embeddings.embedDocuments(texts);

  console.log(`[Embedding] 向量化完成，每个向量维度: ${vectors[0]?.length || 0}`);

  return {
    vectors,
    model,
    dimensions: vectors[0]?.length || 0,
  };
}

export async function embedQuery(text: string): Promise<EmbeddingResult> {
  const configured = await isEmbeddingConfigured();
  if (!configured) {
    throw new Error("Embedding 服务未配置，无法进行向量化");
  }

  const config = await getAIConfig();
  const embeddings = await getEmbeddings();
  const model = config.embedding.model;

  console.log(`[Embedding] 开始向量化查询文本，模型: ${model}, 提供商: ${config.embedding.provider}`);

  const vector = await embeddings.embedQuery(text);

  console.log(`[Embedding] 查询向量化完成，向量维度: ${vector.length}`);

  return {
    vectors: [vector],
    model,
    dimensions: vector.length,
  };
}

export function serializeVector(vector: number[]): string {
  return JSON.stringify(vector);
}

export function deserializeVector(serialized: string): number[] {
  try {
    return JSON.parse(serialized);
  } catch (error) {
    console.error("向量反序列化失败:", error);
    throw new Error("向量数据格式错误");
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`向量维度不匹配: a(${a.length}) vs b(${b.length})`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitudeA = Math.sqrt(normA);
  const magnitudeB = Math.sqrt(normB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

export function sortBySimilarity<T extends { embedding?: string | null }>(
  items: T[],
  queryVector: number[]
): Array<{ item: T; similarity: number }> {
  const results: Array<{ item: T; similarity: number }> = [];

  for (const item of items) {
    if (!item.embedding) {
      continue;
    }

    try {
      const itemVector = deserializeVector(item.embedding);
      const similarity = cosineSimilarity(queryVector, itemVector);
      results.push({ item, similarity });
    } catch (error) {
      console.warn("跳过无效的向量数据:", error);
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity);
}

export { getEmbeddingsInstance };
