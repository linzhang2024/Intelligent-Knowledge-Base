import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import { getMilvusConfig, MilvusConfig } from "@/lib/milvusConfig";

let milvusClient: MilvusClient | null = null;
let cachedConfig: MilvusConfig | null = null;

export async function getMilvusClient(): Promise<MilvusClient> {
  const config = await getMilvusConfig();

  if (
    milvusClient &&
    cachedConfig &&
    cachedConfig.host === config.host &&
    cachedConfig.port === config.port &&
    cachedConfig.username === config.username &&
    cachedConfig.password === config.password
  ) {
    return milvusClient;
  }

  if (milvusClient) {
    try {
      milvusClient.closeConnection();
    } catch (e) {
      console.warn("[Milvus] 关闭旧连接失败:", e);
    }
  }

  const connectParams = {
    address: `${config.host}:${config.port}`,
    ...(config.username && { username: config.username }),
    ...(config.password && { password: config.password }),
  };

  milvusClient = new MilvusClient(connectParams);
  cachedConfig = { ...config };

  return milvusClient;
}

function formatError(error: any): string {
  if (!error) {
    return "未知错误（error 为 null 或 undefined）";
  }

  // 收集所有可能的错误信息
  const parts: string[] = [];

  // 检查是否是 Error 对象
  if (error instanceof Error) {
    if (error.name && error.name !== "Error") {
      parts.push(`[${error.name}]`);
    }
    if (error.message) {
      parts.push(error.message);
    }
    if (error.stack) {
      // 只取堆栈的第一行
      const stackLines = error.stack.split("\n");
      if (stackLines.length > 1) {
        parts.push(`\n位置: ${stackLines[1].trim()}`);
      }
    }
  }

  // 检查 gRPC 特定的错误属性
  const grpcProps = ["code", "status", "details", "metadata", "grpc_code", "grpc_message"];
  const grpcDetails: string[] = [];
  
  for (const prop of grpcProps) {
    if (error[prop] !== undefined && error[prop] !== null) {
      const value = typeof error[prop] === "object" 
        ? JSON.stringify(error[prop], null, 2) 
        : String(error[prop]);
      grpcDetails.push(`${prop}: ${value}`);
    }
  }

  if (grpcDetails.length > 0) {
    parts.push(`\ngRPC 详情:\n  ${grpcDetails.join("\n  ")}`);
  }

  // 检查错误对象的所有可枚举属性
  if (typeof error === "object") {
    const allProps = Object.keys(error);
    const otherProps = allProps.filter(
      (p) => !["name", "message", "stack", ...grpcProps].includes(p)
    );

    if (otherProps.length > 0) {
      const otherDetails: string[] = [];
      for (const prop of otherProps) {
        try {
          const value = typeof error[prop] === "object"
            ? JSON.stringify(error[prop], null, 2)
            : String(error[prop]);
          otherDetails.push(`${prop}: ${value}`);
        } catch {
          otherDetails.push(`${prop}: [无法序列化]`);
        }
      }
      parts.push(`\n其他属性:\n  ${otherDetails.join("\n  ")}`);
    }

    // 如果没有找到任何有用的信息，尝试完整序列化
    if (parts.length === 0) {
      try {
        return `错误对象: ${JSON.stringify(error, null, 2)}`;
      } catch {
        return `错误对象: ${String(error)}`;
      }
    }
  }

  // 如果还是没有信息，尝试转换为字符串
  if (parts.length === 0) {
    return `错误: ${String(error)}`;
  }

  return parts.join(" ");
}

