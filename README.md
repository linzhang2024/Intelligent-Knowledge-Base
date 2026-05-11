# Intelligent-Knowledge-Base

智能知识库系统 - 基于 Next.js 14 + RAG + AI 的企业级文档管理平台

## 项目简介

智能知识库系统是一个基于 Next.js 14 开发的企业级文档管理平台，支持文档上传、知识库管理、权限控制、智能搜索、RAG 向量检索、自然语言转 SQL 等功能。

### 核心功能

- 🔐 用户认证与权限管理（多角色、审核机制）
- 📄 文档上传与管理（支持 PDF、DOCX、TXT、SQL 格式）
- 📚 知识库管理（私有/公开）
- 🔍 智能文档搜索（基于向量相似度）
- 🤖 RAG 检索增强生成（文档切片 + 向量化）
- 💬 AI 对话问答（基于文档内容）
- 🗄️ 数据库表管理（自然语言转 SQL）
- 📊 管理后台
- 🔒 软删除机制
- 🚀 **Milvus 向量数据库支持**（高性能向量搜索）
- 🔄 **数据迁移工具**（从关系型数据库迁移到 Milvus）
- ⚙️ **RAG 配置分离**（普通文档和 SQL 文档独立配置）

### 支持的 AI 提供商

| 提供商                 | Embedding 模型                                                           | LLM 模型                                                                               |
| ------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **OpenAI**          | text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002 | gpt-3.5-turbo, gpt-4, gpt-4o, gpt-4o-mini, gpt-4-turbo                               |
| **DeepSeek**        | deepseek-embedding                                                     | deepseek-chat, deepseek-reasoner, deepseek-coder, deepseek-v4-pro, deepseek-v4-flash |
| **DashScope (阿里云)** | text-embedding-v1, text-embedding-v2, text-embedding-v3                | qwen-turbo, qwen-plus, qwen-max, qwen-7b-chat, qwen-14b-chat, qwen2.5-72b-instruct   |

## 技术栈

- **前端**：Next.js 14, React 18, Tailwind CSS
- **后端**：Next.js API Routes
- **关系型数据库**：SQLite（开发环境）/ PostgreSQL（生产环境）/ MySQL / Oracle
- **向量数据库**：**Milvus**（高性能向量搜索，可选）
- **ORM**：Prisma
- **认证**：基于 Cookie 的认证机制
- **AI**：LangChain.js, OpenAI API, DashScope API, DeepSeek API
- **文档处理**：Mammoth (DOCX), unpdf (PDF), iconv-lite (编码转换)
- **向量存储 SDK**：@zilliz/milvus2-sdk-node

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn
- Docker 和 Docker Compose（可选，用于运行 PostgreSQL）
- 或者 SQLite（轻量级替代方案，无需 Docker）

### 安装依赖

```bash
npm install
```

### 数据库配置

#### 方案一：使用 SQLite（推荐，无需 Docker）

1. 复制环境变量模板：

```bash
cp .env.example .env
```

1. 编辑 `.env` 文件，确保使用 SQLite 配置：

```env
DATABASE_URL="file:./dev.db"
```

#### 方案二：使用 Docker Compose + PostgreSQL

1. 复制环境变量模板：

```bash
cp .env.example .env
```

1. 启动 PostgreSQL 服务：

```bash
docker-compose up -d
```

1. 检查数据库状态：

```bash
docker-compose ps
```

### 数据库迁移

配置好数据库连接后，执行以下命令创建数据库表：

```bash
npx prisma migrate dev
```

如果是首次运行，会提示输入迁移名称，可以输入 `init`：

```bash
npx prisma migrate dev --name init
```

### 数据库配置管理

系统支持在管理后台中配置数据库连接，支持 **SQLite、PostgreSQL、MySQL** 和 **Oracle** 四种数据库类型。

> ⚠️ **重要提示**：Prisma ORM 原生支持 SQLite、PostgreSQL 和 MySQL，但**不直接支持 Oracle**。Oracle 配置仅用于测试连接，实际使用需要额外配置。

#### 数据库类型对比

| 数据库类型          | Prisma 原生支持 | 推荐使用场景     | 默认端口 | 默认用户     | 默认数据库                        |
| -------------- | ----------- | ---------- | ---- | -------- | ---------------------------- |
| **SQLite**     | ✅ 是         | 开发环境、小型应用  | -    | -        | dev.db                       |
| **PostgreSQL** | ✅ 是         | 生产环境、企业级   | 5432 | postgres | intelligent\_knowledge\_base |
| **MySQL**      | ✅ 是         | 生产环境、Web应用 | 3306 | root     | intelligent\_knowledge\_base |
| **Oracle**     | ❌ 否         | 企业级遗留系统    | 1521 | system   | ORCL                         |

#### 方式一：环境变量配置（初始配置）

编辑 `.env` 文件，设置数据库连接：

**SQLite 配置**：

```env
DATABASE_URL="file:./dev.db"
```

