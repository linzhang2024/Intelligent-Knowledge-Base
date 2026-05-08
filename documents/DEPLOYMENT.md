# 项目打包和发布流程

## 目录

1. [项目概述](#项目概述)
2. [环境要求](#环境要求)
3. [开发环境准备](#开发环境准备)
4. [打包流程](#打包流程)
5. [数据库部署](#数据库部署)
6. [Milvus 向量数据库部署（可选）](#milvus-向量数据库部署可选)
7. [生产环境部署](#生产环境部署)
8. [Docker 容器化部署](#docker-容器化部署)
9. [配置管理](#配置管理)
10. [监控和维护](#监控和维护)
11. [故障排除](#故障排除)

***

## 项目概述

本项目是一个基于 Next.js 14 的智能知识库系统，支持：

- 文档上传与管理（PDF、DOCX、TXT、SQL）
- 知识库管理（私有/公开）
- 智能文档搜索（基于向量相似度）
- RAG 检索增强生成
- AI 对话问答
- 自然语言转 SQL
- Milvus 向量数据库支持

**技术栈**：

- 前端：Next.js 14, React 18, Tailwind CSS
- 后端：Next.js API Routes
- 数据库：SQLite / PostgreSQL / MySQL / Oracle
- 向量数据库：Milvus（可选）
- ORM：Prisma
- AI：LangChain.js, OpenAI/DashScope/DeepSeek API

***

## 环境要求

### 开发环境

| 组件             | 版本要求 | 说明               |
| -------------- | ---- | ---------------- |
| Node.js        | 18+  | JavaScript 运行时   |
| npm            | 9+   | 包管理器（或 yarn）     |
| Docker         | 20+  | 可选，用于数据库和 Milvus |
| Docker Compose | 2+   | 可选，用于容器编排        |

### 生产环境

| 组件   | 最低配置                | 推荐配置                 |
| ---- | ------------------- | -------------------- |
| CPU  | 2 核                 | 4+ 核                 |
| 内存   | 4GB                 | 8GB+                 |
| 磁盘   | 20GB                | 50GB+ SSD            |
| 操作系统 | Linux/Windows/macOS | Linux（Ubuntu 20.04+） |

***

## 开发环境准备

### 1. 克隆项目

```bash
# 克隆项目
git clone <repository_url>
cd Intelligent-Knowledge-Base
```

### 2. 安装依赖

```bash
# 安装项目依赖
npm install
```

### 3. 环境变量配置

```bash
# 复制环境变量模板
cp .env.example .env
```

编辑 `.env` 文件，配置必要的环境变量：

```env
# ============================================
# 数据库配置
# ============================================
# SQLite（开发环境推荐，无需 Docker）
DATABASE_URL="file:./dev.db"

# 或 PostgreSQL（生产环境推荐）
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/intelligent_knowledge_base"

# ============================================
# PostgreSQL 单独配置（用于 Docker Compose）
# ============================================
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="intelligent_knowledge_base"
DB_PORT="5432"
DB_HOST="localhost"

# ============================================
# AI 提供商配置（选择一个即可）
# ============================================

# 阿里云 DashScope
DASHSCOPE_API_KEY="your-dashscope-api-key-here"
EMBEDDING_MODEL="text-embedding-v2"
LLM_MODEL="qwen-plus"
LLM_TEMPERATURE="0.7"

# 或 OpenAI
# OPENAI_API_KEY="your-openai-api-key-here"
# EMBEDDING_MODEL="text-embedding-3-small"
# LLM_MODEL="gpt-3.5-turbo"

# 或 DeepSeek
# DEEPSEEK_API_KEY="your-deepseek-api-key-here"
# EMBEDDING_MODEL="deepseek-embedding"
# LLM_MODEL="deepseek-chat"
```

### 4. 数据库初始化

```bash
# 执行数据库迁移
npx prisma migrate dev --name init

# 生成 Prisma Client
npx prisma generate
```

### 5. 启动开发服务器

```bash
# 启动开发服务器（自动检查端口）
npm run dev

# 或直接启动
npm run dev:direct
```

访问地址：<http://localhost:3005>

***

## 打包流程

### 1. 代码检查

```bash
# 运行 ESLint 检查
npm run lint
```

### 2. 构建生产版本

```bash
# 执行构建
npm run build
```

构建过程说明：

1. **编译 TypeScript**：将 `.ts` 和 `.tsx` 文件编译为 JavaScript
2. **优化代码**：执行 Tree Shaking、代码压缩等优化
3. **生成静态资源**：生成 `.next` 目录，包含：
   - `.next/static/`：静态资源（CSS、JS、图片）
   - `.next/server/`：服务器端代码
   - `.next/cache/`：构建缓存

### 3. 构建产物结构

```
.next/
├── BUILD_ID              # 构建 ID
├── build-manifest.json   # 构建清单
├── cache/                # 缓存目录
├── package.json          # 依赖信息
├── prerender-manifest.json
├── react-loadable-manifest.json
├── server/               # 服务器端代码
│   ├── app/              # 应用服务端代码
│   ├── chunks/           # 代码分片
│   ├── pages/            # 页面服务端代码
│   └── vendor-chunks/    # 第三方库
├── static/               # 静态资源
│   ├── css/              # 样式文件
│   ├── chunks/           # JS 代码分片
│   └── media/            # 媒体资源
└── trace                 # 构建追踪信息
```

### 4. 本地测试生产版本

```bash
# 启动生产服务器
npm run start
```

访问地址：<http://localhost:3005>

***

## 数据库部署

### 方案一：SQLite（简单部署）

**适用场景**：开发环境、小型应用、单用户场景

**配置**：

```env
DATABASE_URL="file:./prisma/dev.db"
```

**优点**：

- 无需额外安装
- 配置简单
- 单文件存储，易于备份

**缺点**：

- 不支持并发写入
- 性能有限
- 不适合大规模数据

### 方案二：PostgreSQL（推荐生产环境）

**适用场景**：生产环境、企业级应用、多用户场景

**1. 使用 Docker Compose 启动**

```bash
# 启动 PostgreSQL 容器
docker-compose up -d

# 查看容器状态
docker-compose ps
```

**2. 手动安装 PostgreSQL**

```bash
# Ubuntu
sudo apt update
sudo apt install postgresql postgresql-contrib

# 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 创建数据库和用户
sudo -u postgres psql
CREATE DATABASE intelligent_knowledge_base;
CREATE USER ikb_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE intelligent_knowledge_base TO ikb_user;
\q
```

**3. 配置环境变量**

```env
DATABASE_URL="postgresql://ikb_user:your_password@localhost:5432/intelligent_knowledge_base"
DB_USER="ikb_user"
DB_PASSWORD="your_password"
DB_NAME="intelligent_knowledge_base"
DB_PORT="5432"
DB_HOST="localhost"
```

**4. 执行迁移**

```bash
# 生产环境使用
npx prisma migrate deploy
```

### 方案三：MySQL

**配置环境变量**：

```env
DATABASE_URL="mysql://root:password@localhost:3306/intelligent_knowledge_base"
DB_USER="root"
DB_PASSWORD="your_password"
DB_NAME="intelligent_knowledge_base"
DB_PORT="3306"
DB_HOST="localhost"
```

### 数据库迁移命令

```bash
# 开发环境：创建迁移并应用
npx prisma migrate dev --name <migration_name>

# 生产环境：应用已存在的迁移
npx prisma migrate deploy

# 查看迁移状态
npx prisma migrate status

# 重置数据库（小心使用！）
npx prisma migrate reset
```

***

## Milvus 向量数据库部署（可选）

### 概述

Milvus 是一个高性能向量数据库，用于存储和搜索文档向量。启用 Milvus 可以显著提升大规模数据的向量搜索性能。

### 1. 快速启动

```bash
# 进入项目目录
cd Intelligent-Knowledge-Base

# 使用 docker-compose 启动 Milvus 服务
docker-compose -f docker-compose-milvus.yml up -d
```

### 2. 验证服务状态

```bash
# 查看所有容器状态
docker ps -a
```

应该看到三个正在运行的容器：

- `milvus-etcd`：etcd 元数据存储
- `milvus-minio`：MinIO 对象存储
- `milvus-standalone`：Milvus 主服务

### 3. 服务组件说明

| 服务         | 容器名               | 端口          | 说明       |
| ---------- | ----------------- | ----------- | -------- |
| **Milvus** | milvus-standalone | 19530, 9091 | 向量数据库主服务 |
| **etcd**   | milvus-etcd       | 2379-2380   | 元数据存储    |
| **MinIO**  | milvus-minio      | 9000-9001   | 对象存储     |

### 4. 应用配置

**方式一：管理后台配置（推荐）**

1. 启动应用：`npm run dev`
2. 以管理员身份登录
3. 进入「管理后台」→「系统设置」→「Milvus 配置」
4. 填写配置：
   - 主机地址：`localhost`
   - 端口：`19530`
   - 向量维度：`1024`（根据 Embedding 模型调整）
5. 点击「测试连接」验证服务
6. 点击「初始化集合」创建集合和索引
7. 开启「启用 Milvus」开关并保存

**方式二：环境变量配置**

编辑 `.env` 文件：

```env
# ============================================
# Milvus 向量数据库配置
# ============================================

# 是否启用 Milvus
MILVUS_ENABLED=true

# Milvus 服务器地址
MILVUS_HOST=localhost

# Milvus 服务端口
MILVUS_PORT=19530

# Milvus 认证用户名（可选）
MILVUS_USERNAME=

# Milvus 认证密码（可选）
MILVUS_PASSWORD=

# 存储向量的集合名称
MILVUS_COLLECTION=document_chunks

# 向量维度（需与 Embedding 模型输出一致）
MILVUS_DIMENSIONS=1024
```

### 5. 向量维度说明

向量维度必须与使用的 Embedding 模型输出维度一致：

| 提供商           | 模型名称                    | 向量维度 |
| ------------- | ----------------------- | ---- |
| **DashScope** | text-embedding-v1/v2/v3 | 1024 |
| **OpenAI**    | text-embedding-3-small  | 1536 |
| **OpenAI**    | text-embedding-3-large  | 3072 |
| **OpenAI**    | text-embedding-ada-002  | 1536 |
| **DeepSeek**  | deepseek-embedding      | 1024 |

### 6. 数据迁移

如果有历史数据存储在关系型数据库中，需要迁移到 Milvus：

**方式一：管理后台迁移**

1. 进入「管理后台」→「系统设置」→「Milvus 配置」
2. 在「数据迁移」区域查看状态
3. 点击「开始迁移」按钮

**方式二：API 调用**

```bash
# 启动全量迁移
curl -X POST http://localhost:3005/api/admin/milvus-migrate \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'

# 获取迁移状态
curl http://localhost:3005/api/admin/milvus-migrate
```

### 7. 常用管理命令

```bash
# 启动 Milvus 服务
docker-compose -f docker-compose-milvus.yml up -d

# 停止 Milvus 服务
docker-compose -f docker-compose-milvus.yml down

# 重启 Milvus 服务
docker-compose -f docker-compose-milvus.yml restart

# 查看 Milvus 日志
docker logs milvus-standalone

# 实时查看日志
docker logs -f milvus-standalone

# 进入 Milvus 容器
docker exec -it milvus-standalone bash

# 查看资源使用
docker stats milvus-standalone milvus-etcd milvus-minio
```

### 8. 数据持久化

Milvus 数据存储在 `./volumes/` 目录下：

```
volumes/
├── etcd/      # etcd 元数据
├── minio/     # MinIO 对象存储
└── milvus/    # Milvus 数据和索引
```

**备份数据**：

```bash
# Windows PowerShell
Copy-Item -Path "volumes" -Destination "backup_$(Get-Date -Format 'yyyyMMdd')" -Recurse

# Linux/macOS
tar -czvf milvus_backup_$(date +%Y%m%d).tar.gz volumes/
```

### 9. 双后端架构说明

系统采用**双后端向量存储架构**：

1. **写入时双写**：新上传的文档向量会同时写入：
   - 关系型数据库（JSON 格式）
   - Milvus（如果已启用）
2. **搜索时自动切换**：
   - Milvus 启用时：使用 Milvus 专用索引搜索（高性能）
   - Milvus 未启用时：使用关系型数据库 + 内存计算
3. **向后兼容**：
   - 关系型数据库中的向量数据始终保留
   - 可随时在两种后端之间切换

***

## 生产环境部署

### 1. 环境准备

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 PM2（进程管理器）
sudo npm install -g pm2

# 安装 Docker（可选）
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
```

### 2. 项目部署

```bash
# 进入项目目录
cd /opt/intelligent-knowledge-base

# 安装依赖（生产环境）
npm ci --only=production

# 构建项目
npm run build

# 执行数据库迁移
npx prisma migrate deploy
```

### 3. 使用 PM2 启动

创建 `ecosystem.config.js`：

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
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
```

启动应用：

```bash
# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 重启应用
pm2 restart intelligent-knowledge-base

# 停止应用
pm2 stop intelligent-knowledge-base

# 设置开机自启
pm2 startup
pm2 save
```

### 4. 使用 Nginx 反向代理

安装 Nginx：

```bash
sudo apt install nginx -y
```

创建配置文件 `/etc/nginx/sites-available/ikb.conf`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 客户端最大上传大小
    client_max_body_size 100M;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+atom 
               application/javascript application/json;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 静态文件缓存
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3005;
        proxy_cache_valid 200 1y;
        proxy_cache_bypass $http_pragma;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API 超时设置
    location /api/ {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

启用配置：

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/ikb.conf /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 5. 配置 HTTPS（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 申请证书
sudo certbot --nginx -d your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

***

## Docker 容器化部署

### 1. 创建 Dockerfile

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源码
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 构建应用
RUN npm run build

# 生产阶段
FROM node:20-alpine AS runner

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3005

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# 安装生产依赖
RUN npm ci --only=production

# 更改权限
RUN chown -R nextjs:nodejs /app

USER nextjs

# 暴露端口
EXPOSE 3005

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3005/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# 启动命令
CMD ["node", "server.js"]
```

### 2. 修改 next.config.mjs

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',  // 添加这行
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/:path*',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      
      if (!Array.isArray(config.externals)) {
        config.externals = [config.externals];
      }
      
      config.externals.push(
        '@zilliz/milvus2-sdk-node',
        '@grpc/grpc-js',
        '@grpc/proto-loader',
      );
    }
    
    return config;
  },
};

export default nextConfig;
```

### 3. 创建 docker-compose.prod.yml

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
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-intelligent_knowledge_base}"]
      interval: 5s
      timeout: 5s
      retries: 5

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
      - DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY}
      - EMBEDDING_MODEL=${EMBEDDING_MODEL:-text-embedding-v2}
      - LLM_MODEL=${LLM_MODEL:-qwen-plus}
      - LLM_TEMPERATURE=${LLM_TEMPERATURE:-0.7}
      - MILVUS_ENABLED=${MILVUS_ENABLED:-false}
      - MILVUS_HOST=${MILVUS_HOST:-milvus-standalone}
      - MILVUS_PORT=${MILVUS_PORT:-19530}
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - app_uploads:/app/uploads
      - app_data:/app/data
    networks:
      - ikb-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3005"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    container_name: ikb-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ssl_certs:/etc/ssl/certs
    depends_on:
      - app
    networks:
      - ikb-network

volumes:
  postgres_data:
  app_uploads:
  app_data:
  ssl_certs:

networks:
  ikb-network:
    driver: bridge
```

### 4. 构建和部署

```bash
# 构建镜像
docker-compose -f docker-compose.prod.yml build

# 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 查看状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f

# 停止服务
docker-compose -f docker-compose.prod.yml down
```

***

## 配置管理

### 环境变量说明

| 变量名                 | 必填 | 说明               | 默认值                          |
| ------------------- | -- | ---------------- | ---------------------------- |
| `DATABASE_URL`      | 是  | 数据库连接字符串         | -                            |
| `DB_USER`           | 否  | 数据库用户名           | postgres                     |
| `DB_PASSWORD`       | 否  | 数据库密码            | postgres                     |
| `DB_NAME`           | 否  | 数据库名称            | intelligent\_knowledge\_base |
| `DB_PORT`           | 否  | 数据库端口            | 5432                         |
| `DB_HOST`           | 否  | 数据库主机            | localhost                    |
| `DASHSCOPE_API_KEY` | 否  | 阿里云 API Key      | -                            |
| `OPENAI_API_KEY`    | 否  | OpenAI API Key   | -                            |
| `DEEPSEEK_API_KEY`  | 否  | DeepSeek API Key | -                            |
| `EMBEDDING_MODEL`   | 否  | Embedding 模型     | text-embedding-v2            |
| `LLM_MODEL`         | 否  | LLM 模型           | qwen-plus                    |
| `LLM_TEMPERATURE`   | 否  | 温度参数             | 0.7                          |
| `MILVUS_ENABLED`    | 否  | 是否启用 Milvus      | false                        |
| `MILVUS_HOST`       | 否  | Milvus 主机        | localhost                    |
| `MILVUS_PORT`       | 否  | Milvus 端口        | 19530                        |
| `MILVUS_USERNAME`   | 否  | Milvus 用户名       | -                            |
| `MILVUS_PASSWORD`   | 否  | Milvus 密码        | -                            |
| `MILVUS_COLLECTION` | 否  | 集合名称             | document\_chunks             |
| `MILVUS_DIMENSIONS` | 否  | 向量维度             | 1024                         |

### 配置优先级

系统配置采用以下优先级（从高到低）：

1. **管理后台配置**（存储在数据库 `system_configs` 表）
2. **环境变量**（`.env` 文件或系统环境变量）
3. **默认值**（代码中定义的默认值）

### 敏感信息管理

**API Key 安全存储**：

- 管理后台配置的 API Key 会加密存储
- 环境变量中的 API Key 建议使用密钥管理服务
- 生产环境禁止将 API Key 提交到代码仓库

**.gitignore 配置**：

```
# 环境变量
.env
.env.local
.env.*.local

# 数据库文件
prisma/dev.db
prisma/*.db-journal

# 上传文件
uploads/

# 构建产物
.next/
out/

# 日志
logs/
*.log

# IDE
.idea/
.vscode/
```

***

## 监控和维护

### 1. 日志管理

**PM2 日志**：

```bash
# 查看实时日志
pm2 logs

# 查看错误日志
pm2 logs --err

# 清空日志
pm2 flush

# 日志轮转
pm2 install pm2-logrotate
```

**Docker 日志**：

```bash
# 查看容器日志
docker logs <container_name>

# 实时查看
docker logs -f <container_name>

# 查看最近 100 行
docker logs --tail 100 <container_name>
```

### 2. 数据库备份

**PostgreSQL 备份**：

```bash
# 手动备份
docker exec -t ikb-postgres pg_dumpall -c -U postgres > backup_$(date +%Y%m%d).sql

# 恢复
cat backup_20260506.sql | docker exec -i ikb-postgres psql -U postgres -d intelligent_knowledge_base
```

**SQLite 备份**：

```bash
# 直接复制数据库文件
cp prisma/dev.db backup_$(date +%Y%m%d).db
```

**自动化备份脚本**：

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# PostgreSQL 备份
docker exec -t ikb-postgres pg_dumpall -c -U postgres > $BACKUP_DIR/ikb_db_$DATE.sql

# Milvus 数据备份（如果使用）
if [ -d "./volumes" ]; then
    tar -czvf $BACKUP_DIR/ikb_milvus_$DATE.tar.gz ./volumes
fi

# 清理 7 天前的备份
find $BACKUP_DIR -type f -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -type f -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/ikb_db_$DATE.sql"
```

添加定时任务：

```bash
# 编辑 crontab
crontab -e

# 添加每天凌晨 2 点执行
0 2 * * * /opt/scripts/backup.sh >> /var/log/ikb_backup.log 2>&1
```

### 3. 性能监控

**系统资源监控**：

```bash
# 查看系统资源
htop

# 查看磁盘使用
df -h

# 查看内存使用
free -h

# 查看网络连接
netstat -tlnp
```

**Docker 资源监控**：

```bash
# 查看所有容器资源使用
docker stats

# 查看特定容器
docker stats ikb-app ikb-postgres

# 查看磁盘使用
docker system df
```

**应用性能监控**：

可集成以下监控工具：

- **Prometheus**：指标收集
- **Grafana**：可视化仪表盘
- **Sentry**：错误追踪
- **New Relic**：APM 监控

### 4. 定期维护任务

| 任务    | 频率  | 说明          |
| ----- | --- | ----------- |
| 数据库备份 | 每天  | 数据安全保障      |
| 日志清理  | 每周  | 释放磁盘空间      |
| 安全更新  | 每月  | 安装系统和依赖安全更新 |
| 性能检查  | 每月  | 检查系统性能指标    |
| 依赖更新  | 每季度 | 更新项目依赖（测试后） |

***

## 故障排除

### 1. 应用无法启动

**症状**：应用启动失败，页面无法访问

**排查步骤**：

1. **检查端口占用**：
   ```bash
   # Windows
   netstat -ano | findstr :3005

   # Linux/macOS
   lsof -i :3005
   netstat -tlnp | grep 3005
   ```
2. **查看应用日志**：
   ```bash
   # PM2
   pm2 logs intelligent-knowledge-base

   # Docker
   docker logs ikb-app
   ```
3. **检查数据库连接**：
   ```bash
   # 测试数据库连接
   npx prisma db execute --stdin <<< 'SELECT 1'
   ```
4. **验证环境变量**：
   ```bash
   # 检查环境变量是否正确设置
   node -e "console.log(process.env.DATABASE_URL)"
   ```

### 2. 数据库连接失败

**症状**：应用无法连接到数据库

**排查步骤**：

1. **检查数据库服务状态**：
   ```bash
   # Docker
   docker ps -a | grep postgres

   # 系统服务
   systemctl status postgresql
   ```
2. **验证连接参数**：
   ```bash
   # 测试连接
   npx prisma db pull --force
   ```
3. **检查防火墙**：
   ```bash
   # 查看防火墙规则
   sudo ufw status

   # 临时开放端口
   sudo ufw allow 5432
   ```
4. **检查数据库权限**：
   ```sql
   -- 验证用户权限
   SELECT * FROM pg_user WHERE usename = 'your_user';
   ```

### 3. Milvus 连接失败

**症状**：管理后台测试 Milvus 连接失败

**排查步骤**：

1. **检查 Milvus 容器状态**：
   ```bash
   docker ps -a | grep milvus
   ```
2. **检查所有三个服务**：
   - `milvus-etcd` 是否运行
   - `milvus-minio` 是否运行
   - `milvus-standalone` 是否运行
3. **查看 Milvus 日志**：
   ```bash
   docker logs milvus-standalone
   docker logs milvus-etcd
   docker logs milvus-minio
   ```
4. **测试端口连接**：
   ```bash
   # Windows PowerShell
   Test-NetConnection -ComputerName localhost -Port 19530

   # Linux/macOS
   nc -zv localhost 19530
   ```
5. **常见问题**：

   **问题 1：容器内存不足**
   - 解决方案：增加 Docker 内存限制（Windows/Mac）
   - 检查：`docker stats`
   **问题 2：端口被占用**
   - 解决方案：检查并释放端口 19530、9091、9000、9001、2379
   - 检查：`netstat -tlnp`
   **问题 3：数据目录权限问题**
   - 解决方案：检查 `./volumes` 目录权限
   - 修复：`chmod -R 755 volumes/`

### 4. AI API 调用失败

**症状**：文档向量化失败、AI 对话无响应

**排查步骤**：

1. **验证 API Key**：
   ```bash
   # 检查环境变量
   echo $DASHSCOPE_API_KEY
   echo $OPENAI_API_KEY
   ```
2. **测试 API 连接**：
   ```bash
   # DashScope 测试
   curl -s https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation \
     -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"qwen-plus","input":{"messages":[{"role":"user","content":"你好"}]},"parameters":{"result_format":"message"}}'
   ```
3. **检查网络连接**：
   ```bash
   # 测试 API 服务连通性
   ping dashscope.aliyuncs.com
   ping api.openai.com
   ```
4. **查看配额和余额**：
   - 登录阿里云/OpenAI 控制台
   - 检查 API 调用配额
   - 检查账户余额

### 5. 文档上传失败

**症状**：无法上传文档或上传后处理失败

**排查步骤**：

1. **检查文件大小限制**：
   - 默认限制：100MB
   - Nginx 配置：`client_max_body_size 100M;`
2. **检查文件类型**：
   - 支持的类型：PDF、DOCX、TXT、SQL
   - 检查 MIME 类型配置
3. **检查上传目录权限**：
   ```bash
   # 检查目录是否存在并有写入权限
   ls -la uploads/

   # 修复权限
   chmod -R 755 uploads/
   ```
4. **查看处理日志**：
   - 检查应用日志中的错误信息
   - 验证 AI API 是否正常工作

### 6. 向量搜索异常

**症状**：搜索结果不相关或返回空结果

**排查步骤**：

1. **检查向量数据**：
   ```bash
   # 检查数据库中的向量数据
   npx prisma db execute --stdin <<< 'SELECT COUNT(*) FROM document_chunks WHERE embedding IS NOT NULL;'
   ```
2. **验证 Milvus 数据（如果使用）**：
   - 在管理后台查看 Milvus 状态
   - 检查向量总数是否匹配
3. **检查向量维度**：
   - 确认 Milvus 配置的维度与 Embedding 模型一致
   - DashScope：1024 维
   - OpenAI：1536/3072 维
4. **重新初始化（如果维度不匹配）**：
   - 警告：这会删除所有 Milvus 数据
   - 在管理后台点击「初始化集合」
   - 重新执行数据迁移

### 7. Docker 容器问题

**症状**：容器无法启动或频繁重启

**排查步骤**：

1. **查看容器状态**：
   ```bash
   docker ps -a
   ```
2. **查看容器日志**：
   ```bash
   docker logs <container_name>
   ```
3. **检查资源使用**：
   ```bash
   docker stats
   docker system df
   ```
4. **重建容器**：
   ```bash
   # 停止并删除容器
   docker-compose down

   # 清除镜像缓存
   docker system prune -a

   # 重新构建和启动
   docker-compose up -d --build
   ```

### 8. 性能问题

**症状**：应用响应缓慢

**排查步骤**：

1. **检查系统资源**：
   ```bash
   # CPU 和内存
   htop

   # 磁盘 I/O
   iotop

   # 网络
   iftop
   ```
2. **检查数据库性能**：
   ```bash
   # 查看慢查询
   # PostgreSQL
   docker exec -it ikb-postgres psql -U postgres
   \x
   SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
   ```
3. **优化建议**：
   - 为数据库表添加适当索引
   - 启用 Milvus 提升向量搜索性能
   - 增加服务器资源
   - 配置 CDN 加速静态资源

### 9. 通用排查命令

```bash
# 检查所有服务状态
docker ps -a
pm2 status
systemctl status nginx

# 查看所有日志（最近 100 行）
docker logs --tail 100 ikb-app
docker logs --tail 100 ikb-postgres
pm2 logs --lines 100

# 网络诊断
ping your-domain.com
nslookup your-domain.com
traceroute your-domain.com

# 端口测试
telnet localhost 3005
nc -zv localhost 5432
curl -I http://localhost:3005

# 进程检查
ps aux | grep node
ps aux | grep postgres
```

### 10. 联系支持

如果以上步骤无法解决问题，请收集以下信息：

1. **环境信息**：
   - 操作系统版本
   - Node.js 版本
   - Docker 版本（如果使用）
2. **错误日志**：
   - 应用错误日志
   - 数据库错误日志
   - 容器日志（如果使用 Docker）
3. **配置信息**：
   - `.env` 文件（隐藏敏感信息）
   - Docker Compose 配置
   - Nginx 配置
4. **复现步骤**：
   - 问题发生的具体操作
   - 问题是否可复现
   - 问题发生的频率

***

## 附录

### A. 常用命令速查

```bash
# 开发
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run start            # 启动生产服务器
npm run lint             # 代码检查

# 数据库
npx prisma migrate dev   # 开发环境迁移
npx prisma migrate deploy # 生产环境迁移
npx prisma generate      # 生成 Client
npx prisma studio        # 打开数据库管理界面

# Docker
docker-compose up -d     # 启动服务
docker-compose down      # 停止服务
docker-compose ps        # 查看状态
docker logs -f <name>    # 查看日志

# PM2
pm2 start ecosystem.config.js  # 启动
pm2 status                     # 状态
pm2 logs                       # 日志
pm2 restart <name>             # 重启
pm2 stop <name>                # 停止
```

### B. 端口说明

| 端口        | 服务         | 说明            |
| --------- | ---------- | ------------- |
| **3005**  | Next.js 应用 | 主服务端口         |
| **5432**  | PostgreSQL | 数据库端口         |
| **19530** | Milvus     | 向量数据库 gRPC 端口 |
| **9091**  | Milvus     | 向量数据库 HTTP 端口 |
| **9000**  | MinIO      | 对象存储 API 端口   |
| **9001**  | MinIO      | 对象存储控制台端口     |
| **2379**  | etcd       | 元数据存储端口       |
| **80**    | Nginx      | HTTP 端口       |
| **443**   | Nginx      | HTTPS 端口      |

### C. 默认凭据

| 服务                      | 用户名        | 密码         | 说明          |
| ----------------------- | ---------- | ---------- | ----------- |
| **PostgreSQL (Docker)** | postgres   | postgres   | 可通过环境变量修改   |
| **MinIO**               | minioadmin | minioadmin | Milvus 依赖服务 |
| **Milvus**              | root       | （空）        | 默认无认证       |

### D. 目录结构

```
Intelligent-Knowledge-Base/
├── .next/                # 构建产物（构建后生成）
├── prisma/               # 数据库相关
│   ├── migrations/       # 迁移文件
│   ├── schema.prisma     # 数据库模型
│   └── dev.db            # SQLite 数据库
├── scripts/              # 脚本文件
├── src/                  # 源代码
│   ├── app/              # Next.js 应用
│   ├── components/       # 组件
│   ├── lib/              # 工具库
│   └── utils/            # 工具函数
├── test/                 # 测试文件
├── uploads/              # 上传文件（运行时生成）
├── volumes/              # Docker 数据卷（运行时生成）
│   ├── etcd/
│   ├── milvus/
│   └── minio/
├── .env                  # 环境变量
├── .env.example          # 环境变量模板
├── .gitignore
├── docker-compose.yml    # PostgreSQL 配置
├── docker-compose-milvus.yml  # Milvus 配置
├── ecosystem.config.js   # PM2 配置
├── next.config.mjs       # Next.js 配置
├── package.json          # 项目依赖
├── README.md             # 项目说明
├── DEPLOYMENT.md         # 本文档
└── MILVUS_SETUP.md       # Milvus 详细配置
```

### E. 版本信息

| 组件             | 版本      | 说明     |
| -------------- | ------- | ------ |
| **Next.js**    | 14.2.15 | 前端框架   |
| **React**      | 18.3.1  | UI 库   |
| **Prisma**     | 5.21.1  | ORM    |
| **LangChain**  | 1.3.4   | AI 框架  |
| **Milvus**     | 2.4.0   | 向量数据库  |
| **PostgreSQL** | 16      | 关系型数据库 |
| **Node.js**    | 18+     | 运行时    |

***

## 总结

本项目的部署流程涵盖了从开发到生产的完整生命周期：

1. **开发环境**：简单配置，支持 SQLite 快速启动
2. **构建流程**：标准化的 build 命令，生成优化的生产代码
3. **数据库**：支持多种关系型数据库，提供迁移工具
4. **向量数据库**：可选 Milvus 部署，提升大规模数据搜索性能
5. **生产部署**：支持 PM2 进程管理、Nginx 反向代理、Docker 容器化
6. **配置管理**：多层级配置，支持运行时修改
7. **监控维护**：完善的日志、备份、监控方案
8. **故障排除**：详细的问题排查指南

建议根据实际业务需求选择合适的部署方案：

- **小型应用/测试**：SQLite + PM2
- **中型应用**：PostgreSQL + PM2 + Nginx
- **大型应用/高性能**：PostgreSQL + Milvus + Docker + 负载均衡

如需更详细的配置说明，请参考：

- [README.md](./README.md)：项目功能和使用说明
- [MILVUS\_SETUP.md](./MILVUS_SETUP.md)：Milvus 详细配置指南

