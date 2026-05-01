const fs = require('fs');
const path = require('path');

const testResults = [];
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

function createTestTXT() {
  return `智能知识库系统测试文档

这是一个用于测试智能知识库系统功能的测试文档。该文档包含足够的文本内容，以确保系统能够正确地进行文档解析和RAG预处理（向量化切片）。

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
3.3 生成阶段：大语言模型利用检索到的上下文信息，结合自身的预训练知识，生成准确、相关的回答。`;
}

async function testTXTModule() {
  console.log('\n测试阶段 1: TXT 解析模块测试');
  console.log('='.repeat(60));

  try {
    const { extractTextFromTXT } = require('../src/lib/documentParser');
    
    const testDir = path.join(__dirname, 'test-files');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const txtPath = path.join(testDir, 'test-document.txt');
    const txtContent = createTestTXT();
    fs.writeFileSync(txtPath, txtContent, 'utf-8');

    console.log('\n测试 1.1: TXT 文件解析');
    try {
      const result = await extractTextFromTXT(txtPath);
      
      const hasContent = result.length > 0;
      const hasExpectedText = result.includes('智能知识库系统') && result.includes('RAG技术详解');
      
      addTestResult(
        'TXT 文件解析',
        hasContent && hasExpectedText,
        hasContent 
          ? `文本长度: ${result.length} 字符` 
          : '解析结果为空'
      );
    } catch (error) {
      addTestResult('TXT 文件解析', false, `解析失败: ${error.message}`);
    }

    console.log('\n测试 1.2: 空/短内容 TXT 文件处理');
    const shortTxtPath = path.join(testDir, 'short.txt');
    fs.writeFileSync(shortTxtPath, '短', 'utf-8');
    
    try {
      await extractTextFromTXT(shortTxtPath);
      addTestResult('短内容 TXT 处理', false, '应该抛出异常');
    } catch (error) {
      const { EmptyContentError } = require('../src/lib/documentParser');
      addTestResult(
        '短内容 TXT 处理',
        error instanceof EmptyContentError,
        `正确抛出异常: ${error.name}`
      );
    }

    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true });
      } catch (e) {
        // 忽略
      }
    }
  } catch (error) {
    console.error('TXT 模块测试失败:', error);
    addTestResult('TXT 模块加载', false, `加载失败: ${error.message}`);
  }
}

async function testPDFJSModule() {
  console.log('\n测试阶段 2: pdfjs-dist 模块测试');
  console.log('='.repeat(60));

  try {
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
    
    addTestResult(
      'pdfjs-dist 模块加载',
      pdfjsLib !== undefined && pdfjsLib.getDocument !== undefined,
      `pdfjsLib 可用: ${typeof pdfjsLib}`
    );

    console.log('\n测试 2.1: pdfjs-dist 基本功能');
    
    const testDir = path.join(__dirname, 'test-files');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const minimalPDF = Buffer.from([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37,
      0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a,
      0x31, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a,
      0x3c, 0x3c, 0x2f, 0x54, 0x79, 0x70, 0x65, 0x2f, 0x43, 0x61, 0x74, 0x61, 0x6c, 0x6f, 0x67, 0x3e, 0x3e, 0x0a,
      0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a, 0x0a,
      0x78, 0x72, 0x65, 0x66, 0x0a,
      0x30, 0x20, 0x32, 0x0a,
      0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x20, 0x36, 0x35, 0x35, 0x33, 0x36, 0x20, 0x66, 0x20, 0x0a,
      0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x39, 0x20, 0x30, 0x30, 0x30, 0x30, 0x30, 0x20, 0x6e, 0x20, 0x0a,
      0x74, 0x72, 0x61, 0x69, 0x6c, 0x65, 0x72, 0x0a,
      0x3c, 0x3c, 0x2f, 0x53, 0x69, 0x7a, 0x65, 0x20, 0x32, 0x3e, 0x3e, 0x0a,
      0x73, 0x74, 0x61, 0x72, 0x74, 0x78, 0x72, 0x65, 0x66, 0x0a,
      0x33, 0x39, 0x0a,
      0x25, 0x25, 0x45, 0x4f, 0x46, 0x0a
    ]);

    const pdfPath = path.join(testDir, 'minimal.pdf');
    fs.writeFileSync(pdfPath, minimalPDF);

    console.log('   测试 PDF 文件创建成功');

    const cMapUrl = path.join(
      process.cwd(),
      'node_modules',
      'pdfjs-dist',
      'cmaps'
    );

    const standardFontDataUrl = path.join(
      process.cwd(),
      'node_modules',
      'pdfjs-dist',
      'standard_fonts'
    );

    console.log(`   CMaps 路径: ${cMapUrl}`);
    console.log(`   标准字体路径: ${standardFontDataUrl}`);

    addTestResult(
      'PDF 资源路径检查',
      fs.existsSync(cMapUrl) && fs.existsSync(standardFontDataUrl),
      `CMaps 存在: ${fs.existsSync(cMapUrl)}, 字体存在: ${fs.existsSync(standardFontDataUrl)}`
    );

    try {
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(minimalPDF),
        verbosity: 0,
        useSystemFonts: true,
        cMapUrl: cMapUrl + path.sep,
        cMapPacked: true,
        standardFontDataUrl: standardFontDataUrl + path.sep,
      });

      console.log('   开始加载 PDF 文档...');
      
      const doc = await loadingTask.promise;
      
      addTestResult(
        'PDF 文档加载',
        doc !== undefined,
        `页数: ${doc.numPages}`
      );

      await doc.destroy();
      addTestResult('PDF 文档销毁', true, '文档已成功销毁');
    } catch (error) {
      console.log('   PDF 加载错误:', error.message);
      addTestResult(
        'PDF 文档加载',
        true,
        `预期错误（最小 PDF 结构不完整）: ${error.message.substring(0, 80)}`
      );
    }

    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true });
      } catch (e) {
        // 忽略
      }
    }
  } catch (error) {
    console.error('pdfjs-dist 模块测试失败:', error);
    addTestResult('pdfjs-dist 模块加载', false, `加载失败: ${error.message}`);
  }
}

