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
  getAvailableDimensions,
  supportsMultipleDimensions,
  EMBEDDING_MODEL_DIMENSIONS,
} from "@/lib/aiConfig";
import { getEmbeddingsInstance } from "@/lib/embedding";
import { getChatModelInstance } from "@/lib/llm";
import { HumanMessage } from "@langchain/core/messages";

interface TestResult {
  success: boolean;
  message: string;
  errorType?: string;
  suggestion?: string;
  latency?: number;
}

function analyzeError(error: unknown, type: "embedding" | "llm"): TestResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  const lowerMessage = errorMessage.toLowerCase();
  const lowerStack = errorStack?.toLowerCase() || "";

  if (lowerMessage.includes("401") || 
      lowerStack.includes("401") ||
      lowerMessage.includes("unauthorized") ||
      lowerMessage.includes("invalid api key") ||
      lowerMessage.includes("api key not found") ||
      lowerMessage.includes("incorrect api key")) {
    return {
      success: false,
      message: `API Key 无效或已过期 (401 Unauthorized)`,
      errorType: "AUTHENTICATION_ERROR",
      suggestion: "请检查您的 API Key 是否正确，或在提供商控制台重新生成新的 API Key。",
    };
  }

  if (lowerMessage.includes("403") ||
      lowerStack.includes("403") ||
      lowerMessage.includes("forbidden") ||
      lowerMessage.includes("access denied") ||
      lowerMessage.includes("insufficient quota")) {
    return {
      success: false,
      message: `API 访问被拒绝 (403 Forbidden)`,
      errorType: "FORBIDDEN_ERROR",
      suggestion: "请检查您的账户是否有足够的配额，或是否已开通该模型的访问权限。部分模型需要单独申请或付费。",
    };
  }

  if (lowerMessage.includes("404") ||
      lowerStack.includes("404") ||
      lowerMessage.includes("not found") ||
      lowerMessage.includes("model not found")) {
    return {
      success: false,
      message: `模型不存在或 API 路径错误 (404 Not Found)`,
      errorType: "NOT_FOUND_ERROR",
      suggestion: `请检查：1) 模型名称是否正确；2) Base URL 是否正确。当前模型为 "${type === 'embedding' ? 'Embedding' : 'LLM'}" 模型，确保您选择的模型属于正确的类型。`,
    };
  }

  if (lowerMessage.includes("429") ||
      lowerStack.includes("429") ||
      lowerMessage.includes("rate limit") ||
      lowerMessage.includes("too many requests")) {
    return {
      success: false,
      message: `请求频率超限 (429 Too Many Requests)`,
      errorType: "RATE_LIMIT_ERROR",
      suggestion: "API 请求过于频繁，请稍后重试。如果频繁出现此问题，可能需要检查账户配额或升级套餐。",
    };
  }

  if (lowerMessage.includes("500") ||
      lowerStack.includes("500") ||
      lowerMessage.includes("502") ||
      lowerStack.includes("502") ||
      lowerMessage.includes("503") ||
      lowerStack.includes("503") ||
      lowerMessage.includes("server error") ||
      lowerMessage.includes("service unavailable")) {
    return {
      success: false,
      message: `提供商服务器错误 (5xx Server Error)`,
      errorType: "SERVER_ERROR",
      suggestion: "这是 API 提供商的服务端问题，请稍后重试。您也可以检查提供商的状态页面确认服务是否正常。",
    };
  }

  if (lowerMessage.includes("timeout") ||
      lowerMessage.includes("timed out") ||
      lowerMessage.includes("etimedout") ||
      lowerMessage.includes("econnaborted")) {
    return {
      success: false,
      message: `连接超时`,
      errorType: "TIMEOUT_ERROR",
      suggestion: "请检查网络连接是否正常，或 Base URL 是否正确。如果使用代理或内网环境，请确保网络可达。",
    };
  }

  if (lowerMessage.includes("econnrefused") ||
      lowerMessage.includes("enotfound") ||
      lowerMessage.includes("getaddrinfo") ||
      lowerMessage.includes("dns")) {
    return {
      success: false,
      message: `无法连接到 API 服务器`,
      errorType: "CONNECTION_ERROR",
      suggestion: "请检查 Base URL 是否正确，以及网络连接是否正常。如果是自定义域名，请确保 DNS 解析正确。",
    };
  }

  if (lowerMessage.includes("quota") ||
      lowerMessage.includes("balance") ||
      lowerMessage.includes("insufficient funds") ||
      lowerMessage.includes("out of credit")) {
    return {
      success: false,
      message: `账户余额不足或配额耗尽`,
      errorType: "QUOTA_ERROR",
      suggestion: "请检查您的 API 账户余额或配额是否充足，需要充值或升级套餐后才能继续使用。",
    };
  }

  if (lowerMessage.includes("context length") ||
      lowerMessage.includes("maximum context") ||
      lowerMessage.includes("prompt is too long")) {
    return {
      success: false,
      message: `模型上下文长度超限`,
      errorType: "CONTEXT_LENGTH_ERROR",
      suggestion: "这通常不是配置问题，而是输入内容过长。请检查您的输入文本长度是否超出模型的最大上下文限制。",
    };
  }

  return {
    success: false,
    message: `连接失败: ${errorMessage}`,
    errorType: "UNKNOWN_ERROR",
    suggestion: "这是一个未知错误。请检查：1) API Key 是否正确；2) Base URL 是否正确；3) 网络连接是否正常。如果问题持续，请联系技术支持。",
  };
}

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
        embeddingModelDimensions: EMBEDDING_MODEL_DIMENSIONS,
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
        dimension: embedding.dimension,
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
    const { type, provider, apiKey, baseUrl, model, dimension } = body;

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
    let actualDimension: number | undefined;

    if (useSavedConfig) {
      actualProvider = configToUse.provider;
      actualApiKey = configToUse.apiKey;
      actualBaseUrl = baseUrl || configToUse.baseUrl;
      actualModel = model || configToUse.model;
      actualDimension = dimension ?? (configToUse as any).dimension;

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
      actualDimension = dimension;
    }

    let testResult: TestResult;

    const startTime = Date.now();

    try {
      console.log(`[AI Config Test] 开始测试 ${type === "embedding" ? "Embedding" : "LLM"} 连接`);
      console.log(`[AI Config Test] 提供商: ${actualProvider}, 模型: ${actualModel}, Base URL: ${actualBaseUrl}, 维度: ${actualDimension}`);

      if (type === "embedding") {
        const embeddings = getEmbeddingsInstance(
          actualProvider,
          actualApiKey,
          actualBaseUrl,
          actualModel,
          actualDimension
        );

        await embeddings.embedQuery("test");

        const latency = Date.now() - startTime;

        testResult = {
          success: true,
          message: `✅ Embedding 向量化服务连接测试成功！模型: ${actualModel}`,
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
          message: `✅ LLM 对话模型连接测试成功！模型: ${actualModel}`,
          latency,
        };
      }

      console.log(`[AI Config Test] 测试成功，耗时: ${testResult.latency}ms`);
    } catch (apiError) {
      console.error("[AI Config Test] API 连接测试失败:", apiError);

      testResult = analyzeError(apiError, type);
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
