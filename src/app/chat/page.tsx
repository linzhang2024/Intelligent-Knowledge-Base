"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/ui/AppHeader";

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  documentCount: number;
}

interface ChatSource {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  knowledgeBaseId: string | null;
  knowledgeBaseName: string | null;
  similarity: number;
  snippet: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  isStreaming?: boolean;
  timestamp: Date;
}

interface SSEEvent {
  event: string;
  data: unknown;
}

interface ChatContentProps {
  onKbSelected: (kbId: string) => void;
  selectedKbId: string;
}

function ChatContent({ onKbSelected, selectedKbId }: ChatContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState<string | null>(null);
  const [initialKbLoaded, setInitialKbLoaded] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchKnowledgeBases = async () => {
      try {
        const response = await fetch("/api/kb");
        if (response.ok) {
          const data = await response.json();
          const kbs = data.knowledgeBases || [];
          setKnowledgeBases(kbs);

          const kbFromUrl = searchParams.get("kb");
          if (kbFromUrl && !initialKbLoaded) {
            const validKb = kbs.find((kb: KnowledgeBase) => kb.id === kbFromUrl);
            if (validKb) {
              onKbSelected(kbFromUrl);
              console.log(`[Chat] 自动选中知识库: ${validKb.name}`);
            }
            setInitialKbLoaded(true);
          }
        }
      } catch (err) {
        console.error("获取知识库列表失败:", err);
      }
    };

    fetchKnowledgeBases();
  }, [searchParams, initialKbLoaded, onKbSelected]);

  const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    const assistantMessageId = generateMessageId();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      isStreaming: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInputValue("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/qa/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          knowledgeBaseId: selectedKbId || undefined,
          streaming: true,
          limit: 5,
          minSimilarity: 0.38,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("无法读取响应流");
      }

      let currentContent = "";
      let currentSources: ChatSource[] = [];
      let buffer = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7);
            continue;
          }

          if (line.startsWith("data: ")) {
            try {
              const dataStr = line.slice(6);
              const dataObj = JSON.parse(dataStr) as Record<string, unknown>;

              switch (currentEvent) {
                case "sources":
                  if (dataObj.sources && Array.isArray(dataObj.sources)) {
                    currentSources = dataObj.sources as ChatSource[];
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, sources: currentSources }
                          : msg
                      )
                    );
                  }
                  break;

                case "content":
                  if (typeof dataObj.content === "string") {
                    currentContent += dataObj.content;
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: currentContent }
                          : msg
                      )
                    );
                  }
                  break;

                case "done":
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, isStreaming: false }
                        : msg
                    )
                  );
                  break;

                case "error":
                  if (typeof dataObj.message === "string") {
                    throw new Error(dataObj.message);
                  }
                  break;
              }
            } catch (parseError) {
              if (parseError instanceof Error) {
                throw parseError;
              }
              console.warn("SSE 数据解析失败:", line);
            }
            continue;
          }

          if (line === "") {
            currentEvent = "";
            continue;
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "未知错误";
      setError(errorMessage);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `抱歉，发生了错误：${errorMessage}`,
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    setShowSources(null);
  };

  const formatSimilarity = (similarity: number): string => {
    return `${(similarity * 100).toFixed(1)}%`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader
        activePage="chat"
        showTabs={true}
        showDashboardLink={true}
        pageActions={{
          onClear: clearChat,
          isLoading: isLoading,
        }}
      />

      <main className="flex-1 flex max-w-6xl mx-auto w-full">
        <aside className="w-64 bg-white border-r border-gray-200 p-4 hidden md:block">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择知识库
            </label>
            <select
              value={selectedKbId}
              onChange={(e) => onKbSelected(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">全部知识库</option>
              {knowledgeBases.map((kb) => (
                <option key={kb.id} value={kb.id}>
                  {kb.name} ({kb.documentCount} 文档)
                </option>
              ))}
            </select>
          </div>

          <div className="bg-blue-50 rounded-lg p-3">
            <h3 className="text-sm font-medium text-blue-900 mb-2">使用提示</h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• 选择特定知识库可获得更精准的回答</li>
              <li>• 提问时尽量使用与文档内容相关的关键词</li>
              <li>• AI 会基于最相关的文档片段回答问题</li>
              <li>• 点击「查看来源」可查看引用的文档片段</li>
            </ul>
          </div>
        </aside>

        <div className="flex-1 flex flex-col">
          <div className="md:hidden bg-white border-b border-gray-200 p-3">
            <select
              value={selectedKbId}
              onChange={(e) => onKbSelected(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">全部知识库</option>
              {knowledgeBases.map((kb) => (
                <option key={kb.id} value={kb.id}>
                  {kb.name} ({kb.documentCount} 文档)
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-6xl mb-4">🤖</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  开始知识库问答
                </h2>
                <p className="text-gray-500 max-w-md">
                  上传文档后，您可以向我提问关于文档内容的问题。
                  我会从知识库中检索最相关的信息并给出回答。
                </p>
                {knowledgeBases.length === 0 && (
                  <Link
                    href="/documents/upload"
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    先上传一些文档
                  </Link>
                )}
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-3xl rounded-lg px-4 py-3 ${
                      message.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-white border border-gray-200"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-xs font-medium text-indigo-600">
                          AI 助手
                        </span>
                        {message.isStreaming && (
                          <span className="text-xs text-gray-400 animate-pulse">
                            正在输入...
                          </span>
                        )}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap text-sm">
                      {message.content || (message.isStreaming ? "" : "（空响应）")}
                      {message.isStreaming && !message.content && (
                        <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1"></span>
                      )}
                    </div>

                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-3">
                        <button
                          onClick={() =>
                            setShowSources(showSources === message.id ? null : message.id)
                          }
                          className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center"
                        >
                          <span>📚 参考来源 ({message.sources.length})</span>
                          <svg
                            className={`w-3 h-3 ml-1 transition-transform ${
                              showSources === message.id ? "rotate-180" : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {showSources === message.id && (
                          <div className="mt-2 space-y-2">
                            {message.sources.map((source, idx) => (
                              <div
                                key={source.chunkId}
                                className="bg-gray-50 rounded-md p-2 text-xs"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-gray-700">
                                    {idx + 1}. {source.documentTitle}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-xs ${
                                      source.similarity >= 0.8
                                        ? "bg-green-100 text-green-700"
                                        : source.similarity >= 0.6
                                        ? "bg-yellow-100 text-yellow-700"
                                        : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {formatSimilarity(source.similarity)}
                                  </span>
                                </div>
                                {source.knowledgeBaseName && (
                                  <div className="text-gray-500 mb-1">
                                    知识库：{source.knowledgeBaseName}
                                  </div>
                                )}
                                <div className="text-gray-600 text-xs leading-relaxed">
                                  {source.snippet}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <span className="text-red-500 mr-2">⚠️</span>
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-gray-200 bg-white p-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end space-x-3">
                <div className="flex-1">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入您的问题..."
                    disabled={isLoading}
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={isLoading || !inputValue.trim()}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    "发送"
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                按 Enter 发送，Shift + Enter 换行
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ChatPage() {
  const [selectedKbId, setSelectedKbId] = useState<string>("");

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">加载中...</div>}>
      <ChatContent onKbSelected={setSelectedKbId} selectedKbId={selectedKbId} />
    </Suspense>
  );
}
