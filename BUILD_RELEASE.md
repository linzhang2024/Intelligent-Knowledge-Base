# 智能知识库系统 - 打包发布指南

## 文档信息

| 项目 | 内容 |
|------|------|
| 项目名称 | Intelligent Knowledge Base |
| 版本 | 0.1.0 |
| 技术栈 | Next.js 14, React 18, TypeScript, Tailwind CSS, Prisma, SQLite/PostgreSQL, Milvus |
| 文档创建日期 | 2026-05-11 |

---

## 目录

1. [项目技术架构](#1-项目技术架构)
2. [环境要求](#2-环境要求)
3. [开发环境搭建](#3-开发环境搭建)
4. [打包流程详解](#4-打包流程详解)
5. [数据库部署](#5-数据库部署)
6. [Milvus向量数据库部署](#6-milvus向量数据库部署)
7. [Docker容器化部署](#7-docker容器化部署)
8. [生产环境部署](#8-生产环境部署)
9. [部署验证与回滚](#9-部署验证与回滚)
10. [常见问题排查](#10-常见问题排查)

---

## 1. 项目技术架构

### 1.1 技术栈概览

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 前端框架 | Next.js 14.2.15 | App Router, Server Components |
| UI库 | React 18.3.1 | 组件化开发 |
| 样式 | Tailwind CSS 3.4 | 原子化CSS |
| 后端 | Next.js API Routes | 服务端API |
| ORM | Prisma 5.21.1 | 数据库抽象层 |
| 关系数据库 | SQLite/PostgreSQL/MySQL | 数据存储 |
| 向量数据库 | Milvus 2.4.0 | 向量检索（可选） |
| AI框架 | LangChain 1.3.4 | AI能力封装 |
| AI提供商 | DashScope/OpenAI/DeepSeek | LLM和Embedding |

### 1.2 项目目录结构

```
Intelligent-Knowledge-Base/
├── src/
│   ├── app/                    # Next.js应用目录
│   │   ├── api/               # API路由
│   │   ├── admin/             # 管理后台页面
│   │   ├── chat/              # AI对话页面
│   │   ├── documents/         # 文档管理页面
│   │   └── login/             # 登录页面
│   ├── components/            # React组件
│   │   └── ui/                # UI基础组件
│   └── lib/                   # 核心业务逻辑
│       ├── documentParser/     # 文档解析
│       ├── sqlParser/          # SQL解析
│       └── vectorStore/        # 向量存储
├── prisma/
│   ├── schema.prisma          # 数据库模型
│   └── migrations/            # 迁移文件
├── scripts/                   # 工具脚本
├── test/                      # 测试文件
├── docker-compose.yml         # PostgreSQL配置
├── docker-compose-milvus.yml  # Milvus配置
├── next.config.mjs            # Next.js配置
└── package.json               # 项目依赖
```

### 1.3 核心数据模型

系统使用Prisma ORM，主要数据模型包括：

- **User**: 用户管理（角色：VIEWER/ADMIN）
- **KnowledgeBase**: 知识库（支持公开/私有）
- **Document**: 文档（支持PDF/DOCX/TXT/SQL）
- **DocumentChunk**: 文档分块（包含向量嵌入）
- **SystemConfig**: 系统配置（支持运行时修改）
- **DatabaseTable**: 数据库表结构信息
- **SQLQuery/QueryHistory**: SQL查询历史

---

## 2. 环境要求

### 2.1 开发环境要求

| 组件 | 最低版本 | 推荐版本 | 说明 |
|------|----------|----------|------|
| Node.js | 18.0.0 | 20.x LTS | JavaScript运行时 |
| npm | 9.0.0 | 10.x | 包管理器 |
| Docker | 20.0.0 | 24.x | 容器化支持 |
| Docker Compose | 2.0.0 | 2.x | 容器编排 |

### 2.2 生产环境要求

| 资源 | 最低配置 | 推荐配置 |
|------|----------|----------|
| CPU | 2核 | 4核+ |
| 内存 | 4GB | 8GB+ |
| 磁盘 | 20GB | 50GB+ SSD |
| 带宽 | 5Mbps | 10Mbps+ |

### 2.3 依赖版本锁定

项目依赖版本在package.json中锁定：

```json
{
  "next": "14.2.15",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "@prisma/client": "^5.21.1",
  "prisma": "^5.21.1",
  "typescript": "^5.6.3"
}
```

---

## 3. 开发环境搭建

### 3.1 基础环境配置

**步骤1: 克隆项目**

```bash
git clone <repository_url>
cd Intelligent-Knowledge-Base
```

**步骤2: 安装依赖**

```bash
npm install
```

这会根据package.json安装所有依赖，包括：

- 生产依赖：next, react, @prisma/client, langchain等
- 开发依赖：typescript, @types/react, eslint, tailwindcss等

**步骤3: 环境变量配置**

创建`.env`文件：

```bash
cp .env.example .env
```

编辑`.env`文件，配置必要参数：

```env
# 数据库配置
DATABASE_URL="file:./prisma/dev.db"

# AI配置（选择一种提供商）
# 阿里云DashScope
DASHSCOPE_API_KEY="your-api-key"
EMBEDDING_MODEL="text-embedding-v2"
LLM_MODEL="qwen-plus"

# 或者OpenAI
# OPENAI_API_KEY="your-api-key"
# EMBEDDING_MODEL="text-embedding-3-small"
# LLM_MODEL="gpt-3.5-turbo"

# Milvus配置（可选）
MILVUS_ENABLED=false
MILVUS_HOST=localhost
MILVUS_PORT=19530
MILVUS_DIMENSIONS=1024
```

### 3.2 数据库初始化

**生成Prisma Client**:

```bash
npx prisma generate
```

**执行数据库迁移**（开发环境）:

```bash
npx prisma migrate dev --name init
```

这会创建SQLite数据库文件`prisma/dev.db`和迁移记录。

### 3.3 启动开发服务器

**方式一：自动端口检查**

```bash
npm run dev
```

内部调用`node scripts/check-port.js`检查端口3005是否可用。

**方式二：直接启动**

```bash
npm run dev:direct
```

开发服务器会在`http://localhost:3005`启动，支持热重载。

---

## 4. 打包流程详解

### 4.1 打包前检查

**代码检查**:

```bash
npm run lint
```

ESLint会检查代码规范，确保代码质量。

### 4.2 生产构建

**执行构建**:

```bash
npm run build
```

构建过程包含以下阶段：

**阶段1: TypeScript编译**
- 编译`.ts`和`.tsx`文件
- 类型检查
- 生成`.next/`目录

**阶段2: Next.js优化**
- Tree Shaking移除未使用代码
- 代码压缩和混淆
- 静态资源优化

**阶段3: 产物生成**

构建产物结构：

```
.next/
├── BUILD_ID                  # 构建唯一标识
├── build-manifest.json       # 构建清单
├── cache/                    # 构建缓存
├── package.json              # 运行时依赖
├── server/                   # 服务端代码
│   ├── app/                  # App Router服务端代码
│   ├── chunks/               # 代码分片
│   └── middleware.js         # 中间件
├── static/                   # 静态资源
│   ├── css/                  # 样式文件
│   ├── chunks/               # JS代码分片
│   └── media/                # 媒体资源
└── trace                     # 构建追踪
```

### 4.3 构建产物分析

| 产物类型 | 大小估算 | 说明 |
|----------|----------|------|
| 客户端JS | 100-200KB | 核心代码+路由 |
| CSS | 50-100KB | Tailwind样式 |
| 服务端代码 | 200-400KB | API Routes |
| 静态资源 | 依赖项目 | 图片等 |

### 4.4 本地生产测试

**启动生产服务器**:

```bash
npm run start
```

生产服务器启动后会监听3005端口，可以测试：

- 应用响应速度
- 静态资源加载
- API接口功能
- 数据库连接

---

## 5. 数据库部署

### 5.1 SQLite部署（开发/小型应用）

**特点**：
- 无需额外安装
- 单文件存储，易于备份
- 配置简单

**配置**：
```env
DATABASE_URL="file:./prisma/dev.db"
```

**备份**：
```bash
cp prisma/dev.db backup_$(date +%Y%m%d).db
```

### 5.2 PostgreSQL部署（生产环境推荐）

**使用Docker Compose启动**:

```bash
docker-compose up -d
```

这会启动PostgreSQL 16容器，配置如下：

| 配置项 | 值 |
|--------|-----|
| 镜像 | postgres:16-alpine |
| 端口 | 5432 |
| 用户 | postgres |
| 密码 | postgres |
| 数据库 | intelligent_knowledge_base |
| 数据卷 | postgres_data |

**验证服务状态**:

```bash
docker-compose ps
docker-compose logs postgres
```

**配置环境变量**:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/intelligent_knowledge_base"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="intelligent_knowledge_base"
DB_PORT="5432"
DB_HOST="localhost"
```

**执行数据库迁移**:

```bash
npx prisma migrate deploy
```

### 5.3 MySQL部署

**配置环境变量**:

```env
DATABASE_URL="mysql://root:password@localhost:3306/intelligent_knowledge_base"
```

### 5.4 数据库迁移命令

| 命令 | 用途 |
|------|------|
| `npx prisma migrate dev --name <name>` | 开发环境创建迁移 |
| `npx prisma migrate deploy` | 生产环境应用迁移 |
| `npx prisma migrate status` | 查看迁移状态 |
| `npx prisma migrate reset` | 重置数据库（慎用） |
| `npx prisma db pull` | 从数据库拉取模型 |
| `npx prisma db push` | 推送模型到数据库 |
| `npx prisma generate` | 生成Prisma Client |

---

## 6. Milvus向量数据库部署

### 6.1 架构说明

Milvus是可选组件，用于提升大规模向量搜索性能。

**系统采用双后端架构**：
- 写入时双写：同时写入关系数据库和Milvus
- 搜索时自动切换：根据配置选择后端

### 6.2 快速启动

```bash
docker-compose -f docker-compose-milvus.yml up -d
```

**服务组件**：

| 服务 | 容器名 | 端口 | 说明 |
|------|--------|------|------|
| Milvus | milvus-standalone | 19530, 9091 | 向量数据库主服务 |
| etcd | milvus-etcd | 2379-2380 | 元数据存储 |
| MinIO | milvus-minio | 9000-9001 | 对象存储 |

**验证服务状态**:

```bash
docker ps | grep milvus
```

### 6.3 应用配置

**方式一：管理后台配置（推荐）**

1. 启动应用：`npm run dev`
2. 管理员登录后台
3. 进入「系统设置」→「Milvus配置」
4. 填写配置并测试连接
5. 初始化集合并启用

**方式二：环境变量配置**

```env
MILVUS_ENABLED=true
MILVUS_HOST=localhost
MILVUS_PORT=19530
MILVUS_COLLECTION=document_chunks
MILVUS_DIMENSIONS=1024
```

### 6.4 向量维度说明

| 提供商 | 模型 | 维度 |
|--------|------|------|
| DashScope | text-embedding-v2 | 1024 |
| OpenAI | text-embedding-3-small | 1536 |
| OpenAI | text-embedding-3-large | 3072 |
| DeepSeek | deepseek-embedding | 1024 |

---

## 7. Docker容器化部署

### 7.1 Docker配置

**创建Dockerfile**：

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# 生产阶段
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3005
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production
RUN chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3005
CMD ["node", "server.js"]
```

**修改next.config.mjs**启用standalone输出：

```javascript
const nextConfig = {
  output: 'standalone',  // 添加这行
  // ...其他配置
};
```

### 7.2 Docker Compose生产配置

创建`docker-compose.prod.yml`：

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    container_name: ikb-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-intelligent_knowledge_base}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - ikb-network

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ikb-app
    restart: unless-stopped
    ports:
      - "3005:3005"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-intelligent_knowledge_base}
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - app_uploads:/app/uploads
    networks:
      - ikb-network

volumes:
  postgres_data:
  app_uploads:
networks:
  ikb-network:
    driver: bridge
```

### 7.3 构建和启动

**构建镜像**:

```bash
docker-compose -f docker-compose.prod.yml build
```

**启动服务**:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

**查看状态**:

```bash
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f
```

**停止服务**:

```bash
docker-compose -f docker-compose.prod.yml down
```

---

## 8. 生产环境部署

### 8.1 PM2进程管理

**安装PM2**:

```bash
sudo npm install -g pm2
```

**创建ecosystem.config.js**:

```javascript
module.exports = {
  apps: [{
    name: 'intelligent-knowledge-base',
    script: 'npm',
    args: 'start',
    cwd: '/opt/intelligent-knowledge-base',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3005
    }
  }]
};
```

**PM2常用命令**:

| 命令 | 说明 |
|------|------|
| `pm2 start ecosystem.config.js` | 启动应用 |
| `pm2 status` | 查看状态 |
| `pm2 logs` | 查看日志 |
| `pm2 restart intelligent-knowledge-base` | 重启应用 |
| `pm2 stop intelligent-knowledge-base` | 停止应用 |
| `pm2 delete intelligent-knowledge-base` | 删除应用 |
| `pm2 startup` | 设置开机自启 |
| `pm2 save` | 保存当前进程列表 |

### 8.2 Nginx反向代理

**安装Nginx**:

```bash
sudo apt install nginx -y
```

**创建配置文件** `/etc/nginx/sites-available/ikb.conf`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    client_max_body_size 100M;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/javascript application/json;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3005;
        proxy_cache_valid 200 1y;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**启用配置**:

```bash
sudo ln -s /etc/nginx/sites-available/ikb.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 8.3 HTTPS配置（可选）

使用Let's Encrypt申请免费证书：

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
sudo certbot renew --dry-run
```

---

## 9. 部署验证与回滚

### 9.1 部署后验证

**健康检查端点**:

```bash
curl -I http://localhost:3005/api/health
```

如果没有专门的健康检查端点，可以检查：

```bash
curl -I http://localhost:3005
```

**验证清单**:

| 检查项 | 预期结果 | 命令 |
|--------|----------|------|
| 应用响应 | HTTP 200 | `curl -I http://localhost:3005` |
| 数据库连接 | 正常 | `npx prisma db execute --stdin <<< 'SELECT 1'` |
| 静态资源 | 正常 | 访问`/_next/static/` |
| API接口 | 正常 | 测试登录接口 |

### 9.2 回滚策略

**PM2回滚**:

```bash
# 查看历史构建
ls -la .next/

# 使用previous版本启动
pm2 stop intelligent-knowledge-base
# 手动替换.next目录
pm2 restart intelligent-knowledge-base
```

**Docker回滚**:

```bash
# 查看镜像历史
docker images intelligent-knowledge-base

# 回滚到上一个版本
docker-compose down
docker tag intelligent-knowledge-base:previous intelligent-knowledge-base:latest
docker-compose up -d
```

**数据库回滚**:

```bash
# PostgreSQL备份恢复
cat backup_20260511.sql | docker exec -i ikb-postgres psql -U postgres -d intelligent_knowledge_base
```

---

## 10. 常见问题排查

### 10.1 应用无法启动

**检查端口占用**:

```bash
# Windows
netstat -ano | findstr :3005

# Linux
lsof -i :3005
```

**检查数据库连接**:

```bash
npx prisma db execute --stdin <<< 'SELECT 1'
```

### 10.2 数据库连接失败

**检查服务状态**:

```bash
docker ps | grep postgres
systemctl status postgresql
```

**验证连接参数**:

```bash
npx prisma db pull --force
```

### 10.3 Milvus连接失败

**检查容器状态**:

```bash
docker ps | grep milvus
```

**检查所有服务**:

```bash
docker logs milvus-standalone
docker logs milvus-etcd
docker logs milvus-minio
```

### 10.4 AI API调用失败

**验证API Key**:

```bash
echo $DASHSCOPE_API_KEY
echo $OPENAI_API_KEY
```

**测试API连接**:

```bash
curl -s https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-plus","input":{"messages":[{"role":"user","content":"test"}]},"parameters":{"result_format":"message"}}'
```

---

## 附录

### A. 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 3005 | Next.js | 主应用端口 |
| 5432 | PostgreSQL | 数据库端口 |
| 19530 | Milvus | 向量数据库端口 |
| 9091 | Milvus | 管理端口 |
| 9000 | MinIO | 对象存储API |
| 80/443 | Nginx | HTTP/HTTPS |

### B. 环境变量速查

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| DATABASE_URL | 是 | - | 数据库连接字符串 |
| DASHSCOPE_API_KEY | 否 | - | 阿里云API Key |
| OPENAI_API_KEY | 否 | - | OpenAI API Key |
| EMBEDDING_MODEL | 否 | text-embedding-v2 | Embedding模型 |
| LLM_MODEL | 否 | qwen-plus | LLM模型 |
| MILVUS_ENABLED | 否 | false | 是否启用Milvus |
| MILVUS_HOST | 否 | localhost | Milvus主机 |
| MILVUS_PORT | 否 | 19530 | Milvus端口 |
| MILVUS_DIMENSIONS | 否 | 1024 | 向量维度 |

### C. 常用命令速查

```bash
# 开发
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run start            # 启动生产服务器
npm run lint             # 代码检查

# 数据库
npx prisma migrate dev   # 开发环境迁移
npx prisma migrate deploy # 生产环境迁移
npx prisma generate      # 生成Client
npx prisma studio        # 数据库管理界面

# Docker
docker-compose up -d     # 启动服务
docker-compose down      # 停止服务
docker-compose ps        # 查看状态
docker logs <name>       # 查看日志

# PM2
pm2 start ecosystem.config.js
pm2 status
pm2 logs
pm2 restart <name>
```

### D. 目录结构

```
Intelligent-Knowledge-Base/
├── .next/                    # 构建产物
├── prisma/
│   ├── migrations/           # 迁移文件
│   ├── schema.prisma        # 数据库模型
│   └── dev.db               # SQLite数据库
├── src/
│   ├── app/                 # Next.js应用
│   ├── components/          # React组件
│   └── lib/                 # 工具库
├── volumes/                  # Docker数据卷
├── .env                      # 环境变量
├── docker-compose.yml       # PostgreSQL配置
├── docker-compose-milvus.yml # Milvus配置
└── package.json             # 项目依赖
```

---

## 版本信息

| 组件 | 版本 |
|------|------|
| Next.js | 14.2.15 |
| React | 18.3.1 |
| Prisma | 5.21.1 |
| LangChain | 1.3.4 |
| Milvus | 2.4.0 |
| PostgreSQL | 16 |
| Node.js | 18+ |

---

*文档版本: 1.0*
*最后更新: 2026-05-11*
