const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';

let testResults = [];
let allPassed = true;

function addTestResult(name, passed, message = '') {
  testResults.push({ name, passed, message });
  if (!passed) {
    allPassed = false;
  }
  console.log(`  ${passed ? '✓' : '✗'} ${name}`);
  if (message) {
    console.log(`    ${message}`);
  }
}

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
      const cookies = res.headers['set-cookie'] || [];
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = data ? JSON.parse(data) : {};
          resolve({ 
            status: res.statusCode, 
            data: response,
            cookies: cookies
          });
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

function makeMultipartRequest(path, formData, options = {}) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36);
    const url = new URL(path, BASE_URL);
    
    let bodyBuffer = Buffer.alloc(0);
    
    for (const [key, value] of Object.entries(formData)) {
      const header = `--${boundary}\r\nContent-Disposition: form-data; name="${key}"`;
      
      if (value && value.file) {
        const fileHeader = `${header}; filename="${value.filename}"\r\nContent-Type: ${value.contentType || 'application/octet-stream'}\r\n\r\n`;
        bodyBuffer = Buffer.concat([bodyBuffer, Buffer.from(fileHeader), value.content, Buffer.from('\r\n')]);
      } else {
        const textHeader = `${header}\r\n\r\n`;
        bodyBuffer = Buffer.concat([bodyBuffer, Buffer.from(textHeader + value + '\r\n')]);
      }
    }
    
    bodyBuffer = Buffer.concat([bodyBuffer, Buffer.from(`--${boundary}--\r\n`)]);

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
        ...options.headers
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      const cookies = res.headers['set-cookie'] || [];
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = data ? JSON.parse(data) : {};
          resolve({ 
            status: res.statusCode, 
            data: response,
            cookies: cookies
          });
        } catch (error) {
          reject(new Error(`解析响应失败: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(bodyBuffer);
    req.end();
  });
}

function extractCookieValue(cookies, cookieName) {
  for (const cookie of cookies) {
    if (cookie.startsWith(`${cookieName}=`)) {
      return cookie.split(';')[0];
    }
  }
  return '';
}

async function loginUser(email, password) {
  console.log(`   登录用户: ${email}`);
  const response = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  
  if (response.status === 200) {
    const cookie = extractCookieValue(response.cookies, 'kb_user_id');
    console.log(`   ✓ 登录成功，Cookie: ${cookie.substring(0, 30)}...`);
    return { cookie, userId: response.data.user.id, user: response.data.user };
  } else {
    console.log(`   ✗ 登录失败: ${response.data.message}`);
    return { status: response.status, message: response.data.message };
  }
}

function generateRandomEmail() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-user-${timestamp}-${random}@test.com`;
}

function createTestPDF() {
  const pdfContent = Buffer.from([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34,
    0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a,
    0x31, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a,
    0x3c, 0x3c, 0x2f, 0x54, 0x79, 0x70, 0x65, 0x2f, 0x43, 0x61, 0x74, 0x61, 0x6c, 0x6f, 0x67, 0x3e, 0x3e, 0x0a,
    0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a, 0x0a,
    0x78, 0x72, 0x65, 0x66, 0x0a,
    0x30, 0x20, 0x32, 0x0a,
    0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x20, 0x36, 0x35, 0x35, 0x33, 0x36, 0x20, 0x66, 0x20, 0x0a,
    0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x20, 0x30, 0x30, 0x30, 0x31, 0x35, 0x20, 0x6e, 0x20, 0x0a,
    0x74, 0x72, 0x61, 0x69, 0x6c, 0x65, 0x72, 0x0a,
    0x3c, 0x3c, 0x2f, 0x53, 0x69, 0x7a, 0x65, 0x20, 0x32, 0x3e, 0x3e, 0x0a,
    0x73, 0x74, 0x61, 0x72, 0x74, 0x78, 0x72, 0x65, 0x66, 0x0a,
    0x33, 0x36, 0x0a,
    0x25, 0x25, 0x45, 0x4f, 0x46, 0x0a
  ]);
  return pdfContent;
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('文档流程与用户准入自动化测试');
  console.log('='.repeat(60));
  console.log(`服务器地址: ${BASE_URL}`);
  console.log(`测试时间: ${new Date().toLocaleString('zh-CN')}\n`);

  let adminUser = null;
  let pendingUser = null;
  let pendingUserEmail = null;
  let pendingUserPassword = 'test123456';
  let testDocument = null;

  try {
    console.log('\n' + '='.repeat(60));
    console.log('测试阶段 1: 环境准备');
    console.log('='.repeat(60));

    console.log('\n测试 1.1: 检查服务器是否启动');
    try {
      const response = await makeRequest('/api/auth/login', {
        method: 'GET'
      });
      addTestResult('服务器启动检查', response.status === 405, `响应状态码: ${response.status}`);
    } catch (error) {
      addTestResult('服务器启动检查', false, `连接失败: ${error.message}`);
      console.log('\n❌ 服务器未启动，请先运行: npm run dev');
      process.exit(1);
    }

    console.log('\n测试 1.2: 创建/登录管理员用户');
    const adminLogin = await loginUser('admin-doc-flow-test@example.com', 'admin123');
    if (adminLogin.cookie) {
      adminUser = adminLogin;
      addTestResult('管理员用户登录', true, '用户已创建/登录成功');
    } else {
      addTestResult('管理员用户登录', false, '无法创建或登录管理员用户');
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试阶段 2: 新用户注册与待审核状态');
    console.log('='.repeat(60));

    console.log('\n测试 2.1: 新用户注册（非管理员邮箱）');
    pendingUserEmail = generateRandomEmail();
    console.log(`   注册用户: ${pendingUserEmail}`);
    const newUserLogin = await loginUser(pendingUserEmail, pendingUserPassword);
    
    if (newUserLogin.status === 403 && newUserLogin.message === '账号待审核，请联系管理员') {
      addTestResult(
        '新用户注册后处于待审核状态',
        true,
        `返回 403，消息: ${newUserLogin.message}`
      );
    } else if (newUserLogin.cookie) {
      addTestResult(
        '新用户注册后处于待审核状态',
        false,
        `错误: 新用户直接登录成功，预期应为待审核状态`
      );
      pendingUser = newUserLogin;
    } else {
      addTestResult(
        '新用户注册后处于待审核状态',
        false,
        `状态: ${newUserLogin.status}, 消息: ${newUserLogin.message}`
      );
    }

    console.log('\n测试 2.2: 待审核用户无法登录');
    const pendingLoginAttempt = await loginUser(pendingUserEmail, pendingUserPassword);
    addTestResult(
      '待审核用户无法登录',
      pendingLoginAttempt.status === 403 && pendingLoginAttempt.message === '账号待审核，请联系管理员',
      `状态: ${pendingLoginAttempt.status}, 消息: ${pendingLoginAttempt.message}`
    );

    console.log('\n' + '='.repeat(60));
    console.log('测试阶段 3: 管理员审核用户');
    console.log('='.repeat(60));

    if (adminUser && adminUser.cookie) {
      console.log('\n测试 3.1: 管理员获取用户列表找到待审核用户');
      const userListResponse = await makeRequest(`/api/admin/users?page=1&limit=100`, {
        method: 'GET',
        headers: {
          'Cookie': adminUser.cookie
        }
      });
      
      const foundPendingUser = userListResponse.data.users?.find(u => 
        u.email === pendingUserEmail
      );
      
      addTestResult(
        '管理员找到待审核用户',
        userListResponse.status === 200 && foundPendingUser,
        foundPendingUser 
          ? `找到用户，状态: ${foundPendingUser.status}` 
          : `未找到用户或请求失败`
      );

      if (foundPendingUser) {
        console.log('\n测试 3.2: 管理员审核通过用户（将状态改为 ACTIVE）');
        const approveResponse = await makeRequest(`/api/admin/users/${foundPendingUser.id}`, {
          method: 'PATCH',
          headers: {
            'Cookie': adminUser.cookie
          },
          body: { status: 'ACTIVE' }
        });
        
        addTestResult(
          '管理员审核通过用户',
          approveResponse.status === 200 && approveResponse.data.user?.status === 'ACTIVE',
          `状态: ${approveResponse.status}, 新状态: ${approveResponse.data.user?.status}`
        );

        console.log('\n测试 3.3: 审核通过后用户可以登录');
        const afterApprovalLogin = await loginUser(pendingUserEmail, pendingUserPassword);
        addTestResult(
          '审核通过后用户可以登录',
          afterApprovalLogin.cookie !== undefined && afterApprovalLogin.cookie !== '',
          afterApprovalLogin.cookie ? '登录成功' : `登录失败: ${afterApprovalLogin.message}`
        );

        if (afterApprovalLogin.cookie) {
          pendingUser = afterApprovalLogin;
        }
      }
    } else {
      addTestResult('管理员找到待审核用户', false, '跳过 - 管理员未登录');
      addTestResult('管理员审核通过用户', false, '跳过 - 管理员未登录');
      addTestResult('审核通过后用户可以登录', false, '跳过 - 管理员未登录');
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试阶段 4: 文档上传与文本提取');
    console.log('='.repeat(60));

    if (pendingUser && pendingUser.cookie) {
      console.log('\n测试 4.1: 创建用户的默认知识库');
      const kbListResponse = await makeRequest('/api/admin/documents', {
        method: 'GET',
        headers: {
          'Cookie': adminUser?.cookie
        }
      });

      console.log('\n测试 4.2: 准备上传文档（模拟 PDF 文件）');
      const pdfBuffer = createTestPDF();
      
      addTestResult('准备测试 PDF 文件', true, `PDF 大小: ${pdfBuffer.length} 字节`);

      console.log('\n测试 4.3: 上传文档');
      const uploadFormData = {
        title: '自动化测试文档 - ' + Date.now(),
        file: {
          file: true,
          filename: 'test-document.pdf',
          contentType: 'application/pdf',
          content: pdfBuffer
        }
      };

      const uploadResponse = await makeMultipartRequest('/api/documents/upload', uploadFormData, {
        headers: {
          'Cookie': pendingUser.cookie
        }
      });

      const uploadSuccess = uploadResponse.status === 201 && uploadResponse.data.document;
      addTestResult(
        '文档上传成功',
        uploadSuccess,
        uploadSuccess 
          ? `文档 ID: ${uploadResponse.data.document.id}` 
          : `状态: ${uploadResponse.status}, 消息: ${uploadResponse.data.message}`
      );

      if (uploadSuccess) {
        testDocument = uploadResponse.data.document;
        
        console.log('\n测试 4.4: 验证文档状态为 DRAFT');
        addTestResult(
          '文档状态为 DRAFT',
          testDocument.status === 'DRAFT',
          `状态: ${testDocument.status}`
        );

        console.log('\n测试 4.5: 验证文档关联了正确的作者');
        addTestResult(
          '文档作者关联正确',
          testDocument.authorId === pendingUser.userId,
          `作者 ID: ${testDocument.authorId}, 预期: ${pendingUser.userId}`
        );

        console.log('\n测试 4.6: 验证文档有 fileUrl');
        addTestResult(
          '文档有 fileUrl',
          testDocument.fileUrl !== null && testDocument.fileUrl !== undefined,
          `fileUrl: ${testDocument.fileUrl}`
        );
      }
    } else {
      addTestResult('准备测试 PDF 文件', false, '跳过 - 用户未登录');
      addTestResult('文档上传成功', false, '跳过 - 用户未登录');
      addTestResult('文档状态为 DRAFT', false, '跳过 - 用户未登录');
      addTestResult('文档作者关联正确', false, '跳过 - 用户未登录');
      addTestResult('文档有 fileUrl', false, '跳过 - 用户未登录');
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试阶段 5: 管理员文档管理');
    console.log('='.repeat(60));

    if (adminUser && adminUser.cookie) {
      console.log('\n测试 5.1: 管理员获取文档列表');
      const docListResponse = await makeRequest('/api/admin/documents?page=1&limit=10', {
        method: 'GET',
        headers: {
          'Cookie': adminUser.cookie
        }
      });

      addTestResult(
        '管理员获取文档列表',
        docListResponse.status === 200 && docListResponse.data.documents && docListResponse.data.pagination,
        `状态: ${docListResponse.status}, 文档数: ${docListResponse.data.documents?.length || 0}`
      );

      if (testDocument) {
        console.log('\n测试 5.2: 按状态筛选文档');
        const draftFilterResponse = await makeRequest('/api/admin/documents?page=1&limit=10&status=DRAFT', {
          method: 'GET',
          headers: {
            'Cookie': adminUser.cookie
          }
        });

        addTestResult(
          '按状态筛选文档',
          draftFilterResponse.status === 200,
          `状态: ${draftFilterResponse.status}`
        );

        console.log('\n测试 5.3: 管理员修改文档状态（DRAFT → PUBLISHED）');
        const updateStatusResponse = await makeRequest(`/api/admin/documents/${testDocument.id}`, {
          method: 'PATCH',
          headers: {
            'Cookie': adminUser.cookie
          },
          body: { status: 'PUBLISHED' }
        });

        addTestResult(
          '管理员修改文档状态',
          updateStatusResponse.status === 200 && updateStatusResponse.data.document?.status === 'PUBLISHED',
          `状态: ${updateStatusResponse.status}, 新状态: ${updateStatusResponse.data.document?.status}`
        );
      }
    } else {
      addTestResult('管理员获取文档列表', false, '跳过 - 管理员未登录');
      addTestResult('按状态筛选文档', false, '跳过 - 管理员未登录');
      addTestResult('管理员修改文档状态', false, '跳过 - 管理员未登录');
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试阶段 6: 禁用用户测试');
    console.log('='.repeat(60));

    if (adminUser && adminUser.cookie && pendingUser) {
      console.log('\n测试 6.1: 管理员禁用用户');
      const banResponse = await makeRequest(`/api/admin/users/${pendingUser.userId}`, {
        method: 'PATCH',
        headers: {
          'Cookie': adminUser.cookie
        },
        body: { status: 'BANNED' }
      });

      addTestResult(
        '管理员禁用用户',
        banResponse.status === 200 && banResponse.data.user?.status === 'BANNED',
        `状态: ${banResponse.status}, 新状态: ${banResponse.data.user?.status}`
      );

      console.log('\n测试 6.2: 被禁用用户无法登录');
      const bannedLoginAttempt = await loginUser(pendingUserEmail, pendingUserPassword);
      addTestResult(
        '被禁用用户无法登录',
        bannedLoginAttempt.status === 403 && bannedLoginAttempt.message === '账号已被禁用，请联系管理员',
        `状态: ${bannedLoginAttempt.status}, 消息: ${bannedLoginAttempt.message}`
      );
    } else {
      addTestResult('管理员禁用用户', false, '跳过 - 管理员或用户未登录');
      addTestResult('被禁用用户无法登录', false, '跳过 - 管理员或用户未登录');
    }

  } catch (error) {
    console.error('\n测试过程中发生错误:');
    console.error(`  错误信息: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('测试结果汇总');
  console.log('='.repeat(60));

  const passedCount = testResults.filter(r => r.passed).length;
  const failedCount = testResults.filter(r => !r.passed).length;

  console.log(`\n总测试数: ${testResults.length}`);
  console.log(`通过: ${passedCount}`);
  console.log(`失败: ${failedCount}`);

  if (failedCount > 0) {
    console.log('\n失败的测试:');
    testResults.filter(r => !r.passed).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name}`);
      if (r.message) {
        console.log(`     ${r.message}`);
      }
    });
  }

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ 所有测试通过！');
    console.log('\n📋 测试覆盖:');
    console.log('   ✅ 新用户注册后处于 PENDING 状态');
    console.log('   ✅ 待审核用户无法登录');
    console.log('   ✅ 管理员可将用户状态改为 ACTIVE');
    console.log('   ✅ 审核通过后用户可以登录');
    console.log('   ✅ 文档上传成功并关联作者');
    console.log('   ✅ 文档状态默认为 DRAFT');
    console.log('   ✅ 管理员可修改文档状态');
    console.log('   ✅ 被禁用用户无法登录');
    process.exit(0);
  } else {
    console.log('❌ 部分测试失败！');
    console.log('\n⚠️  请检查代码并修复后重新运行测试。');
    process.exit(1);
  }
}

runTests();
