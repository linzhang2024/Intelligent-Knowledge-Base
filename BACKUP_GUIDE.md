# 备份脚本执行方式

## 🚀 快速执行

### 方法 1：npm 命令（推荐）

```bash
npm run db:backup
```

### 方法 2：直接运行脚本

```bash
node scripts/backup-db.js
```

---

## 📋 完整执行方式

### Windows 系统

#### 方式 1：PowerShell（推荐）

```powershell
# 打开 PowerShell，进入项目目录
cd D:\workspace\Trae\Intelligent-Knowledge-Base

# 执行备份
npm run db:backup
```

#### 方式 2：命令提示符 (CMD)

```cmd
cd D:\workspace\Trae\Intelligent-Knowledge-Base
npm run db:backup
```

#### 方式 3：创建批处理文件

创建 `backup.bat`：

```batch
@echo off
cd /d "%~dp0"
echo 开始备份...
npm run db:backup
echo 备份完成！
pause
```

双击运行即可。

#### 方式 4：任务计划程序（自动备份）

1. 创建 `backup.bat`（见上方）
2. 打开"任务计划程序"
3. 点击"创建基本任务"
4. 配置：
   - 名称：`Intelligent-Knowledge-Base 备份`
   - 触发器：每天凌晨 2:00
   - 操作：启动程序
   - 程序/脚本：选择 `backup.bat`
   - 勾选"不管用户是否登录都要运行"
   - 勾选"使用最高权限运行"

---

### Linux 系统

#### 方式 1：终端命令

```bash
cd /path/to/Intelligent-Knowledge-Base
npm run db:backup
```

#### 方式 2：创建 Shell 脚本

创建 `backup.sh`：

```bash
#!/bin/bash
cd "$(dirname "$0")/.."
echo "开始备份..."
npm run db:backup
echo "备份完成！"
```

赋予执行权限：

```bash
chmod +x backup.sh
./backup.sh
```

#### 方式 3：使用 cron（自动备份）

```bash
# 编辑 crontab
crontab -e

# 添加每天凌晨 2 点备份
0 2 * * * cd /path/to/Intelligent-Knowledge-Base && npm run db:backup >> /var/log/backup.log 2>&1

# 保存后查看
crontab -l
```

---

### macOS 系统

#### 方式 1：终端命令

```bash
cd /path/to/Intelligent-Knowledge-Base
npm run db:backup
```

#### 方式 2：使用 cron

与 Linux 相同（见上方）

#### 方式 3：使用 launchd

创建 `~/Library/LaunchAgents/com.knowledgebase.backup.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.knowledgebase.backup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd /path/to/Intelligent-Knowledge-Base && npm run db:backup</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>2</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
</dict>
</plist>
```

加载任务：

```bash
launchctl load ~/Library/LaunchAgents/com.knowledgebase.backup.plist
```

---

## ✅ 验证备份结果

执行备份后，检查 `backup/` 目录：

```bash
# Windows PowerShell
ls backup/

# Linux/macOS
ls -lh backup/
```

应该看到类似以下的文件：

```
backup/
├── backup_sqlite_2026-05-08_10-30-00-000Z.db
├── schema_2026-05-08_10-30-00-000Z.prisma
└── milvus_backup_2026-05-08_10-30-00-000Z/
    ├── etcd/
    ├── minio/
    ├── milvus/
    └── README.txt
```

---

## 📊 预期输出示例

### 启用 Milvus 的情况

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

### 未启用 Milvus 的情况

```
✓ 创建 backup 目录
数据库连接字符串：file:./dev.db
Milvus 状态：未启用
✓ SQLite 数据库已备份到：backup_sqlite_2026-05-08_10-30-00-000Z.db
✓ Schema 已备份到：schema_2026-05-08_10-30-00-000Z.prisma

备份完成！
```

---

## ⚠️ 常见问题

### 1. 权限错误

**Windows**: 使用管理员身份运行 PowerShell 或 CMD

**Linux/macOS**: 使用 sudo 或修改目录权限
```bash
sudo npm run db:backup
# 或
chmod -R 755 /path/to/Intelligent-Knowledge-Base
```

### 2. npm 命令未找到

确保已安装 Node.js 和 npm：
```bash
node --version
npm --version
```

如果未安装，请从 https://nodejs.org/ 下载安装。

### 3. Docker 未运行（Milvus 备份时）

```bash
# Windows/Mac: 启动 Docker Desktop
# Linux: 启动 Docker 服务
sudo systemctl start docker
```

### 4. 磁盘空间不足

检查磁盘空间：
```bash
# Windows PowerShell
Get-PSDrive

# Linux/macOS
df -h
```

清理旧备份或增加磁盘空间。

---

## 📅 推荐备份频率

| 环境 | 频率 | 方法 |
|------|------|------|
| **开发环境** | 每周一次 | 手动执行 |
| **测试环境** | 每天一次 | cron/任务计划 |
| **生产环境** | 每天多次 | cron/任务计划 + 云存储 |

---

## 🔗 相关文档

- [数据库备份完整指南](./documents/DATABASE_BACKUP.md)
- [Milvus 配置指南](./documents/MILVUS_SETUP.md)
- [部署指南](./documents/DEPLOYMENT.md)

---

**最后更新**: 2026-05-08
