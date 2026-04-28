# Intelligent-Knowledge-Base

搜索 / RAG / 权限 / 文档管理 / 向量检索

## 项目简介

智能知识库系统是一个基于 Next.js 14 开发的企业级文档管理平台，支持文档上传、知识库管理、权限控制、智能搜索等功能。

### 核心功能

- 🔐 用户认证与权限管理
- 📄 文档上传与管理（支持 PDF、DOCX、TXT 格式）
- 📚 知识库管理
- 🔍 智能文档搜索
- 📊 管理后台
- 💾 数据导出
- 🔒 安全权限控制

## 技术栈

- **前端**：Next.js 14, React 18, Tailwind CSS
- **后端**：Next.js API Routes
- **数据库**：SQLite（开发环境）/ PostgreSQL（生产环境）
- **ORM**：Prisma
- **认证**：基于 Cookie 的认证机制

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
# 使用 SQLite（轻量级替代方案，无需 Docker）
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

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3005 查看应用（默认端口已改为 3005）。

## 项目结构

```
├── prisma/                 # 数据库相关
│   └── schema.prisma       # 数据库模型定义
├── scripts/                # 脚本文件
│   └── check-port.js       # 端口占用检查脚本
├── src/                    # 源代码
│   ├── app/                # Next.js 应用
│   │   ├── api/            # API 路由
│   │   │   ├── auth/       # 认证相关
│   │   │   ├── documents/  # 文档相关
│   │   │   ├── kb/         # 知识库相关
│   │   │   ├── test/       # 测试接口
│   │   │   └── uploads/    # 文件访问
│   │   ├── admin/          # 管理后台
│   │   ├── dashboard/      # 仪表盘
│   │   ├── documents/      # 文档页面
│   │   ├── login/          # 登录页面
│   │   ├── globals.css     # 全局样式
│   │   ├── layout.tsx      # 布局组件
│   │   └── page.tsx        # 首页
│   └── lib/                # 工具库
│       ├── auth.ts         # 认证工具
│       ├── format.ts       # 格式化工具
│       └── prisma.ts       # Prisma 客户端
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
- 支持自动创建新用户
- 登录成功后跳转到仪表盘

### 2. 仪表盘 (`/dashboard`)
- 我的知识库列表
- 知识库导出功能
- 最近文档列表
- 上传文档入口
- 管理后台入口

### 3. 文档上传 (`/documents/upload`)
- 文档基本信息填写
- 文件上传（支持 PDF、DOCX、TXT）
- 文件类型和大小验证

### 4. 文档详情 (`/documents/[id]`)
- 文档内容展示
- 文档信息查看
- 附件下载
- 操作记录

### 5. 管理后台 (`/admin`)
- 系统概览
- 用户管理
- 文档管理
- 知识库管理
- 系统设置

## API 路由

### 认证相关
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出

### 文档相关
- `POST /api/documents/upload` - 上传文档
- `GET /api/uploads/[filename]` - 访问上传的文件

### 知识库相关
- `GET /api/kb/[id]/export` - 导出知识库
- `GET /api/kb/[id]/members` - 查看知识库成员

### 测试相关
- `GET /api/test/retrieve` - 测试文档检索
- `POST /api/test/retrieve` - 添加测试文档
- `DELETE /api/test/retrieve` - 删除测试文档

## 数据库模型

### User（用户）
- `id`: 唯一标识符
- `email`: 邮箱（唯一）
- `password`: 密码
- `name`: 姓名（可选）
- `role`: 角色（USER/ADMIN）
- `createdAt`: 创建时间
- `updatedAt`: 更新时间

### KnowledgeBase（知识库）
- `id`: 唯一标识符
- `name`: 名称
- `description`: 描述（可选）
- `ownerId`: 所有者ID
- `createdAt`: 创建时间
- `updatedAt`: 更新时间

### Document（文档）
- `id`: 唯一标识符
- `title`: 标题
- `content`: 内容（可选）
- `fileUrl`: 文件路径（可选）
- `fileType`: 文件类型（可选）
- `fileSize`: 文件大小（可选）
- `status`: 状态（DRAFT/PUBLISHED/ARCHIVED）
- `authorId`: 作者ID（可选）
- `knowledgeBaseId`: 知识库ID（可选）
- `createdAt`: 创建时间
- `updatedAt`: 更新时间

## 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| DATABASE_URL | 数据库连接字符串 | - |
| DB_USER | PostgreSQL 用户名 | postgres |
| DB_PASSWORD | PostgreSQL 密码 | postgres |
| DB_NAME | PostgreSQL 数据库名 | intelligent_knowledge_base |
| DB_PORT | PostgreSQL 端口 | 5432 |
| DB_HOST | PostgreSQL 主机 | localhost |

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
2. **权限控制**：知识库访问权限检查，只有所有者可以访问
3. **输入验证**：文件上传类型和大小验证
4. **错误处理**：统一的错误处理和安全的错误信息返回
5. **端口安全**：默认端口改为 3005，避免端口冲突

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

## 部署注意事项

1. **生产环境**：建议使用 PostgreSQL 数据库
2. **密码安全**：生产环境中应该使用强密码
3. **数据备份**：定期备份数据库和上传文件
4. **环境变量**：生产环境中应该设置适当的环境变量
5. **文件存储**：考虑使用云存储服务存储上传的文件

## 功能特性

### 📄 文档管理
- 支持多种文件格式上传
- 文档状态管理（草稿、已发布、已归档）
- 文档内容和附件管理

### 📚 知识库
- 知识库创建和管理
- 知识库成员管理
- 知识库导出功能

### 🔍 智能搜索
- 基于关键词的文档检索
- 相关性评分
- 搜索结果高亮

### 🔐 权限控制
- 用户认证
- 角色管理
- 知识库访问权限

### 📊 管理后台
- 系统概览统计
- 用户管理
- 文档管理
- 知识库管理
- 系统设置

## 技术亮点

1. **Next.js 14**：使用最新的 App Router 架构
2. **Prisma ORM**：类型安全的数据库操作
3. **Tailwind CSS**：响应式设计
4. **SQLite 支持**：开发环境无需 Docker
5. **安全认证**：基于 Cookie 的认证机制
6. **智能搜索**：基于关键词的相关性评分
7. **文件管理**：安全的文件上传和访问
8. **权限系统**：基于所有者的访问控制

## 项目状态

✅ 核心功能已实现
✅ 数据库配置完成
✅ 安全测试通过
✅ 单元测试覆盖

## 快速使用指南

1. **安装依赖**：`npm install`
2. **配置数据库**：复制 `.env.example` 为 `.env` 并配置
3. **执行迁移**：`npx prisma migrate dev --name init`
4. **启动服务器**：`npm run dev`
5. **访问应用**：http://localhost:3005
6. **登录系统**：使用任意邮箱和密码登录（会自动创建用户）
7. **创建知识库**：登录后会自动创建默认知识库
8. **上传文档**：点击 "上传文档" 按钮
9. **搜索文档**：使用搜索功能查找文档
10. **管理系统**：点击 "管理后台" 进入管理界面
