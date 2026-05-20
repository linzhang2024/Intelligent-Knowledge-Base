import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        if (!process.env[key]) process.env[key] = val;
      }
    }
  });
}

const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.document.findMany({
    where: {
      createdAt: { gte: new Date('2026-05-18T00:00:00+08:00'), lt: new Date('2026-05-19T00:00:00+08:00') },
      deletedAt: null,
    },
    select: { id: true },
  });

  const linkedCount = await prisma.databaseTable.count({
    where: { documentId: { in: docs.map(d => d.id) } }
  });

  const totalTables = await prisma.databaseTable.count();
  const tablesWithDoc = await prisma.databaseTable.count({ where: { documentId: { not: null } } });

  console.log(`=== 验证结果 ===`);
  console.log(`5月18日文档数: ${docs.length}`);
  console.log(`关联到 databaseTable 的文档: ${linkedCount}`);
  console.log(`databaseTable 总数: ${totalTables}`);
  console.log(`有 documentId 的表: ${tablesWithDoc}`);

  // Check specific key tables
  const keyTables = ['最高诊断依据', '性别', '处方类型', '结算方式', '民族', '学历'];
  for (const name of keyTables) {
    const tbl = await prisma.databaseTable.findFirst({
      where: { name },
      include: { columns: { orderBy: { ordinalPosition: 'asc' } } },
    });
    if (tbl) {
      console.log(`\n✅ "${name}": ${tbl.columns.length}列, comment="${tbl.tableComment}", docId=${tbl.documentId?.substring(0,12)}...`);
      for (const col of tbl.columns) {
        console.log(`   - ${col.name}: ${col.columnType} ${col.columnComment || ''}`);
      }
    } else {
      console.log(`\n❌ "${name}": 未找到`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });