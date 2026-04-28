import { DashScopeEmbeddings } from "@langchain/community/embeddings/dashscope";

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DEFAULT_EMBEDDING_MODEL = "text-embedding-v2";

export interface EmbeddingResult {
  vectors: number[][];
  model: string;
  dimensions: number;
}

export function isEmbeddingConfigured(): boolean {
  return !!DASHSCOPE_API_KEY && DASHSCOPE_API_KEY.trim().length > 0;
}

function getEmbeddings(): DashScopeEmbeddings {
  if (!DASHSCOPE_API_KEY) {
    throw new Error("DASHSCOPE_API_KEY 未配置，请在环境变量中设置");
  }

  return new DashScopeEmbeddings({
    model: process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
    apiKey: DASHSCOPE_API_KEY,
  });
}

export async function embedDocuments(texts: string[]): Promise<EmbeddingResult> {
  if (!isEmbeddingConfigured()) {
    throw new Error("Embedding 服务未配置，无法进行向量化");
  }

  const model = process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const embeddings = getEmbeddings();

  console.log(`[Embedding] 开始向量化 ${texts.length} 个文本片段，模型: ${model}`);

  const vectors = await embeddings.embedDocuments(texts);

  console.log(`[Embedding] 向量化完成，每个向量维度: ${vectors[0]?.length || 0}`);

  return {
    vectors,
    model,
    dimensions: vectors[0]?.length || 0,
  };
}

export async function embedQuery(text: string): Promise<EmbeddingResult> {
  if (!isEmbeddingConfigured()) {
    throw new Error("Embedding 服务未配置，无法进行向量化");
  }

  const model = process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const embeddings = getEmbeddings();

  console.log(`[Embedding] 开始向量化查询文本，模型: ${model}`);

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
