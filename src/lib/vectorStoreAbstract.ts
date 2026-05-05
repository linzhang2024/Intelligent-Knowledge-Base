import { SearchResult, SearchOptions } from "@/lib/vectorStore";

export interface VectorSearchHit {
  id: string;
  chunkId: string;
  documentId: string;
  knowledgeBaseId: string | null;
  content: string;
  similarity: number;
  index?: number;
}

export interface VectorStoreBackend {
  name: string;
  
  semanticSearch(
    queryVector: number[],
    options: SearchOptions
  ): Promise<SearchResult[]>;

  updateChunkEmbedding(
    chunkId: string,
    vector: number[],
    model: string,
    metadata?: {
      documentId: string;
      knowledgeBaseId: string | null;
      content: string;
      index: number;
    }
  ): Promise<void>;

  checkEmbeddingExists(chunkId: string): Promise<boolean>;

  deleteByDocumentId(documentId: string): Promise<void>;

  deleteByChunkIds(chunkIds: string[]): Promise<void>;

  getStats(userId?: string): Promise<{
    totalChunks: number;
    embeddedChunks: number;
    pendingChunks: number;
  }>;
}
