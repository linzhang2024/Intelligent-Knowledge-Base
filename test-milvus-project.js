const { MilvusClient } = require('@zilliz/milvus2-sdk-node');

async function testConnection() {
  console.log('========================================');
  console.log('Milvus Node.js SDK 连接测试（项目环境）');
  console.log('========================================');
  console.log('');

  // 测试 1: 使用 127.0.0.1
  console.log('测试 1: 使用 "127.0.0.1:19530"');
  console.log('----------------------------------------');
  
  let client1 = null;
  try {
    console.log('正在创建客户端...');
    client1 = new MilvusClient({
      address: '127.0.0.1:19530',
      timeout: 10000,
    });
    console.log('客户端创建成功，正在获取版本...');
    
    const version = await client1.getVersion();
    console.log('✅ 连接成功！');
    console.log('Milvus 版本:', version.version);
  } catch (error) {
    console.log('❌ 连接失败！');
    console.log('错误类型:', typeof error);
    console.log('错误对象:', error);
    if (error instanceof Error) {
      console.log('Error.name:', error.name);
      console.log('Error.message:', error.message);
      console.log('Error.stack:', error.stack?.split('\n')[0]);
    }
    // 打印所有属性
    if (typeof error === 'object' && error !== null) {
      console.log('错误对象属性:');
      for (const key of Object.keys(error)) {
        try {
          const value = error[key];
          const valueStr = typeof value === 'object' 
            ? JSON.stringify(value) 
            : String(value);
          console.log(`  ${key}:`, valueStr.substring(0, 500));
        } catch (e) {
          console.log(`  ${key}: [无法读取]`);
        }
      }
    }
  } finally {
    if (client1) {
      try {
        await client1.closeConnection();
        console.log('客户端连接已关闭');
      } catch (e) {
        console.log('关闭连接时出错:', e);
      }
    }
  }
  
  console.log('');
  console.log('========================================');
  console.log('');

  // 测试 2: 使用 localhost
  console.log('测试 2: 使用 "localhost:19530"');
  console.log('----------------------------------------');
  
  let client2 = null;
  try {
    console.log('正在创建客户端...');
    client2 = new MilvusClient({
      address: 'localhost:19530',
      timeout: 10000,
    });
    console.log('客户端创建成功，正在获取版本...');
    
    const version = await client2.getVersion();
    console.log('✅ 连接成功！');
    console.log('Milvus 版本:', version.version);
  } catch (error) {
    console.log('❌ 连接失败！');
    console.log('错误类型:', typeof error);
    console.log('错误对象:', error);
    if (error instanceof Error) {
      console.log('Error.name:', error.name);
      console.log('Error.message:', error.message);
      console.log('Error.stack:', error.stack?.split('\n')[0]);
    }
    // 打印所有属性
    if (typeof error === 'object' && error !== null) {
      console.log('错误对象属性:');
      for (const key of Object.keys(error)) {
        try {
          const value = error[key];
          const valueStr = typeof value === 'object' 
            ? JSON.stringify(value) 
            : String(value);
          console.log(`  ${key}:`, valueStr.substring(0, 500));
        } catch (e) {
          console.log(`  ${key}: [无法读取]`);
        }
      }
    }
  } finally {
    if (client2) {
      try {
        await client2.closeConnection();
        console.log('客户端连接已关闭');
      } catch (e) {
        console.log('关闭连接时出错:', e);
      }
    }
  }

  console.log('');
  console.log('========================================');
  console.log('测试完成');
  console.log('========================================');
}

testConnection().catch(console.error);
