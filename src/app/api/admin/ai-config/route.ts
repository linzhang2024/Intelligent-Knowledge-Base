import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getPublicAIConfig,
  getAIConfig,
  saveAIConfig,
  AI_PROVIDERS,
  EMBEDDING_MODELS,
  LLM_MODELS,
  PROVIDER_BASE_URLS,
  AIProvider,
  AIConfig,
} from "@/lib/aiConfig";
import { getEmbeddingsInstance } from "@/lib/embedding";
import { getChatModelInstance } from "@/lib/llm";
import { HumanMessage } from "@langchain/core/messages";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const config = await getPublicAIConfig();

    return NextResponse.json(
      {
        config,
        providers: Object.values(AI_PROVIDERS),
        embeddingModels: EMBEDDING_MODELS,
        llmModels: LLM_MODELS,
        defaultBaseUrls: PROVIDER_BASE_URLS,
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
    console.error("获取 AI 配置失败:", error);
    return NextResponse.json(
      { message: "获取 AI 配置失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { embedding, llm } = body;

    const updateData: Partial<AIConfig> = {};

    if (embedding) {
      if (!Object.values(AI_PROVIDERS).includes(embedding.provider)) {
        return NextResponse.json(
          { message: `无效的 Embedding 提供商: ${embedding.provider}` },
          { status: 400 }
        );
      }
      updateData.embedding = {
        provider: embedding.provider,
        apiKey: embedding.apiKey || "",
        baseUrl: embedding.baseUrl || PROVIDER_BASE_URLS[embedding.provider as AIProvider],
        model: embedding.model || EMBEDDING_MODELS[embedding.provider as AIProvider][0],
      };
    }

    if (llm) {
      if (!Object.values(AI_PROVIDERS).includes(llm.provider)) {
        return NextResponse.json(
          { message: `无效的 LLM 提供商: ${llm.provider}` },
          { status: 400 }
        );
      }
      updateData.llm = {
        provider: llm.provider,
        apiKey: llm.apiKey || "",
        baseUrl: llm.baseUrl || PROVIDER_BASE_URLS[llm.provider as AIProvider],
        model: llm.model || LLM_MODELS[llm.provider as AIProvider][0],
        temperature: llm.temperature ?? 0.7,
      };
    }

    await saveAIConfig(updateData);

    const updatedConfig = await getPublicAIConfig();

    return NextResponse.json(
      {
        message: "配置保存成功",
        config: updatedConfig,
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
    console.error("保存 AI 配置失败:", error);
    return NextResponse.json(
      { message: "保存 AI 配置失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { type, provider, apiKey, baseUrl, model } = body;

    if (!type || (type !== "embedding" && type !== "llm")) {
      return NextResponse.json(
        { message: 'type 参数必须是 "embedding" 或 "llm"' },
        { status: 400 }
      );
    }

    const currentConfig = await getAIConfig();
    const configToUse = type === "embedding" ? currentConfig.embedding : currentConfig.llm;

    const useSavedConfig = apiKey === "use_saved";

    let actualProvider: AIProvider;
    let actualApiKey: string;
    let actualBaseUrl: string;
    let actualModel: string;

    if (useSavedConfig) {
      actualProvider = configToUse.provider;
      actualApiKey = configToUse.apiKey;
      actualBaseUrl = baseUrl || configToUse.baseUrl;
      actualModel = model || configToUse.model;

      if (!actualApiKey || actualApiKey.trim() === "") {
        return NextResponse.json(
          { success: false, message: "没有保存的 API Key，请先配置" },
          { status: 200 }
        );
      }
    } else {
      if (!provider || !Object.values(AI_PROVIDERS).includes(provider)) {
        return NextResponse.json(
          { success: false, message: "无效的提供商" },
          { status: 200 }
        );
      }

      if (!apiKey || apiKey.trim() === "") {
        return NextResponse.json(
          { success: false, message: "API Key 不能为空" },
          { status: 200 }
        );
      }

      actualProvider = provider as AIProvider;
      actualApiKey = apiKey;
      actualBaseUrl = baseUrl || PROVIDER_BASE_URLS[actualProvider];
      actualModel = model || (
        type === "embedding"
          ? EMBEDDING_MODELS[actualProvider][0]
          : LLM_MODELS[actualProvider][0]
      );
    }

    let testResult: { success: boolean; message: string; latency?: number };

    const startTime = Date.now();

    try {
      if (type === "embedding") {
        const embeddings = getEmbeddingsInstance(
          actualProvider,
          actualApiKey,
          actualBaseUrl,
          actualModel
        );

        await embeddings.embedQuery("test");

        const latency = Date.now() - startTime;

        testResult = {
          success: true,
          message: `Embedding 连接测试成功，模型: ${actualModel}`,
          latency,
        };
      } else {
        const chatModel = getChatModelInstance(
          actualProvider,
          actualApiKey,
          actualBaseUrl,
          {
            model: actualModel,
            temperature: 0.7,
            streaming: false,
          }
        );

        await chatModel.invoke([new HumanMessage("Hello, please respond with 'OK'")]);

        const latency = Date.now() - startTime;

        testResult = {
          success: true,
          message: `LLM 连接测试成功，模型: ${actualModel}`,
          latency,
        };
      }
    } catch (apiError) {
      console.error("API 连接测试失败:", apiError);

      const errorMessage = apiError instanceof Error
        ? apiError.message
        : "未知错误";

      testResult = {
        success: false,
        message: `连接失败: ${errorMessage}`,
      };
    }

    return NextResponse.json(testResult, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { success: false, message: "未登录，请先登录" },
          { status: 401 }
        );
      }
      if (error.message === "无权限访问此资源") {
        return NextResponse.json(
          { success: false, message: "无权限访问此资源" },
          { status: 403 }
        );
      }
    }
    console.error("测试连接失败:", error);
    return NextResponse.json(
      { success: false, message: "测试连接失败，请稍后重试" },
      { status: 500 }
    );
  }
}