**PostgreSQL 配置**：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/intelligent_knowledge_base"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="intelligent_knowledge_base"
DB_PORT="5432"
DB_HOST="localhost"
```

**MySQL 配置**：

```env
DATABASE_URL="mysql://root:password@localhost:3306/intelligent_knowledge_base"
DB_USER="root"
DB_PASSWORD="your_password"
DB_NAME="intelligent_knowledge_base"
DB_PORT="3306"
DB_HOST="localhost"
```

**Oracle 配置**（仅用于测试连接）：

```env
DATABASE_URL="oracle:thin:system/password@localhost:1521:ORCL"
DB_USER="system"
DB_PASSWORD="your_password"
DB_PORT="1521"
DB_HOST="localhost"
DB_SID="ORCL"
# 或使用服务名
DB_SERVICE_NAME="ORCL"
```

#### 方式二：管理后台配置（运行时切换）

1. 启动应用并以管理员身份登录
2. 进入「管理后台」→「系统设置」→「数据库配置」
3. 选择数据库类型并填写相应配置：

**通用配置项**：

- **主机地址**：数据库服务器地址（默认：localhost）
- **端口**：数据库端口
- **用户名**：数据库用户名
- **密码**：数据库密码
- **数据库名**：数据库名称

**Oracle 特有配置项**：

- **SID**：数据库实例名（如 ORCL、XE）
- **Service Name**：服务名（可选，用于 Oracle 12c+）

> **重要提示**：修改数据库配置后需要重启服务才能生效。配置会保存到 `.env` 文件中。

#### 数据库连接测试

在管理后台的数据库配置页面，可以点击「测试连接」按钮验证配置是否正确：

- **SQLite**：检查数据库文件是否存在或可创建
- **PostgreSQL**：尝试建立实际连接并执行 `SELECT 1`
- **MySQL**：尝试建立实际连接并执行 `SELECT 1`
  - 需要先安装 `mysql2` 驱动：`npm install mysql2`
- **Oracle**：尝试建立实际连接并执行 `SELECT 1 FROM DUAL`
  - 需要先安装 `oracledb` 驱动：`npm install oracledb`
  - 需要安装 Oracle Instant Client

#### 切换数据库类型

如果需要切换数据库类型，请按照以下步骤操作：

1. 在管理后台配置新的数据库连接
2. 点击「测试连接」确保连接正常
3. 点击「保存数据库配置」
4. **重启应用服务**以应用新配置
5. 在新数据库上执行迁移：
   ```bash
   npx prisma migrate dev --name init
   ```

> ⚠️ 注意：切换数据库不会自动迁移数据。需要手动导出旧数据库数据并导入新数据库。

### 数据存储架构

系统采用**分层存储架构**，同时支持**关系型数据库**和**向量数据库**，两者分工明确，协同工作。

#### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              智能知识库系统                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          应用层                                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │   │
│  │  │ 用户管理  │  │ 知识库管理│  │ 文档管理  │  │   向量搜索/RAG    │   │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────────┬────────┘   │   │
│  └───────┼──────────────┼──────────────┼───────────────────┼───────────┘   │
│          │              │              │                   │               │
│          └──────────────┴──────────────┴───────────────────┘               │
│                                          │                                   │
│                                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       数据访问层 (Prisma ORM)                        │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  关系型数据库操作  │  向量存储工厂 (vectorStore)              │   │   │
│  │  └───────────────────┴──────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                          │                                   │
│                    ┌─────────────────────┴─────────────────────┐           │
│                    ▼                                           ▼           │
│  ┌─────────────────────────────┐         ┌─────────────────────────────┐ │
│  │      关系型数据库            │         │      向量数据库 (可选)       │ │
│  │  (SQLite/PostgreSQL/MySQL/  │         │         (Milvus)             │ │
│  │   Oracle)                   │         │                               │ │
│  │                             │         │  ┌─────────────────────────┐ │ │
│  │  存储所有业务数据            │         │  │  Collection:             │ │ │
│  │  + 用户、角色、权限          │         │  │  document_chunks        │ │ │
│  │  + 知识库元数据              │         │  │                         │ │ │
│  │  + 文档元数据                │         │  │  仅存储:                 │ │ │
│  │  + 文档分块内容              │         │  │  - 向量数据 (embedding) │ │ │
│  │  + 向量数据副本 (JSON 格式) │         │  │  - 关联元数据           │ │ │
│  │  + 系统配置                  │         │  │  - 文本内容冗余          │ │ │
│  │  + SQL 查询历史              │         │  └─────────────────────────┘ │ │
│  │  + 数据库表元数据            │         │                               │ │
│  └─────────────────────────────┘         └─────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### 数据存储分工详解

| 数据类型         | 存储位置           | 说明                                           |
| ------------ | -------------- | -------------------------------------------- |
| **用户数据**     | 关系型数据库         | 用户表、角色、权限、认证信息                               |
| **知识库元数据**   | 关系型数据库         | 知识库名称、描述、可见性、所有者                             |
| **文档元数据**    | 关系型数据库         | 文档标题、文件类型、大小、状态、作者                           |
| **文档分块内容**   | 关系型数据库         | 分块后的文本内容（用于 RAG 上下文）                         |
| **向量数据副本**   | 关系型数据库         | `document_chunks.embedding` 字段，JSON 格式       |
| **向量数据索引**   | 向量数据库 (Milvus) | `embedding` 字段，FloatVector 类型，带索引            |
| **向量关联元数据**  | 向量数据库 (Milvus) | document\_id, knowledge\_base\_id, content 等 |
| **系统配置**     | 关系型数据库         | AI 配置、RAG 配置、Milvus 配置等                      |
| **SQL 查询历史** | 关系型数据库         | 自然语言转 SQL 的查询记录                              |
| **数据库表元数据**  | 关系型数据库         | 表结构、列信息、表关系                                  |

#### 关系型数据库表结构

系统使用 Prisma ORM 管理关系型数据库，包含以下核心表：

| 表名                   | 主要字段                                                                     | 说明         |
| -------------------- | ------------------------------------------------------------------------ | ---------- |
| **users**            | id, email, password, name, role, status                                  | 用户表        |
| **knowledge\_bases** | id, name, description, visibility, ownerId                               | 知识库表       |
| **documents**        | id, title, content, fileUrl, fileType, status, authorId, knowledgeBaseId | 文档表        |
| **document\_chunks** | id, documentId, index, content, **embedding** (JSON), embeddingModel     | 文档分块表      |
| **system\_configs**  | configKey, configValue, description                                      | 系统配置表      |
| **database\_tables** | name, schemaName, tableComment, knowledgeBaseId                          | 数据库表元数据    |
| **table\_columns**   | tableId, name, dataType, isNullable, isPrimaryKey                        | 表列信息       |
| **table\_relations** | fromTableId, fromColumnName, toTableId, toColumnName                     | 表关系        |
| **sql\_queries**     | query, queryType, description, tables, columns                           | 保存的 SQL 查询 |
| **query\_history**   | userQuery, generatedSQL, executionResult, isSuccess                      | 查询历史       |

#### 向量数据库集合结构

当 Milvus 启用时，系统会自动创建 `document_chunks` 集合：

| 字段名                     | 数据类型           | 说明                    |
| ----------------------- | -------------- | --------------------- |
| **id**                  | VarChar(64)    | 主键，使用 chunk\_id       |
| **chunk\_id**           | VarChar(64)    | 文档切片 ID（对应关系型数据库的 id） |
| **document\_id**        | VarChar(64)    | 所属文档 ID               |
| **knowledge\_base\_id** | VarChar(64)    | 所属知识库 ID              |
| **content**             | VarChar(65535) | 切片文本内容（冗余存储，用于快速检索）   |
| **embedding**           | FloatVector    | 向量数据（维度由配置决定）         |
| **model**               | VarChar(256)   | 使用的 Embedding 模型      |

**索引配置**：

- **索引类型**：IVF\_FLAT
- **度量类型**：COSINE（余弦相似度）
- **参数**：nlist = 1024

#### 双后端向量存储机制

系统采用**双后端向量存储架构**，确保数据安全和灵活切换：

```
┌────────────────────────────────────────────────────────────────────────┐
│                         向量写入流程 (双写)                               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   文档上传 / 重新解析                                                   │
│            │                                                           │
│            ▼                                                           │
│   ┌─────────────────┐                                                  │
│   │  生成 Embedding  │                                                  │
│   │  (向量数据)       │                                                  │
│   └────────┬────────┘                                                  │
│            │                                                           │
│    ┌───────┴────────┐                                                  │
│    ▼                ▼                                                  │
│  ┌─────────┐    ┌──────────────────────────────────────────┐          │
│  │关系型数据库│    │      Milvus 向量数据库 (如果已启用)      │          │
│  │         │    │                                          │          │
│  │- 序列化   │    │- 原生 FloatVector 类型                │          │
│  │  为 JSON  │    │- 专用向量索引 (IVF_FLAT)              │          │
│  │  字符串   │    │- 高性能相似度搜索                       │          │
│  │- 存储到    │    │                                          │          │
│  │  embedding │    │                                          │          │
│  │  字段      │    │                                          │          │
│  └─────────┘    └──────────────────────────────────────────┘          │
│                                                                        │
│   ✅ 确保数据一致性和安全性                                             │
│   ✅ 可随时切换向量存储后端                                             │
│   ✅ 无需担心数据丢失                                                   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**写入机制**：

1. **双写策略**：新上传的文档向量会同时写入：
   - 关系型数据库的 `document_chunks.embedding` 字段（JSON 格式）
   - Milvus 的 `document_chunks` 集合（如果 Milvus 已启用）
2. **数据一致性**：
   - 关系型数据库中的向量数据**始终保留**
   - Milvus 中的向量数据是**副本**，用于高性能搜索
   - 可随时在两种后端之间切换

