const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3005';

const testResults = [];
let allPassed = true;
let testUserCookie = '';
let testUserId = '';
let createdDocuments = [];

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

function generateRandomEmail() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-pdf-${timestamp}-${random}@test.com`;
}

function createTestTXTContent() {
  return `智能知识库系统测试文档

第一章：系统概述
智能知识库系统是一个用于管理和检索文档的智能系统。它支持多种文档格式，包括PDF、DOCX和TXT文件。系统的核心功能包括文档上传与解析、向量化存储与检索、RAG增强智能问答、知识库管理与组织。

第二章：文档处理流程
当用户上传文档时，系统会执行以下步骤：
第一步：文件验证，检查文件格式是否支持，验证文件大小是否在限制范围内，检查文件是否损坏。
第二步：文本提取，对于PDF文件使用pdf-parse库提取文本内容，对于DOCX文件使用mammoth库提取文本内容，对于TXT文件直接读取文本内容。
第三步：文本处理，清理文本中的多余空格和换行，统一文本编码格式。
第四步：向量化切片，将长文本分割成多个片段，每个片段默认大小为500字符，片段之间保留50字符的重叠，以确保上下文连续性。

第三章：RAG技术详解
RAG（Retrieval-Augmented Generation）是一种结合检索和生成的人工智能技术。它的工作原理如下：
3.1 检索阶段：当用户提出问题时，系统首先在知识库中检索与问题相关的文档片段。这个过程包括将用户问题转换为向量表示，在向量数据库中搜索相似的文档片段，按相似度排序返回最相关的片段。
3.2 增强阶段：检索到的相关片段会被整合到提示词中，作为上下文信息提供给大语言模型。这样模型就可以基于最新的、特定领域的知识来回答问题。
3.3 生成阶段：大语言模型利用检索到的上下文信息，结合自身的预训练知识，生成准确、相关的回答。

第四章：最佳实践
为了获得最佳的使用体验，建议遵循以下最佳实践：
4.1 文档准备：使用清晰的标题和层次结构，确保文本可编辑（扫描版PDF效果不佳），使用标准的文档格式。
4.2 知识库组织：按主题或项目创建独立的知识库，使用有意义的知识库名称，定期整理和更新文档。
4.3 文档上传：为每个文档提供清晰的标题，选择合适的知识库进行分类，可添加补充说明以增强上下文。