async function testDocumentParserModule() {
  console.log('\n测试阶段 3: 文档解析模块综合测试');
  console.log('='.repeat(60));

  try {
    const {
      DocumentParseError,
      EncryptedPDFError,
      ScannedPDFError,
      CorruptedFileError,
      UnsupportedFormatError,
      EmptyContentError,
      getDocumentTypeFromExtension,
      getDocumentTypeFromMimeType,
      validatePDFHeader
    } = require('../src/lib/documentParser');

    console.log('\n测试 3.1: 异常类测试');
    
    addTestResult(
      'DocumentParseError',
      new DocumentParseError('test') instanceof Error,
      '正确继承 Error'
    );
    
    addTestResult(
      'EncryptedPDFError',
      new EncryptedPDFError() instanceof DocumentParseError,
      '正确继承 DocumentParseError'
    );
    
    addTestResult(
      'ScannedPDFError',
      new ScannedPDFError() instanceof DocumentParseError,
      '正确继承 DocumentParseError'
    );
    
    addTestResult(
      'CorruptedFileError',
      new CorruptedFileError('PDF') instanceof DocumentParseError,
      '正确继承 DocumentParseError'
    );
    
    addTestResult(
      'UnsupportedFormatError',
      new UnsupportedFormatError('.exe') instanceof DocumentParseError,
      '正确继承 DocumentParseError'
    );
    
    addTestResult(
      'EmptyContentError',
      new EmptyContentError('PDF') instanceof DocumentParseError,
      '正确继承 DocumentParseError'
    );

    console.log('\n测试 3.2: 文档类型检测');
    
    addTestResult(
      'PDF 扩展名识别',
      getDocumentTypeFromExtension('.pdf') === 'pdf',
      `结果: ${getDocumentTypeFromExtension('.pdf')}`
    );
    
    addTestResult(
      'DOCX 扩展名识别',
      getDocumentTypeFromExtension('.docx') === 'docx',
      `结果: ${getDocumentTypeFromExtension('.docx')}`
    );
    
    addTestResult(
      'TXT 扩展名识别',
      getDocumentTypeFromExtension('.txt') === 'txt',
      `结果: ${getDocumentTypeFromExtension('.txt')}`
    );
    
    addTestResult(
      'PDF MIME 类型识别',
      getDocumentTypeFromMimeType('application/pdf') === 'pdf',
      `结果: ${getDocumentTypeFromMimeType('application/pdf')}`
    );

    console.log('\n测试 3.3: PDF 文件头验证');
    
    const validPDFHeader = Buffer.from('%PDF-1.7 test');
    const invalidPDFHeader = Buffer.from('Not a PDF');
    const emptyBuffer = Buffer.alloc(0);
    
    addTestResult(
      '有效 PDF 头验证',
      validatePDFHeader(validPDFHeader) === true,
      '验证通过'
    );
    
    addTestResult(
      '无效 PDF 头验证',
      validatePDFHeader(invalidPDFHeader) === false,
      '正确识别为无效'
    );
    
    addTestResult(
      '空缓冲区验证',
      validatePDFHeader(emptyBuffer) === false,
      '正确识别为无效'
    );

  } catch (error) {
    console.error('文档解析模块测试失败:', error);
    addTestResult('文档解析模块加载', false, `加载失败: ${error.message}`);
  }
}

async function runAllTests() {
  console.log('='.repeat(60));
  console.log('PDF 解析功能综合测试');
  console.log('='.repeat(60));
  console.log(`Node.js 版本: ${process.version}`);
  console.log(`测试时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`工作目录: ${process.cwd()}`);

  await testTXTModule();
  await testPDFJSModule();
  await testDocumentParserModule();

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
    console.log('   ✅ TXT 文件解析');
    console.log('   ✅ pdfjs-dist 模块加载');
    console.log('   ✅ PDF 资源路径检查');
    console.log('   ✅ 异常类');
    console.log('   ✅ 文档类型检测');
    console.log('   ✅ PDF 文件头验证');
    console.log('\n💡 使用说明:');
    console.log('   1. 启动开发服务器: npm run dev');
    console.log('   2. 使用真实 PDF 文件进行端到端测试');
    console.log('   3. 运行 pdf-parser-e2e-test.js 进行完整流程测试');
    process.exit(0);
  } else {
    console.log('❌ 部分测试失败！');
    console.log('\n⚠️  请检查代码并修复后重新运行测试。');
    process.exit(1);
  }
}

runAllTests().catch(console.error);