```
┌────────────────────────────────────────────────────────────────────────┐
│                         向量搜索流程 (自动切换)                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   用户查询                                                              │
│      │                                                                 │
│      ▼                                                                 │
│   ┌────────────────────────────────────────────────────────────────┐  │
│   │              向量存储工厂 (vectorStore)                         │  │
│   │                                                                │  │
│   │   检查 milvus.enabled 配置                                      │  │
│   │            │                                                    │  │
│   │     ┌──────┴──────┐                                             │  │
│   │     ▼             ▼                                             │  │
│   │ ┌────────┐   ┌──────────────────────────────────────────────┐  │  │
│   │ │ Milvus │   │           关系型数据库                        │  │  │
│   │ │ 已启用 │   │                                              │  │  │
│   │ └───┬────┘   │                                              │  │  │
│   │     │        │                                              │  │  │
│   │     ▼        │                                              │  │  │
│   │ ┌─────────┐  │  ┌────────────────────────────────────────┐  │  │  │
│   │ │ Milvus  │  │  │  1. 查询所有非空 embedding 的分块       │  │  │  │
│   │ │ 专用索引 │  │  │  2. 反序列化 JSON 向量数据              │  │  │  │
│   │ │ 搜索     │  │  │  3. 内存计算余弦相似度                 │  │  │  │
│   │ │          │  │  │  4. 按相似度排序并返回结果              │  │  │  │
│   │ │ 高性能   │  │  │                                        │  │  │  │
│   │ │ 适合     │  │  │  ✅ 简单，无需额外部署                │  │  │  │
│   │ │ 大规模   │  │  │  ⚠️  数据量 > 10K 时性能下降         │  │  │  │
│   │ │ 数据     │  │  │                                        │  │  │  │
│   │ └─────────┘  │  └────────────────────────────────────────┘  │  │  │
│   │              │                                              │  │  │
│   │              └──────────────────────────────────────────────┘  │  │
│   │                                                                │  │
│   └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**搜索机制**：

1. **自动切换**：根据 `milvus.enabled` 配置自动选择搜索后端
2. **Milvus 启用时**：
   - 使用 Milvus 专用向量索引进行搜索
   - 高性能，适合大规模数据（> 10K 向量）
3. **Milvus 未启用时**：
   - 从关系型数据库读取向量数据（JSON 格式）
   - 反序列化后在内存中计算余弦相似度
   - 适合小规模数据（< 10K 向量）

#### 数据迁移流程

系统提供完整的数据迁移工具，支持从关系型数据库迁移向量数据到 Milvus：

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           数据迁移流程                                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   关系型数据库 (document_chunks 表)                                     │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │  embedding 字段 (JSON 格式的向量字符串)                         │   │
│   │  例: "[0.123, 0.456, 0.789, ...]"                            │   │
│   └─────────────────────────────┬──────────────────────────────────┘   │
│                                 │                                        │
│                                 ▼                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                      迁移处理过程                                │   │
│   │                                                                │   │
│   │  1. 统计数据：统计 document_chunks 表中非空 embedding 的数量   │   │
│   │                                                                │   │
│   │  2. 批量读取：每次读取 100 条记录 (分页)                       │   │
│   │                                                                │   │
│   │  3. 反序列化：JSON.parse(embedding) → number[]                │   │
│   │                                                                │   │
│   │  4. 批量插入：插入 Milvus 的 document_chunks 集合              │   │
│   │                                                                │   │
│   │  5. 更新进度：更新 migrationStatus (processed/errors)         │   │
│   │                                                                │   │
│   └─────────────────────────────┬──────────────────────────────────┘   │
│                                 │                                        │
│                                 ▼                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                    Milvus 向量数据库                            │   │
│   │                                                                │   │
│   │  Collection: document_chunks                                   │   │
│   │  ┌──────────────────────────────────────────────────────────┐  │   │
│   │  │  embedding 字段 (FloatVector 类型)                        │  │   │
│   │  │  + 专用向量索引 (IVF_FLAT)                                │  │   │
│   │  │  + 高性能相似度搜索                                        │  │   │
│   │  │  + 支持大规模数据                                          │  │   │
│   │  └──────────────────────────────────────────────────────────┘  │   │
│   │                                                                │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ✅ 幂等性：可多次执行，已存在的向量会被覆盖 (chunk_id 作为主键)       │
│   ✅ 错误处理：单个向量迁移失败不影响其他向量，错误会被记录              │
│   ✅ 向后兼容：关系型数据库中的向量数据不会被删除                       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

#### 数据安全保障

| 保障机制      | 说明                       |
| --------- | ------------------------ |
| **双写策略**  | 向量数据同时写入关系型数据库和 Milvus   |
| **主副本架构** | 关系型数据库是主存储，Milvus 是副本/索引 |
| **向后兼容**  | 可随时切换向量存储后端，无需数据转换       |
| **幂等迁移**  | 迁移工具可多次执行，不会重复或丢失数据      |
| **软删除**   | 删除操作不会物理删除数据，可恢复         |

### 向量数据库配置（Milvus）

> 📖 **详细配置指南**：关于 Milvus 的完整配置、管理和故障排除，请参考 [MILVUS\_SETUP.md](./MILVUS_SETUP.md)。

系统支持 **Milvus** 高性能向量数据库，用于存储和搜索文档向量。Milvus 是一个开源的向量数据库，专门为 AI 应用设计，支持：

- 高性能向量相似度搜索
- 大规模向量存储
- 多种索引类型（IVF\_FLAT、IVF\_PQ、HNSW 等）
- 动态字段支持

#### 向量存储架构

系统采用**双后端向量存储架构**：

```
┌─────────────────────────────────────────────────────────────────┐
│                        应用层                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │  文档上传    │    │  向量搜索    │    │    文档删除          │ │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘ │
└─────────┼───────────────────┼───────────────────────┼────────────┘
          │                   │                       │
          ▼                   ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    向量存储工厂 (vectorStoreFactory)              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  根据 milvus.enabled 配置自动选择后端                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │                   │
          ▼                   ▼
┌─────────────────┐    ┌─────────────────────────────────────────┐
│  关系型数据库    │    │           Milvus 向量数据库              │
│  (Database)     │    │                                         │
│                 │    │  ┌─────────────────────────────────┐   │
│  ┌───────────┐  │    │  │    Collection: document_chunks   │   │
│  │document_  │  │    │  │                                 │   │
│  │chunks     │  │    │  │  字段:                           │   │
│  │- id       │  │    │  │  • id (PK, VarChar)            │   │
│  │- documentId│ │    │  │  • chunk_id (VarChar)           │   │
│  │- index    │  │    │  │  • document_id (VarChar)        │   │
│  │- content  │  │    │  │  • knowledge_base_id (VarChar)  │   │
│  │- embedding│  │    │  │  • content (VarChar, 65535)    │   │
│  │  (JSON)   │  │    │  │  • embedding (FloatVector)      │   │
│  │- embedding│  │    │  │  • model (VarChar)              │   │
│  │  Model    │  │    │  │                                 │   │
│  └───────────┘  │    │  索引类型: IVF_FLAT (COSINE 相似度)  │   │
│                 │    │  └─────────────────────────────────┘   │
└─────────────────┘    └─────────────────────────────────────────┘
```

#### 向量后端对比

| 特性       | 关系型数据库（默认）                  | Milvus 向量数据库      |
| -------- | --------------------------- | ----------------- |
| **存储方式** | 向量以 JSON 存储在 `embedding` 字段 | 专用向量存储引擎          |
| **搜索方式** | 内存计算余弦相似度                   | 专用索引加速搜索          |
| **性能**   | 适合小规模数据（< 10K 向量）           | 适合大规模数据（> 10K 向量） |
| **扩展性**  | 受限于数据库查询性能                  | 支持分布式部署，水平扩展      |
| **配置要求** | 无需额外配置                      | 需要部署 Milvus 服务    |
| **适用场景** | 开发测试、小型应用                   | 生产环境、高性能搜索        |

#### 双后端特性

系统支持双后端同时工作：

1. **写入时双写**：新上传的文档向量会同时写入关系型数据库和 Milvus（如果 Milvus 已启用）
2. **搜索时自动切换**：根据 `milvus.enabled` 配置自动选择搜索后端
3. **向后兼容**：关系型数据库中的向量数据始终保留，可随时切换回原后端

#### 配置 Milvus

##### 快速开始

项目已提供完整的 Milvus Docker Compose 配置文件 `docker-compose-milvus.yml`。

**启动 Milvus 服务**：

```bash
docker-compose -f docker-compose-milvus.yml up -d
```

**服务组件**：

| 服务         | 容器名               | 端口          | 说明       |
| ---------- | ----------------- | ----------- | -------- |
| **Milvus** | milvus-standalone | 19530, 9091 | 向量数据库主服务 |
| **etcd**   | milvus-etcd       | 2379-2380   | 元数据存储    |
| **MinIO**  | milvus-minio      | 9000-9001   | 对象存储     |

> 📖 **详细配置**：关于 Milvus 的完整配置、管理命令、故障排除和高级设置，请参考 [MILVUS\_SETUP.md](./MILVUS_SETUP.md)。

##### 配置 Milvus 连接

有两种配置方式：

**方式一：管理后台配置（推荐）**

1. 启动应用并以管理员身份登录
2. 进入「管理后台」→「系统设置」→「Milvus 配置」
3. 填写以下配置：

| 配置项           | 说明                   | 默认值              |
| ------------- | -------------------- | ---------------- |
| **启用 Milvus** | 是否使用 Milvus 作为向量存储后端 | 关闭               |
| **主机地址**      | Milvus 服务器地址         | localhost        |
| **端口**        | Milvus 服务端口          | 19530            |
| **用户名**       | Milvus 认证用户名（可选）     | 空                |
| **密码**        | Milvus 认证密码（可选）      | 空                |
| **集合名称**      | 存储向量的集合名称            | document\_chunks |
| **向量维度**      | Embedding 模型输出的向量维度  | 1024             |

> ⚠️ **注意**：向量维度必须与实际使用的 Embedding 模型输出维度一致：
>
> - DashScope `text-embedding-v1/v2`: 1024 维
> - DashScope `text-embedding-v3`: 1024 维
> - OpenAI `text-embedding-3-small`: 1536 维（默认）
> - OpenAI `text-embedding-3-large`: 3072 维
> - OpenAI `text-embedding-ada-002`: 1536 维

**方式二：环境变量配置**

编辑 `.env` 文件（可选，管理后台配置优先级更高）：

```env
# Milvus 配置（可选）
MILVUS_ENABLED=false
MILVUS_HOST=localhost
MILVUS_PORT=19530
MILVUS_USERNAME=
MILVUS_PASSWORD=
MILVUS_COLLECTION=document_chunks
MILVUS_DIMENSIONS=1024
```

#### Milvus 配置流程

1. **测试连接**：点击「测试连接」按钮验证 Milvus 服务是否可访问
2. **初始化集合**：点击「初始化集合」创建必要的集合和索引
   - 会自动创建 `document_chunks` 集合
   - 会自动创建 `embedding` 字段的 IVF\_FLAT 索引（余弦相似度）
   - 会自动加载集合到内存
3. **启用 Milvus**：开启「启用 Milvus」开关并保存
4. **数据迁移**：如果有历史数据，点击「开始迁移」将向量从关系型数据库迁移到 Milvus

#### 数据迁移

系统提供完整的数据迁移工具，支持从关系型数据库迁移向量数据到 Milvus。

##### 迁移流程

```
┌──────────────────────────────────────────────────────────────────────┐
│                           数据迁移流程                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐   │
│  │  1. 统计数据  │────▶│  2. 批量读取  │────▶│  3. 反序列化向量 │   │
│  │  (统计已有   │     │  (从 document │     │  (JSON → number[]) │   │
│  │   向量数量)  │     │   _chunks 表) │     │                  │   │
│  └──────────────┘     └──────────────┘     └──────────────────┘   │
│                                                        │             │
│                                                        ▼             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐   │
│  │  6. 迁移完成  │◀────│  5. 更新进度  │◀────│  4. 插入 Milvus │   │
│  │  (显示统计   │     │  (processed  │     │  (批量插入向量)   │   │
│  │   信息)     │     │   / errors)   │     │                  │   │
│  └──────────────┘     └──────────────┘     └──────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