function analyzeConnectionError(error: any, host: string, port: number): string {
  const analysis: string[] = [];
  
  // 尝试识别错误类型
  const errorStr = String(error).toLowerCase();
  const errorMessage = error?.message?.toLowerCase() || "";
  const errorCode = error?.code;
  
  analysis.push("\n\n--- 错误分析 ---");

  // 检查常见的连接错误
  if (errorStr.includes("econnrefused") || errorMessage.includes("econnrefused")) {
    analysis.push("🔴 连接被拒绝（ECONNREFUSED）");
    analysis.push("   可能原因：");
    analysis.push("   - Milvus 服务没有在指定端口监听");
    analysis.push("   - 防火墙阻止了连接");
    analysis.push("   - 端口映射配置错误");
    analysis.push("   建议：");
    analysis.push(`   1. 检查 Milvus 容器状态: docker ps | findstr milvus`);
    analysis.push(`   2. 检查端口监听: netstat -ano | findstr :${port}`);
    analysis.push(`   3. 尝试使用 127.0.0.1 代替 localhost`);
  } else if (errorStr.includes("etimedout") || errorMessage.includes("etimedout")) {
    analysis.push("🔴 连接超时（ETIMEDOUT）");
    analysis.push("   可能原因：");
    analysis.push("   - 网络路由问题");
    analysis.push("   - 防火墙丢弃了数据包");
    analysis.push("   - Milvus 服务过载");
    analysis.push("   建议：");
    analysis.push("   1. 检查防火墙设置");
    analysis.push("   2. 检查 Milvus 资源使用情况");
    analysis.push("   3. 增加连接超时时间");
  } else if (errorStr.includes("enotfound") || errorMessage.includes("enotfound") || errorStr.includes("getaddrinfo")) {
    analysis.push("🔴 主机名解析失败");
    analysis.push("   可能原因：");
    analysis.push(`   - 无法解析主机名 "${host}"`);
    analysis.push("   - DNS 配置问题");
    analysis.push("   建议：");
    analysis.push(`   1. 尝试使用 IP 地址代替主机名`);
    analysis.push(`   2. 检查 hosts 文件配置`);
  } else if (errorStr.includes("permission") || errorStr.includes("access denied")) {
    analysis.push("🔴 权限被拒绝");
    analysis.push("   可能原因：");
    analysis.push("   - 防火墙阻止了出站连接");
    analysis.push("   - 安全软件限制");
    analysis.push("   建议：");
    analysis.push("   1. 以管理员身份运行应用");
    analysis.push("   2. 检查安全软件设置");
  } else if (errorCode === 14 || errorStr.includes("unavailable")) {
    analysis.push("🔴 gRPC 服务不可用（错误码 14）");
    analysis.push("   这是 gRPC 常见的连接错误");
    analysis.push("   可能原因：");
    analysis.push("   - Milvus 服务未完全启动");
    analysis.push("   - 网络连接被阻止");
    analysis.push("   - 服务正在重启");
    analysis.push("   建议：");
    analysis.push("   1. 等待 Milvus 完全启动（可能需要 30-60 秒）");
    analysis.push("   2. 检查 Milvus 日志: docker logs milvus-standalone");
    analysis.push("   3. 尝试重启 Milvus 服务");
  } else if (errorStr.includes("retried") && errorStr.includes("times")) {
    analysis.push("🟡 连接重试失败");
    analysis.push("   SDK 尝试了多次连接但都失败了");
    analysis.push("   可能原因：");
    analysis.push("   - 网络层面的问题（最常见）");
    analysis.push("   - IPv4/IPv6 解析问题");
    analysis.push("   - 防火墙阻止");
    analysis.push("   建议：");
    analysis.push(`   1. 首先尝试使用 127.0.0.1 代替 localhost`);
    analysis.push(`   2. 检查 Windows 防火墙设置`);
    analysis.push(`   3. 确认 Milvus 容器正在运行`);
  } else {
    analysis.push("🟡 未知类型的连接错误");
    analysis.push("   建议：");
    analysis.push("   1. 查看下方的详细错误信息");
    analysis.push("   2. 检查应用控制台的完整日志");
    analysis.push("   3. 尝试以下通用解决方案");
  }

  analysis.push("\n--- 通用解决方案 ---");
  analysis.push("1. 📌 **首先尝试：使用 127.0.0.1 代替 localhost**");
  analysis.push("   - 这是 Windows 上最常见的解决方案");
  analysis.push("   - 原因：localhost 可能解析为 IPv6 地址 ::1");
  analysis.push("   - 而 Docker 容器通常只监听 IPv4 地址");
  analysis.push("");
  analysis.push("2. 🔥 检查 Windows 防火墙");
  analysis.push("   - 临时禁用防火墙测试（仅用于诊断）：");
  analysis.push("     netsh advfirewall set allprofiles state off");
  analysis.push("   - 测试完成后务必重新启用：");
  analysis.push("     netsh advfirewall set allprofiles state on");
  analysis.push("   - 或者添加防火墙规则（以管理员身份运行）：");
  analysis.push(`     netsh advfirewall firewall add rule name="Milvus Port ${port}" dir=in action=allow protocol=TCP localport=${port}`);
  analysis.push("");
  analysis.push("3. 🔍 检查 Milvus 服务状态");
  analysis.push("   - 查看容器状态: docker ps -a");
  analysis.push("   - 查看 Milvus 日志: docker logs milvus-standalone");
  analysis.push("   - 检查端口监听: netstat -ano | findstr :19530");
  analysis.push("");
  analysis.push("4. 🔄 重启 Milvus 服务");
  analysis.push("   - 停止服务: docker-compose -f docker-compose-milvus.yml down");
  analysis.push("   - 启动服务: docker-compose -f docker-compose-milvus.yml up -d");
  analysis.push("   - 等待 30-60 秒让服务完全启动");
  analysis.push("");
  analysis.push("5. 🌐 检查网络配置");
  analysis.push("   - 确认 Docker 端口映射正确");
  analysis.push("   - 检查是否有其他进程占用端口 19530");
  analysis.push("   - 尝试使用 Docker 容器 IP 直接连接");

  return analysis.join("\n");
}

