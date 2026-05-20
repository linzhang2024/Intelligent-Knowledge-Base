const { MilvusClient, DataType } = require('@zilliz/milvus2-sdk-node');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const MILVUS_HOST = 'localhost';
const MILVUS_PORT = 19530;
const COLLECTION_NAME = 'document_chunks';
const DIMENSIONS = 1024;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('========================================');
  console.log(' Milvus 数据恢复脚本');
  console.log('========================================\n');

  const prisma = new PrismaClient();

  // Step 1: Connect to Milvus
  console.log('[1/4] 连接 Milvus...');
  const client = new MilvusClient({
    address: `${MILVUS_HOST}:${MILVUS_PORT}`,
    timeout: 30000,
  });

  try {
    const version = await client.getVersion();
    console.log(`  ✓ Milvus 版本: ${version.version}\n`);
  } catch (e) {
    console.error(`  ✗ 无法连接到 Milvus: ${e.message}`);
    process.exit(1);
  }

  // Step 2: Create collection
  console.log('[2/4] 创建集合...');
  try {
    const hasCollection = await client.hasCollection({
      collection_name: COLLECTION_NAME,
    });

    if (hasCollection.value) {
      console.log(`  集合 "${COLLECTION_NAME}" 已存在，跳过创建`);
    } else {
      await client.createCollection({
        collection_name: COLLECTION_NAME,
        fields: [
          {
            name: 'id',
            data_type: DataType.VarChar,
            is_primary_key: true,
            max_length: 64,
          },
          {
            name: 'chunk_id',
            data_type: DataType.VarChar,
            max_length: 64,
          },
          {
            name: 'document_id',
            data_type: DataType.VarChar,
            max_length: 64,
          },
          {
            name: 'knowledge_base_id',
            data_type: DataType.VarChar,
            max_length: 64,
          },
          {
            name: 'content',
            data_type: DataType.VarChar,
            max_length: 65535,
          },
          {
            name: 'embedding',
            data_type: DataType.FloatVector,
            dim: DIMENSIONS,
          },
          {
            name: 'model',
            data_type: DataType.VarChar,
            max_length: 256,
          },
        ],
        enable_dynamic_field: true,
      });

      console.log(`  ✓ 集合 "${COLLECTION_NAME}" 创建成功`);

      await client.createIndex({
        collection_name: COLLECTION_NAME,
        field_name: 'embedding',
        index_type: 'IVF_FLAT',
        metric_type: 'COSINE',
        params: { nlist: 1024 },
      });

      console.log('  ✓ 索引创建成功');

      await client.loadCollectionSync({
        collection_name: COLLECTION_NAME,
      });

      console.log('  ✓ 集合加载成功');
    }
    console.log('');
  } catch (e) {
    console.error(`  ✗ 创建集合失败: ${e.message}`);
    process.exit(1);
  }

  // Step 3: Read vectors from database
  console.log('[3/4] 从数据库读取向量数据...');

  const totalChunks = await prisma.documentChunk.count({
    where: { embedding: { not: null } },
  });

  console.log(`  数据库中共有 ${totalChunks} 个已向量化的文档片段\n`);

  if (totalChunks === 0) {
    console.log('  没有需要迁移的向量数据，任务完成！');
    await client.closeConnection();
    await prisma.$disconnect();
    return;
  }

  // Step 4: Insert vectors into Milvus
  console.log('[4/4] 迁移向量数据到 Milvus...');

  const batchSize = 100;
  let skip = 0;
  let totalInserted = 0;
  let totalErrors = 0;
  let batchNum = 0;

  while (true) {
    const chunks = await prisma.documentChunk.findMany({
      where: { embedding: { not: null } },
      select: {
        id: true,
        documentId: true,
        content: true,
        embedding: true,
        embeddingModel: true,
        document: {
          select: { knowledgeBaseId: true },
        },
      },
      skip,
      take: batchSize,
      orderBy: { id: 'asc' },
    });

    if (chunks.length === 0) break;

    batchNum++;
    const vectorsToInsert = [];

    for (const chunk of chunks) {
      try {
        const vector = JSON.parse(chunk.embedding);

        if (vector.length !== DIMENSIONS) {
          console.log(`  ⚠ 跳过 chunk ${chunk.id}: 维度不匹配 (${vector.length} vs ${DIMENSIONS})`);
          totalErrors++;
          continue;
        }

        vectorsToInsert.push({
          id: chunk.id,
          chunk_id: chunk.id,
          document_id: chunk.documentId,
          knowledge_base_id: chunk.document.knowledgeBaseId || '',
          content: chunk.content,
          embedding: vector,
          model: chunk.embeddingModel || 'unknown',
        });
      } catch (e) {
        console.log(`  ⚠ 跳过 chunk ${chunk.id}: 向量解析失败 (${e.message})`);
        totalErrors++;
      }
    }

    if (vectorsToInsert.length > 0) {
      try {
        const result = await client.insert({
          collection_name: COLLECTION_NAME,
          data: vectorsToInsert,
        });

        const cnt = typeof result.insert_cnt === 'number'
          ? result.insert_cnt
          : parseInt(result.insert_cnt, 10) || vectorsToInsert.length;

        totalInserted += cnt;
        console.log(`  批次 ${batchNum}: 插入 ${cnt}/${vectorsToInsert.length} 个向量 (总计: ${totalInserted}/${totalChunks})`);
      } catch (e) {
        console.log(`  ✗ 批次 ${batchNum} 插入失败: ${e.message}`);
        totalErrors += vectorsToInsert.length;
      }
    }

    skip += batchSize;
  }

  // Flush data
  try {
    await client.flushSync({
      collection_names: [COLLECTION_NAME],
    });
    console.log('\n  ✓ 数据持久化完成');
  } catch (e) {
    console.log(`\n  ⚠ 数据持久化警告: ${e.message}`);
  }

  console.log('\n========================================');
  console.log(' 恢复完成！');
  console.log(` 成功: ${totalInserted} 个向量`);
  console.log(` 失败: ${totalErrors} 个向量`);
  console.log('========================================');

  await client.closeConnection();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('\n恢复脚本异常退出:', err);
  process.exit(1);
});