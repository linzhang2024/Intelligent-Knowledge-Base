import { isMilvusEnabled, getMilvusConfig } from "@/lib/milvusConfig";
import { VectorStoreBackend } from "@/lib/vectorStoreAbstract";
import { DatabaseVectorStore } from "@/lib/vectorStoreDatabase";
import { MilvusVectorStore } from "@/lib/vectorStoreMilvus";

let databaseStore: DatabaseVectorStore | null = null;
let milvusStore: MilvusVectorStore | null = null;

export function getDatabaseVectorStore(): DatabaseVectorStore {
  if (!databaseStore) {
    databaseStore = new DatabaseVectorStore();
  }
  return databaseStore;
}

export function getMilvusVectorStore(): MilvusVectorStore {
  if (!milvusStore) {
    milvusStore = new MilvusVectorStore();
  }
  return milvusStore;
}

export async function getVectorStore(): Promise<VectorStoreBackend> {
  const enabled = await isMilvusEnabled();
  
  if (enabled) {
    return getMilvusVectorStore();
  }
  
  return getDatabaseVectorStore();
}

export async function getActiveVectorStoreType(): Promise<"database" | "milvus"> {
  const enabled = await isMilvusEnabled();
  return enabled ? "milvus" : "database";
}

export async function getVectorStoreConfig(): Promise<{
  type: "database" | "milvus";
  milvusConfig?: {
    host: string;
    port: number;
    collection: string;
    dimensions: number;
  };
}> {
  const milvusConfig = await getMilvusConfig();
  
  if (milvusConfig.enabled) {
    return {
      type: "milvus",
      milvusConfig: {
        host: milvusConfig.host,
        port: milvusConfig.port,
        collection: milvusConfig.collection,
        dimensions: milvusConfig.dimensions,
      },
    };
  }
  
  return {
    type: "database",
  };
}