export async function testMilvusConnection(config: MilvusConfig): Promise<{ success: boolean; message: string; version?: string }> {
  let client: MilvusClient | null = null;
  const address = `${config.host}:${config.port}`;
  
  console.log(`[Milvus] ========================================`);
  console.log(`[Milvus] 开始测试连接到 Milvus`);
  console.log(`[Milvus] 主机: ${config.host}`);
  console.log(`[Milvus] 端口: ${config.port}`);
  console.log(`[Milvus] 地址: ${address}`);
  console.log(`[Milvus] 用户名: ${config.username ? "已设置" : "未设置"}`);
  console.log(`[Milvus] ========================================`);
  
  try {
    const connectParams = {
      address,
      ...(config.username && { username: config.username }),
      ...(config.password && { password: config.password }),
      timeout: 30000,
    };

    console.log(`[Milvus] 创建 Milvus 客户端...`);
    console.log(`[Milvus] 连接参数:`, JSON.stringify({ ...connectParams, password: config.password ? "***" : "未设置" }));
    
    client = new MilvusClient(connectParams);
    console.log(`[Milvus] 客户端创建成功，正在获取版本信息...`);
    console.log(`[Milvus] 这可能需要几秒钟，请耐心等待...`);
    
    const result = await client.getVersion();
    console.log(`[Milvus] ✅ 连接成功！`);
    console.log(`[Milvus] Milvus 版本: ${result.version}`);
    console.log(`[Milvus] ========================================`);
    
    await client.closeConnection();
    console.log(`[Milvus] 连接已关闭`);

    return {
      success: true,
      message: `连接成功，Milvus 版本: ${result.version}`,
      version: result.version,
    };
  } catch (error: any) {
    console.error(`[Milvus] ❌ 连接失败！`);
    console.error(`[Milvus] 错误类型:`, typeof error);
    console.error(`[Milvus] 错误对象:`, error);
    
    // 尝试获取更多错误信息
    if (error instanceof Error) {
      console.error(`[Milvus] Error.name:`, error.name);
      console.error(`[Milvus] Error.message:`, error.message);
      console.error(`[Milvus] Error.stack:`, error.stack?.split("\n")[0]);
    }
    
    // 检查所有可枚举属性
    if (typeof error === "object" && error !== null) {
      console.error(`[Milvus] 错误对象属性:`);
      for (const key of Object.keys(error)) {
        try {
          const value = error[key];
          const valueStr = typeof value === "object" 
            ? JSON.stringify(value) 
            : String(value);
          console.error(`[Milvus]   ${key}: ${valueStr.substring(0, 200)}${valueStr.length > 200 ? "..." : ""}`);
        } catch (e) {
          console.error(`[Milvus]   ${key}: [无法读取]`);
        }
      }
    }
    
    if (client) {
      try {
        console.log(`[Milvus] 尝试关闭客户端连接...`);
        await client.closeConnection();
        console.log(`[Milvus] 客户端连接已关闭`);
      } catch (e) {
        console.warn(`[Milvus] 关闭客户端连接时出错:`, e);
      }
    }
    
    console.error(`[Milvus] ========================================`);
    
    const errorDetails = formatError(error);
    const analysis = analyzeConnectionError(error, config.host, config.port);

    return {
      success: false,
      message: `连接失败: ${errorDetails}${analysis}`,
    };
  }
}

