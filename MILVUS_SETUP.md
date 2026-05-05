# Milvus 向量数据库配置指南

## 概述

Milvus 是一个开源的向量数据库，专门为 AI 应用设计，支持高性能向量相似度搜索、大规模向量存储和多种索引类型。

本指南详细说明如何在 Intelligent-Knowledge-Base 项目中配置和使用 Milvus 向量数据库。

## 目录

1. [前置条件](#前置条件)
2. [快速开始](#快速开始)
3. [Docker Compose 配置](#docker-compose-配置)
4. [应用配置](#应用配置)
5. [数据迁移](#数据迁移)
6. [管理命令](#管理命令)
7. [故障排除](#故障排除)
8. [高级配置](#高级配置)

---

## 前置条件

在开始配置 Milvus 之前，请确保您的系统满足以下要求：

### 软件要求

- **Docker**：已安装并运行
- **Docker Compose**：已安装（通常随 Docker 一起安装）
- **至少 8GB 可用内存**：Milvus 及其依赖服务（etcd、MinIO）需要足够的内存
- **至少 20GB 可用磁盘空间**：用于存储向量数据和相关文件

### 检查 Docker 状态

运行以下命令确保 Docker 正在运行：

```bash
docker --version
docker-compose --version
docker ps
```

如果 Docker 正常运行，您应该看到版本信息和正在运行的容器列表（如果有）。

---

## 快速开始

如果您已经安装了 Docker，可以按照以下快速步骤启动 Milvus：

### 步骤 1：启动 Milvus 服务

```bash
# 进入项目目录
cd d:\workspace\Trae\Intelligent-Knowledge-Base

# 使用 docker-compose 启动 Milvus 服务
docker-compose -f docker-compose-milvus.yml up -d
```

### 步骤 2：验证服务状态

```bash
# 查看所有容器状态
docker ps -a
```

您应该看到三个正在运行的容器：
- `milvus-etcd`：etcd 元数据存储
- `milvus-minio`：MinIO 对象存储
- `milvus-standalone`：Milvus 主服务

### 步骤 3：在应用中配置 Milvus

1. 启动应用：`npm run dev`
2. 以管理员身份登录
3. 进入「管理后台」→「系统设置」→「Milvus 配置」
4. 填写以下配置：
   - **主机地址**：`localhost`
   - **端口**：`19530`
   - **向量维度**：`1024`（根据您的 Embedding 模型调整）
5. 点击「测试连接」验证服务
6. 点击「初始化集合」创建必要的集合和索引
7. 开启「启用 Milvus」开关并保存

### 步骤 4：数据迁移（可选）

如果您有历史数据存储在关系型数据库中，可以：
1. 点击「开始迁移」将向量从关系型数据库迁移到 Milvus
2. 或者使用 API 调用：
   ```bash
   curl -X POST http://localhost:3005/api/admin/milvus-migrate \
     -H "Content-Type: application/json" \
     -d '{"action": "start"}'
   ```

---

## Docker Compose 配置

### 配置文件说明

项目使用 `docker-compose-milvus.yml` 文件来配置 Milvus 服务。该文件定义了三个必要的服务：

1. **etcd**：用于存储 Milvus 的元数据
2. **MinIO**：用于存储向量数据和索引文件
3. **Milvus Standalone**：Milvus 主服务

### 完整配置文件

```yaml
version: '3.5'

services:
  etcd:
    container_name: milvus-etcd
    image: quay.io/coreos/etcd:v3.5.5
    environment:
      - ETCD_AUTO_COMPACTION_MODE=revision
      - ETCD_AUTO_COMPACTION_RETENTION=1000
      - ETCD_QUOTA_BACKEND_BYTES=4294967296
      - ETCD_SNAPSHOT_COUNT=50000
    volumes:
      - ${DOCKER_VOLUME_DIRECTORY:-.}/volumes/etcd:/etcd
    command: etcd -advertise-client-urls=http://127.0.0.1:2379 -listen-client-urls http://0.0.0.0:2379 --data-dir /etcd
    networks:
      - milvus

  minio:
    container_name: milvus-minio
    image: minio/minio:RELEASE.2023-03-20T20-16-18Z
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    ports:
      - "9001:9001"
      - "9000:9000"
    volumes:
      - ${DOCKER_VOLUME_DIRECTORY:-.}/volumes/minio:/minio_data
    command: minio server /minio_data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    networks:
      - milvus

  standalone:
    container_name: milvus-standalone
    image: milvusdb/milvus:v2.4.0
    command: ["milvus", "run", "standalone"]
    environment:
      ETCD_ENDPOINTS: etcd:2379
      MINIO_ADDRESS: minio:9000
    volumes:
      - ${DOCKER_VOLUME_DIRECTORY:-.}/volumes/milvus:/var/lib/milvus
    ports:
      - "19530:19530"
      - "9091:9091"
    depends_on:
      - "etcd"
      - "minio"
    networks:
      - milvus

networks:
  default:
    name: milvus
  milvus:
    external: false
```

### 服务说明

#### 1. etcd 服务

| 配置项 | 值 | 说明 |
|--------|-----|------|
| **镜像** | quay.io/coreos/etcd:v3.5.5 | etcd 官方镜像，版本 3.5.5 |
| **容器名** | milvus-etcd | 容器名称 |
| **自动压缩模式** | revision | 基于版本号压缩 |
| **压缩保留** | 1000 | 保留最近 1000 个版本 |
| **后端配额** | 4GB | 最大存储大小 |
| **数据目录** | /etcd | etcd 数据存储目录 |
| **卷挂载** | ./volumes/etcd:/etcd | 持久化存储 |

#### 2. MinIO 服务

| 配置项 | 值 | 说明 |
|--------|-----|------|
| **镜像** | minio/minio:RELEASE.2023-03-20T20-16-18Z | MinIO 官方镜像 |
| **容器名** | milvus-minio | 容器名称 |
| **访问密钥** | minioadmin | API 访问密钥 |
| **密钥** | minioadmin | API 密钥 |
| **端口** | 9000, 9001 | API 端口和控制台端口 |
| **数据目录** | /minio_data | MinIO 数据存储目录 |
| **卷挂载** | ./volumes/minio:/minio_data | 持久化存储 |

**MinIO 控制台访问**：
- **URL**：http://localhost:9001
- **用户名**：minioadmin
- **密码**：minioadmin

#### 3. Milvus Standalone 服务

| 配置项 | 值 | 说明 |
|--------|-----|------|
| **镜像** | milvusdb/milvus:v2.4.0 | Milvus 官方镜像，版本 2.4.0 |
| **容器名** | milvus-standalone | 容器名称 |
| **etcd 端点** | etcd:2379 | etcd 服务地址 |
| **MinIO 地址** | minio:9000 | MinIO 服务地址 |
| **数据目录** | /var/lib/milvus | Milvus 数据存储目录 |
| **卷挂载** | ./volumes/milvus:/var/lib/milvus | 持久化存储 |
| **端口** | 19530, 9091 | 服务端口和管理端口 |

### 网络配置

所有服务都连接到名为 `milvus` 的 Docker 网络，确保服务之间可以相互通信。

### 数据持久化

所有数据都存储在 `./volumes/` 目录下：
- `./volumes/etcd/`：etcd 元数据
- `./volumes/minio/`：MinIO 对象存储数据
- `./volumes/milvus/`：Milvus 数据和索引

### 自定义存储路径

如果需要更改数据存储路径，可以设置 `DOCKER_VOLUME_DIRECTORY` 环境变量：

```bash
# Windows PowerShell
$env:DOCKER_VOLUME_DIRECTORY="D:\data\milvus"
docker-compose -f docker-compose-milvus.yml up -d

# Linux/macOS
export DOCKER_VOLUME_DIRECTORY="/data/milvus"
docker-compose -f docker-compose-milvus.yml up -d
```

---

## 应用配置

配置 Milvus 服务启动后，需要在应用中配置连接信息。有两种配置方式：

### 方式一：管理后台配置（推荐）

1. **启动应用**：
   ```bash
   npm run dev
   ```

2. **登录系统**：
   - 访问 http://localhost:3005
   - 使用管理员账户登录

3. **进入配置页面**：
   - 点击「管理后台」
   - 点击「系统设置」
   - 选择「Milvus 配置」标签页

4. **填写配置信息**：

   | 配置项 | 说明 | 默认值 |
   |--------|------|--------|
   | **启用 Milvus** | 是否使用 Milvus 作为向量存储后端 | 关闭 |
   | **主机地址** | Milvus 服务器地址 | localhost |
   | **端口** | Milvus 服务端口 | 19530 |
   | **用户名** | Milvus 认证用户名（可选） | 空 |
   | **密码** | Milvus 认证密码（可选） | 空 |
   | **集合名称** | 存储向量的集合名称 | document_chunks |
   | **向量维度** | Embedding 模型输出的向量维度 | 1024 |

5. **测试连接**：
   - 点击「测试连接」按钮
   - 如果连接成功，会显示「连接成功」提示

6. **初始化集合**：
   - 点击「初始化集合」按钮
   - 系统会自动创建 `document_chunks` 集合和索引

7. **保存配置**：
   - 开启「启用 Milvus」开关
   - 点击「保存配置」按钮

### 方式二：环境变量配置

编辑 `.env` 文件，添加以下配置：

```env
# ============================================
# Milvus 向量数据库配置
# ============================================

# 是否启用 Milvus（true/false）
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

> **重要提示**：管理后台配置优先级高于环境变量。建议通过管理后台页面进行配置，配置会保存到数据库的 `system_config` 表中。

### 向量维度配置

向量维度必须与实际使用的 Embedding 模型输出维度一致：

| 提供商 | 模型名称 | 向量维度 |
|--------|---------|---------|
| **DashScope** | text-embedding-v1 | 1024 |
| **DashScope** | text-embedding-v2 | 1024 |
| **DashScope** | text-embedding-v3 | 1024 |
| **OpenAI** | text-embedding-3-small | 1536 |
| **OpenAI** | text-embedding-3-large | 3072 |
| **OpenAI** | text-embedding-ada-002 | 1536 |
| **DeepSeek** | deepseek-embedding | 1024 |

**配置示例**：
- 如果使用 DashScope 的 `text-embedding-v2`，设置 `MILVUS_DIMENSIONS=1024`
- 如果使用 OpenAI 的 `text-embedding-3-small`，设置 `MILVUS_DIMENSIONS=1536`

> **注意**：如果向量维度不匹配，会导致搜索结果异常或插入失败。如果需要更改维度，需要重新初始化集合并迁移数据。

### Milvus 集合结构

系统自动创建的 `document_chunks` 集合结构：

| 字段名 | 数据类型 | 说明 |
|--------|---------|------|
| **id** | VarChar(64) | 主键，使用 chunk_id |
| **chunk_id** | VarChar(64) | 文档切片 ID |
| **document_id** | VarChar(64) | 所属文档 ID |
| **knowledge_base_id** | VarChar(64) | 所属知识库 ID |
| **content** | VarChar(65535) | 切片文本内容 |
| **embedding** | FloatVector | 向量数据（维度由配置决定） |
| **model** | VarChar(256) | 使用的 Embedding 模型 |

### 索引配置

系统自动创建的索引配置：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| **索引类型** | IVF_FLAT | 倒排文件索引，适合精确搜索 |
| **度量类型** | COSINE | 余弦相似度 |
| **参数** | nlist = 1024 | 聚类中心数量 |

### 双后端架构

系统采用**双后端向量存储架构**，具有以下特性：

1. **写入时双写**：
   - 新上传的文档向量会同时写入关系型数据库和 Milvus（如果 Milvus 已启用）
   - 确保数据一致性和安全性

2. **搜索时自动切换**：
   - 根据 `milvus.enabled` 配置自动选择搜索后端
   - 如果 Milvus 已启用，使用 Milvus 进行向量搜索
   - 如果 Milvus 未启用，使用关系型数据库进行向量搜索

3. **向后兼容**：
   - 关系型数据库中的向量数据始终保留
   - 可随时在两种后端之间切换
   - 无需担心数据丢失

---

## 数据迁移

系统提供完整的数据迁移工具，支持从关系型数据库迁移向量数据到 Milvus。

### 迁移流程

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

### 迁移方式

#### 方式一：管理后台迁移（推荐）

1. **进入配置页面**：
   - 进入「管理后台」→「系统设置」→「Milvus 配置」

2. **查看迁移状态**：
   - 在「数据迁移」区域查看当前状态
   - 显示 Milvus 状态、集合名称、向量总数、维度
   - 显示迁移状态（是否运行中、进度、错误数量）

3. **启动迁移**：
   - 点击「开始迁移」按钮
   - 系统会自动开始全量数据迁移

4. **监控进度**：
   - 查看进度条和统计信息
   - 已处理数量 / 总数
   - 错误数量

#### 方式二：API 调用

**启动全量迁移**：
```bash
curl -X POST http://localhost:3005/api/admin/milvus-migrate \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'
```

**获取迁移状态**：
```bash
curl http://localhost:3005/api/admin/milvus-migrate
```

**迁移单个文档**：
```bash
curl -X POST http://localhost:3005/api/admin/milvus-migrate \
  -H "Content-Type: application/json" \
  -d '{"action": "migrateDocument", "documentId": "doc-xxx"}'
```

**清除文档向量**：
```bash
curl -X POST http://localhost:3005/api/admin/milvus-migrate \
  -H "Content-Type: application/json" \
  -d '{"action": "clearDocument", "documentId": "doc-xxx"}'
```

### 迁移特性

1. **批量处理**：
   - 每次处理 100 个向量
   - 减少内存占用
   - 提高迁移效率

2. **错误处理**：
   - 单个向量迁移失败不会影响其他向量
   - 错误会被记录
   - 可重新执行迁移

3. **幂等性**：
   - 可多次执行迁移
   - 已存在的向量会被覆盖（使用 chunk_id 作为主键）
   - 确保数据一致性

4. **向后兼容**：
   - 关系型数据库中的向量数据不会被删除
   - 可随时切换回原后端
   - 保障数据安全

### 迁移状态说明

**状态返回示例**：
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

**状态字段说明**：

| 字段 | 说明 |
|------|------|
| **isRunning** | 是否正在迁移中 |
| **total** | 总向量数量 |
| **processed** | 已处理数量 |
| **errors** | 错误数量 |
| **startTime** | 开始时间 |
| **endTime** | 结束时间 |

### 迁移失败处理

如果迁移过程中出现错误：

1. **查看错误数量**：
   - 在管理后台查看迁移状态中的错误数量
   - 或者通过 API 获取详细错误信息

2. **检查日志**：
   - 查看应用日志获取详细错误信息
   - 检查 Milvus 服务状态

3. **重新迁移**：
   - 点击「开始迁移」按钮重新执行
   - 已成功的向量会被更新
   - 失败的向量会被重试

4. **分批迁移**：
   - 如果数据量特别大，考虑分批迁移
   - 使用「迁移单个文档」功能测试

---

## 管理命令

### 启动和停止服务

**启动 Milvus 服务**：
```bash
docker-compose -f docker-compose-milvus.yml up -d
```

**停止 Milvus 服务**：
```bash
docker-compose -f docker-compose-milvus.yml down
```

**重启 Milvus 服务**：
```bash
docker-compose -f docker-compose-milvus.yml restart
```

**停止并删除数据（小心使用！）**：
```bash
docker-compose -f docker-compose-milvus.yml down -v
```

### 查看服务状态

**查看所有容器状态**：
```bash
docker ps -a
```

**查看 Milvus 容器状态**：
```bash
# Windows PowerShell
docker ps -a | Select-String "milvus"

# Linux/macOS
docker ps -a | grep milvus
```

### 查看日志

**查看 Milvus 日志**：
```bash
docker logs milvus-standalone
```

**实时查看 Milvus 日志**：
```bash
docker logs -f milvus-standalone
```

**查看 etcd 日志**：
```bash
docker logs milvus-etcd
```

**查看 MinIO 日志**：
```bash
docker logs milvus-minio
```

### 数据管理

**查看数据目录**：
```bash
# Windows PowerShell
ls volumes\

# Linux/macOS
ls -la volumes/
```

**备份数据**：
```bash
# Windows PowerShell
Copy-Item -Path "volumes" -Destination "backup_$(Get-Date -Format 'yyyyMMdd')" -Recurse

# Linux/macOS
tar -czvf milvus_backup_$(date +%Y%m%d).tar.gz volumes/
```

**恢复数据**：
```bash
# Windows PowerShell
# 先停止服务
docker-compose -f docker-compose-milvus.yml down
# 删除旧数据
Remove-Item -Path "volumes" -Recurse -Force
# 恢复备份
Copy-Item -Path "backup_20260505" -Destination "volumes" -Recurse
# 启动服务
docker-compose -f docker-compose-milvus.yml up -d

# Linux/macOS
# 先停止服务
docker-compose -f docker-compose-milvus.yml down
# 删除旧数据
rm -rf volumes/
# 恢复备份
tar -xzvf milvus_backup_20260505.tar.gz
# 启动服务
docker-compose -f docker-compose-milvus.yml up -d
```

### 进入容器

**进入 Milvus 容器**：
```bash
docker exec -it milvus-standalone bash
```

**进入 etcd 容器**：
```bash
docker exec -it milvus-etcd bash
```

**进入 MinIO 容器**：
```bash
docker exec -it milvus-minio bash
```

### 性能监控

**查看容器资源使用情况**：
```bash
docker stats
```

**查看特定容器资源使用**：
```bash
docker stats milvus-standalone milvus-etcd milvus-minio
```

---

## 故障排除

### 问题 1：Milvus 服务无法启动

**症状**：
- 执行 `docker-compose up` 后容器立即退出
- 容器状态显示 `Exited`

**解决方案**：

1. **检查 Docker 状态**：
   ```bash
   docker info
   ```

2. **查看容器日志**：
   ```bash
   docker logs milvus-standalone
   docker logs milvus-etcd
   docker logs milvus-minio
   ```

3. **检查端口占用**：
   ```bash
   # Windows PowerShell
   netstat -ano | findstr :19530
   netstat -ano | findstr :9091
   netstat -ano | findstr :9000
   netstat -ano | findstr :9001

   # Linux/macOS
   netstat -tlnp | grep 19530
   lsof -i :19530
   ```

4. **检查内存**：
   - 确保系统至少有 8GB 可用内存
   - 检查 Docker 内存限制（Windows/Mac）

5. **重新创建容器**：
   ```bash
   # 停止并删除容器
   docker-compose -f docker-compose-milvus.yml down -v
   
   # 重新启动
   docker-compose -f docker-compose-milvus.yml up -d
   ```

### 问题 2：应用无法连接到 Milvus

**症状**：
- 在管理后台点击「测试连接」失败
- 应用日志显示连接错误

**解决方案**：

1. **检查 Milvus 状态**：
   ```bash
   docker ps -a
   ```
   确保所有三个容器都在运行。

2. **检查端口映射**：
   ```bash
   docker port milvus-standalone
   ```
   确认端口 19530 已正确映射。

3. **测试网络连接**：
   ```bash
   # Windows PowerShell
   Test-NetConnection -ComputerName localhost -Port 19530

   # Linux/macOS
   telnet localhost 19530
   # 或
   nc -zv localhost 19530
   ```

4. **检查防火墙**：
   - 确保防火墙允许端口 19530
   - 临时关闭防火墙测试

5. **检查配置**：
   - 确认主机地址为 `localhost`
   - 确认端口为 `19530`
   - 确认用户名和密码为空（默认配置）

### 问题 3：向量搜索结果异常

**症状**：
- 搜索结果不相关
- 搜索返回空结果
- 报错维度不匹配

**解决方案**：

1. **检查向量维度**：
   - 确认 Milvus 配置中的向量维度与 Embedding 模型输出一致
   - 参考「向量维度配置」章节

2. **重新初始化集合**：
   - 如果维度不匹配，需要重新初始化集合
   - **警告**：这会删除所有现有数据
   - 在管理后台点击「初始化集合」按钮

3. **检查索引状态**：
   - 确保索引已创建
   - 在管理后台查看集合状态

4. **检查数据**：
   - 确认向量数据已正确插入
   - 执行数据迁移（如果需要）

### 问题 4：数据迁移失败

**症状**：
- 迁移进度停滞
- 错误数量持续增加
- 迁移状态显示失败

**解决方案**：

1. **检查 Milvus 连接**：
   - 确保 Milvus 服务正常运行
   - 测试连接是否成功

2. **检查向量数据**：
   - 关系型数据库中的 `embedding` 字段存储的是 JSON 格式
   - 检查是否有无效的 JSON 数据
   - 可重新解析文档修复向量化数据

3. **检查内存**：
   - 迁移时会批量处理（每次 100 个向量）
   - 如果数据量特别大，考虑分批迁移

4. **查看日志**：
   - 查看应用日志获取详细错误信息
   - 检查 Milvus 服务日志

5. **分批迁移**：
   - 使用「迁移单个文档」功能测试
   - 先迁移少量数据验证

### 问题 5：容器内存不足

**症状**：
- 容器频繁重启
- 服务响应缓慢
- 日志显示内存相关错误

**解决方案**：

1. **增加 Docker 内存限制**（Windows/Mac）：
   - 打开 Docker Desktop
   - 进入 Settings → Resources → Advanced
   - 增加 Memory 限制（建议至少 8GB）
   - 点击 Apply & Restart

2. **检查容器资源使用**：
   ```bash
   docker stats
   ```

3. **清理 Docker 资源**：
   ```bash
   # 清理未使用的镜像
   docker image prune -a
   
   # 清理未使用的容器
   docker container prune
   
   # 清理所有未使用的资源
   docker system prune -a
   ```

4. **调整服务配置**：
   - 对于开发环境，可以考虑减少服务数量
   - 或者使用更轻量级的配置

### 问题 6：MinIO 健康检查失败

**症状**：
- MinIO 容器状态显示 `unhealthy`
- Milvus 无法连接到 MinIO

**解决方案**：

1. **检查 MinIO 日志**：
   ```bash
   docker logs milvus-minio
   ```

2. **测试 MinIO 连接**：
   ```bash
   # Windows PowerShell
   Test-NetConnection -ComputerName localhost -Port 9000

   # Linux/macOS
   curl -f http://localhost:9000/minio/health/live
   ```

3. **访问 MinIO 控制台**：
   - 打开浏览器访问 http://localhost:9001
   - 使用用户名 `minioadmin` 和密码 `minioadmin` 登录
   - 检查存储桶状态

4. **检查数据目录权限**：
   ```bash
   # Windows PowerShell
   Get-Acl volumes\minio

   # Linux/macOS
   ls -la volumes/minio
   ```

5. **重新创建 MinIO 容器**：
   ```bash
   # 停止服务
   docker-compose -f docker-compose-milvus.yml down
   
   # 删除 MinIO 数据（小心使用！）
   Remove-Item -Path "volumes\minio" -Recurse -Force
   
   # 重新启动
   docker-compose -f docker-compose-milvus.yml up -d
   ```

### 问题 7：etcd 启动失败

**症状**：
- etcd 容器无法启动
- Milvus 无法连接到 etcd

**解决方案**：

1. **检查 etcd 日志**：
   ```bash
   docker logs milvus-etcd
   ```

2. **检查数据目录**：
   ```bash
   # Windows PowerShell
   ls volumes\etcd

   # Linux/macOS
   ls -la volumes/etcd
   ```

3. **检查端口占用**：
   ```bash
   # Windows PowerShell
   netstat -ano | findstr :2379

   # Linux/macOS
   netstat -tlnp | grep 2379
   ```

4. **重新创建 etcd 容器**：
   ```bash
   # 停止服务
   docker-compose -f docker-compose-milvus.yml down
   
   # 删除 etcd 数据（小心使用！）
   Remove-Item -Path "volumes\etcd" -Recurse -Force
   
   # 重新启动
   docker-compose -f docker-compose-milvus.yml up -d
   ```

### 通用故障排除步骤

1. **检查容器状态**：
   ```bash
   docker ps -a
   ```

2. **查看容器日志**：
   ```bash
   docker logs <container_name>
   ```

3. **重启服务**：
   ```bash
   docker-compose -f docker-compose-milvus.yml restart
   ```

4. **重新创建服务**：
   ```bash
   # 停止并删除容器
   docker-compose -f docker-compose-milvus.yml down
   
   # 重新启动
   docker-compose -f docker-compose-milvus.yml up -d
   ```

5. **查看 Docker 事件**：
   ```bash
   docker events
   ```

6. **检查 Docker 磁盘空间**：
   ```bash
   docker system df
   ```

---

## 高级配置

### 启用 Milvus 认证

默认情况下，Milvus 没有启用认证。在生产环境中，建议启用认证。

1. **创建 Milvus 配置文件**：

   创建 `milvus.yaml` 文件：
   ```yaml
   common:
     security:
       authorizationEnabled: true
   ```

2. **修改 docker-compose-milvus.yml**：

   在 standalone 服务中添加配置文件挂载：
   ```yaml
   standalone:
     container_name: milvus-standalone
     image: milvusdb/milvus:v2.4.0
     command: ["milvus", "run", "standalone"]
     environment:
       ETCD_ENDPOINTS: etcd:2379
       MINIO_ADDRESS: minio:9000
     volumes:
       - ${DOCKER_VOLUME_DIRECTORY:-.}/volumes/milvus:/var/lib/milvus
       - ./milvus.yaml:/milvus/configs/milvus.yaml  # 添加这行
     ports:
       - "19530:19530"
       - "9091:9091"
     depends_on:
       - "etcd"
       - "minio"
   ```

3. **设置默认用户名和密码**：

   Milvus 默认的 root 用户密码为空。首次连接后需要设置密码：
   ```python
   from pymilvus import connections, utility
   
   # 连接到 Milvus
   connections.connect(host="localhost", port="19530")
   
   # 设置 root 用户密码
   utility.reset_password("root", "", "your_secure_password")
   ```

4. **更新应用配置**：

   在管理后台的 Milvus 配置页面：
   - 用户名：`root`
   - 密码：`your_secure_password`

### 配置 HTTPS

在生产环境中，建议为 Milvus 配置 HTTPS。

1. **准备证书文件**：
   - server.crt：服务器证书
   - server.key：服务器私钥

2. **修改 Milvus 配置**：

   在 `milvus.yaml` 中添加 TLS 配置：
   ```yaml
   common:
     security:
       tlsMode: 1  # 1: 仅服务器认证, 2: 双向认证
   
   proxy:
     port: 19530
     tlsPort: 19531
   ```

3. **修改 docker-compose-milvus.yml**：

   添加证书文件挂载：
   ```yaml
   standalone:
     # ... 其他配置
     volumes:
       - ${DOCKER_VOLUME_DIRECTORY:-.}/volumes/milvus:/var/lib/milvus
       - ./milvus.yaml:/milvus/configs/milvus.yaml
       - ./certs/server.crt:/milvus/configs/certs/server.crt
       - ./certs/server.key:/milvus/configs/certs/server.key
     ports:
       - "19530:19530"
       - "19531:19531"  # TLS 端口
       - "9091:9091"
   ```

### 调整性能参数

根据您的硬件配置和使用场景，可以调整 Milvus 的性能参数。

1. **创建自定义配置文件**：

   ```yaml
   # milvus.yaml
   queryNode:
     gpu:
       initMemSize: 0
       maxMemSize: 0
   
   dataCoord:
     segment:
       maxSize: 512
       sealProportion: 0.23
   
   dataNode:
     dataSync:
       period: 300
   
   queryCoord:
     autoHandoff: true
   
   indexCoord:
     enableGpu: false
   ```

2. **挂载配置文件**：

   参考前面的步骤，在 docker-compose-milvus.yml 中挂载配置文件。

### 配置集群模式

对于生产环境，建议使用 Milvus 集群模式以获得高可用性和可扩展性。

集群模式需要更多的服务组件：
- 多个 etcd 实例（集群模式）
- 多个 MinIO 实例（分布式模式）
- Milvus 服务分离（Proxy、Data Node、Query Node、Index Node 等）

详细的集群配置请参考 [Milvus 官方文档](https://milvus.io/docs/install_cluster-docker.md)。

### 监控和告警

#### 使用 Prometheus 监控

Milvus 支持 Prometheus 监控。

1. **配置 Milvus 指标**：

   在 `milvus.yaml` 中启用指标：
   ```yaml
   common:
     metrics:
       enable: true
   ```

2. **配置 Prometheus**：

   创建 `prometheus.yml`：
   ```yaml
   global:
     scrape_interval: 15s
   
   scrape_configs:
     - job_name: 'milvus'
       static_configs:
         - targets: ['milvus-standalone:9091']
   ```

3. **使用 Grafana 可视化**：

   - 导入 Milvus 官方 Dashboard
   - 监控关键指标：QPS、延迟、内存使用、存储使用等

#### 关键监控指标

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| **milvus_query_latency** | 查询延迟 | P99 > 500ms |
| **milvus_insert_latency** | 插入延迟 | P99 > 1000ms |
| **milvus_memory_usage** | 内存使用 | > 80% |
| **milvus_disk_usage** | 磁盘使用 | > 80% |
| **milvus_etcd_health** | etcd 健康状态 | != 1 |
| **milvus_minio_health** | MinIO 健康状态 | != 1 |

---

## 附录

### 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| **19530** | Milvus | gRPC 服务端口 |
| **9091** | Milvus | HTTP 管理端口/指标端口 |
| **9000** | MinIO | API 端口 |
| **9001** | MinIO | 控制台端口 |
| **2379** | etcd | 客户端端口 |
| **2380** | etcd | 集群通信端口 |

### 默认凭据

| 服务 | 用户名 | 密码 |
|------|--------|------|
| **MinIO** | minioadmin | minioadmin |
| **Milvus (默认)** | root | （空） |

### 数据目录结构

```
volumes/
├── etcd/                    # etcd 元数据
│   └── ...
├── minio/                   # MinIO 对象存储
│   └── minio_data/
│       └── ...
└── milvus/                  # Milvus 数据
    └── var/
        └── lib/
            └── milvus/
                └── ...
```

### 相关链接

- **Milvus 官方网站**：https://milvus.io/
- **Milvus 官方文档**：https://milvus.io/docs
- **Milvus GitHub**：https://github.com/milvus-io/milvus
- **MinIO 官方网站**：https://min.io/
- **etcd 官方网站**：https://etcd.io/

### 版本信息

| 组件 | 版本 | 说明 |
|------|------|------|
| **Milvus** | v2.4.0 | 向量数据库 |
| **etcd** | v3.5.5 | 元数据存储 |
| **MinIO** | RELEASE.2023-03-20T20-16-18Z | 对象存储 |

---

## 总结

Milvus 向量数据库为 Intelligent-Knowledge-Base 项目提供了高性能的向量存储和搜索能力。通过本指南，您应该能够：

1. ✅ 使用 Docker Compose 快速启动 Milvus 服务
2. ✅ 在应用中配置 Milvus 连接
3. ✅ 管理 Milvus 服务（启动、停止、重启）
4. ✅ 进行数据迁移
5. ✅ 故障排除常见问题
6. ✅ 了解高级配置选项

如果您遇到任何问题或需要进一步的帮助，请参考：
- 本指南的「故障排除」章节
- Milvus 官方文档
- 项目 README.md