##### 迁移操作

**方式一：管理后台迁移（推荐）**

1. 进入「管理后台」→「系统设置」→「Milvus 配置」
2. 在「数据迁移」区域：
   - 查看当前 Milvus 状态和向量数量
   - 查看迁移进度（如果正在迁移）
3. 点击「开始迁移」按钮启动迁移

迁移状态显示：

- **状态**：运行中 / 已停止
- **进度**：已处理 / 总数
- **错误**：迁移失败的数量
- **进度条**：可视化展示迁移进度

**方式二：API 调用**

```bash
# 启动全量迁移
curl -X POST http://localhost:3005/api/admin/milvus-migrate \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'

# 获取迁移状态
curl http://localhost:3005/api/admin/milvus-migrate

# 迁移单个文档
curl -X POST http://localhost:3005/api/admin/milvus-migrate \
  -H "Content-Type: application/json" \
  -d '{"action": "migrateDocument", "documentId": "doc-xxx"}'
```

##### 迁移说明

- **批量处理**：每次处理 100 个向量，减少内存占用
- **错误处理**：单个向量迁移失败不影响其他向量，错误会被记录
- **幂等性**：可多次执行迁移，已存在的向量会被覆盖（使用 chunk\_id 作为主键）
- **向后兼容**：关系型数据库中的向量数据不会被删除

#### Milvus 集合结构

系统自动创建的 `document_chunks` 集合结构：

| 字段名                     | 数据类型           | 说明               |
| ----------------------- | -------------- | ---------------- |
| **id**                  | VarChar(64)    | 主键，使用 chunk\_id  |
| **chunk\_id**           | VarChar(64)    | 文档切片 ID          |
| **document\_id**        | VarChar(64)    | 所属文档 ID          |
| **knowledge\_base\_id** | VarChar(64)    | 所属知识库 ID         |
| **content**             | VarChar(65535) | 切片文本内容           |
| **embedding**           | FloatVector    | 向量数据（维度由配置决定）    |
| **model**               | VarChar(256)   | 使用的 Embedding 模型 |

**索引配置**：

- **索引类型**：IVF\_FLAT
- **度量类型**：COSINE（余弦相似度）
- **参数**：nlist = 1024

#### RAG 配置分离

系统支持**普通文档**和 **SQL 文档**的分块参数独立配置。

##### 配置项说明

| 配置项                             | 普通文档默认值 | SQL 文档默认值 | 说明           |
| ------------------------------- | ------- | --------- | ------------ |
| **文本分片大小** (chunkSize)          | 500 字符  | 4000 字符   | 每个文本片段的目标大小  |
| **分片重叠大小** (chunkOverlap)       | 50 字符   | 0 字符      | 相邻片段之间的重叠字符数 |
| **最大单块大小** (maxSingleChunkSize) | 2000 字符 | 8000 字符   | 单个片段的最大限制    |

##### SQL 文档特殊处理

SQL 文档使用不同的分块策略：

1. **按 CREATE 语句边界分割**：
   - 匹配 `CREATE TABLE`、`CREATE OR REPLACE FUNCTION` 等语句
   - 每个 DDL 语句作为独立片段
   - 保持语句完整性
2. **推荐配置**：
   - 较大的分片大小（4000 字符）
   - 零重叠（避免语句重复）
   - 较大的最大单块限制（8000 字符）

##### 配置方式

进入「管理后台」→「系统设置」→「RAG 配置」：

- **普通文档**：适用于 PDF、DOCX、TXT 等普通文档
- **SQL 文档**：适用于 `.sql` 脚本文件

> **提示**：修改配置后，新上传的文档会使用新配置。已上传的文档需要「重新解析」才能应用新配置。

### AI 配置

配置 AI 提供商以启用 RAG 和智能搜索功能。有两种配置方式：

#### 方式一：环境变量配置（推荐用于开发）

编辑 `.env` 文件：

```env
DASHSCOPE_API_KEY=your-dashscope-api-key
EMBEDDING_MODEL=text-embedding-v2
LLM_MODEL=qwen-plus
LLM_TEMPERATURE=0.7
```

#### 方式二：管理后台配置

1. 启动应用后登录系统
2. 进入「管理后台」→「系统设置」→「AI 配置」
3. 配置以下参数：
   - **Embedding 配置**：提供商、API Key、Base URL、模型名称
   - **LLM 配置**：提供商、API Key、Base URL、模型名称、温度参数

> 敏感信息（API Key）会加密存储在数据库中。

### 启动开发服务器

```bash
npm run dev
```

访问 <http://localhost:3005> 查看应用（默认端口已改为 3005）。

## 项目结构