export async function ensureMilvusCollection(): Promise<{
  success: boolean;
  message: string;
  collectionExists: boolean;
  collectionCreated: boolean;
}> {
  const config = await getMilvusConfig();

  if (!config.enabled) {
    return {
      success: false,
      message: "Milvus 未启用",
      collectionExists: false,
      collectionCreated: false,
    };
  }

  const client = await getMilvusClient();
  const collectionName = config.collection;

  try {
    const hasCollection = await client.hasCollection({
      collection_name: collectionName,
    });

    if (hasCollection.value) {
      return {
        success: true,
        message: `集合 "${collectionName}" 已存在`,
        collectionExists: true,
        collectionCreated: false,
      };
    }

    const result = await client.createCollection({
      collection_name: collectionName,
      fields: [
        {
          name: "id",
          data_type: DataType.VarChar,
          is_primary_key: true,
          max_length: 64,
        },
        {
          name: "chunk_id",
          data_type: DataType.VarChar,
          max_length: 64,
        },
        {
          name: "document_id",
          data_type: DataType.VarChar,
          max_length: 64,
        },
        {
          name: "knowledge_base_id",
          data_type: DataType.VarChar,
          max_length: 64,
        },
        {
          name: "content",
          data_type: DataType.VarChar,
          max_length: 65535,
        },
        {
          name: "embedding",
          data_type: DataType.FloatVector,
          dim: config.dimensions,
        },
        {
          name: "model",
          data_type: DataType.VarChar,
          max_length: 256,
        },
      ],
      enable_dynamic_field: true,
    });

    await client.createIndex({
      collection_name: collectionName,
      field_name: "embedding",
      index_type: "IVF_FLAT",
      metric_type: "COSINE",
      params: { nlist: 1024 },
    });

    await client.loadCollectionSync({
      collection_name: collectionName,
    });

    return {
      success: true,
      message: `集合 "${collectionName}" 创建成功`,
      collectionExists: false,
      collectionCreated: true,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `操作失败: ${error.message || "未知错误"}`,
      collectionExists: false,
      collectionCreated: false,
    };
  }
}

export async function insertMilvusVectors(
  vectors: Array<{
    id: string;
    chunkId: string;
    documentId: string;
    knowledgeBaseId: string | null;
    content: string;
    embedding: number[];
    model: string;
  }>
): Promise<{ success: boolean; insertedCount: number; message: string }> {
  const config = await getMilvusConfig();

  if (!config.enabled) {
    return {
      success: false,
      insertedCount: 0,
      message: "Milvus 未启用",
    };
  }

  if (vectors.length === 0) {
    return {
      success: true,
      insertedCount: 0,
      message: "没有向量需要插入",
    };
  }

  const client = await getMilvusClient();
  const collectionName = config.collection;

  try {
    const data = vectors.map((v) => ({
      id: v.id,
      chunk_id: v.chunkId,
      document_id: v.documentId,
      knowledge_base_id: v.knowledgeBaseId || "",
      content: v.content,
      embedding: v.embedding,
      model: v.model,
    }));

    const firstVector = data[0];
    console.log(`[Milvus] 准备插入 ${data.length} 个向量`);
    console.log(`[Milvus] 第一个向量示例: id=${firstVector.id}, embedding维度=${firstVector.embedding?.length || 0}`);

    const result = await client.insert({
      collection_name: collectionName,
      data,
    });

    console.log(`[Milvus] 插入结果:`, JSON.stringify(result, null, 2));

    await client.flushSync({
      collection_names: [collectionName],
    });

    const insertedCount = typeof result.insert_cnt === "number" ? result.insert_cnt : parseInt(result.insert_cnt as string, 10) || vectors.length;

    return {
      success: true,
      insertedCount,
      message: `成功插入 ${insertedCount} 个向量`,
    };
  } catch (error: any) {
    const errorDetails = formatError(error);
    console.error(`[Milvus] 插入向量失败:`, errorDetails);
    return {
      success: false,
      insertedCount: 0,
      message: `插入失败: ${errorDetails}`,
    };
  }
}