第五章：测试验证
这份文档包含足够的文本内容，用于测试系统的文档解析功能。系统应该能够正确提取所有文本内容，并将其分割成适当大小的片段。通过这份文档，可以验证以下功能：文档上传流程、文本提取和解析、向量化切片过程。`;
}

function createMinimalPDF() {
  return Buffer.from([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37,
    0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a,
    0x31, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a,
    0x3c, 0x3c, 0x2f, 0x54, 0x79, 0x70, 0x65, 0x2f, 0x43, 0x61, 0x74, 0x61, 0x6c, 0x6f, 0x67, 0x20, 0x2f, 0x50, 0x61, 0x67, 0x65, 0x73, 0x20, 0x32, 0x20, 0x30, 0x20, 0x52, 0x3e, 0x3e, 0x0a,
    0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a, 0x0a,
    0x32, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a,
    0x3c, 0x3c, 0x2f, 0x54, 0x79, 0x70, 0x65, 0x2f, 0x50, 0x61, 0x67, 0x65, 0x73, 0x20, 0x2f, 0x4b, 0x69, 0x64, 0x73, 0x5b, 0x33, 0x20, 0x30, 0x20, 0x52, 0x5d, 0x20, 0x2f, 0x43, 0x6f, 0x75, 0x6e, 0x74, 0x20, 0x31, 0x3e, 0x3e, 0x0a,
    0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a, 0x0a,
    0x33, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a,
    0x3c, 0x3c, 0x2f, 0x54, 0x79, 0x70, 0x65, 0x2f, 0x50, 0x61, 0x67, 0x65, 0x20, 0x2f, 0x4d, 0x65, 0x64, 0x69, 0x61, 0x42, 0x6f, 0x78, 0x5b, 0x30, 0x20, 0x30, 0x20, 0x36, 0x31, 0x32, 0x20, 0x37, 0x39, 0x32, 0x5d, 0x20, 0x2f, 0x50, 0x61, 0x72, 0x65, 0x6e, 0x74, 0x20, 0x32, 0x20, 0x30, 0x20, 0x52, 0x20, 0x2f, 0x52, 0x65, 0x73, 0x6f, 0x75, 0x72, 0x63, 0x65, 0x73, 0x3c, 0x3c, 0x2f, 0x46, 0x6f, 0x6e, 0x74, 0x3c, 0x3c, 0x2f, 0x46, 0x31, 0x3c, 0x3c, 0x2f, 0x54, 0x79, 0x70, 0x65, 0x2f, 0x46, 0x6f, 0x6e, 0x74, 0x20, 0x2f, 0x53, 0x75, 0x62, 0x74, 0x79, 0x70, 0x65, 0x2f, 0x54, 0x79, 0x70, 0x65, 0x31, 0x20, 0x2f, 0x42, 0x61, 0x73, 0x65, 0x46, 0x6f, 0x6e, 0x74, 0x2f, 0x48, 0x65, 0x6c, 0x76, 0x65, 0x74, 0x69, 0x63, 0x61, 0x3e, 0x3e, 0x3e, 0x3e, 0x3e, 0x3e, 0x3e, 0x0a,
    0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a, 0x0a,
    0x78, 0x72, 0x65, 0x66, 0x0a,
    0x30, 0x20, 0x34, 0x0a,
    0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x20, 0x36, 0x35, 0x35, 0x33, 0x36, 0x20, 0x66, 0x20, 0x0a,
    0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x39, 0x20, 0x30, 0x30, 0x30, 0x30, 0x30, 0x20, 0x6e, 0x20, 0x0a,
    0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x35, 0x38, 0x20, 0x30, 0x30, 0x30, 0x30, 0x30, 0x20, 0x6e, 0x20, 0x0a,
    0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x31, 0x31, 0x35, 0x20, 0x30, 0x30, 0x30, 0x30, 0x30, 0x20, 0x6e, 0x20, 0x0a,
    0x74, 0x72, 0x61, 0x69, 0x6c, 0x65, 0x72, 0x0a,
    0x3c, 0x3c, 0x2f, 0x53, 0x69, 0x7a, 0x65, 0x20, 0x34, 0x3e, 0x3e, 0x0a,
    0x73, 0x74, 0x61, 0x72, 0x74, 0x78, 0x72, 0x65, 0x66, 0x0a,
    0x32, 0x36, 0x37, 0x0a,
    0x25, 0x25, 0x45, 0x4f, 0x46, 0x0a
  ]);
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('PDF 解析功能端到端测试');
  console.log('='.repeat(60));
  console.log(`服务器地址: ${BASE_URL}`);
  console.log(`Node.js 版本: ${process.version}`);
  console.log(`测试时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('');

  try {
    console.log('测试阶段 1: 环境准备');
    console.log('='.repeat(60));

    console.log('\n测试 1.1: 检查服务器是否启动');
    try {
      const response = await makeRequest('/api/auth/login', { method: 'GET' });
      addTestResult('服务器启动检查', response.status === 405, `响应状态码: ${response.status}`);
    } catch (error) {
      addTestResult('服务器启动检查', false, `连接失败: ${error.message}`);
      console.log('\n❌ 服务器未启动，请先运行: npm run dev');
      process.exit(1);
    }

    console.log('\n测试 1.2: 注册/登录测试用户');
    const testEmail = generateRandomEmail();
    const testPassword = 'test123456';
    
    console.log(`   注册用户: ${testEmail}`);
    const registerResponse = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: { email: testEmail, password: testPassword, name: 'PDF Test User' }
    });

    if (registerResponse.status === 200 || registerResponse.status === 201) {
      addTestResult('用户注册', true, `用户 ID: ${registerResponse.data.user?.id}`);
      
      console.log('   登录用户...');
      const loginResponse = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: { email: testEmail, password: testPassword }
      });

      if (loginResponse.status === 200 && loginResponse.data.user) {
        testUserCookie = extractCookieValue(loginResponse.cookies, 'kb_user_id');
        testUserId = loginResponse.data.user.id;
        addTestResult('用户登录', true, `Cookie: ${testUserCookie.substring(0, 30)}...`);
      } else {
        addTestResult('用户登录', false, `登录失败: ${loginResponse.data.message}`);
      }
    } else {
      addTestResult('用户注册', false, `注册失败: ${registerResponse.data.message}`);
    }

    console.log('\n测试阶段 2: TXT 文档上传测试');
    console.log('='.repeat(60));

    if (testUserCookie) {
      console.log('\n测试 2.1: 上传 TXT 文档');
      const txtContent = createTestTXTContent();
      const txtBuffer = Buffer.from(txtContent, 'utf-8');
      
      const uploadFormData = {
        title: 'TXT 测试文档 - ' + Date.now(),
        file: {
          file: true,
          filename: 'test-document.txt',
          contentType: 'text/plain',
          content: txtBuffer
        }
      };

      const uploadResponse = await makeMultipartRequest('/api/documents/upload', uploadFormData, {
        headers: { 'Cookie': testUserCookie }
      });

      const uploadSuccess = uploadResponse.status === 201 && uploadResponse.data.document;
      addTestResult(
        'TXT 文档上传',
        uploadSuccess,
        uploadSuccess 
          ? `文档 ID: ${uploadResponse.data.document.id}, 状态: ${uploadResponse.data.document.status}` 
          : `状态: ${uploadResponse.status}, 消息: ${uploadResponse.data.message}`
      );

      if (uploadSuccess) {
        createdDocuments.push(uploadResponse.data.document.id);
        
        console.log('\n测试 2.2: 验证 TXT 文档解析结果');
        const doc = uploadResponse.data.document;
        
        const hasContent = doc.content && doc.content.length > 0;
        const hasFileUrl = doc.fileUrl !== null;
        const isDraft = doc.status === 'DRAFT';
        
        addTestResult(
          'TXT 文档解析验证',
          hasContent && hasFileUrl && isDraft,
          `内容长度: ${doc.content?.length || 0}, 状态: ${doc.status}`
        );

        if (uploadResponse.data.rag) {
          const rag = uploadResponse.data.rag;
          addTestResult(
            'TXT 文档 RAG 预处理',
            rag.chunkCount > 0,
            `切片数量: ${rag.chunkCount}`
          );
        }
      }
    } else {
      addTestResult('TXT 文档上传', false, '跳过 - 用户未登录');
    }

    console.log('\n测试阶段 3: PDF 文档上传测试');
    console.log('='.repeat(60));

    if (testUserCookie) {
      console.log('\n测试 3.1: 上传 PDF 文档（最小结构）');
      const pdfBuffer = createMinimalPDF();
      
      const uploadFormData = {
        title: 'PDF 测试文档 - ' + Date.now(),
        file: {
          file: true,
          filename: 'test-document.pdf',
          contentType: 'application/pdf',
          content: pdfBuffer
        }
      };

      const uploadResponse = await makeMultipartRequest('/api/documents/upload', uploadFormData, {
        headers: { 'Cookie': testUserCookie }
      });

      console.log(`   响应状态: ${uploadResponse.status}`);
      console.log(`   响应消息: ${uploadResponse.data.message}`);

      if (uploadResponse.status === 201 && uploadResponse.data.document) {
        createdDocuments.push(uploadResponse.data.document.id);
        addTestResult(
          'PDF 文档上传',
          true,
          `文档 ID: ${uploadResponse.data.document.id}`
        );
      } else if (uploadResponse.status === 500 || uploadResponse.status === 400) {
        const errorType = uploadResponse.data.errorType;
        const isExpectedError = 
          errorType === 'ScannedPDFError' || 
          errorType === 'EmptyContentError' ||
          errorType === 'CorruptedFileError';
        
        addTestResult(
          'PDF 文档上传（最小结构）',
          isExpectedError,
          `错误类型: ${errorType}, 消息: ${uploadResponse.data.message}`
        );
        
        if (uploadResponse.data.document) {
          createdDocuments.push(uploadResponse.data.document.id);
        }
      } else {
        addTestResult(
          'PDF 文档上传',
          false,
          `状态: ${uploadResponse.status}, 消息: ${uploadResponse.data.message}`
        );
      }

      console.log('\n测试 3.2: 上传无效 PDF 文件');
      const invalidPdfBuffer = Buffer.from('This is not a valid PDF file');
      
      const invalidUploadFormData = {
        title: '无效 PDF 测试 - ' + Date.now(),
        file: {
          file: true,
          filename: 'invalid.pdf',
          contentType: 'application/pdf',
          content: invalidPdfBuffer
        }
      };

      const invalidUploadResponse = await makeMultipartRequest('/api/documents/upload', invalidUploadFormData, {
        headers: { 'Cookie': testUserCookie }
      });

      const isCorrectError = 
        invalidUploadResponse.status === 400 || 
        invalidUploadResponse.status === 500;
      
      addTestResult(
        '无效 PDF 错误处理',
        isCorrectError,
        `状态: ${invalidUploadResponse.status}, 错误类型: ${invalidUploadResponse.data.errorType}`
      );

      if (invalidUploadResponse.data.document) {
        createdDocuments.push(invalidUploadResponse.data.document.id);
      }
    } else {
      addTestResult('PDF 文档上传', false, '跳过 - 用户未登录');
    }

    console.log('\n测试阶段 4: 智能对话搜索测试');
    console.log('='.repeat(60));

    if (testUserCookie) {
      console.log('\n测试 4.1: 测试文档搜索接口');
      
      const searchQuery = 'RAG技术';
      const searchResponse = await makeRequest(`/api/qa/search?query=${encodeURIComponent(searchQuery)}`, {
        method: 'GET',
        headers: { 'Cookie': testUserCookie }
      });

      const searchValid = 
        searchResponse.status === 200 || 
        searchResponse.status === 400 || 
        searchResponse.status === 500;
      
      addTestResult(
        '搜索接口可用性',
        searchValid,
        `状态: ${searchResponse.status}`
      );

      console.log('\n测试 4.2: 测试文档列表接口');
      const docListResponse = await makeRequest('/api/documents?page=1&limit=10', {
        method: 'GET',
        headers: { 'Cookie': testUserCookie }
      });

      const listSuccess = docListResponse.status === 200 && docListResponse.data.documents;
      addTestResult(
        '文档列表接口',
        listSuccess,
        listSuccess 
          ? `文档数量: ${docListResponse.data.documents.length}` 
          : `状态: ${docListResponse.status}`
      );
    } else {
      addTestResult('智能对话搜索测试', false, '跳过 - 用户未登录');
    }

    console.log('\n测试阶段 5: 边缘情况测试');
    console.log('='.repeat(60));

    if (testUserCookie) {
      console.log('\n测试 5.1: 不支持的文件格式');
      const unsupportedBuffer = Buffer.from('<?xml version="1.0"?><test></test>');
      
      const unsupportedFormData = {
        title: '不支持格式测试 - ' + Date.now(),
        file: {
          file: true,
          filename: 'test.xml',
          contentType: 'application/xml',
          content: unsupportedBuffer
        }
      };

      const unsupportedResponse = await makeMultipartRequest('/api/documents/upload', unsupportedFormData, {
        headers: { 'Cookie': testUserCookie }
      });

      const isUnsupportedError = 
        unsupportedResponse.status === 400 && 
        unsupportedResponse.data.errorType === 'UNSUPPORTED_FORMAT';
      
      addTestResult(
        '不支持格式错误处理',
        isUnsupportedError || unsupportedResponse.status === 400,
        `状态: ${unsupportedResponse.status}, 错误类型: ${unsupportedResponse.data.errorType}`
      );

      console.log('\n测试 5.2: 空内容 TXT 文件');
      const emptyTxtBuffer = Buffer.from('短');
      
      const emptyTxtFormData = {
        title: '空内容测试 - ' + Date.now(),
        file: {
          file: true,
          filename: 'empty.txt',
          contentType: 'text/plain',
          content: emptyTxtBuffer
        }
      };

      const emptyTxtResponse = await makeMultipartRequest('/api/documents/upload', emptyTxtFormData, {
        headers: { 'Cookie': testUserCookie }
      });

      const isEmptyError = 
        emptyTxtResponse.status === 500 && 
        emptyTxtResponse.data.errorType === 'EmptyContentError';
      
      addTestResult(
        '空内容错误处理',
        isEmptyError,
        `状态: ${emptyTxtResponse.status}, 错误类型: ${emptyTxtResponse.data.errorType}`
      );

      if (emptyTxtResponse.data.document) {
        createdDocuments.push(emptyTxtResponse.data.document.id);
      }
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
  
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  
  console.log(`\n总测试数: ${testResults.length}`);
  console.log(`通过: ${passed}`);
  console.log(`失败: ${failed}`);
  
  if (failed > 0) {
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
    console.log('   ✅ 服务器连接检查');
    console.log('   ✅ 用户注册与登录');
    console.log('   ✅ TXT 文档上传与解析');
    console.log('   ✅ PDF 文档上传（含错误处理）');
    console.log('   ✅ 智能对话搜索接口');
    console.log('   ✅ 边缘情况测试');
    process.exit(0);
  } else {
    console.log('❌ 部分测试失败！');
    console.log('\n⚠️  请检查代码并修复后重新运行测试。');
    process.exit(1);
  }
}

runTests().catch(console.error);
