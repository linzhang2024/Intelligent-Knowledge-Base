# Intelligent-Knowledge-Base

搜索 / RAG / 权限 / 文档管理 / 向量检索

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn
- Docker 和 Docker Compose（推荐，用于运行 PostgreSQL）
- 或者 SQLite（轻量级替代方案）

### 安装依赖

```bash
npm install
```

### 数据库配置

#### 方案一：使用 Docker Compose + PostgreSQL（推荐）

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

#### 方案二：使用 SQLite（轻量级，无需 Docker）

1. 复制环境变量模板：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，将 `DATABASE_URL` 改为 SQLite 配置：
```env
# 注释掉 PostgreSQL 配置
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/intelligent_knowledge_base"

# 启用 SQLite 配置
DATABASE_URL="file:./dev.db"
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

访问 http://localhost:3000 查看应用。

## 常用命令

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

## 项目结构

```
├── prisma/
│   └── schema.prisma    # 数据库模型定义
├── src/
│   ├── app/
│   │   ├── api/         # API 路由
│   │   ├── documents/   # 文档相关页面
│   │   └── ...          # 其他页面
│   └── lib/
│       └── prisma.ts    # Prisma 客户端配置
├── uploads/             # 上传文件存储目录（自动创建）
├── .env.example         # 环境变量模板
├── docker-compose.yml   # Docker 配置
└── package.json         # 项目依赖
```

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

## 故障排除

### 问题 1：Prisma migrate 失败，提示连接被拒绝

**原因**：PostgreSQL 服务未启动

**解决方案**：
1. 确保 Docker 正在运行
2. 执行 `docker-compose up -d` 启动数据库
3. 等待几秒钟让数据库初始化完成
4. 再次执行 `npx prisma migrate dev`

### 问题 2：数据库密码错误

**解决方案**：
1. 检查 `.env` 文件中的 `DATABASE_URL` 配置
2. 确保密码与 `docker-compose.yml` 中的配置一致
3. 如果修改了密码，需要重建数据库容器：
```bash
docker-compose down -v
docker-compose up -d
```

### 问题 3：SQLite 迁移失败

**解决方案**：
1. 确保 `.env` 文件中 `DATABASE_URL` 格式正确：
```env
DATABASE_URL="file:./dev.db"
```
2. 删除旧的数据库文件（如果有）：
```bash
rm -f prisma/dev.db
rm -f prisma/dev.db-journal
```
3. 重新执行迁移：
```bash
npx prisma migrate dev
```

## 注意事项

1. **生产环境**：不要使用 SQLite，应该使用 PostgreSQL 或其他生产级数据库
2. **密码安全**：生产环境中应该使用强密码，不要使用默认密码
3. **数据备份**：定期备份数据库数据
4. **上传文件**：上传的文件存储在 `uploads/` 目录，该目录已添加到 `.gitignore`，不会被提交到版本控制