```
├── prisma/                 # 数据库相关
│   ├── schema.prisma       # 数据库模型定义
│   └── dev.db              # SQLite 数据库文件
├── scripts/                # 脚本文件
│   └── check-port.js       # 端口占用检查脚本
├── src/                    # 源代码
│   ├── app/                # Next.js 应用
│   │   ├── api/            # API 路由
│   │   │   ├── admin/      # 管理后台 API
│   │   │   │   ├── ai-config/      # AI 配置
│   │   │   │   ├── documents/      # 文档管理
│   │   │   │   ├── knowledge-bases/ # 知识库管理
│   │   │   │   ├── stats/          # 统计数据
│   │   │   │   └── users/          # 用户管理
│   │   │   ├── auth/       # 认证相关
│   │   │   ├── documents/  # 文档相关（上传、切片、检索）
│   │   │   ├── qa/         # 问答相关
│   │   │   │   ├── chat/   # AI 对话
│   │   │   │   ├── search/ # 向量搜索
│   │   │   │   └── sql/    # SQL 生成
│   │   │   ├── test/       # 测试接口
│   │   │   └── uploads/    # 文件访问
│   │   ├── admin/          # 管理后台页面
│   │   │   ├── documents/  # 文档管理
│   │   │   ├── knowledge-bases/ # 知识库管理
│   │   │   ├── settings/   # 系统设置
│   │   │   └── users/      # 用户管理
│   │   ├── dashboard/      # 仪表盘
│   │   ├── documents/      # 文档页面
│   │   │   ├── upload/     # 文档上传
│   │   │   └── [id]/       # 文档详情
│   │   ├── login/          # 登录页面
│   │   ├── globals.css     # 全局样式
│   │   ├── layout.tsx      # 布局组件
│   │   └── page.tsx        # 首页
│   ├── lib/                # 工具库
│   │   ├── aiConfig.ts     # AI 配置管理
│   │   ├── auth.ts         # 认证工具
│   │   ├── embedding.ts    # 向量化工具
│   │   ├── llm.ts          # LLM 调用工具
│   │   ├── prisma.ts       # Prisma 客户端
│   │   ├── sqlContext.ts   # SQL 上下文管理
│   │   ├── sqlRAG.ts       # SQL RAG 工具
│   │   ├── uploadProgress.ts # 上传进度管理
│   │   └── vectorStore.ts  # 向量存储工具
│   └── utils/              # 工具函数
│       └── crypto.ts       # 加密工具
├── test/                   # 测试文件
├── uploads/                # 上传文件存储（自动创建）
├── .env                    # 环境变量
├── .env.example            # 环境变量模板
├── docker-compose.yml      # Docker 配置
├── package.json            # 项目依赖
└── README.md               # 项目文档
```

## 页面结构

### 1. 登录页面 (`/login`)

- 用户登录界面
- 支持自动创建新用户（初始角色为 VIEWER，状态为 PENDING）
- 登录成功后跳转到仪表盘

### 2. 仪表盘 (`/dashboard`)

- 我的知识库列表
- 知识库导出功能
- 最近文档列表
- 上传文档入口
- 管理后台入口（仅 ADMIN 可见）

### 3. 文档上传 (`/documents/upload`)

- 文档基本信息填写
- 文件上传（支持 PDF、DOCX、TXT）
- 文件类型和大小验证
- 自动文本提取和切片
- 向量化处理（如已配置 AI）

### 4. 文档详情 (`/documents/[id]`)

- 文档内容展示
- 文档信息查看
- 切片数据展示
- 附件下载
- 操作记录

### 5. 管理后台

#### 5.1 系统概览 (`/admin`)

- 用户统计
- 文档统计
- 知识库统计
- 系统状态

#### 5.2 用户管理 (`/admin/users`)

- 用户列表
- 角色分配（ADMIN/EDITOR/VIEWER）
- 状态管理（PENDING/ACTIVE/DISABLED）
- 软删除用户

#### 5.3 文档管理 (`/admin/documents`)

- 全量文档列表
- 状态管理（DRAFT/PUBLISHED/ARCHIVED）
- 文档预览
- 文档编辑
- 文档删除（硬删除）
- 重新解析文档

#### 5.4 知识库管理 (`/admin/knowledge-bases`)

- 知识库列表
- 知识库详情
- 关联文档管理
- 数据库表管理

#### 5.5 系统设置 (`/admin/settings`)

系统设置页面包含三个标签页，提供完整的系统配置能力：

##### 标签页 1：基本设置

- **存储设置**：上传文件存储位置配置
- **安全设置**：会话过期时间、密码策略等
- **数据库配置**：数据库连接配置（支持 SQLite/PostgreSQL/MySQL/Oracle）
  - 测试数据库连接
  - 保存数据库配置（需重启服务生效）
- **向量存储后端**：显示当前使用的向量存储后端（关系型数据库 / Milvus）

##### 标签页 2：RAG 配置

支持**普通文档**和 **SQL 文档**的分块参数独立配置：

**普通文档配置**（适用于 PDF、DOCX、TXT）：

- 文本分片大小 (chunkSize)：默认 500 字符
- 分片重叠大小 (chunkOverlap)：默认 50 字符
- 最大单块大小 (maxSingleChunkSize)：默认 2000 字符

**SQL 文档配置**（适用于 `.sql` 文件）：

- 文本分片大小 (chunkSize)：默认 4000 字符
- 分片重叠大小 (chunkOverlap)：默认 0 字符
- 最大单块大小 (maxSingleChunkSize)：默认 8000 字符

> SQL 文档使用特殊的分块策略：按 `CREATE` 语句边界分割，保持 DDL 语句完整性。

##### 标签页 3：Milvus 配置

**Milvus 连接配置**：

- 启用 Milvus：开关控制是否使用 Milvus 作为向量存储后端
- 主机地址：Milvus 服务器地址（默认：localhost）
- 端口：Milvus 服务端口（默认：19530）
- 用户名：Milvus 认证用户名（可选）
- 密码：Milvus 认证密码（可选）
- 集合名称：存储向量的集合名称（默认：document\_chunks）
- 向量维度：Embedding 模型输出的向量维度（默认：1024）

**操作按钮**：

- **测试连接**：验证 Milvus 服务是否可访问
- **初始化集合**：创建集合和索引（IVF\_FLAT，余弦相似度）
- **保存配置**：保存所有配置

**数据迁移区域**：

- **Milvus 状态**：显示是否启用、集合名称、向量总数、维度
- **迁移状态**：显示是否运行中、进度、错误数量
- **进度条**：可视化展示迁移进度
- **开始迁移**：启动全量数据迁移（从关系型数据库到 Milvus）

> ⚠️ **重要提示**：向量维度必须与实际使用的 Embedding 模型输出维度一致。例如：
>
> - DashScope `text-embedding-v2`: 1024 维
> - OpenAI `text-embedding-3-small`: 1536 维

#### 5.6 AI 配置

AI 配置已整合到系统设置的基本设置中，包括：

**Embedding 配置**：

- 提供商：OpenAI / DeepSeek / DashScope
- API Key：加密存储
- Base URL：可选（用于兼容 OpenAI 接口的第三方服务）
- 模型名称：如 `text-embedding-v2`、`text-embedding-3-small` 等

**LLM 配置**：

- 提供商：OpenAI / DeepSeek / DashScope
- API Key：加密存储
- Base URL：可选
- 模型名称：如 `qwen-plus`、`gpt-3.5-turbo` 等
- 温度参数：控制回答的随机性（0-1）

> 敏感信息（API Key）会使用 `crypto.ts` 中的加密函数加密后存储在数据库的 `system_config` 表中。

## 核心功能说明

### RAG 检索增强生成

系统支持基于文档内容的智能问答：

1. **文档处理流程**：
   ```
   上传文件 → 文本提取 → 文档切片 → 向量化 → 存储向量
   ```
2. **检索流程**：
   ```
   用户问题 → 问题向量化 → 相似度搜索 → 相关文档切片 → 构建 Prompt → LLM 回答
   ```
3. **API 端点**：
   - `POST /api/documents/upload` - 上传并处理文档
   - `POST /api/qa/search` - 向量相似度搜索
   - `POST /api/qa/chat` - 基于文档的 AI 对话

### 自然语言转 SQL (Text-to-SQL)

系统支持通过自然语言查询数据库表：

1. **数据库表管理**：
   - 支持关联知识库
   - 自动识别表结构
   - 管理表关系
2. **查询流程**：
   ```
   自然语言问题 → 识别相关表 → 获取表结构 → 构建 Prompt → LLM 生成 SQL → 执行查询 → 返回结果
   ```
3. **API 端点**：
   - `POST /api/qa/sql` - 自然语言转 SQL

### 用户角色与权限

| 角色         | 说明  | 权限                 |
| ---------- | --- | ------------------ |
| **ADMIN**  | 管理员 | 所有权限 + 用户管理 + 系统设置 |
| **EDITOR** | 编辑者 | 上传文档、编辑文档、创建知识库    |
| **VIEWER** | 查看者 | 查看文档、搜索文档          |

### 用户状态

| 状态           | 说明  | <br />            |
| ------------ | --- | ----------------- |
| **PENDING**  | 待审核 | 新注册用户，默认状态，需管理员审核 |
| **ACTIVE**   | 正常  | 已激活用户，可正常使用       |
| **DISABLED** | 禁用  | 被禁用用户，无法登录        |

### 软删除机制

系统采用软删除策略保护数据：

- **User 表**：使用 `deletedAt` 字段标记删除
- **Document 表**：查询时过滤 `deletedAt: null`
- 注意：当前文档删除 API 实际执行硬删除（与用户删除策略不一致）

## 数据库模型

### User（用户）

| 字段        | 类型        | 说明                                     |
| --------- | --------- | -------------------------------------- |
| id        | String    | 唯一标识符                                  |
| email     | String    | 邮箱（唯一）                                 |
| password  | String    | 密码                                     |
| name      | String?   | 姓名（可选）                                 |
| role      | String    | 角色（VIEWER/EDITOR/ADMIN），默认 VIEWER      |
| status    | String    | 状态（PENDING/ACTIVE/DISABLED），默认 PENDING |
| avatar    | String?   | 头像（可选）                                 |
| profile   | String?   | 个人简介（可选）                               |
| createdAt | DateTime  | 创建时间                                   |
| updatedAt | DateTime  | 更新时间                                   |
| deletedAt | DateTime? | 删除时间（软删除标记）                            |

### KnowledgeBase（知识库）

| 字段          | 类型       | 说明                             |
| ----------- | -------- | ------------------------------ |
| id          | String   | 唯一标识符                          |
| name        | String   | 名称                             |
| description | String?  | 描述（可选）                         |
| visibility  | String   | 可见性（PRIVATE/PUBLIC），默认 PRIVATE |
| ownerId     | String   | 所有者ID                          |
| createdAt   | DateTime | 创建时间                           |
| updatedAt   | DateTime | 更新时间                           |

### Document（文档）

| 字段              | 类型        | 说明                                    |
| --------------- | --------- | ------------------------------------- |
| id              | String    | 唯一标识符                                 |
| title           | String    | 标题                                    |
| content         | String?   | 提取的文本内容（可选）                           |
| fileUrl         | String?   | 文件路径（可选）                              |
| fileType        | String?   | 文件类型（可选）                              |
| fileSize        | BigInt?   | 文件大小（可选）                              |
| status          | String    | 状态（DRAFT/PUBLISHED/ARCHIVED），默认 DRAFT |
| authorId        | String?   | 作者ID（可选）                              |
| knowledgeBaseId | String?   | 知识库ID（可选）                             |
| vectorId        | String?   | 向量存储ID（可选）                            |
| createdAt       | DateTime  | 创建时间                                  |
| updatedAt       | DateTime  | 更新时间                                  |
| deletedAt       | DateTime? | 删除时间（软删除标记）                           |

### DocumentChunk（文档切片）

| 字段             | 类型       | 说明           |
| -------------- | -------- | ------------ |
| id             | String   | 唯一标识符        |
| documentId     | String   | 所属文档ID       |
| index          | Int      | 切片索引         |
| content        | String   | 切片内容         |
| vectorId       | String?  | 向量存储ID（可选）   |
| embedding      | String?  | 向量数据（序列化，可选） |
| embeddingModel | String?  | 使用的向量化模型（可选） |
| createdAt      | DateTime | 创建时间         |
| updatedAt      | DateTime | 更新时间         |

### DatabaseTable（数据库表）

用于 Text-to-SQL 功能的表元数据管理。

### TableColumn（表字段）

### TableRelation（表关系）

### SQLQuery（SQL 查询记录）

### QueryHistory（查询历史）

### SystemConfig（系统配置）

用于存储 AI 配置等系统设置，敏感数据加密存储。

## API 路由

### 认证相关

| 方法   | 路径                   | 说明   |
| ---- | -------------------- | ---- |
| POST | `/api/auth/login`    | 用户登录 |
| POST | `/api/auth/logout`   | 用户登出 |
| POST | `/api/auth/register` | 用户注册 |

### 文档相关

| 方法   | 路径                              | 说明           |
| ---- | ------------------------------- | ------------ |
| GET  | `/api/documents`                | 获取文档列表（公开文档） |
| POST | `/api/documents/upload`         | 上传文档         |
| POST | `/api/documents/chunk/complete` | 完成文档切片处理     |
| GET  | `/api/uploads/[filename]`       | 访问上传的文件      |

### 管理后台 API

| 方法               | 路径                                  | 说明                             |
| ---------------- | ----------------------------------- | ------------------------------ |
| GET/POST         | `/api/admin/ai-config`              | 获取/保存 AI 配置                    |
| GET/PUT/POST     | `/api/admin/milvus-config`          | 获取/保存 Milvus 配置 / 测试连接 / 初始化集合 |
| GET/POST         | `/api/admin/milvus-migrate`         | 获取迁移状态 / 启动迁移 / 单文档迁移          |
| GET/PUT/POST     | `/api/admin/rag-config`             | 获取/保存 RAG 配置                   |
| GET/DELETE       | `/api/admin/documents`              | 获取文档列表/批量删除                    |
| GET/PATCH/DELETE | `/api/admin/documents/[id]`         | 获取/更新/删除单个文档                   |
| POST             | `/api/admin/documents/[id]/reparse` | 重新解析文档                         |
| GET/POST         | `/api/admin/knowledge-bases`        | 获取/创建知识库                       |
| GET/PATCH/DELETE | `/api/admin/knowledge-bases/[id]`   | 获取/更新/删除知识库                    |
| GET              | `/api/admin/stats`                  | 获取系统统计                         |
| GET              | `/api/admin/users`                  | 获取用户列表                         |
| PATCH/DELETE     | `/api/admin/users/[id]`             | 更新/删除用户                        |

#### Milvus 配置 API 详情

**GET /api/admin/milvus-config**

获取当前 Milvus 配置和统计信息：

```json
{
  "config": {
    "enabled": false,
    "host": "localhost",
    "port": 19530,
    "username": "",
    "password": "",
    "collection": "document_chunks",
    "dimensions": 1024
  },
  "stats": {
    "enabled": false,
    "collectionName": "document_chunks",
    "totalVectors": 0,
    "dimensions": 1024
  },
  "defaultConfig": { ... }
}
```

**PUT /api/admin/milvus-config**

保存 Milvus 配置：

```json
{
  "enabled": true,
  "host": "localhost",
  "port": 19530,
  "username": "",
  "password": "",
  "collection": "document_chunks",
  "dimensions": 1024
}
```

**POST /api/admin/milvus-config**

执行操作：

```json
// 测试连接
{
  "action": "test",
  "host": "localhost",
  "port": 19530,
  ...
}

// 初始化集合
{
  "action": "initCollection"
}
```

#### 数据迁移 API 详情

**GET /api/admin/milvus-migrate**

获取迁移状态：

```json
{
  "enabled": true,
  "milvusStats": {
    "enabled": true,
    "collectionName": "document_chunks",
    "totalVectors": 1500,
    "dimensions": 1024
  },
  "migrationStatus": {
    "isRunning": false,
    "total": 2000,
    "processed": 1500,
    "errors": 5,
    "startTime": "2026-05-05T10:00:00Z",
    "endTime": "2026-05-05T10:15:00Z"
  }
}
```

**POST /api/admin/milvus-migrate**

执行迁移操作：

```json
// 启动全量迁移
{
  "action": "start"
}

// 迁移单个文档
{
  "action": "migrateDocument",
  "documentId": "doc-xxx"
}

// 清除文档向量
{
  "action": "clearDocument",
  "documentId": "doc-xxx"
}
```

### 问答与搜索 API

| 方法   | 路径               | 说明            |
| ---- | ---------------- | ------------- |
| POST | `/api/qa/search` | 向量相似度搜索       |
| POST | `/api/qa/chat`   | AI 对话问答（基于文档） |
| POST | `/api/qa/sql`    | 自然语言转 SQL     |

### 测试接口

| 方法              | 路径                   | 说明       |
| --------------- | -------------------- | -------- |
| GET/POST/DELETE | `/api/test/retrieve` | 文档检索测试接口 |

## 环境变量

### 数据库配置

