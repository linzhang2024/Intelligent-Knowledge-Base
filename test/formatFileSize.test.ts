import { formatFileSize } from "../src/lib/format";

interface TestCase {
  input: bigint | number | null | undefined;
  expected: string;
  description: string;
}

const testCases: TestCase[] = [
  { input: 0, expected: "0 B", description: "0 字节" },
  { input: 1, expected: "1 B", description: "1 字节" },
  { input: 512, expected: "512 B", description: "512 字节" },
  { input: 1023, expected: "1023 B", description: "1023 字节（接近 1KB）" },
  { input: 1024, expected: "1 KB", description: "1024 字节（1 KB）" },
  { input: 1536, expected: "1.5 KB", description: "1536 字节（1.5 KB）" },
  { input: 2048, expected: "2 KB", description: "2048 字节（2 KB）" },
  { input: 1024 * 500, expected: "500 KB", description: "500 KB" },
  { input: 1024 * 1024 - 1, expected: "1024 KB", description: "1MB 减 1 字节" },
  { input: 1024 * 1024, expected: "1 MB", description: "1 MB" },
  { input: 1024 * 1024 * 1.5, expected: "1.5 MB", description: "1.5 MB" },
  { input: 1024 * 1024 * 10, expected: "10 MB", description: "10 MB" },
  { input: 1024 * 1024 * 123.45, expected: "123.45 MB", description: "123.45 MB" },
  { input: 1024 * 1024 * 1024 - 1, expected: "1024 MB", description: "1GB 减 1 字节" },
  { input: 1024 * 1024 * 1024, expected: "1 GB", description: "1 GB" },
  { input: 1024 * 1024 * 1024 * 2.5, expected: "2.5 GB", description: "2.5 GB" },
  { input: 1024 * 1024 * 1024 * 100, expected: "100 GB", description: "100 GB" },
  { input: BigInt(0), expected: "0 B", description: "BigInt 0 字节" },
  { input: BigInt(1024), expected: "1 KB", description: "BigInt 1 KB" },
  { input: BigInt(1024 * 1024), expected: "1 MB", description: "BigInt 1 MB" },
  { input: BigInt(1024 * 1024 * 1024), expected: "1 GB", description: "BigInt 1 GB" },
  { input: null, expected: "未知", description: "null 值" },
  { input: undefined, expected: "未知", description: "undefined 值" },
  { input: -1, expected: "未知", description: "负数" },
  { input: -1024, expected: "未知", description: "负的 KB 值" },
];

function runTests(): void {
  console.log("🧪 运行 formatFileSize 函数单元测试\n");
  console.log("=".repeat(60));

  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase, index) => {
    const result = formatFileSize(testCase.input);
    const passedTest = result === testCase.expected;

    if (passedTest) {
      passed++;
      console.log(`✅ 测试 ${index + 1}: ${testCase.description}`);
      console.log(`   输入: ${testCase.input} → 输出: "${result}" (预期: "${testCase.expected}")\n`);
    } else {
      failed++;
      console.log(`❌ 测试 ${index + 1}: ${testCase.description}`);
      console.log(`   输入: ${testCase.input}`);
      console.log(`   预期: "${testCase.expected}"`);
      console.log(`   实际: "${result}"\n`);
    }
  });

  console.log("=".repeat(60));
  console.log(`\n📊 测试结果:`);
  console.log(`   通过: ${passed}/${testCases.length}`);
  console.log(`   失败: ${failed}/${testCases.length}`);

  if (failed === 0) {
    console.log("\n🎉 所有测试通过！");
    process.exit(0);
  } else {
    console.log("\n💥 部分测试失败！");
    process.exit(1);
  }
}

runTests();