export async function searchMilvusVectors(
  queryVector: number[],
  options: {
    limit?: number;
    minSimilarity?: number;
    knowledgeBaseId?: string;
  } = {}
): Promise<Array<{
  id: string;
  chunkId: string;
  documentId: string;
  knowledgeBaseId: string | null;
  content: string;
  similarity: number;
}>> {
  const config = await getMilvusConfig();

  if (!config.enabled) {
    throw new Error("Milvus 未启用");
  }

  const { limit = 10, minSimilarity = 0.38, knowledgeBaseId } = options;
  const client = await getMilvusClient();
  const collectionName = config.collection;

  try {
    const searchParams: any = {
      collection_name: collectionName,
      vectors: [queryVector],
      limit,
      output_fields: ["id", "chunk_id", "document_id", "knowledge_base_id", "content"],
      metric_type: "COSINE",
      params: { nprobe: 10 },
    };

    if (knowledgeBaseId) {
      searchParams.filter = `knowledge_base_id == "${knowledgeBaseId}"`;
    }

    const result = await client.search(searchParams);

    if (!result.results) {
      return [];
    }

    const resultAny = result as any;
    let hitsArray: any[];

    if (Array.isArray(resultAny.results)) {
      if (resultAny.results.length === 0) {
        return [];
      }
      const firstResult = resultAny.results[0];
      hitsArray = Array.isArray(firstResult) ? firstResult : [firstResult];
    } else {
      hitsArray = Array.isArray(resultAny.results) ? resultAny.results : [resultAny.results];
    }

    if (!hitsArray || hitsArray.length === 0) {
      return [];
    }

    const formattedResults: Array<{
      id: string;
      chunkId: string;
      documentId: string;
      knowledgeBaseId: string | null;
      content: string;
      similarity: number;
    }> = [];

    for (const hit of hitsArray) {
      const similarity = hit.score;

      if (similarity < minSimilarity) {
        continue;
      }

      formattedResults.push({
        id: hit.id,
        chunkId: hit.chunk_id || hit.id,
        documentId: hit.document_id,
        knowledgeBaseId: hit.knowledge_base_id || null,
        content: hit.content,
        similarity: similarity,
      });
    }

    return formattedResults;
  } catch (error: any) {
    console.error("[Milvus] 搜索失败:", error);
    throw new Error(`向量搜索失败: ${error.message || "未知错误"}`);
  }
}

export async function deleteMilvusVectors(
  ids: string[]
): Promise<{ success: boolean; deletedCount: number; message: string }> {
  const config = await getMilvusConfig();

  if (!config.enabled) {
    return {
      success: false,
      deletedCount: 0,
      message: "Milvus 未启用",
    };
  }

  if (ids.length === 0) {
    return {
      success: true,
      deletedCount: 0,
      message: "没有向量需要删除",
    };
  }

  const client = await getMilvusClient();
  const collectionName = config.collection;

  try {
    await client.delete({
      collection_name: collectionName,
      filter: `id in [${ids.map((id) => `"${id}"`).join(",")}]`,
    });

    return {
      success: true,
      deletedCount: ids.length,
      message: `成功删除 ${ids.length} 个向量`,
    };
  } catch (error: any) {
    return {
      success: false,
      deletedCount: 0,
      message: `删除失败: ${error.message || "未知错误"}`,
    };
  }
}

export async function deleteMilvusVectorsByDocumentId(
  documentId: string
): Promise<{ success: boolean; message: string }> {
  const config = await getMilvusConfig();

  if (!config.enabled) {
    return {
      success: false,
      message: "Milvus 未启用",
    };
  }

  const client = await getMilvusClient();
  const collectionName = config.collection;

  try {
    await client.delete({
      collection_name: collectionName,
      filter: `document_id == "${documentId}"`,
    });

    return {
      success: true,
      message: `成功删除文档 ${documentId} 的所有向量`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `删除失败: ${error.message || "未知错误"}`,
    };
  }
}

export async function getMilvusStats(): Promise<{
  enabled: boolean;
  collectionName: string;
  totalVectors: number;
  dimensions: number;
}> {
  const config = await getMilvusConfig();

  if (!config.enabled) {
    return {
      enabled: false,
      collectionName: config.collection,
      totalVectors: 0,
      dimensions: config.dimensions,
    };
  }

  try {
    const client = await getMilvusClient();
    const collectionName = config.collection;

    const stats = await client.getCollectionStatistics({
      collection_name: collectionName,
    });

    let rowCount = "0";
    const statsAny = stats as any;

    if (Array.isArray(statsAny.data)) {
      const rowCountItem = statsAny.data.find((s: any) => s.name === "row_count");
      rowCount = rowCountItem?.value || "0";
    } else if (statsAny.data && typeof statsAny.data === "object") {
      if (statsAny.data.row_count !== undefined) {
        rowCount = String(statsAny.data.row_count);
      } else if (statsAny.data.value !== undefined) {
        rowCount = String(statsAny.data.value);
      }
    }

    if (rowCount === "0" && statsAny.stats !== undefined) {
      rowCount = String(statsAny.stats);
    }

    if (rowCount === "0" && statsAny.row_count !== undefined) {
      rowCount = String(statsAny.row_count);
    }

    return {
      enabled: true,
      collectionName,
      totalVectors: parseInt(rowCount, 10) || 0,
      dimensions: config.dimensions,
    };
  } catch (error) {
    console.error("[Milvus] 获取统计信息失败:", error);
    return {
      enabled: config.enabled,
      collectionName: config.collection,
      totalVectors: 0,
      dimensions: config.dimensions,
    };
  }
}
