import { NextRequest, NextResponse } from "next/server";
import { readFile, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { documentParser } from "@/lib/documentParser";
import {
  processChunksWithErrorHandling,
  processSQLChunksWithErrorHandling,
  splitTextIntoChunks,
  splitSQLIntoChunks,
} from "@/lib/documentChunkProcessor";
import { importSQLSchema } from "@/lib/sqlImporter";
import { tryMultipleEncodings, cleanText } from "@/lib/encodingUtils";

const SPLIT_TMP_DIR = "upload/split-tmp";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { splitFiles, knowledgeBaseId, originalFileName } = body;

    if (!splitFiles || !Array.isArray(splitFiles) || splitFiles.length === 0) {
      return NextResponse.json(
        { success: false, message: "没有拆分文件" },
        { status: 400 }
      );
    }

    console.log(`[upload-split] 开始处理 ${splitFiles.length} 个拆分文件`);

    let allContent = "";
    let totalSize = 0;

    for (let i = 0; i < splitFiles.length; i++) {
      const file = splitFiles[i];
      const filePath = path.join(process.cwd(), file.path);

      console.log(`[upload-split] 读取文件 ${i + 1}/${splitFiles.length}: ${file.name}`);

      try {
        const fileBuffer = await readFile(filePath);

        let content: string;

        try {
          const result = tryMultipleEncodings(fileBuffer);
          console.log(`[upload-split] 编码检测: ${result.originalEncoding}, 无效字符: ${result.invalidByteCount}`);
          content = cleanText(result.text);
          console.log(`[upload-split] 使用 ${result.originalEncoding} 编码解码`);
        } catch (encodeError) {
          console.warn(`[upload-split] 编码检测失败，尝试 UTF-8: ${encodeError}`);
          content = cleanText(fileBuffer.toString("utf-8"));
        }

        allContent += content + "\n\n";
        totalSize += file.size;

      } catch (fileError) {
        console.error(`[upload-split] 文件 ${file.name} 读取失败:`, fileError);
        return NextResponse.json(
          { success: false, message: `文件 ${file.name} 读取失败` },
          { status: 500 }
        );
      }
    }

    const title = originalFileName ? originalFileName.replace(/\.[^/.]+$/, "") : `split_${Date.now()}`;

    console.log(`[upload-split] 创建单个文档: ${title}, 总大小：${totalSize} bytes`);

    const document = await prisma.document.create({
      data: {
        title,
        content: allContent,
        fileType: "SQL",
        fileUrl: splitFiles[0].path,
        fileSize: totalSize,
        knowledgeBaseId: knowledgeBaseId || null,
        status: "PARSING",
      },
    });

    console.log(`[upload-split] 创建文档：${document.id}`);

    const parsed = await documentParser.parse(allContent, "SQL");

    await prisma.document.update({
      where: { id: document.id },
      data: {
        status: "CHUNKING",
        content: parsed.content || allContent,
      },
    });

    const textChunks = splitSQLIntoChunks(parsed.content || allContent);
    console.log(`[upload-split] SQL 文档切片数量：${textChunks.length}`);

    const chunkProcessingResult = await processSQLChunksWithErrorHandling(
      textChunks,
      document.id
    );

    console.log(`[upload-split] 存储切片数量：${chunkProcessingResult.storedCount}`);

    try {
      await importSQLSchema(allContent, document.id);
      console.log(`[upload-split] SQL 表结构导入成功`);
    } catch (sqlError) {
      console.warn(`[upload-split] SQL 表结构导入失败:`, sqlError);
    }

    await prisma.document.update({
      where: { id: document.id },
      data: { status: "DONE" },
    });

    console.log(`[upload-split] 删除拆分文件...`);
    for (const file of splitFiles) {
      const filePath = path.join(process.cwd(), file.path);
      try {
        await unlink(filePath);
        console.log(`[upload-split] 删除文件：${file.name}`);
      } catch (e) {
        console.warn(`[upload-split] 删除文件失败：${file.name}`);
      }
    }

    return NextResponse.json({
      success: true,
      documentId: document.id,
      title: document.title,
      chunkCount: chunkProcessingResult.storedCount,
      message: `成功处理 ${splitFiles.length} 个文件，共 ${chunkProcessingResult.storedCount} 个切片`,
    });

  } catch (error) {
    console.error("[upload-split] 处理失败:", error);
    return NextResponse.json(
      { success: false, message: "处理失败" },
      { status: 500 }
    );
  }
}
