const net = require('net');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3005;

function checkPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        reject(err);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    
    server.listen(port);
  });
}

async function main() {
  console.log(`🔍 检查端口 ${PORT} 是否被占用...`);
  
  try {
    const isPortInUse = await checkPort(PORT);
    
    if (isPortInUse) {
      console.log(`❌ 端口 ${PORT} 已被占用！`);
      console.log('\n💡 请尝试以下解决方案:');
      console.log(`   1. 关闭占用端口 ${PORT} 的进程后重试`);
      console.log(`   2. 使用其他端口: PORT=3002 npm run dev`);
      console.log(`   3. 查看占用进程: netstat -ano | findstr :${PORT}`);
      process.exit(1);
    } else {
      console.log(`✅ 端口 ${PORT} 可用，正在启动开发服务器...`);
      console.log(`🌐 服务器将运行在: http://localhost:${PORT}`);
      
      const command = `npx next dev --port ${PORT}`;
      const child = exec(command, {
        env: { ...process.env, PORT: String(PORT) }
      });
      
      child.stdout?.pipe(process.stdout);
      child.stderr?.pipe(process.stderr);
      
      child.on('exit', (code) => {
        process.exit(code || 0);
      });
      
      child.on('error', (err) => {
        console.error('启动失败:', err);
        process.exit(1);
      });
    }
  } catch (error) {
    console.error('端口检查失败:', error);
    process.exit(1);
  }
}

main();
