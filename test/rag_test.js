const http = require('http');

const BASE_URL = 'http://localhost:3000';

const testDocuments = [
  {
    title: '人工智能技术发展概述',
    content: '人工智能（AI）技术正在快速发展，特别是在深度学习和自然语言处理领域。最新的大型语言模型如GPT系列能够理解和生成人类语言，在各种任务中展现出惊人的能力。机器学习算法通过大量数据训练，不断优化模型参数，提高预测准确性。计算机视觉技术也在图像识别、目标检测等方面取得重大突破。AI技术正在深刻改变各个行业，从医疗诊断到自动驾驶，从智能客服到金融分析。'
  },
  {
    title: '红烧肉家常做法详解',
    content: '红烧肉的做法：首先准备五花肉500克，切成3厘米见方的块。锅中加水烧开，放入肉块焯水去血沫，捞出洗净沥干。锅中放少许油，加入冰糖小火炒至焦糖色，放入肉块翻炒上色。加入姜片、八角、桂皮、料酒、生抽、老抽，翻炒均匀后加入没过肉块的热水。大火烧开后转小火炖煮1.5小时，最后大火收汁即可。这道经典的中式菜肴，肥而不腻，入口即化，是家庭聚餐的必备菜品。'
  },
  {
    title: '三国时期历史故事精选',
    content: '三国时期是中国历史上一个英雄辈出的时代。公元220年，曹丕篡汉称帝，国号魏，史称曹魏。次年刘备在成都称帝，国号汉，史称蜀汉。229年孙权称帝，国号吴，史称东吴。三国鼎立的局面正式形成。这一时期发生了许多著名的战役，如官渡之战、赤壁之战、夷陵之战等，涌现出曹操、刘备、孙权、诸葛亮、周瑜等杰出人物。草船借箭、空城计、三顾茅庐等故事至今仍被广泛传颂。'
  }
];