| 变量名           | 描述              | 默认值                          |
| ------------- | --------------- | ---------------------------- |
| DATABASE\_URL | 数据库连接字符串        | -                            |
| DB\_USER      | PostgreSQL 用户名  | postgres                     |
| DB\_PASSWORD  | PostgreSQL 密码   | postgres                     |
| DB\_NAME      | PostgreSQL 数据库名 | intelligent\_knowledge\_base |
| DB\_PORT      | PostgreSQL 端口   | 5432                         |
| DB\_HOST      | PostgreSQL 主机   | localhost                    |

### AI 配置

| 变量名                 | 描述                    | 默认值               |
| ------------------- | --------------------- | ----------------- |
| DASHSCOPE\_API\_KEY | 阿里云 DashScope API Key | -                 |
| OPENAI\_API\_KEY    | OpenAI API Key        | -                 |
| OPENAI\_BASE\_URL   | OpenAI Base URL       | 可选                |
| DEEPSEEK\_API\_KEY  | DeepSeek API Key      | -                 |
| EMBEDDING\_PROVIDER | Embedding 提供商         | dashscope         |
| EMBEDDING\_MODEL    | Embedding 模型名称        | text-embedding-v2 |
| LLM\_PROVIDER       | LLM 提供商               | dashscope         |
| LLM\_MODEL          | LLM 模型名称              | qwen-plus         |
| LLM\_TEMPERATURE    | LLM 温度参数              | 0.7               |

### Milvus 向量数据库配置（可选）

| 变量名                | 描述           | 默认值              |
| ------------------ | ------------ | ---------------- |
| MILVUS\_ENABLED    | 是否启用 Milvus  | false            |
| MILVUS\_HOST       | Milvus 服务器地址 | localhost        |
| MILVUS\_PORT       | Milvus 服务端口  | 19530            |
| MILVUS\_USERNAME   | Milvus 认证用户名 | 空                |
| MILVUS\_PASSWORD   | Milvus 认证密码  | 空                |
| MILVUS\_COLLECTION | 向量集合名称       | document\_chunks |
| MILVUS\_DIMENSIONS | 向量维度（需与模型匹配） | 1024             |

> ⚠️ **注意**：管理后台配置优先级高于环境变量。建议通过管理后台页面进行配置，配置会保存到数据库的 `system_config` 表中。

## 常用命令

### 开发相关

```bash
# 启动开发服务器（带端口检查）
npm run dev

# 直接启动开发服务器
npm run dev:direct

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 代码检查
npm run lint
```

### 数据库操作

```bash
# 执行迁移
npx prisma migrate dev

# 重置数据库（小心使用！会删除所有数据）
npx prisma migrate reset

# 查看数据库状态
npx prisma migrate status

# 打开 Prisma Studio（数据库可视化工具）
npx prisma studio

# 生成 Prisma Client
npx prisma generate
```

### Docker 操作

**PostgreSQL 数据库操作**：

```bash
# 启动数据库
docker-compose up -d

# 停止数据库
docker-compose down

# 停止数据库并删除数据（小心使用！）
docker-compose down -v

# 查看数据库日志
docker-compose logs -f postgres
```

**Milvus 向量数据库操作**：

```bash
# 启动 Milvus 服务
docker-compose -f docker-compose-milvus.yml up -d

# 停止 Milvus 服务
docker-compose -f docker-compose-milvus.yml down

# 重启 Milvus 服务
docker-compose -f docker-compose-milvus.yml restart

# 查看所有容器状态
docker ps -a

# 查看 Milvus 日志
docker logs milvus-standalone
```

> 📖 **详细管理命令**：关于 Milvus 的完整管理命令、数据备份恢复、性能监控等，请参考 [MILVUS\_SETUP.md](./MILVUS_SETUP.md)。

## 安全特性

1. **身份验证**：基于 Cookie 的认证机制，使用 httpOnly Cookie
2. **权限控制**：基于角色的访问控制（RBAC）
3. **输入验证**：文件上传类型和大小验证
4. **加密存储**：API Key 等敏感信息加密存储
5. **错误处理**：统一的错误处理和安全的错误信息返回
6. **软删除**：用户数据采用软删除策略，可恢复
7. **端口安全**：默认端口改为 3005，避免端口冲突

## 测试

### 单元测试

```bash
# 运行文件大小格式化测试
node test/formatFileSize.test.js

# 运行 TypeScript 版本测试
npx ts-node test/formatFileSize.test.ts
```

### 安全测试

```bash
# 运行安全测试（需要先启动开发服务器）
node test/security_export.test.js
```

### RAG 功能测试

```bash
# 运行文档流程测试
node test/doc_flow.test.js

# 运行 RAG 测试
node test/rag_test.js
```

## 故障排除

### 问题 1：端口 3005 被占用

**解决方案**：

1. 关闭占用端口 3005 的进程
2. 或者使用其他端口：`PORT=3002 npm run dev`
3. 查看占用进程：`netstat -ano | findstr :3005`

### 问题 2：Prisma migrate 失败

**解决方案**：

1. 确保 `.env` 文件配置正确
2. 对于 SQLite，删除旧的数据库文件后重试：

```bash
rm -f dev.db
rm -f dev.db-journal
npx prisma migrate dev
```

1. 对于 PostgreSQL，确保 Docker 服务正在运行

### 问题 3：文件上传失败

**解决方案**：

1. 检查文件类型是否支持（PDF、DOCX、TXT）
2. 检查文件大小是否超过 10MB 限制
3. 确保 uploads 目录存在且有写入权限

### 问题 4：AI 功能不工作

**解决方案**：

1. 检查 API Key 是否正确配置
2. 检查网络连接是否正常
3. 检查模型名称是否正确
4. 查看控制台错误日志获取详细信息

### 问题 5：文档向量化失败

**解决方案**：

1. 确保 Embedding 配置正确
2. 检查文档是否有可提取的文本内容
3. 查看 `uploads` 目录权限

> 📖 **Milvus 故障排除**：关于 Milvus 连接失败、搜索结果异常、数据迁移失败等问题的详细解决方案，请参考 [MILVUS\_SETUP.md](./MILVUS_SETUP.md) 中的「故障排除」章节。

### 问题 6：Milvus 连接失败

**解决方案**：

1. 确保 Milvus 服务正在运行
   ```bash
   docker ps | grep milvus
   ```
2. 检查 Milvus 配置是否正确
   - 主机地址是否正确（默认：localhost）
   - 端口是否正确（默认：19530）
   - 用户名和密码是否正确（如果启用了认证）
3. 测试 Milvus 连接
   - 在管理后台点击「测试连接」按钮
   - 检查网络是否可达
4. 查看 Milvus 日志
   ```bash
   docker logs milvus-standalone
   ```

### 问题 7：Milvus 向量搜索结果异常

**解决方案**：

1. **向量维度不匹配**：
   - 确保 Milvus 配置中的向量维度与 Embedding 模型输出一致
   - DashScope `text-embedding-v2`: 1024 维
   - OpenAI `text-embedding-3-small`: 1536 维
   - 如果维度不匹配，需要重新初始化集合并迁移数据
2. **索引未创建**：
   - 点击「初始化集合」按钮确保索引已创建
   - 系统使用 IVF\_FLAT 索引和余弦相似度度量
3. **集合未加载**：
   - Milvus 集合需要加载到内存才能搜索
   - 初始化集合时会自动加载

### 问题 8：数据迁移失败

**解决方案**：

1. **部分迁移失败**：
   - 检查迁移状态中的错误数量
   - 单个向量迁移失败不会影响其他向量
   - 可重新执行迁移，已成功的向量会被更新
2. **内存不足**：
   - 迁移时会批量处理（每次 100 个向量）
   - 如果数据量特别大，考虑分批迁移
   - 使用「迁移单个文档」功能测试
3. **向量数据损坏**：
   - 关系型数据库中的 `embedding` 字段存储的是 JSON 格式
   - 检查是否有无效的 JSON 数据
   - 可重新解析文档修复向量化数据

### 问题 9：SQL 文档分块异常

**解决方案**：

1. **RangeError: Invalid array length**：
   - 这是由于正则表达式使用零宽度先行断言导致的
   - 已修复：将 `(?=CREATE...)` 改为 `(CREATE...)`
   - 确保使用最新版本的代码
