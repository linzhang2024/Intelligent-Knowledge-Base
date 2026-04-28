const http = require('http');

const BASE_URL = 'http://localhost:3005';

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
    return { cookie, userId: response.data.user.id };
  } else {
    console.log(`   ✗ 登录失败: ${response.data.message}`);
    return null;
  }
}

async function createAdminUser(email, password) {
  const loginResult = await loginUser(email, password);
  if (!loginResult) {
    return null;
  }

  return loginResult;
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('用户管理 API 自动化测试');
  console.log('='.repeat(60));
  console.log(`服务器地址: ${BASE_URL}`);
  console.log(`测试时间: ${new Date().toLocaleString('zh-CN')}\n`);

  let adminUser = null;
  let regularUser = null;
  let testUserId = null;

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
    adminUser = await loginUser('admin-user-test@example.com', 'admin123');
    if (adminUser) {
      addTestResult('管理员用户登录', true, '用户已创建/登录成功');
    } else {
      addTestResult('管理员用户登录', false, '无法创建或登录管理员用户');
    }

    console.log('\n测试 1.3: 创建/登录普通用户');
    regularUser = await loginUser('regular-user-test@example.com', 'user123');
    if (regularUser) {
      addTestResult('普通用户登录', true, '用户已创建/登录成功');
    } else {
      addTestResult('普通用户登录', false, '无法创建或登录普通用户');
    }

    console.log('\n测试 1.4: 创建测试用户用于删除测试');
    const testUserLogin = await loginUser('test-user-for-delete@example.com', 'test123');
    if (testUserLogin) {
      testUserId = testUserLogin.userId;
      addTestResult('测试用户创建', true, `测试用户 ID: ${testUserId}`);
    } else {
      addTestResult('测试用户创建', false, '无法创建测试用户');
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试阶段 2: 未登录状态下的拦截测试');
    console.log('='.repeat(60));

    console.log('\n测试 2.1: 未登录访问用户列表 API');
    const noAuthListResponse = await makeRequest('/api/admin/users', {
      method: 'GET'
    });
    addTestResult(
      '未登录访问用户列表',
      noAuthListResponse.status === 401,
      `预期: 401, 实际: ${noAuthListResponse.status}`
    );

    console.log('\n测试 2.2: 未登录访问用户详情 PATCH API');
    const noAuthPatchResponse = await makeRequest('/api/admin/users/some-id', {
      method: 'PATCH',
      body: { role: 'ADMIN' }
    });
    addTestResult(
      '未登录 PATCH 用户',
      noAuthPatchResponse.status === 401,
      `预期: 401, 实际: ${noAuthPatchResponse.status}`
    );

    console.log('\n测试 2.3: 未登录访问用户 DELETE API');
    const noAuthDeleteResponse = await makeRequest('/api/admin/users/some-id', {
      method: 'DELETE'
    });
    addTestResult(
      '未登录 DELETE 用户',
      noAuthDeleteResponse.status === 401,
      `预期: 401, 实际: ${noAuthDeleteResponse.status}`
    );

    console.log('\n' + '='.repeat(60));
    console.log('测试阶段 3: 普通用户越权访问测试');
    console.log('='.repeat(60));

    if (regularUser && regularUser.cookie) {
      console.log('\n测试 3.1: 普通用户访问用户列表 API');
      const userListResponse = await makeRequest('/api/admin/users', {
        method: 'GET',
        headers: {
          'Cookie': regularUser.cookie
        }
      });
      addTestResult(
        '普通用户访问用户列表',
        userListResponse.status === 403,
        `预期: 403, 实际: ${userListResponse.status}`
      );

      console.log('\n测试 3.2: 普通用户 PATCH 用户 API');
      const userPatchResponse = await makeRequest(`/api/admin/users/${regularUser.userId}`, {
        method: 'PATCH',
        headers: {
          'Cookie': regularUser.cookie
        },
        body: { role: 'ADMIN' }
      });
      addTestResult(
        '普通用户 PATCH 用户',
        userPatchResponse.status === 403,
        `预期: 403, 实际: ${userPatchResponse.status}`
      );

      console.log('\n测试 3.3: 普通用户 DELETE 用户 API');
      const userDeleteResponse = await makeRequest(`/api/admin/users/${regularUser.userId}`, {
        method: 'DELETE',
        headers: {
          'Cookie': regularUser.cookie
        }
      });
      addTestResult(
        '普通用户 DELETE 用户',
        userDeleteResponse.status === 403,
        `预期: 403, 实际: ${userDeleteResponse.status}`
      );
    } else {
      addTestResult('普通用户访问用户列表', false, '跳过 - 普通用户未登录');
      addTestResult('普通用户 PATCH 用户', false, '跳过 - 普通用户未登录');
      addTestResult('普通用户 DELETE 用户', false, '跳过 - 普通用户未登录');
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试阶段 4: 管理员正常操作测试');
    console.log('='.repeat(60));

    if (adminUser && adminUser.cookie) {
      console.log('\n测试 4.1: 管理员获取用户列表');
      const adminListResponse = await makeRequest('/api/admin/users?page=1&limit=10', {
        method: 'GET',
        headers: {
          'Cookie': adminUser.cookie
        }
      });
      addTestResult(
        '管理员获取用户列表',
        adminListResponse.status === 200 && adminListResponse.data.users && adminListResponse.data.pagination,
        `状态: ${adminListResponse.status}, 用户数: ${adminListResponse.data.users?.length || 0}`
      );

      console.log('\n测试 4.2: 管理员获取用户列表带搜索参数');
      const searchResponse = await makeRequest('/api/admin/users?page=1&limit=10&search=admin', {
        method: 'GET',
        headers: {
          'Cookie': adminUser.cookie
        }
      });
      addTestResult(
        '管理员搜索用户',
        searchResponse.status === 200,
        `状态: ${searchResponse.status}, 搜索结果数: ${searchResponse.data.users?.length || 0}`
      );

      console.log('\n测试 4.3: 管理员修改用户角色');
      if (regularUser && regularUser.userId) {
        const patchRoleResponse = await makeRequest(`/api/admin/users/${regularUser.userId}`, {
          method: 'PATCH',
          headers: {
            'Cookie': adminUser.cookie
          },
          body: { role: 'EDITOR' }
        });
        addTestResult(
          '管理员修改用户角色',
          patchRoleResponse.status === 200 && patchRoleResponse.data.user?.role === 'EDITOR',
          `状态: ${patchRoleResponse.status}, 新角色: ${patchRoleResponse.data.user?.role}`
        );
      } else {
        addTestResult('管理员修改用户角色', false, '跳过 - 无测试用户');
      }

      console.log('\n测试 4.4: 管理员修改用户状态');
      if (regularUser && regularUser.userId) {
        const patchStatusResponse = await makeRequest(`/api/admin/users/${regularUser.userId}`, {
          method: 'PATCH',
          headers: {
            'Cookie': adminUser.cookie
          },
          body: { status: 'INACTIVE' }
        });
        addTestResult(
          '管理员修改用户状态',
          patchStatusResponse.status === 200 && patchStatusResponse.data.user?.status === 'INACTIVE',
          `状态: ${patchStatusResponse.status}, 新状态: ${patchStatusResponse.data.user?.status}`
        );
      } else {
        addTestResult('管理员修改用户状态', false, '跳过 - 无测试用户');
      }

      console.log('\n测试 4.5: 管理员不能删除自己');
      const deleteSelfResponse = await makeRequest(`/api/admin/users/${adminUser.userId}`, {
        method: 'DELETE',
        headers: {
          'Cookie': adminUser.cookie
        }
      });
      addTestResult(
        '管理员不能删除自己',
        deleteSelfResponse.status === 400,
        `状态: ${deleteSelfResponse.status}, 消息: ${deleteSelfResponse.data.message}`
      );

      console.log('\n测试 4.6: 管理员删除其他用户');
      if (testUserId) {
        const deleteUserResponse = await makeRequest(`/api/admin/users/${testUserId}`, {
          method: 'DELETE',
          headers: {
            'Cookie': adminUser.cookie
          }
        });
        addTestResult(
          '管理员删除用户',
          deleteUserResponse.status === 200,
          `状态: ${deleteUserResponse.status}, 消息: ${deleteUserResponse.data.message}`
        );
      } else {
        addTestResult('管理员删除用户', false, '跳过 - 无测试用户');
      }

      console.log('\n测试 4.7: 无效的角色值验证');
      if (regularUser && regularUser.userId) {
        const invalidRoleResponse = await makeRequest(`/api/admin/users/${regularUser.userId}`, {
          method: 'PATCH',
          headers: {
            'Cookie': adminUser.cookie
          },
          body: { role: 'INVALID_ROLE' }
        });
        addTestResult(
          '无效角色值验证',
          invalidRoleResponse.status === 400,
          `状态: ${invalidRoleResponse.status}`
        );
      } else {
        addTestResult('无效角色值验证', false, '跳过 - 无测试用户');
      }

      console.log('\n测试 4.8: 无效的状态值验证');
      if (regularUser && regularUser.userId) {
        const invalidStatusResponse = await makeRequest(`/api/admin/users/${regularUser.userId}`, {
          method: 'PATCH',
          headers: {
            'Cookie': adminUser.cookie
          },
          body: { status: 'INVALID_STATUS' }
        });
        addTestResult(
          '无效状态值验证',
          invalidStatusResponse.status === 400,
          `状态: ${invalidStatusResponse.status}`
        );
      } else {
        addTestResult('无效状态值验证', false, '跳过 - 无测试用户');
      }
    } else {
      addTestResult('管理员获取用户列表', false, '跳过 - 管理员未登录');
      addTestResult('管理员搜索用户', false, '跳过 - 管理员未登录');
      addTestResult('管理员修改用户角色', false, '跳过 - 管理员未登录');
      addTestResult('管理员修改用户状态', false, '跳过 - 管理员未登录');
      addTestResult('管理员不能删除自己', false, '跳过 - 管理员未登录');
      addTestResult('管理员删除用户', false, '跳过 - 管理员未登录');
      addTestResult('无效角色值验证', false, '跳过 - 管理员未登录');
      addTestResult('无效状态值验证', false, '跳过 - 管理员未登录');
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试阶段 5: 参数验证测试');
    console.log('='.repeat(60));

    if (adminUser && adminUser.cookie) {
      console.log('\n测试 5.1: PATCH 请求无更新字段');
      if (regularUser && regularUser.userId) {
        const emptyPatchResponse = await makeRequest(`/api/admin/users/${regularUser.userId}`, {
          method: 'PATCH',
          headers: {
            'Cookie': adminUser.cookie
          },
          body: {}
        });
        addTestResult(
          'PATCH 无更新字段',
          emptyPatchResponse.status === 400,
          `状态: ${emptyPatchResponse.status}`
        );
      } else {
        addTestResult('PATCH 无更新字段', false, '跳过 - 无测试用户');
      }

      console.log('\n测试 5.2: 访问不存在的用户');
      const nonExistentUserResponse = await makeRequest('/api/admin/users/non-existent-id-12345', {
        method: 'PATCH',
        headers: {
          'Cookie': adminUser.cookie
        },
        body: { role: 'VIEWER' }
      });
      addTestResult(
        '访问不存在的用户',
        nonExistentUserResponse.status === 404,
        `状态: ${nonExistentUserResponse.status}`
      );
    } else {
      addTestResult('PATCH 无更新字段', false, '跳过 - 管理员未登录');
      addTestResult('访问不存在的用户', false, '跳过 - 管理员未登录');
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
    console.log('   ✅ 未登录用户访问 API → 401 Unauthorized');
    console.log('   ✅ 普通用户访问管理员 API → 403 Forbidden');
    console.log('   ✅ 管理员获取用户列表 → 200 OK');
    console.log('   ✅ 管理员搜索用户 → 200 OK');
    console.log('   ✅ 管理员修改用户角色 → 200 OK');
    console.log('   ✅ 管理员修改用户状态 → 200 OK');
    console.log('   ✅ 管理员删除用户 → 200 OK');
    console.log('   ✅ 管理员不能删除自己 → 400 Bad Request');
    console.log('   ✅ 无效参数验证 → 400 Bad Request');
    console.log('   ✅ 访问不存在的用户 → 404 Not Found');
    process.exit(0);
  } else {
    console.log('❌ 部分测试失败！');
    console.log('\n⚠️  请检查代码并修复后重新运行测试。');
    process.exit(1);
  }
}

runTests();
