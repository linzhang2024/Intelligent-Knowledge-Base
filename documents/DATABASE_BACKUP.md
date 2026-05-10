# 数据库备份指南

## 概述

本项目提供了完整的数据库备份解决方案，支持：
- **关系型数据库**：SQLite 和 PostgreSQL
- **向量数据库**：Milvus（可选，如果启用）
- **Schema 文件**：Prisma schema

## 使用方法

### 方式一：使用 npm 命令（推荐）

```bash
npm run db:backup
```

### 方式二：直接运行脚本

```bash
node scripts/backup-db.js
```

### 方式三：Windows PowerShell 管理员身份运行

```powershell
# 如果需要在计划任务中运行
$env:Path = "C:\Program Files\nodejs;$env:Path"
npm run db:backup
```

## 功能说明

备份脚本会自动完成以下操作：

1. **自动检测数据库类型**（SQLite 或 PostgreSQL）
2. **自动检测 Milvus 状态**（是否启用向量数据库）
3. **创建 backup 目录**（如果不存在）
4. **根据时间戳生成唯一备份文件名**
5. **备份关系型数据库**：
   - SQLite：直接复制数据库文件
   - PostgreSQL：使用 pg_dump 导出 SQL 转储
6. **备份 Schema 文件**：`prisma/schema.prisma`
7. **备份 Milvus 向量数据库**（如果启用）：
   - etcd 元数据
   - MinIO 对象存储（包含向量数据和索引）
   - Milvus 主服务数据
8. **创建恢复说明文件**：`README.txt`

## 备份文件格式

### SQLite 数据库

备份文件命名格式：
```
backup_sqlite_YYYY-MM-DD_HH-MM-SS-SSSZ.db
schema_YYYY-MM-DD_HH-MM-SS-SSSZ.prisma
```

### PostgreSQL 数据库

备份文件命名格式：
```
backup_postgres_YYYY-MM-DD_HH-MM-SS-SSSZ.sql
schema_YYYY-MM-DD_HH-MM-SS-SSSZ.prisma
```

### Milvus 向量数据库（如果启用）

备份目录命名格式：
```
milvus_backup_YYYY-MM-DD_HH-MM-SS-SSSZ/
├── etcd/              # etcd 元数据
├── minio/             # MinIO 对象存储（向量数据）
├── milvus/            # Milvus 主服务数据
└── README.txt         # 恢复说明
```

## 备份目录结构

完整的备份目录结构示例：

```
backup/
├── backup_sqlite_2026-05-08_10-30-00-000Z.db      # SQLite 数据库
├── schema_2026-05-08_10-30-00-000Z.prisma         # Schema 文件
└── milvus_backup_2026-05-08_10-30-00-000Z/        # Milvus 备份（如果启用）
    ├── etcd/
    │   └── ...                                    # etcd 数据
    ├── minio/
    │   └── minio_data/                            # MinIO 存储的向量数据
    ├── milvus/
    │   └── var/                                   # Milvus 数据
    └── README.txt                                 # 恢复说明
```

## 注意事项

### PostgreSQL 备份要求

使用 PostgreSQL 时，需要确保系统已安装 `pg_dump` 工具并在环境变量 PATH 中可用。

**检查是否安装**：
```bash
pg_dump --version
```

**安装方法**：
- **Windows**: 安装 PostgreSQL 客户端工具
- **Linux**: `sudo apt-get install postgresql-client` (Debian/Ubuntu)
- **macOS**: `brew install postgresql`

### Milvus 备份要求

备份 Milvus 数据需要：
1. **Docker 正常运行**
2. **volumes 目录存在**（Milvus 数据存储目录）

如果 Milvus 容器正在运行，脚本会自动检测并备份数据。
如果 Milvus 未运行，脚本会直接备份 volumes 目录中的文件。

### 环境变量配置

备份脚本会自动从项目根目录的 `.env` 文件中读取配置：

```env
# 关系型数据库配置
DATABASE_URL="file:./dev.db"  # SQLite
# 或
DATABASE_URL="postgresql://user:pass@localhost:5432/db"  # PostgreSQL

# Milvus 向量数据库配置（可选）
MILVUS_ENABLED=true  # 设置为 true 启用 Milvus 备份
```

### 磁盘空间要求

备份需要的磁盘空间估算：
- **SQLite**: 数据库文件大小 × 1
- **PostgreSQL**: 数据库文件大小 × 1.5
- **Milvus**: volumes 目录大小 × 1

建议保留至少 **2 倍数据库大小** 的可用空间。

## 恢复数据

### SQLite 恢复

直接将备份的 `.db` 文件复制回 `prisma/` 目录并覆盖原文件：