2. **分块过大或过小**：
   - 在「RAG 配置」页面调整 SQL 文档的分块参数
   - 推荐配置：chunkSize=4000, chunkOverlap=0, maxSingleChunkSize=8000
3. **CREATE 语句识别不准确**：
   - SQL 分块策略匹配以下模式：
     - `CREATE TABLE`
     - `CREATE OR REPLACE FUNCTION`
     - `CREATE OR REPLACE PROCEDURE`
     - `CREATE OR REPLACE TRIGGER`
     - `CREATE OR REPLACE VIEW`
   - 如果有特殊的 SQL 语法，可能需要调整正则表达式

## 部署注意事项

1. **生产环境**：建议使用 PostgreSQL 数据库
2. **密码安全**：生产环境中应该使用强密码
3. **数据备份**：定期备份数据库和上传文件
4. **环境变量**：生产环境中应该设置适当的环境变量
5. **文件存储**：考虑使用云存储服务（如 AWS S3、阿里云 OSS）存储上传的文件
6. **HTTPS**：生产环境必须使用 HTTPS
7. **日志**：配置适当的日志记录和监控
8. **限流**：考虑添加 API 限流防止滥用

## 功能特性

### 📄 文档管理

- 支持多种文件格式上传（PDF、DOCX、TXT、SQL）
- 自动文本提取
- 文档状态管理（草稿、已发布、已归档）
- 文档内容和附件管理
- 重新解析文档
- SQL 文档专用分块策略

### 📚 知识库

- 知识库创建和管理
- 私有/公开知识库
- 知识库成员管理
- 知识库导出功能

### 🔍 智能搜索

- 基于向量相似度的文档检索
- 相关性评分
- 多关键词支持
- 支持知识库过滤

### 🤖 AI 对话

- 基于文档内容的问答
- RAG 检索增强生成
- 多轮对话支持

### 🗄️ 数据库查询

- 自然语言转 SQL
- 表结构自动识别
- 查询历史记录

### 🔐 权限控制

- 用户认证
- 角色管理（ADMIN/EDITOR/VIEWER）
- 用户审核机制
- 知识库访问权限

### 📊 管理后台

- 系统概览统计
- 用户管理
- 文档管理
- 知识库管理
- AI 配置管理
- Milvus 向量数据库配置
- RAG 分块参数配置
- 数据迁移工具

### 🚀 向量数据库

- **双后端架构**：支持关系型数据库和 Milvus
- **Milvus 集成**：高性能向量存储和搜索
- **数据迁移工具**：从关系型数据库迁移到 Milvus
- **向后兼容**：可随时切换向量存储后端

## 技术亮点

1. **Next.js 14**：使用最新的 App Router 架构
2. **Prisma ORM**：类型安全的数据库操作
3. **Tailwind CSS**：响应式设计
4. **SQLite 支持**：开发环境无需 Docker
5. **安全认证**：基于 Cookie 的认证机制
6. **多 AI 提供商**：支持 OpenAI、DeepSeek、DashScope
7. **RAG 检索**：文档向量化 + 相似度搜索
8. **Text-to-SQL**：自然语言转数据库查询
9. **加密存储**：敏感信息加密保护
10. **Milvus 集成**：高性能向量数据库支持
11. **双后端向量存储**：关系型数据库与 Milvus 无缝切换
12. **RAG 配置分离**：普通文档与 SQL 文档独立配置分块参数

## 项目状态

✅ 核心功能已实现\
✅ 数据库配置完成\
✅ RAG 功能已实现\
✅ Text-to-SQL 功能已实现\
✅ 多 AI 提供商支持\
✅ 用户角色权限系统\
✅ 安全测试通过\
✅ **Milvus 向量数据库集成**\
✅ **数据迁移工具**\
✅ **RAG 配置分离（普通文档/SQL 文档）**

## 快速使用指南

1. **安装依赖**：`npm install`
2. **配置数据库**：复制 `.env.example` 为 `.env` 并配置
3. **配置 AI（可选）**：添加 `DASHSCOPE_API_KEY` 或其他 AI 提供商配置
4. **执行迁移**：`npx prisma migrate dev --name init`
5. **启动服务器**：`npm run dev`
6. **访问应用**：<http://localhost:3005>
7. **登录系统**：使用任意邮箱和密码登录（会自动创建用户）
   - 第一个注册的用户会自动成为 **ADMIN（管理员）**，状态为 **ACTIVE（正常）**
   - 后续注册的用户角色为 **VIEWER（查看者）**，状态为 **PENDING（待审核）**
8. **查询用户列表**：使用 Prisma Studio 或直接查询数据库
   - 方法一：启动 Prisma Studio：`npx prisma studio`，然后在浏览器中访问 <http://localhost:5555>，查看 User 表
   - 方法二：使用 SQLite 命令行查询（如果使用 SQLite）：
     ```bash
     # 进入 prisma 目录
     cd prisma

     # 使用 sqlite3 打开数据库
     sqlite3 dev.db

     # 查询所有用户
     SELECT id, email, name, role, status, "createdAt" FROM "User" WHERE "deletedAt" IS NULL;

     # 退出
     .quit
     ```
   - 方法三：使用 PostgreSQL 命令行查询（如果使用 PostgreSQL）：
     ```bash
     # 连接到数据库
     psql -h localhost -U postgres -d intelligent_knowledge_base

     # 查询所有用户
     SELECT id, email, name, role, status, "createdAt" FROM "User" WHERE "deletedAt" IS NULL;

     # 退出
     \q
     ```
9. **升级用户为管理员**：
   - 方法一：使用 Prisma Studio 直接编辑 User 表
   - 方法二：执行 SQL 更新：
     ```sql
     -- 将指定用户升级为管理员
     UPDATE "User" SET role = 'ADMIN', status = 'ACTIVE' WHERE email = 'your-email@example.com';
     ```
   - 方法三：如果已有管理员账户，登录后进入「管理后台」→「用户管理」进行操作
10. **配置 AI**：进入管理后台 → 系统设置 → AI 配置，配置 Embedding 和 LLM
11. **配置数据库**：进入管理后台 → 系统设置 → 数据库配置，可切换数据库类型（需重启服务）
12. **上传文档**：点击 "上传文档" 按钮，系统会自动处理并向量化
13. **搜索对话**：使用搜索功能或 AI 对话功能

## 用户管理说明

### 用户自动创建机制

系统支持自动创建用户：

1. **首次登录**：在登录页面输入任意邮箱和密码，系统会自动创建用户
2. **第一个用户**：会自动成为 **ADMIN（管理员）**，状态为 **ACTIVE（正常）**
3. **后续用户**：角色为 **VIEWER（查看者）**，状态为 **PENDING（待审核）**，需要管理员激活

### 用户角色说明

| 角色         | 说明  | 权限                 |
| ---------- | --- | ------------------ |
| **ADMIN**  | 管理员 | 所有权限 + 用户管理 + 系统设置 |
| **EDITOR** | 编辑者 | 上传文档、编辑文档、创建知识库    |
| **VIEWER** | 查看者 | 查看文档、搜索文档          |

### 用户状态说明

| 状态           | 说明  | <br />            |
| ------------ | --- | ----------------- |
| **PENDING**  | 待审核 | 新注册用户，默认状态，需管理员审核 |
| **ACTIVE**   | 正常  | 已激活用户，可正常使用       |
| **DISABLED** | 禁用  | 被禁用用户，无法登录        |

### 常用用户查询 SQL

```sql
-- 查询所有活跃用户
SELECT id, email, name, role, status, "createdAt" 
FROM "User" 
WHERE "deletedAt" IS NULL AND status = 'ACTIVE';

-- 查询待审核用户
SELECT id, email, name, role, status, "createdAt" 
FROM "User" 
WHERE "deletedAt" IS NULL AND status = 'PENDING';

-- 查询所有管理员
SELECT id, email, name, role, status 
FROM "User" 
WHERE "deletedAt" IS NULL AND role = 'ADMIN';

-- 激活待审核用户
UPDATE "User" SET status = 'ACTIVE' WHERE id = 'user-id';

-- 升级为管理员
UPDATE "User" SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

