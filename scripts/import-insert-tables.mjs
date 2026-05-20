/**
 * 从 INSERT 语句中解析表结构并创建 databaseTable + tableColumn 记录
 * 
 * 适用场景：只有 INSERT INTO ... VALUES (...) 语句的 SQL 文件
 * 例如：prompt Importing table ZLHIS.最高诊断依据... insert into ... values ...;
 */

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

function inferColumnType(values) {
  const types = new Set();
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const trimmed = v.trim();
    if (/^\d+$/.test(trimmed)) {
      types.add('INTEGER');
    } else if (/^\d+\.\d+$/.test(trimmed)) {
      types.add('DECIMAL');
    } else {
      types.add('VARCHAR2');
    }
  }
  
  if (types.size === 1 && types.has('INTEGER')) return 'INTEGER';
  if (types.size === 1 && types.has('DECIMAL')) return 'DECIMAL';
  return 'VARCHAR2';
}

function inferColumnLength(values) {
  let maxLen = 0;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const trimmed = v.trim();
    if (trimmed.length > maxLen) maxLen = trimmed.length;
  }
  return maxLen > 0 ? Math.max(maxLen * 2, 50) : 255;
}

function parseInsertStatements(sqlContent) {
  const results = new Map();
  
  const insertRegex = /insert\s+into\s+(?:[^\s(]+\.)?\s*["`]?([^\s("`]+)["`]?\s*\(([^)]+)\)\s*values\s*\(([^)]+(?:\([^)]*\)[^)]*)*)\)/gi;
  
  let match;
  while ((match = insertRegex.exec(sqlContent)) !== null) {
    const tableName = match[1].trim();
    const columnsStr = match[2];
    const valuesStr = match[3];
    
    if (!results.has(tableName)) {
      results.set(tableName, { columns: [], rows: [] });
    }
    
    const entry = results.get(tableName);
    
    if (entry.columns.length === 0) {
      entry.columns = columnsStr.split(',').map(c => c.trim().replace(/["'`]/g, ''));
    }
    
    const values = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < valuesStr.length; i++) {
      const ch = valuesStr[i];
      if (ch === "'") {
        if (inQuote && valuesStr[i + 1] === "'") {
          current += "'";
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === ',' && !inQuote) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) values.push(current.trim());
    
    entry.rows.push(values);
  }
  
  return results;
}

async function createDatabaseTable(documentId, tableName, columns, allRows, knowledgeBaseId) {
  // Gather per-column values
  const colValues = columns.map((_, i) => allRows.map(row => row[i] || null).filter(v => v !== null));
  
  // Skip overly wide tables (>15 columns - likely not dictionary tables)
  if (columns.length > 50) {
    console.log(`    SKIP: 列数(${columns.length}) > 50，非字典表`);
    return 0;
  }
  
  // Skip overly large tables (>500 rows)
  if (allRows.length > 1000) {
    console.log(`    SKIP: 行数(${allRows.length}) > 1000，非字典表`);
    return 0;
  }
  
  try {
    // Create databaseTable
    const table = await prisma.databaseTable.create({
      data: {
        name: tableName,
        schemaName: 'ZLHIS',
        tableComment: `${tableName} (从INSERT语句自动导入, ${allRows.length}行数据)`,
        documentId,
        knowledgeBaseId: knowledgeBaseId || null,
      },
    });
    
    // Create columns
    for (let i = 0; i < columns.length; i++) {
      const colName = columns[i];
      const vals = colValues[i] || [];
      const colType = inferColumnType(vals);
      const colLength = inferColumnLength(vals);
      
      await prisma.tableColumn.create({
        data: {
          tableId: table.id,
          name: colName,
          dataType: colType,
          columnType: colType === 'VARCHAR2' ? `VARCHAR2(${colLength})` : colType,
          isNullable: true,
          isPrimaryKey: colName.toLowerCase().includes('编码') || colName.toLowerCase().includes('代码') || colName.toLowerCase().includes('id'),
          columnComment: colType === 'INTEGER' 
            ? `数值型，示例值: ${vals.slice(0,3).join(', ')}`
            : `文本型，最大长度=${colLength}，示例值: ${vals.slice(0,3).join(', ')}`,
          ordinalPosition: i + 1,
        },
      });
    }
    
    return 1;
  } catch (err) {
    console.log(`    ERROR: ${err.message}`);
    return 0;
  }
}

async function main() {
  console.log('=== 从INSERT语句解析表结构并导入 databaseTable ===\n');
  
  const docs = await prisma.document.findMany({
    where: {
      createdAt: { gte: new Date('2026-05-18T00:00:00.000Z'), lt: new Date('2026-05-19T00:00:00.000Z') },
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true, content: true, knowledgeBaseId: true },
  });

  console.log(`找到 ${docs.length} 个文档\n`);
  
  let totalTables = 0;
  
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    if (!doc.content) {
      console.log(`[${i+1}/${docs.length}] SKIP (无内容): "${doc.title}"`);
      continue;
    }
    
    // 检查是否已有 databaseTable
    const existingCount = await prisma.databaseTable.count({
      where: { documentId: doc.id }
    });
    if (existingCount > 0) {
      console.log(`[${i+1}/${docs.length}] SKIP (已有${existingCount}个表): "${doc.title}"`);
      continue;
    }
    
    // 解析 INSERT 语句
    const parsed = parseInsertStatements(doc.content);
    
    if (parsed.size === 0) {
      // 可能是 CUSTOM_ 前缀的DDL文件，跳过
      console.log(`[${i+1}/${docs.length}] N/A (无INSERT): "${doc.title}"`);
      continue;
    }
    
    let docTableCount = 0;
    for (const [tableName, { columns, rows }] of parsed) {
      console.log(`[${i+1}/${docs.length}] TABLE "${tableName}": ${columns.length}列, ${rows.length}行`);
      const created = await createDatabaseTable(doc.id, tableName, columns, rows, doc.knowledgeBaseId);
      docTableCount += created;
    }
    
    totalTables += docTableCount;
  }
  
  // 验证
  const finalLinked = await prisma.databaseTable.count({
    where: {
      documentId: { in: docs.map(d => d.id) }
    }
  });
  
  console.log(`\n=== 完成 ===`);
  console.log(`导入表数: ${totalTables}`);
  console.log(`关联到5月18日文档的 databaseTable 总数: ${finalLinked}`);
  
  await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });