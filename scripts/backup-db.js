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
}

if (!databaseUrl) {
  console.error('✗ 未找到 DATABASE_URL 配置，请检查 .env 文件');
  process.exit(1);
}

console.log('数据库连接字符串:', databaseUrl.replace(/:[^:]+@/, ':***@'));

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

console.log('\n备份完成！');
