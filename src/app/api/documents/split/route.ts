import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { tryMultipleEncodings, cleanText } from "@/lib/encodingUtils";

const TEMP_UPLOAD_DIR = "upload/temp";
const SPLIT_TMP_DIR = "upload/split-tmp";

function splitIntoStatements(text: string): string[] {
  const statements: string[] = [];
  let currentStatement = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === "/" && i + 1 < text.length && text[i + 1] === "*") {
      let commentEnd = text.indexOf("*/", i + 2);
      if (commentEnd !== -1) {
        currentStatement += text.substring(i, commentEnd + 2);
        i = commentEnd + 1;
      } else {
        currentStatement += char;
      }
      continue;
    }

    if (char === "-" && i + 1 < text.length && text[i + 1] === "-") {
      let lineEnd = text.indexOf("\n", i);
      if (lineEnd !== -1) {
        currentStatement += text.substring(i, lineEnd);
        i = lineEnd;
      } else {
        currentStatement += text.substring(i);
        break;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      const quote = char;
      currentStatement += char;
      i++;
      while (i < text.length) {
        const c = text[i];
        if (c === "\\" && i + 1 < text.length) {
          currentStatement += c + text[i + 1];
          i += 2;
        } else if (c === quote) {
          currentStatement += c;
          i++;
          break;
        } else {
          currentStatement += c;
          i++;
        }
      }
      continue;
    }

    currentStatement += char;

    if (char === ";") {
      const trimmed = currentStatement.trim();
      if (trimmed.length > 0 && trimmed !== ";") {
        statements.push(currentStatement);
      }
      currentStatement = "";
    }
  }

  const remaining = currentStatement.trim();
  if (remaining.length > 0 && remaining !== ";") {
    statements.push(currentStatement);
  }

  return statements;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tempFilePath, originalName } = body;

    if (!tempFilePath) {
      return NextResponse.json(
        { success: false, message: "缺少文件路径" },
        { status: 400 }
      );
    }

    const fullTempPath = path.join(process.cwd(), tempFilePath);

    console.log(`[split] 读取临时文件: ${fullTempPath}`);

    const fileBuffer = await readFile(fullTempPath);

    let fileContent: string;

    try {
      const result = tryMultipleEncodings(fileBuffer);
      console.log(`[split] 编码检测: ${result.originalEncoding}, 无效字符: ${result.invalidByteCount}`);
      fileContent = cleanText(result.text);
      console.log(`[split] 使用 ${result.originalEncoding} 编码解码`);
    } catch (encodeError) {
      console.warn(`[split] 编码检测失败，尝试 UTF-8: ${encodeError}`);
      fileContent = cleanText(fileBuffer.toString("utf-8"));
    }

    console.log(`[split] 文件读取完成，内容长度: ${fileContent.length} 字符`);

    const statements = splitIntoStatements(fileContent);
    console.log(`[split] 解析出 ${statements.length} 条语句`);

    const absoluteSplitDir = path.join(process.cwd(), SPLIT_TMP_DIR);
    await mkdir(absoluteSplitDir, { recursive: true });

    const baseName = originalName.replace(/\.[^/.]+$/, "");
    const dateTimeStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const splitFiles: { index: number; path: string; name: string; size: number }[] = [];

    let chunkContent = "";
    let chunkIndex = 1;
    let currentChunkSize = 0;
    const MAX_CHUNK_SIZE = 200 * 1024;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const statementSize = Buffer.byteLength(statement, "utf-8");

      if (currentChunkSize + statementSize > MAX_CHUNK_SIZE && chunkContent.length > 0) {
        const chunkFileName = `${baseName}_${dateTimeStr}_${chunkIndex}.sql`;
        const absoluteChunkFilePath = path.join(absoluteSplitDir, chunkFileName);

        await writeFile(absoluteChunkFilePath, chunkContent, "utf-8");

        const chunkStat = await import("fs/promises").then(fs => fs.stat(absoluteChunkFilePath));

        const relativeChunkPath = path.join(SPLIT_TMP_DIR, chunkFileName);

        splitFiles.push({
          index: chunkIndex,
          path: relativeChunkPath,
          name: chunkFileName,
          size: chunkStat.size,
        });

        console.log(`[split] 保存拆分文件: ${chunkFileName}, 大小: ${chunkStat.size} bytes`);

        chunkContent = "";
        currentChunkSize = 0;
        chunkIndex++;
      }

      chunkContent += statement;
      currentChunkSize += statementSize;
    }

    if (chunkContent.length > 0) {
      const chunkFileName = `${baseName}_${dateTimeStr}_${chunkIndex}.sql`;
      const absoluteChunkFilePath = path.join(absoluteSplitDir, chunkFileName);

      await writeFile(absoluteChunkFilePath, chunkContent, "utf-8");

      const chunkStat = await import("fs/promises").then(fs => fs.stat(absoluteChunkFilePath));

      const relativeChunkPath = path.join(SPLIT_TMP_DIR, chunkFileName);

      splitFiles.push({
        index: chunkIndex,
        path: relativeChunkPath,
        name: chunkFileName,
        size: chunkStat.size,
      });

      console.log(`[split] 保存拆分文件: ${chunkFileName}, 大小: ${chunkStat.size} bytes`);
    }

    console.log(`[split] 删除临时文件: ${fullTempPath}`);
    try {
      await unlink(fullTempPath);
    } catch (e) {
      console.warn(`[split] 删除临时文件失败: ${e}`);
    }

    return NextResponse.json({
      success: true,
      splitFiles,
      totalChunks: splitFiles.length,
      originalStatements: statements.length,
    });
  } catch (error) {
    console.error("[split] 拆分失败:", error);
    return NextResponse.json(
      { success: false, message: "拆分失败" },
      { status: 500 }
    );
  }
}
