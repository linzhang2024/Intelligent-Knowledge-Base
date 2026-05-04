# Intelligent-Knowledge-Base

智能知识库系统 - 基于 Next.js 14 + RAG + AI 的企业级文档管理平台

## 项目简介

智能知识库系统是一个基于 Next.js 14 开发的企业级文档管理平台，支持文档上传、知识库管理、权限控制、智能搜索、RAG 向量检索、自然语言转 SQL 等功能。

### 核心功能

- 🔐 用户认证与权限管理（多角色、审核机制）
- 📄 文档上传与管理（支持 PDF、DOCX、TXT 格式）
- 📚 知识库管理（私有/公开）
- 🔍 智能文档搜索（基于向量相似度）
- 🤖 RAG 检索增强生成（文档切片 + 向量化）
- 💬 AI 对话问答（基于文档内容）
- 🗄️ 数据库表管理（自然语言转 SQL）
- 📊 管理后台
- 🔒 软删除机制

### 支持的 AI 提供商

| 提供商 | Embedding 模型 | LLM 模型 |
|--------|---------------|----------|
| **OpenAI** | text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002 | gpt-3.5-turbo, gpt-4, gpt-4o, gpt-4o-mini, gpt-4-turbo |
| **DeepSeek** | deepseek-embedding | deepseek-chat, deepseek-reasoner, deepseek-coder, deepseek-v4-pro, deepseek-v4-flash |
| **DashScope (阿里云)** | text-embedding-v1, text-embedding-v2, text-embedding-v3 | qwen-turbo, qwen-plus, qwen-max, qwen-7b-chat, qwen-14b-chat, qwen2.5-72b-instruct |

## 技术栈

- **前端**：Next.js 14, React 18, Tailwind CSS
- **后端**：Next.js API Routes
- **数据库**：SQLite（开发环境）/ PostgreSQL（生产环境）
- **ORM**：Prisma
- **认证**：基于 Cookie 的认证机制
- **AI**：LangChain.js, OpenAI API, DashScope API, DeepSeek API
- **文档处理**：Mammoth (DOCX), unpdf (PDF), iconv-lite (编码转换)

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

2. 编辑 `.env` 文件，确保使用 SQLite 配置：

```env
DATABASE_URL="file:./dev.db"
```

#### 方案二：使用 Docker Compose + PostgreSQL

1. 复制环境变量模板：

```bash
cp .env.example .env
```

2. 启动 PostgreSQL 服务：

```bash
docker-compose up -d
```

3. 检查数据库状态：

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

- AI 配置（Embedding、LLM）
- API Key 加密存储

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

| 角色 | 说明 | 权限 |
|------|------|------|
| **ADMIN** | 管理员 | 所有权限 + 用户管理 + 系统设置 |
| **EDITOR** | 编辑者 | 上传文档、编辑文档、创建知识库 |
| **VIEWER** | 查看者 | 查看文档、搜索文档 |

### 用户状态

| 状态 | 说明 |
|------|------|
| **PENDING** | 待审核 | 新注册用户，默认状态，需管理员审核 |
| **ACTIVE** | 正常 | 已激活用户，可正常使用 |
| **DISABLED** | 禁用 | 被禁用用户，无法登录 |

### 软删除机制

系统采用软删除策略保护数据：

- **User 表**：使用 `deletedAt` 字段标记删除
- **Document 表**：查询时过滤 `deletedAt: null`
- 注意：当前文档删除 API 实际执行硬删除（与用户删除策略不一致）

## 数据库模型

### User（用户）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识符 |
| email | String | 邮箱（唯一） |
| password | String | 密码 |
| name | String? | 姓名（可选） |
| role | String | 角色（VIEWER/EDITOR/ADMIN），默认 VIEWER |
| status | String | 状态（PENDING/ACTIVE/DISABLED），默认 PENDING |
| avatar | String? | 头像（可选） |
| profile | String? | 个人简介（可选） |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |
| deletedAt | DateTime? | 删除时间（软删除标记） |

### KnowledgeBase（知识库）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识符 |
| name | String | 名称 |
| description | String? | 描述（可选） |
| visibility | String | 可见性（PRIVATE/PUBLIC），默认 PRIVATE |
| ownerId | String | 所有者ID |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

### Document（文档）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识符 |
| title | String | 标题 |
| content | String? | 提取的文本内容（可选） |
| fileUrl | String? | 文件路径（可选） |
| fileType | String? | 文件类型（可选） |
| fileSize | BigInt? | 文件大小（可选） |
| status | String | 状态（DRAFT/PUBLISHED/ARCHIVED），默认 DRAFT |
| authorId | String? | 作者ID（可选） |
| knowledgeBaseId | String? | 知识库ID（可选） |
| vectorId | String? | 向量存储ID（可选） |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |
| deletedAt | DateTime? | 删除时间（软删除标记） |