let createdDocumentIds = [];

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`请求失败: ${res.statusCode} - ${data}`));
          }
        } catch (error) {
          reject(new Error(`解析响应失败: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function cleanup() {
  console.log('\n清理测试数据...');
  try {
    if (createdDocumentIds.length > 0) {
      const deletePromises = createdDocumentIds.map(id => 
        makeRequest(`/api/test/retrieve?id=${id}`, { method: 'DELETE' })
      );
      await Promise.all(deletePromises);
      console.log(`已清理 ${createdDocumentIds.length} 个测试文档`);
    }
  } catch (error) {
    console.log(`清理失败: ${error.message}`);
  }
}

async function runTest() {
  console.log('=== RAG 检索测试开始 ===\n');

  try {
    console.log('1. 清空现有测试数据...');
    const clearResponse = await makeRequest('/api/test/retrieve', {
      method: 'DELETE'
    });
    console.log(`✓ ${clearResponse.message}\n`);

    console.log('2. 通过 API 插入测试文档...');
    console.log('   准备插入 3 条不同领域的文档:');
    console.log('   - AI 技术领域');
    console.log('   - 烹饪方法领域（红烧肉做法）');
    console.log('   - 历史故事领域（三国时期）\n');

    const addResponse = await makeRequest('/api/test/retrieve', {
      method: 'POST',
      body: {
        documents: testDocuments
      }
    });

    console.log(`✓ 成功插入 ${addResponse.count} 条文档`);
    
    createdDocumentIds = addResponse.documents.map(doc => doc.id);
    
    console.log('\n   插入的文档详情:');
    addResponse.documents.forEach((doc, index) => {
      console.log(`   第 ${index + 1} 条:`);
      console.log(`      真实 ID: ${doc.id}`);
      console.log(`      标题: ${doc.title}`);
      console.log(`      内容长度: ${doc.content?.length || 0} 字符`);
      console.log(`      创建时间: ${doc.createdAt}\n`);
    });

    const testQuery = '如何做红烧肉';
    console.log(`3. 执行检索测试: "${testQuery}"`);
    
    const searchResponse = await makeRequest(`/api/test/retrieve?query=${encodeURIComponent(testQuery)}`);
    
    console.log(`\n   检索统计报告:`);
    console.log(`   - 查询关键词: ${searchResponse.query}`);
    console.log(`   - 匹配到的总文档数: ${searchResponse.totalMatched}`);
    console.log(`   - 返回前 ${searchResponse.results.length} 条结果\n`);
    
    console.log('   检索结果详情:');
    searchResponse.results.forEach((result, index) => {
      console.log(`\n   第 ${index + 1} 条结果:`);
      console.log(`      真实文档 ID: ${result.id}`);
      console.log(`      文档标题: ${result.title}`);
      console.log(`      相似度分数: ${result.score.toFixed(4)}`);
      console.log(`      内容片段: ${result.contentSnippet}`);
      console.log(`      创建时间: ${result.createdAt}`);
    });

    console.log('\n4. 验证检索结果...');
    
    if (searchResponse.results.length === 0) {
      console.log('✗ 验证失败：没有找到任何匹配的文档');
      await cleanup();
      console.log('\n=== 测试失败 ===');
      process.exit(1);
    }

    const firstResult = searchResponse.results[0];
    const isCookingDocument = 
      firstResult.title.includes('红烧肉') || 
      firstResult.title.includes('烹饪') ||
      (firstResult.contentSnippet && 
       (firstResult.contentSnippet.includes('红烧肉') || 
        firstResult.contentSnippet.includes('五花肉') ||
        firstResult.contentSnippet.includes('炖煮')));

    const hasRealId = firstResult.id && firstResult.id.length > 0 && firstResult.id !== 'cooking-001';
    const hasScore = typeof firstResult.score === 'number' && firstResult.score >= 0 && firstResult.score <= 1;
    const hasContentSnippet = firstResult.contentSnippet && firstResult.contentSnippet.length > 0;

    console.log(`\n   验证条件检查:`);
    console.log(`   - 第一条结果属于烹饪领域: ${isCookingDocument ? '✓ 通过' : '✗ 未通过'}`);
    console.log(`   - 包含真实的文档 ID: ${hasRealId ? '✓ 通过' : '✗ 未通过'}`);
    console.log(`   - 包含有效的相似度分数: ${hasScore ? '✓ 通过' : '✗ 未通过'}`);
    console.log(`   - 包含内容片段: ${hasContentSnippet ? '✓ 通过' : '✗ 未通过'}`);

    if (isCookingDocument && hasRealId && hasScore && hasContentSnippet) {
      console.log('\n✓ 所有验证条件通过！');
      console.log(`\n   详细信息:`);
      console.log(`      真实文档 ID: ${firstResult.id}`);
      console.log(`      文档标题: ${firstResult.title}`);
      console.log(`      相似度分数: ${firstResult.score.toFixed(4)}`);
      console.log(`      内容片段: ${firstResult.contentSnippet.substring(0, 100)}...`);
      
      await cleanup();
      
      console.log('\n=== 测试通过 ===');
      process.exit(0);
    } else {
      console.log('\n✗ 部分验证条件未通过');
      
      if (!isCookingDocument) {
        console.log(`   问题：第一条结果不属于烹饪领域`);
        console.log(`   实际标题: ${firstResult.title}`);
      }
      
      if (!hasRealId) {
        console.log(`   问题：文档 ID 不是真实的数据库 ID`);
        console.log(`   实际 ID: ${firstResult.id}`);
      }
      
      await cleanup();
      
      console.log('\n=== 测试失败 ===');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n测试过程中发生错误:');
    console.error(`  错误信息: ${error.message}`);
    console.error('\n请确保:');
    console.error('  1. 开发服务器正在运行 (npm run dev)');
    console.error('  2. 数据库已正确配置并运行');
    console.error('  3. 已执行 prisma migrate dev 初始化数据库\n');
    
    await cleanup();
    
    console.log('=== 测试失败 ===');
    process.exit(1);
  }
}

runTest();
