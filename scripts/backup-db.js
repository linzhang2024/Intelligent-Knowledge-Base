#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 创建 backup 目录
const backupDir = path.join(__dirname, '..', 'backup');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
  console.log('✓ 创建 backup 目录');
}

// 加载环境变量
const envPath = path.join(__dirname, '..', '.env');
let databaseUrl = null;
let milvusEnabled = false;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('DATABASE_URL=')) {
      databaseUrl = trimmedLine.substring('DATABASE_URL='.length).replace(/^"|"$/g, '');
      break;
    }
  }
  
  // 检查是否启用了 Milvus
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('MILVUS_ENABLED=')) {
      const value = trimmedLine.substring('MILVUS_ENABLED='.length).toLowerCase();
      milvusEnabled = value === 'true' || value === '1';
      break;
    }
  }
}

if (!databaseUrl) {
  console.error('✗ 未找到 DATABASE_URL 配置，请检查 .env 文件');
  process.exit(1);
}

console.log('数据库连接字符串:', databaseUrl.replace(/:[^:]+@/, ':***@'));
console.log('Milvus 状态:', milvusEnabled ? '已启用' : '未启用');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];

if (databaseUrl.startsWith('file:')) {
  // SQLite 数据库备份
  const dbPath = databaseUrl.replace('file:', '');
  const dbFullPath = path.join(__dirname, '..', 'prisma', dbPath.replace('./', ''));
  
  if (!fs.existsSync(dbFullPath)) {
    console.error('✗ 找不到数据库文件:', dbFullPath);
    process.exit(1);
  }

  const backupFileName = `backup_sqlite_${timestamp}.db`;
  const backupPath = path.join(backupDir, backupFileName);
  
  fs.copyFileSync(dbFullPath, backupPath);
  console.log(`✓ SQLite 数据库已备份到: ${backupFileName}`);
  
  // 同时备份 schema.prisma
  const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
  const schemaBackupName = `schema_${timestamp}.prisma`;
  fs.copyFileSync(schemaPath, path.join(backupDir, schemaBackupName));
  console.log(`✓ Schema 已备份到: ${schemaBackupName}`);
  
} else if (databaseUrl.startsWith('postgresql:')) {
  // PostgreSQL 数据库备份
  const backupFileName = `backup_postgres_${timestamp}.sql`;
  const backupPath = path.join(backupDir, backupFileName);
  
  try {
    execSync(`pg_dump "${databaseUrl}" > "${backupPath}"`, { stdio: 'pipe' });
    console.log(`✓ PostgreSQL 数据库已备份到: ${backupFileName}`);
    
    // 同时备份 schema.prisma
    const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
    const schemaBackupName = `schema_${timestamp}.prisma`;
    fs.copyFileSync(schemaPath, path.join(backupDir, schemaBackupName));
    console.log(`✓ Schema 已备份到: ${schemaBackupName}`);
  } catch (error) {
    console.error('✗ PostgreSQL 备份失败，请确保已安装 pg_dump 并在 PATH 中');
    console.error('错误:', error.message);
    process.exit(1);
  }
  
} else {
  console.error('✗ 不支持的数据库类型');
  process.exit(1);
}

// 备份 Milvus 向量数据库（如果启用）
if (milvusEnabled) {
  console.log('\n开始备份 Milvus 向量数据库...');
  
  const volumesDir = path.join(__dirname, '..', 'volumes');
  
  if (!fs.existsSync(volumesDir)) {
    console.log('⚠ Milvus 数据目录不存在，跳过备份');
  } else {
    try {
      // 检查 Docker 是否运行
      try {
        execSync('docker ps', { stdio: 'pipe' });
      } catch (dockerError) {
        console.log('⚠ Docker 未运行，跳过 Milvus 备份');
        console.log('提示：如果 Milvus 正在运行，请确保 Docker 服务已启动');
      }
      
      // 检查 Milvus 容器是否在运行
      let milvusRunning = false;
      try {
        const containers = execSync('docker ps --format "{{.Names}}"', { 
          stdio: 'pipe', 
          encoding: 'utf-8' 
        });
        milvusRunning = containers.includes('milvus-standalone');
      } catch (error) {
        console.log('⚠ 无法检查 Docker 容器状态，跳过 Milvus 备份检查');
      }
      
      if (!milvusRunning) {
        console.log('⚠ Milvus 容器未运行，将备份 volumes 目录数据');
      } else {
        console.log('✓ Milvus 容器正在运行，备份 volumes 目录...');
      }
      
      // 创建 Milvus 备份目录
      const milvusBackupDir = path.join(backupDir, `milvus_backup_${timestamp}`);
      fs.mkdirSync(milvusBackupDir, { recursive: true });
      
      // 备份 etcd 数据
      const etcdSource = path.join(volumesDir, 'etcd');
      const etcdDest = path.join(milvusBackupDir, 'etcd');
      if (fs.existsSync(etcdSource)) {
        copyDirectory(etcdSource, etcdDest);
        console.log(`✓ etcd 元数据已备份到：milvus_backup_${timestamp}/etcd`);
      } else {
        console.log('⚠ etcd 数据目录不存在');
      }
      
      // 备份 MinIO 数据（包含向量数据）
      const minioSource = path.join(volumesDir, 'minio');
      const minioDest = path.join(milvusBackupDir, 'minio');
      if (fs.existsSync(minioSource)) {
        copyDirectory(minioSource, minioDest);
        console.log(`✓ MinIO 对象存储数据已备份到：milvus_backup_${timestamp}/minio`);
      } else {
        console.log('⚠ MinIO 数据目录不存在');
      }
      
      // 备份 Milvus 数据
      const milvusSource = path.join(volumesDir, 'milvus');
      const milvusDest = path.join(milvusBackupDir, 'milvus');
      if (fs.existsSync(milvusSource)) {
        copyDirectory(milvusSource, milvusDest);
        console.log(`✓ Milvus 数据已备份到：milvus_backup_${timestamp}/milvus`);
      } else {
        console.log('⚠ Milvus 数据目录不存在');
      }
      
      // 创建备份说明文件
      const readmeContent = `Milvus 备份说明
================

备份时间：${new Date().toISOString()}
备份内容：
- etcd: Milvus 元数据
- minio: MinIO 对象存储（包含向量数据和索引）
- milvus: Milvus 主服务数据

恢复步骤：
1. 停止 Milvus 服务：docker-compose -f docker-compose-milvus.yml down
2. 删除旧数据：删除 volumes/etcd, volumes/minio, volumes/milvus 目录
3. 恢复备份：将此目录下的 etcd, minio, milvus 文件夹复制到 volumes/ 目录
4. 启动服务：docker-compose -f docker-compose-milvus.yml up -d

注意：恢复前请确保 Docker 和 docker-compose 已安装并正常运行
`;
      fs.writeFileSync(
        path.join(milvusBackupDir, 'README.txt'),
        readmeContent
      );
      console.log(`✓ 备份说明文件已创建：milvus_backup_${timestamp}/README.txt`);
    } catch (error) {
      console.error('⚠ Milvus 备份失败:', error.message);
      console.log('这不会影响关系型数据库备份的完成');
    }
  }
}

console.log('\n备份完成！');

// 递归复制目录的辅助函数
function copyDirectory(src, dest) {
  // 创建目标目录
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  // 读取源目录内容
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      // 递归复制子目录
      copyDirectory(srcPath, destPath);
    } else {
      // 复制文件
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
