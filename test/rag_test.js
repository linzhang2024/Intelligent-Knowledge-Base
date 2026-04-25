const http = require('http');

const BASE_URL = 'http://localhost:3000';

const testDocuments = [
  {
    id: 'ai-tech-001',
    content: '人工智能（AI）技术正在快速发展，特别是在深度学习和自然语言处理领域。最新的大型语言模型如GPT系列能够理解和生成人类语言，在各种任务中展现出惊人的能力。机器学习算法通过大量数据训练，不断优化模型参数，提高预测准确性。',
    metadata: {
      category: 'AI技术',
      topic: '人工智能',
      keywords: '机器学习,深度学习,NLP'
    }
  },
  {
    id: 'cooking-001',
    content: '红烧肉的做法：首先准备五花肉500克，切成3厘米见方的块。锅中加水烧开，放入肉块焯水去血沫，捞出洗净沥干。锅中放少许油，加入冰糖小火炒至焦糖色，放入肉块翻炒上色。加入姜片、八角、桂皮、料酒、生抽、老抽，翻炒均匀后加入没过肉块的热水。大火烧开后转小火炖煮1.5小时，最后大火收汁即可。',
    metadata: {
      category: '烹饪方法',
      topic: '红烧肉',
      keywords: '家常菜,中式烹饪,肉类料理'
    }
  },
  {
    id: 'history-001',
    content: '三国时期是中国历史上一个英雄辈出的时代。公元220年，曹丕篡汉称帝，国号魏，史称曹魏。次年刘备在成都称帝，国号汉，史称蜀汉。229年孙权称帝，国号吴，史称东吴。三国鼎立的局面正式形成。这一时期发生了许多著名的战役，如官渡之战、赤壁之战、夷陵之战等，涌现出曹操、刘备、孙权、诸葛亮、周瑜等杰出人物。',
    metadata: {
      category: '历史故事',
      topic: '三国时期',
      keywords: '中国古代史,三国鼎立,历史人物'
    }
  }
];

async function makeRequest(path, options = {}) {
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

async function runTest() {
  console.log('=== RAG 检索测试开始 ===\n');

  try {
    // 1. 清空测试数据
    console.log('1. 清空向量数据库...');
    await makeRequest('/api/test/retrieve', {
      method: 'DELETE'
    });
    console.log('✓ 向量数据库已清空\n');

    // 2. 添加测试文档
    console.log('2. 添加测试文档...');
    console.log('   - AI技术文档');
    console.log('   - 烹饪方法文档（红烧肉做法）');
    console.log('   - 历史故事文档（三国时期）');
    
    const addResponse = await makeRequest('/api/test/retrieve', {
      method: 'POST',
      body: {
        documents: testDocuments
      }
    });
    
    console.log(`✓ 成功添加 ${addResponse.count} 条文档\n`);

    // 3. 测试检索功能
    const testQuery = '如何做红烧肉';
    console.log(`3. 测试检索: "${testQuery}"`);
    
    const searchResponse = await makeRequest(`/api/test/retrieve?query=${encodeURIComponent(testQuery)}`);
    
    console.log(`\n   检索结果（共 ${searchResponse.results.length} 条）:
`);
    
    searchResponse.results.forEach((result, index) => {
      console.log(`   第 ${index + 1} 条结果:`);
      console.log(`      ID: ${result.id}`);
      console.log(`      分类: ${result.metadata?.category || '未知'}`);
      console.log(`      相似度分数: ${result.score.toFixed(4)}`);
      console.log(`      内容摘要: ${result.content.substring(0, 100)}...
`);
    });

    // 4. 验证结果
    console.log('4. 验证检索结果...');
    
    const firstResult = searchResponse.results[0];
    const isCookingCategory = firstResult?.metadata?.category === '烹饪方法';
    
    if (isCookingCategory) {
      console.log('✓ 验证通过：第一条结果属于"烹饪方法"领域');
      console.log(`  相似度分数: ${firstResult.score.toFixed(4)}`);
      console.log(`  分类: ${firstResult.metadata.category}`);
      console.log(`  主题: ${firstResult.metadata.topic}\n`);
      
      console.log('=== 测试通过 ===');
      process.exit(0);
    } else {
      console.log('✗ 验证失败：第一条结果不属于"烹饪方法"领域');
      console.log(`  实际分类: ${firstResult?.metadata?.category || '未知'}`);
      console.log(`  相似度分数: ${firstResult?.score?.toFixed(4) || 'N/A'}\n`);
      
      console.log('=== 测试失败 ===');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n测试过程中发生错误:');
    console.error(`  错误信息: ${error.message}`);
    console.error('\n请确保:');
    console.error('  1. 开发服务器正在运行 (npm run dev)');
    console.error('  2. Chroma 数据库服务正在运行');
    console.error('  3. DEEPSEEK_API_KEY 环境变量已正确配置\n');
    
    console.log('=== 测试失败 ===');
    process.exit(1);
  }
}

runTest();
