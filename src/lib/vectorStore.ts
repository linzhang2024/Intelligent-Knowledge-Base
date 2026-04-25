import { ChromaClient, Collection, IEmbeddingFunction, EmbeddingFunctionParams } from 'chromadb';
import OpenAI from 'openai';

class DeepSeekEmbeddingFunction implements IEmbeddingFunction {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'deepseek-embedding') {
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.deepseek.com/v1',
    });
    this.model = model;
  }

  async generate(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
      encoding_format: 'float',
    });

    return response.data.map((item) => item.embedding);
  }
}

class VectorStoreService {
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;
  private collectionName: string = 'knowledge_base';

  constructor() {}

  private async initialize(): Promise<void> {
    if (this.client && this.collection) {
      return;
    }

    const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

    if (!deepseekApiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable is not set');
    }

    this.client = new ChromaClient({ path: chromaUrl });

    const embeddingFunction = new DeepSeekEmbeddingFunction(deepseekApiKey);

    this.collection = await this.client.getOrCreateCollection({
      name: this.collectionName,
      embeddingFunction: embeddingFunction,
      metadata: { 'hnsw:space': 'cosine' },
    });
  }

  async addDocuments(
    documents: {
      id: string;
      content: string;
      metadata?: Record<string, any>;
    }[]
  ): Promise<void> {
    await this.initialize();

    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    const ids = documents.map((doc) => doc.id);
    const contents = documents.map((doc) => doc.content);
    const metadatas = documents.map((doc) => doc.metadata || {});

    await this.collection.add({
      ids: ids,
      documents: contents,
      metadatas: metadatas,
    });
  }

  async search(
    query: string,
    topK: number = 3
  ): Promise<{
    id: string;
    content: string;
    metadata: Record<string, any>;
    score: number;
  }[]> {
    await this.initialize();

    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    const results = await this.collection.query({
      queryTexts: [query],
      nResults: topK,
    });

    const ids = results.ids[0] || [];
    const documents = results.documents[0] || [];
    const metadatas = results.metadatas[0] || [];
    const distances = results.distances?.[0] || [];

    return ids.map((id, index) => ({
      id: id,
      content: documents[index] || '',
      metadata: (metadatas[index] as Record<string, any>) || {},
      score: distances[index] !== undefined ? 1 - distances[index] : 0,
    }));
  }

  async clearCollection(): Promise<void> {
    await this.initialize();

    if (!this.client || !this.collection) {
      throw new Error('Client or collection not initialized');
    }

    await this.client.deleteCollection({ name: this.collectionName });
    this.collection = null;
  }

  async count(): Promise<number> {
    await this.initialize();

    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    return await this.collection.count();
  }
}

export const vectorStoreService = new VectorStoreService();