```bash
# 停止应用
# 复制备份文件
cp backup/backup_sqlite_xxx.db prisma/dev.db
# 重启应用
npm run dev
```

### PostgreSQL 恢复

使用 `psql` 命令恢复：

```bash
# 创建数据库（如果不存在）
createdb -U username database_name

# 恢复数据
psql -U username -d database_name -f backup/backup_postgres_xxx.sql
```

### Milvus 向量数据库恢复

**重要**：恢复 Milvus 数据需要先停止 Milvus 服务。

#### 步骤 1：停止 Milvus 服务

```bash
docker-compose -f docker-compose-milvus.yml down
```

#### 步骤 2：删除旧数据

```bash
# Windows PowerShell
Remove-Item -Path "volumes\etcd" -Recurse -Force
Remove-Item -Path "volumes\minio" -Recurse -Force
Remove-Item -Path "volumes\milvus" -Recurse -Force

# Linux/macOS
rm -rf volumes/etcd volumes/minio volumes/milvus
```

#### 步骤 3：恢复备份

```bash
# Windows PowerShell
$backupDir = "backup\milvus_backup_xxx"
Copy-Item -Path "$backupDir\etcd" -Destination "volumes\etcd" -Recurse
Copy-Item -Path "$backupDir\minio" -Destination "volumes\minio" -Recurse
Copy-Item -Path "$backupDir\milvus" -Destination "volumes\milvus" -Recurse

# Linux/macOS
cp -r backup/milvus_backup_xxx/etcd volumes/etcd
cp -r backup/milvus_backup_xxx/minio volumes/minio
cp -r backup/milvus_backup_xxx/milvus volumes/milvus
```

#### 步骤 4：启动服务

```bash
docker-compose -f docker-compose-milvus.yml up -d
```

#### 步骤 5：验证恢复

```bash
# 检查容器状态
docker ps -a | grep milvus

# 查看日志
docker logs milvus-standalone
```

### 完整系统恢复流程

如果系统完全损坏，恢复步骤：

1. **恢复关系型数据库**
   ```bash
   # SQLite
   cp backup/backup_sqlite_xxx.db prisma/dev.db
   
   # PostgreSQL
   psql -U username -d database_name -f backup/backup_postgres_xxx.sql
   ```

2. **恢复 Schema**
   ```bash
   cp backup/schema_xxx.prisma prisma/schema.prisma
   ```

3. **恢复 Milvus（如果启用）**
   - 按照上面的 Milvus 恢复步骤操作

4. **重新生成 Prisma 客户端**
   ```bash
   npx prisma generate
   ```

5. **启动应用**
   ```bash
   npm run dev
   ```

## 自动化备份（推荐）

### Windows：使用任务计划程序

1. **创建批处理文件** `backup.bat`：
   ```batch
   @echo off
   cd /d "D:\workspace\Trae\Intelligent-Knowledge-Base"
   npm run db:backup
   exit
   ```

2. **打开任务计划程序**：
   - 搜索"任务计划程序"
   - 点击"创建基本任务"

3. **配置任务**：
   - 名称：`Intelligent-Knowledge-Base Backup`
   - 触发器：每天/每周
   - 操作：启动程序
   - 程序：`backup.bat` 的路径

4. **高级设置**（可选）：
   - 勾选"不管用户是否登录都要运行"
   - 勾选"使用最高权限运行"

### Linux/macOS：使用 cron

1. **编辑 crontab**：
   ```bash
   crontab -e
   ```

2. **添加备份任务**：
   ```bash
   # 每天凌晨 2 点备份
   0 2 * * * cd /path/to/Intelligent-Knowledge-Base && npm run db:backup >> /var/log/backup.log 2>&1
   
   # 每周一凌晨 3 点备份
   0 3 * * 1 cd /path/to/Intelligent-Knowledge-Base && npm run db:backup >> /var/log/backup.log 2>&1
   ```

3. **验证 cron 任务**：
   ```bash
   crontab -l
   ```

### 使用第三方备份工具

也可以使用专业的备份工具：
- **Windows**: SyncBack, Cobian Backup
- **Linux**: rsync, duplicity
- **macOS**: Time Machine, Carbon Copy Cloner

## 备份保留策略

建议保留多个备份版本：

### 手动清理

定期清理旧备份：
```bash
# 保留最近 7 天的备份
# 删除 7 天前的备份文件
```

### 自动清理脚本

