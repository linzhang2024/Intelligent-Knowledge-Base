/**
 * 清理 5月18日 重复入库文件 + 重新切片/向量化
 * 
 * 步骤：
 * 1. 查找 2026-05-18 入库的文档
 * 2. 按 fileHash 分组，找出重复文件
 * 3. 删除重复的文档（保留最早的一份）
 * 4. 对所有保留的文档重新切片和向量化
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

const prisma = new PrismaClient();

const TARGET_DATE_START = new Date('2026-05-18T00:00:00+08:00');
const TARGET_DATE_END = new Date('2026-05-19T00:00:00+08:00');

async function findMay18Documents() {
  console.log('🔍 查询 2026-05-18 入库的文档...');
  const docs = await prisma.document.findMany({
    where: {
      createdAt: {
        gte: TARGET_DATE_START,
        lt: TARGET_DATE_END,
      },
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`   找到 ${docs.length} 个文档`);
  return docs;
}

function findDuplicates(docs) {
  const byHash = new Map();

  for (const doc of docs) {
    const hash = doc.fileHash || doc.title; // fallback to title
    if (!byHash.has(hash)) {
      byHash.set(hash, []);
    }
    byHash.get(hash).push(doc);
  }

  const duplicates = [];
  const kept = [];

  for (const [hash, group] of byHash) {
    if (group.length > 1) {
      const [first, ...rest] = group;
      kept.push(first);
      for (const dup of rest) {
        duplicates.push({ duplicate: dup, keep: first });
      }
    } else {
      kept.push(group[0]);
    }
  }

  return { duplicates, kept, byHash };
}

async function softDeleteDocument(docId, docTitle) {
  try {
    // 先删除关联的 chunks
    const chunkResult = await prisma.documentChunk.deleteMany({
      where: { documentId: docId },
    });
    console.log(`   - 删除 ${chunkResult.count} 个切片`);

    // 软删除文档
    await prisma.document.update({
      where: { id: docId },
      data: { deletedAt: new Date() },
    });

    console.log(`   - 文档 "${docTitle}" 已软删除`);
  } catch (err) {
    console.error(`   ❌ 删除失败: ${err.message}`);
  }
}

async function tryDeleteMilvusVectors(docId) {
  // 尝试调用 Milvus SDK 清理向量
  const milvusEnabled = (process.env.MILVUS_ENABLED || '').toLowerCase() === 'true';
  if (!milvusEnabled) {
    console.log(`   ⚠️ Milvus 未启用，跳过向量清理`);
    return;
  }

  try {
    const { MilvusClient } = await import('@zilliz/milvus2-sdk-node');
    const milvusAddress = process.env.MILVUS_ADDRESS || 'localhost:19530';
    const milvusCollection = process.env.MILVUS_COLLECTION_NAME || 'knowledge_base';

    const client = new MilvusClient({ address: milvusAddress });

    // 先尝试加载 collection
    try {
      await client.loadCollectionSync({ collection_name: milvusCollection });
    } catch (e) {
      // collection 可能未加载，忽略
    }

    const deleteExpr = `documentId == "${docId}"`;
    const deleteResult = await client.deleteEntities({
      collection_name: milvusCollection,
      expr: deleteExpr,
    });

    console.log(`   - Milvus 向量清理完成`);
  } catch (err) {
    console.error(`   ⚠️ Milvus 向量清理失败（可忽略，向量会过期）: ${err.message}`);
  }
}

async function callReparseAPI(docId, docTitle) {
  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId) {
    console.error(`   ❌ 未设置 ADMIN_USER_ID 环境变量，无法调用 reparse API`);
    return false;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005';
  const url = `${baseUrl}/api/admin/documents/${docId}/reparse`;

  try {
    console.log(`   🔄 调用 reparse API: ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `kb_user_id=${adminUserId}`,
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`   ✅ "${docTitle}" 重新处理成功！切片数: ${data.rag?.chunkCount || '?'}, 向量化: ${data.rag?.embeddingSuccess ? '成功' : '失败'}`);
      return true;
    } else {
      console.error(`   ❌ API 返回错误 (${response.status}): ${data.message}`);
      return false;
    }
  } catch (err) {
    console.error(`   ❌ 网络请求失败: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('清理 5月18日 重复文件 & 重新切片/向量化');
  console.log('========================================\n');

  // Step 1: 查找文档
  const docs = await findMay18Documents();
  if (docs.length === 0) {
    console.log('没有找到 5月18日 入库的文档，无需处理。');
    await prisma.$disconnect();
    return;
  }

  // 打印文档列表
  console.log('\n📋 文档列表:');
  for (const doc of docs) {
    console.log(`   [${doc.id.substring(0,8)}...] ${doc.title} (${doc.fileType || '?'}) - hash: ${doc.fileHash?.substring(0,12) || '无'} - ${doc.createdAt.toISOString()}`);
  }

  // Step 2: 找重复
  const { duplicates, kept } = findDuplicates(docs);

  if (duplicates.length === 0) {
    console.log('\n✅ 没有发现重复文件。');
  } else {
    console.log(`\n🔴 发现 ${duplicates.length} 个重复文件（将删除）:`);
    for (const { duplicate, keep } of duplicates) {
      console.log(`   - "${duplicate.title}" 是 "${keep.title}" 的重复`);
    }

    // Step 3: 删除重复
    console.log('\n🗑️  开始删除重复文件...');
    for (const { duplicate, keep } of duplicates) {
      console.log(`\n   删除重复: "${duplicate.title}" (重复于 "${keep.title}")`);
      await softDeleteDocument(duplicate.id, duplicate.title);
      await tryDeleteMilvusVectors(duplicate.id);
    }
    console.log(`\n✅ 已删除 ${duplicates.length} 个重复文件`);
  }

  // Step 4: 重新处理保留的文档
  console.log(`\n📦 需要重新处理的文档: ${kept.length} 个`);

  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId) {
    console.log('\n⚠️  请在 .env 文件中设置 ADMIN_USER_ID=你的管理员用户ID');
    console.log('   可以通过数据库查询: prisma.user.findFirst({ where: { role: "ADMIN" } })');
    console.log('   然后再运行此脚本进行 reparse。');
    await prisma.$disconnect();
    return;
  }

  console.log(`\n🔄 开始重新切片和向量化（使用管理员用户: ${adminUserId.substring(0,8)}...）\n`);
  
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < kept.length; i++) {
    const doc = kept[i];
    console.log(`\n[${i + 1}/${kept.length}] 处理: "${doc.title}" (${doc.fileType || '?'})`);
    
    const result = await callReparseAPI(doc.id, doc.title);
    if (result) {
      successCount++;
    } else {
      failCount++;
    }

    // 避免请求太快
    if (i < kept.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n========================================`);
  console.log(`📊 处理完成！`);
  console.log(`   成功: ${successCount} 个`);
  console.log(`   失败: ${failCount} 个`);
  console.log(`   删除重复: ${duplicates.length} 个`);
  console.log(`========================================`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('脚本执行失败:', err);
  await prisma.$disconnect();
  process.exit(1);
});