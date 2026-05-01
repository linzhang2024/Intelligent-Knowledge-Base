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

智能知识库系统是一个用于管理和检索文档的智能系统。它支持多种文档格式，包括PDF、DOCX和TXT文件。`;
}

function createTestDOCX() {
  return Buffer.from([
    0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00,
    0x08, 0x00, 0x00, 0x00, 0x21, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00
  ]);
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

async function testDocumentParserModule() {
  console.log('='.repeat(60));
  console.log('文档解析模块测试');
  console.log('='.repeat(60));
  console.log(`Node.js 版本: ${process.version}`);
  console.log(`测试时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('');

  const testDir = path.join(__dirname, 'test-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  console.log('测试 1: 测试 TXT 文件解析');
  try {
    const txtContent = createTestTXT();
    const txtPath = path.join(testDir, 'test-document.txt');
    fs.writeFileSync(txtPath, txtContent, 'utf-8');
    
    const { extractTextFromTXT } = require('../src/lib/documentParser');
    const result = await extractTextFromTXT(txtPath);
    
    const hasContent = result.length > 0;
    const hasExpectedText = result.includes('智能知识库系统');
    
    addTestResult(
      'TXT 文件解析',
      hasContent && hasExpectedText,
      hasContent 
        ? `文本长度: ${result.length} 字符` 
        : '解析结果为空'
    );
    
    fs.unlinkSync(txtPath);
  } catch (error) {
    addTestResult('TXT 文件解析', false, `解析失败: ${error.message}`);
  }

  console.log('');
  console.log('测试 2: 测试 PDF 文件头验证');
  try {
    const { validatePDFHeader } = require('../src/lib/documentParser');
    
    const validPDF = createMinimalPDF();
    const validResult = validatePDFHeader(validPDF);
    addTestResult(
      '有效 PDF 文件头验证',
      validResult === true,
      validResult ? '验证通过' : '验证失败'
    );
    
    const invalidBuffer = Buffer.from('Not a PDF file');
    const invalidResult = validatePDFHeader(invalidBuffer);
    addTestResult(
      '无效 PDF 文件头验证',
      invalidResult === false,
      invalidResult === false ? '正确识别为无效' : '错误地识别为有效'
    );
    
    const emptyBuffer = Buffer.alloc(0);
    const emptyResult = validatePDFHeader(emptyBuffer);
    addTestResult(
      '空缓冲区 PDF 验证',
      emptyResult === false,
      emptyResult === false ? '正确识别为无效' : '错误地识别为有效'
    );
  } catch (error) {
    addTestResult('PDF 文件头验证', false, `测试失败: ${error.message}`);
  }

  console.log('');
  console.log('测试 3: 测试文档类型检测');
  try {
    const { getDocumentTypeFromExtension, getDocumentTypeFromMimeType } = require('../src/lib/documentParser');
    
    const pdfType = getDocumentTypeFromExtension('.pdf');
    addTestResult(
      'PDF 扩展名识别',
      pdfType === 'pdf',
      `识别结果: ${pdfType}`
    );
    
    const docxType = getDocumentTypeFromExtension('.docx');
    addTestResult(
      'DOCX 扩展名识别',
      docxType === 'docx',
      `识别结果: ${docxType}`
    );
    
    const txtType = getDocumentTypeFromExtension('.txt');
    addTestResult(
      'TXT 扩展名识别',
      txtType === 'txt',
      `识别结果: ${txtType}`
    );
    
    const pdfMime = getDocumentTypeFromMimeType('application/pdf');
    addTestResult(
      'PDF MIME 类型识别',
      pdfMime === 'pdf',
      `识别结果: ${pdfMime}`
    );
    
    const docxMime = getDocumentTypeFromMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    addTestResult(
      'DOCX MIME 类型识别',
      docxMime === 'docx',
      `识别结果: ${docxMime}`
    );
    
    const txtMime = getDocumentTypeFromMimeType('text/plain');
    addTestResult(
      'TXT MIME 类型识别',
      txtMime === 'txt',
      `识别结果: ${txtMime}`
    );
  } catch (error) {
    addTestResult('文档类型检测', false, `测试失败: ${error.message}`);
  }

  console.log('');
  console.log('测试 4: 测试异常类');
  try {
    const {
      DocumentParseError,
      EncryptedPDFError,
      ScannedPDFError,
      CorruptedFileError,
      UnsupportedFormatError,
      EmptyContentError
    } = require('../src/lib/documentParser');
    
    const parseError = new DocumentParseError('测试解析错误');
    addTestResult(
      'DocumentParseError 创建',
      parseError instanceof Error && parseError.name === 'DocumentParseError',
      `错误类型: ${parseError.name}`
    );
    
    const encryptedError = new EncryptedPDFError();
    addTestResult(
      'EncryptedPDFError 创建',
      encryptedError instanceof DocumentParseError && encryptedError.name === 'EncryptedPDFError',
      `错误类型: ${encryptedError.name}`
    );
    
    const scannedError = new ScannedPDFError();
    addTestResult(
      'ScannedPDFError 创建',
      scannedError instanceof DocumentParseError && scannedError.name === 'ScannedPDFError',
      `错误类型: ${scannedError.name}`
    );
    
    const corruptedError = new CorruptedFileError('PDF');
    addTestResult(
      'CorruptedFileError 创建',
      corruptedError instanceof DocumentParseError && corruptedError.name === 'CorruptedFileError',
      `错误类型: ${corruptedError.name}`
    );
    
    const unsupportedError = new UnsupportedFormatError('.exe');
    addTestResult(
      'UnsupportedFormatError 创建',
      unsupportedError instanceof DocumentParseError && unsupportedError.name === 'UnsupportedFormatError',
      `错误类型: ${unsupportedError.name}`
    );
    
    const emptyError = new EmptyContentError('PDF');
    addTestResult(
      'EmptyContentError 创建',
      emptyError instanceof DocumentParseError && emptyError.name === 'EmptyContentError',
      `错误类型: ${emptyError.name}`
    );
  } catch (error) {
    addTestResult('异常类测试', false, `测试失败: ${error.message}`);
  }

  console.log('');
  console.log('测试 5: 测试无效文件解析');
  try {
    const { parseDocument } = require('../src/lib/documentParser');
    
    const invalidPath = path.join(testDir, 'nonexistent.txt');
    
    try {
      await parseDocument(invalidPath, 'txt');
      addTestResult('不存在文件解析', false, '应该抛出异常');
    } catch (error) {
      addTestResult(
        '不存在文件解析',
        error instanceof Error,
        `正确抛出异常: ${error.message.substring(0, 50)}`
      );
    }
  } catch (error) {
    addTestResult('无效文件解析测试', false, `测试失败: ${error.message}`);
  }

  console.log('');
  console.log('测试 6: 测试空 TXT 文件处理');
  try {
    const { extractTextFromTXT, EmptyContentError } = require('../src/lib/documentParser');
    
    const shortTxtPath = path.join(testDir, 'short.txt');
    fs.writeFileSync(shortTxtPath, '短', 'utf-8');
    
    try {
      await extractTextFromTXT(shortTxtPath);
      addTestResult('短内容 TXT 处理', false, '应该抛出 EmptyContentError');
    } catch (error) {
      addTestResult(
        '短内容 TXT 处理',
        error instanceof EmptyContentError,
        `正确抛出异常: ${error.name}`
      );
    }
    
    fs.unlinkSync(shortTxtPath);
  } catch (error) {
    addTestResult('空 TXT 文件测试', false, `测试失败: ${error.message}`);
  }

  console.log('');
  console.log('='.repeat(60));
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
      console.log(`  ${i + 1}. ${r.name}: ${r.message}`);
    });
  }

  if (fs.existsSync(testDir)) {
    try {
      fs.rmdirSync(testDir, { recursive: true });
    } catch (e) {
      // 忽略清理错误
    }
  }
  
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ 所有测试通过！');
    console.log('\n📋 测试覆盖:');
    console.log('   ✅ TXT 文件解析');
    console.log('   ✅ PDF 文件头验证');
    console.log('   ✅ 文档类型检测');
    console.log('   ✅ 异常类');
    console.log('   ✅ 无效文件处理');
    console.log('   ✅ 空内容文件处理');
    process.exit(0);
  } else {
    console.log('❌ 部分测试失败！');
    console.log('\n⚠️  请检查代码并修复后重新运行测试。');
    process.exit(1);
  }
}

testDocumentParserModule().catch(console.error);