### DocumentChunk（文档切片）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识符 |
| documentId | String | 所属文档ID |
| index | Int | 切片索引 |
| content | String | 切片内容 |
| vectorId | String? | 向量存储ID（可选） |
| embedding | String? | 向量数据（序列化，可选） |
| embeddingModel | String? | 使用的向量化模型（可选） |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

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

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/logout` | 用户登出 |
| POST | `/api/auth/register` | 用户注册 |

### 文档相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/documents` | 获取文档列表（公开文档） |
| POST | `/api/documents/upload` | 上传文档 |
| POST | `/api/documents/chunk/complete` | 完成文档切片处理 |
| GET | `/api/uploads/[filename]` | 访问上传的文件 |

### 管理后台 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/admin/ai-config` | 获取/保存 AI 配置 |
| GET/DELETE | `/api/admin/documents` | 获取文档列表/批量删除 |
| GET/PATCH/DELETE | `/api/admin/documents/[id]` | 获取/更新/删除单个文档 |
| POST | `/api/admin/documents/[id]/reparse` | 重新解析文档 |
| GET/POST | `/api/admin/knowledge-bases` | 获取/创建知识库 |
| GET/PATCH/DELETE | `/api/admin/knowledge-bases/[id]` | 获取/更新/删除知识库 |
| GET | `/api/admin/stats` | 获取系统统计 |
| GET | `/api/admin/users` | 获取用户列表 |
| PATCH/DELETE | `/api/admin/users/[id]` | 更新/删除用户 |

### 问答与搜索 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/qa/search` | 向量相似度搜索 |
| POST | `/api/qa/chat` | AI 对话问答（基于文档） |
| POST | `/api/qa/sql` | 自然语言转 SQL |

### 测试接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/DELETE | `/api/test/retrieve` | 文档检索测试接口 |

## 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| DATABASE_URL | 数据库连接字符串 | - |
| DB_USER | PostgreSQL 用户名 | postgres |
| DB_PASSWORD | PostgreSQL 密码 | postgres |
| DB_NAME | PostgreSQL 数据库名 | intelligent_knowledge_base |
| DB_PORT | PostgreSQL 端口 | 5432 |
| DB_HOST | PostgreSQL 主机 | localhost |
| DASHSCOPE_API_KEY | 阿里云 DashScope API Key | - |
| EMBEDDING_MODEL | Embedding 模型名称 | text-embedding-v2 |
| LLM_MODEL | LLM 模型名称 | qwen-plus |
| LLM_TEMPERATURE | LLM 温度参数 | 0.7 |

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

3. 对于 PostgreSQL，确保 Docker 服务正在运行

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

- 支持多种文件格式上传（PDF、DOCX、TXT）
- 自动文本提取
- 文档状态管理（草稿、已发布、已归档）
- 文档内容和附件管理
- 重新解析文档

### 📚 知识库

- 知识库创建和管理
- 私有/公开知识库
- 知识库成员管理
- 知识库导出功能

### 🔍 智能搜索

- 基于向量相似度的文档检索
- 相关性评分
- 多关键词支持

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

## 项目状态

✅ 核心功能已实现  
✅ 数据库配置完成  
✅ RAG 功能已实现  
✅ Text-to-SQL 功能已实现  
✅ 多 AI 提供商支持  
✅ 用户角色权限系统  
✅ 安全测试通过  

## 快速使用指南

1. **安装依赖**：`npm install`
2. **配置数据库**：复制 `.env.example` 为 `.env` 并配置
3. **配置 AI（可选）**：添加 `DASHSCOPE_API_KEY` 或其他 AI 提供商配置
4. **执行迁移**：`npx prisma migrate dev --name init`
5. **启动服务器**：`npm run dev`
6. **访问应用**：<http://localhost:3005>
7. **登录系统**：使用任意邮箱和密码登录（会自动创建用户，角色为 VIEWER，状态为 PENDING）
8. **升级权限**：如果需要管理员权限，可直接在数据库中将用户 role 改为 ADMIN，status 改为 ACTIVE
9. **配置 AI**：进入管理后台 → 系统设置 → AI 配置，配置 Embedding 和 LLM
10. **上传文档**：点击 "上传文档" 按钮，系统会自动处理并向量化
11. **搜索对话**：使用搜索功能或 AI 对话功能
