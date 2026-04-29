import { ChatAlibabaTongyi } from "@langchain/community/chat_models/alibaba_tongyi";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { SearchResult } from "@/lib/vectorStore";
import { getAIConfig, AI_PROVIDERS, AIProvider } from "@/lib/aiConfig";

const SYSTEM_PROMPT_TEMPLATE = `你是一个专业的知识库助手。请基于以下提供的上下文信息来回答用户的问题。

## 回答规则：
1. **仅使用上下文信息**：你的回答必须严格基于以下提供的上下文内容。
2. **引用来源**：如果使用了上下文中的信息，请在回答中明确引用。
3. **诚实原则**：如果上下文没有足够的信息来回答问题，请诚实地说"根据当前知识库中的内容，我无法回答这个问题"。
4. **不猜测**：不要编造或猜测上下文之外的信息。
5. **使用中文**：请使用中文进行回答。

## 引用格式：
当引用上下文时，请使用以下格式：
> [来源：文档标题 - 第X段] 引用内容

## 当前上下文：
{context}`;

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}

function getChatModelInstance(
  provider: AIProvider,
  apiKey: string,
  baseUrl: string,
  options: ChatOptions = {}
) {
  const model = options.model;
  const temperature = options.temperature ?? 0.7;
  const streaming = options.streaming ?? false;

  switch (provider) {
    case AI_PROVIDERS.OPENAI:
    case AI_PROVIDERS.DEEPSEEK:
      return new ChatOpenAI({
        model,
        apiKey,
        temperature,
        streaming,
        configuration: {
          baseURL: baseUrl,
        },
      });

    case AI_PROVIDERS.DASHSCOPE:
      return new ChatAlibabaTongyi({
        model,
        apiKey,
        temperature,
        streaming,
      } as any);

    default:
      throw new Error(`不支持的 LLM 提供商: ${provider}`);
  }
}

export async function isLLMConfigured(): Promise<boolean> {
  const config = await getAIConfig();
  return !!config.llm.apiKey && config.llm.apiKey.trim().length > 0;
}

async function getChatModel(options: ChatOptions = {}) {
  const config = await getAIConfig();

  if (!config.llm.apiKey) {
    throw new Error("LLM API Key 未配置，请在系统设置中配置");
  }

  return getChatModelInstance(
    config.llm.provider,
    config.llm.apiKey,
    config.llm.baseUrl,
    {
      ...options,
      model: options.model || config.llm.model,
      temperature: options.temperature ?? config.llm.temperature,
    }
  );
}

function buildContext(searchResults: SearchResult[]): string {
  if (searchResults.length === 0) {
    return "（当前知识库中没有找到相关信息）";
  }

  const contextParts = searchResults.map((result, index) => {
    return `
---
【参考 ${index + 1}】
文档：${result.documentTitle}
知识库：${result.knowledgeBaseName || "未分类"}
相似度：${(result.similarity * 100).toFixed(1)}%

内容：
${result.content}
---
    `.trim();
  });

  return contextParts.join("\n\n");
}

function buildRAGPrompt(
  userQuery: string,
  searchResults: SearchResult[],
  history: ChatMessage[] = []
): BaseMessage[] {
  const context = buildContext(searchResults);
  const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{context}", context);

  const messages: BaseMessage[] = [new SystemMessage(systemPrompt)];

  for (const msg of history) {
    if (msg.role === "user") {
      messages.push(new HumanMessage(msg.content));
    } else if (msg.role === "assistant") {
      messages.push(new HumanMessage(msg.content));
    }
  }

  messages.push(new HumanMessage(userQuery));

  return messages;
}

export async function chatWithRAG(
  userQuery: string,
  searchResults: SearchResult[],
  options: ChatOptions = {},
  history: ChatMessage[] = []
): Promise<string> {
  const messages = buildRAGPrompt(userQuery, searchResults, history);
  const model = await getChatModel({ ...options, streaming: false });

  const config = await getAIConfig();
  console.log(`[LLM] 开始 RAG 聊天，查询: "${userQuery}"`);
  console.log(`[LLM] 上下文片段数量: ${searchResults.length}, 提供商: ${config.llm.provider}, 模型: ${config.llm.model}`);

  const response = await model.invoke(messages);

  console.log(`[LLM] RAG 聊天完成，响应长度: ${response.content.toString().length}`);

  return response.content.toString();
}

export async function chatWithRAGStream(
  userQuery: string,
  searchResults: SearchResult[],
  options: ChatOptions = {},
  history: ChatMessage[] = []
): Promise<AsyncIterable<string>> {
  const messages = buildRAGPrompt(userQuery, searchResults, history);
  const model = await getChatModel({ ...options, streaming: true });

  const config = await getAIConfig();
  console.log(`[LLM] 开始流式 RAG 聊天，查询: "${userQuery}"`);
  console.log(`[LLM] 上下文片段数量: ${searchResults.length}, 提供商: ${config.llm.provider}, 模型: ${config.llm.model}`);

  const stream = await model.stream(messages);

  return (async function* () {
    for await (const chunk of stream) {
      const content = chunk.content.toString();
      if (content) {
        yield content;
      }
    }
  })();
}

export { buildContext, buildRAGPrompt, getChatModelInstance };
