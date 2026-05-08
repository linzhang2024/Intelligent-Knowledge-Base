# 数据库备份指南

## 概述

本项目提供了便捷的数据库备份脚本，支持 SQLite 和 PostgreSQL 两种数据库类型。

## 使用方法

### 方式一：使用 npm 命令（推荐）

```bash
npm run db:backup
```

### 方式二：直接运行脚本

```bash
node scripts/backup-db.js
```

## 功能说明

备份脚本会自动完成以下操作：

1. 自动检测当前使用的数据库类型（SQLite 或 PostgreSQL）
2. 在项目根目录创建 `backup` 文件夹（如果不存在）
3. 根据当前时间戳生成唯一的备份文件名
4. 备份数据库文件（SQLite）或导出 SQL 转储（PostgreSQL）
5. 同时备份 `prisma/schema.prisma` 文件

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

## 注意事项

### PostgreSQL 备份要求

使用 PostgreSQL 时，需要确保系统已安装 `pg_dump` 工具并在环境变量 PATH 中可用。

### 环境变量配置

备份脚本会自动从项目根目录的 `.env` 文件中读取 `DATABASE_URL` 配置。

## 恢复数据

### SQLite 恢复

直接将备份的 `.db` 文件复制回 `prisma/` 目录并覆盖原文件即可。

### PostgreSQL 恢复

使用 `psql` 命令恢复：
```bash
psql -U username -d database_name -f backup_postgres_xxx.sql
```

## 示例输出

```
✓ 创建 backup 目录
数据库连接字符串: file:./dev.db
✓ SQLite 数据库已备份到: backup_sqlite_2026-05-07_08-47-28-045Z.db
✓ Schema 已备份到: schema_2026-05-07_08-47-28-045Z.prisma

备份完成！
```
