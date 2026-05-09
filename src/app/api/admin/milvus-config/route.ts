import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getMilvusConfig,
  saveMilvusConfig,
  MilvusConfig,
  DEFAULT_MILVUS_CONFIG,
} from "@/lib/milvusConfig";
import {
  testMilvusConnection,
  ensureMilvusCollection,
  getMilvusStats,
} from "@/lib/milvusClient";
import {
  getAIConfig,
  getEmbeddingModelDimensions,
  EMBEDDING_MODEL_DIMENSIONS,
} from "@/lib/aiConfig";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const [config, stats, aiConfig] = await Promise.all([
      getMilvusConfig(),
      getMilvusStats(),
      getAIConfig(),
    ]);

    const recommendedDimensions = getEmbeddingModelDimensions(
      aiConfig.embedding.model, 
      aiConfig.embedding.dimension
    );
    const dimensionsMatch = config.dimensions === recommendedDimensions;

    return NextResponse.json(
      {
        config,
        stats,
        defaultConfig: DEFAULT_MILVUS_CONFIG,
        embeddingConfig: {
          provider: aiConfig.embedding.provider,
          model: aiConfig.embedding.model,
          recommendedDimensions,
        },
        dimensionsMatch,
        allModelDimensions: EMBEDDING_MODEL_DIMENSIONS,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { message: "未登录，请先登录" },
          { status: 401 }
        );
      }
      if (error.message === "无权限访问此资源") {
        return NextResponse.json(
          { message: "无权限访问此资源" },
          { status: 403 }
        );
      }
    }
    console.error("获取 Milvus 配置失败:", error);
    return NextResponse.json(
      { message: "获取 Milvus 配置失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const {
      enabled,
      host,
      port,
      username,
      password,
      collection,
      dimensions,
    } = body;

    const updateData: Partial<MilvusConfig> = {};

    if (enabled !== undefined) updateData.enabled = enabled;
    if (host !== undefined) updateData.host = host;
    if (port !== undefined) updateData.port = Number(port);
    if (username !== undefined) updateData.username = username;
    if (password !== undefined) updateData.password = password;
    if (collection !== undefined) updateData.collection = collection;
    if (dimensions !== undefined) updateData.dimensions = Number(dimensions);

    if (updateData.port !== undefined && (updateData.port < 1 || updateData.port > 65535)) {
      return NextResponse.json(
        { message: "端口号必须在 1-65535 之间" },
        { status: 400 }
      );
    }

    if (updateData.dimensions !== undefined && (updateData.dimensions < 1 || updateData.dimensions > 100000)) {
      return NextResponse.json(
        { message: "向量维度必须在 1-100000 之间" },
        { status: 400 }
      );
    }

    await saveMilvusConfig(updateData);

    const updatedConfig = await getMilvusConfig();
    const stats = await getMilvusStats();

    return NextResponse.json(
      {
        message: "Milvus 配置保存成功",
        config: updatedConfig,
        stats,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { message: "未登录，请先登录" },
          { status: 401 }
        );
      }
      if (error.message === "无权限访问此资源") {
        return NextResponse.json(
          { message: "无权限访问此资源" },
          { status: 403 }
        );
      }
    }
    console.error("保存 Milvus 配置失败:", error);
    return NextResponse.json(
      { message: "保存 Milvus 配置失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { action, ...config } = body;

    if (action === "test") {
      const testConfig: MilvusConfig = {
        enabled: config.enabled ?? false,
        host: config.host || DEFAULT_MILVUS_CONFIG.host,
        port: Number(config.port) || DEFAULT_MILVUS_CONFIG.port,
        username: config.username || "",
        password: config.password || "",
        collection: config.collection || DEFAULT_MILVUS_CONFIG.collection,
        dimensions: Number(config.dimensions) || DEFAULT_MILVUS_CONFIG.dimensions,
      };

      const result = await testMilvusConnection(testConfig);

      return NextResponse.json(
        {
          success: result.success,
          message: result.message,
          version: result.version,
        },
        { status: result.success ? 200 : 400 }
      );
    }

    if (action === "initCollection") {
      const result = await ensureMilvusCollection();

      return NextResponse.json(
        {
          success: result.success,
          message: result.message,
          collectionExists: result.collectionExists,
          collectionCreated: result.collectionCreated,
        },
        { status: result.success ? 200 : 400 }
      );
    }

    return NextResponse.json(
      { message: "未知的操作类型" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { message: "未登录，请先登录" },
          { status: 401 }
        );
      }
      if (error.message === "无权限访问此资源") {
        return NextResponse.json(
          { message: "无权限访问此资源" },
          { status: 403 }
        );
      }
    }
    console.error("Milvus 操作失败:", error);
    return NextResponse.json(
      { message: "操作失败，请稍后重试" },
      { status: 500 }
    );
  }
}