创建 `scripts/cleanup-backups.js`：
```javascript
const fs = require('fs');
const path = require('path');

const backupDir = path.join(__dirname, '..', 'backup');
const daysToKeep = 7;
const now = Date.now();
const msPerDay = 24 * 60 * 60 * 1000;

fs.readdir(backupDir, (err, files) => {
  if (err) throw err;
  
  files.forEach(file => {
    const filePath = path.join(backupDir, file);
    fs.stat(filePath, (err, stats) => {
      if (err) throw err;
      
      if (now - stats.mtimeMs > daysToKeep * msPerDay) {
        fs.unlink(filePath, err => {
          if (err) throw err;
          console.log(`已删除旧备份：${file}`);
        });
      }
    });
  });
});
```

## 示例输出

### SQLite + Milvus 启用

```
✓ 创建 backup 目录
数据库连接字符串：file:./dev.db
Milvus 状态：已启用
✓ SQLite 数据库已备份到：backup_sqlite_2026-05-08_10-30-00-000Z.db
✓ Schema 已备份到：schema_2026-05-08_10-30-00-000Z.prisma

开始备份 Milvus 向量数据库...
✓ Milvus 容器正在运行，备份 volumes 目录...
✓ etcd 元数据已备份到：milvus_backup_2026-05-08_10-30-00-000Z/etcd
✓ MinIO 对象存储数据已备份到：milvus_backup_2026-05-08_10-30-00-000Z/minio
✓ Milvus 数据已备份到：milvus_backup_2026-05-08_10-30-00-000Z/milvus
✓ 备份说明文件已创建：milvus_backup_2026-05-08_10-30-00-000Z/README.txt

备份完成！
```

### 仅 SQLite（Milvus 未启用）

```
✓ 创建 backup 目录
数据库连接字符串：file:./dev.db
Milvus 状态：未启用
✓ SQLite 数据库已备份到：backup_sqlite_2026-05-08_10-30-00-000Z.db
✓ Schema 已备份到：schema_2026-05-08_10-30-00-000Z.prisma

备份完成！
```

### PostgreSQL + Milvus 启用

```
✓ 创建 backup 目录
数据库连接字符串：postgresql://user:***@localhost:5432/db
Milvus 状态：已启用
✓ PostgreSQL 数据库已备份到：backup_postgres_2026-05-08_10-30-00-000Z.sql
✓ Schema 已备份到：schema_2026-05-08_10-30-00-000Z.prisma

开始备份 Milvus 向量数据库...
✓ Milvus 容器正在运行，备份 volumes 目录...
✓ etcd 元数据已备份到：milvus_backup_2026-05-08_10-30-00-000Z/etcd
✓ MinIO 对象存储数据已备份到：milvus_backup_2026-05-08_10-30-00-000Z/minio
✓ Milvus 数据已备份到：milvus_backup_2026-05-08_10-30-00-000Z/milvus
✓ 备份说明文件已创建：milvus_backup_2026-05-08_10-30-00-000Z/README.txt

备份完成！
```

## 故障排除

### 问题 1：备份失败 - "未找到 DATABASE_URL 配置"

**解决方案**：
1. 检查 `.env` 文件是否存在
2. 确认 `DATABASE_URL` 配置正确
3. 确保没有语法错误

### 问题 2：PostgreSQL 备份失败 - "pg_dump: 未找到命令"

**解决方案**：
```bash
# Windows: 添加 PostgreSQL bin 目录到 PATH
$env:Path += ";C:\Program Files\PostgreSQL\15\bin"

# Linux: 安装客户端
sudo apt-get install postgresql-client

# macOS: 使用 brew 安装
brew install postgresql
```

### 问题 3：Milvus 备份失败 - "Docker 未运行"

**解决方案**：
1. 启动 Docker Desktop
2. 或者如果 Milvus 未运行，可以忽略此错误（会备份 volumes 目录）

### 问题 4：磁盘空间不足

**解决方案**：
1. 清理旧备份文件
2. 增加磁盘空间
3. 配置备份保留策略（只保留最近 N 天的备份）

### 问题 5：备份文件权限问题

**解决方案**：
```bash
# Linux/macOS: 修改权限
chmod 755 backup/
chown -R $USER:$USER backup/

# Windows: 使用管理员身份运行
```

## 最佳实践

1. **定期备份**：至少每天一次
2. **多地存储**：备份文件存储到不同位置（云存储、外部硬盘）
3. **测试恢复**：定期测试备份文件的恢复流程
4. **监控备份**：设置备份失败的告警通知
5. **版本控制**：保留多个历史版本
6. **加密敏感数据**：对备份文件进行加密

## 相关文档

- [Milvus 配置指南](./MILVUS_SETUP.md) - Milvus 数据备份和恢复详细说明
- [部署指南](./DEPLOYMENT.md) - 生产环境备份策略
- [README.md](../README.md) - 项目总体说明

---

**最后更新**: 2026-05-08  
**维护者**: Intelligent-Knowledge-Base Team
