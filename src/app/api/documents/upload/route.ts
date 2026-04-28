import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { formatFileSize } from "@/lib/format";
import { requireAuth, getCurrentUserId } from "@/lib/auth";

const ALLOWED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

function splitTextIntoChunks(text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  const sentences = text.split(/([。！？.!?\n])/).filter(s => s.trim());
  
  let currentChunk = "";
  
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i] + (sentences[i + 1] || "");
    
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      if (overlap > 0 && currentChunk.length > overlap) {
        const lastPart = currentChunk.slice(-overlap);
        const lastSentenceMatch = lastPart.match(/[^。！？.!?\n]*[。！？.!?\n]?$/);
        currentChunk = lastSentenceMatch ? lastSentenceMatch[0] : lastPart;
      } else {
        currentChunk = "";
      }
    }
    
    currentChunk += sentence;
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

export const DOCUMENT_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

export type DocumentStatus = typeof DOCUMENT_STATUS[keyof typeof DOCUMENT_STATUS];

async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    console.log("开始解析 PDF 文件:", filePath);
    
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = pdfParseModule.default || pdfParseModule;
    
    const dataBuffer = await readFile(filePath);
    console.log("读取 PDF 文件成功，大小:", dataBuffer.length, "bytes");
    
    const pdfData = await pdfParse(dataBuffer);
    console.log("PDF 解析完成，文本长度:", pdfData.text?.length || 0);
    
    return pdfData.text || "";
  } catch (error) {
    console.error("PDF 文本提取失败:", error);
    return "";
  }
}

async function extractTextFromTXT(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    console.error("TXT 文本提取失败:", error);
    return "";
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const currentUserId = user.id;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const content = formData.get("content") as string | null;
    const knowledgeBaseId = formData.get("knowledgeBaseId") as string | null;

    if (!title) {
      return NextResponse.json(
        { message: "文档标题不能为空" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { message: "请选择要上传的文件" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: `文件大小不能超过 10MB，当前文件大小为 ${formatFileSize(file.size)}` },
        { status: 400 }
      );
    }

    const isMimeTypeAllowed = ALLOWED_TYPES.includes(file.type);
    const fileExtension = "." + (file.name.split(".").pop()?.toLowerCase() || "");
    const isExtensionAllowed = ALLOWED_EXTENSIONS.includes(fileExtension);

    if (!isMimeTypeAllowed && !isExtensionAllowed) {
      return NextResponse.json(
        { message: "不支持的文件类型，只支持 PDF、DOCX、TXT 格式" },
        { status: 400 }
      );
    }

    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const uniqueFileName = `${timestamp}-${randomString}${fileExtension}`;
    const filePath = path.join(uploadsDir, uniqueFileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    let extractedContent = content || "";
    if (fileExtension === ".pdf") {
      extractedContent = await extractTextFromPDF(filePath);
    } else if (fileExtension === ".txt") {
      extractedContent = await extractTextFromTXT(filePath);
    }

    const textChunks = splitTextIntoChunks(extractedContent);
    console.log(`[RAG 预处理] 文档 "${title}" 文本长度: ${extractedContent.length} 字符`);
    console.log(`[RAG 预处理] 文档 "${title}" 切片数量: ${textChunks.length} 个片段`);
    if (textChunks.length > 0) {
      console.log(`[RAG 预处理] 文档 "${title}" 第一个片段长度: ${textChunks[0].length} 字符`);
    }

    if (knowledgeBaseId && knowledgeBaseId.trim()) {
      const kb = await prisma.knowledgeBase.findUnique({
        where: { id: knowledgeBaseId },
        select: { id: true, ownerId: true },
      });

      if (!kb) {
        return NextResponse.json(
          { message: "指定的知识库不存在" },
          { status: 400 }
        );
      }

      if (kb.ownerId !== currentUserId) {
        return NextResponse.json(
          { message: "您没有权限向此知识库添加文档" },
          { status: 403 }
        );
      }
    }

    const document = await prisma.$transaction(async (tx) => {
      const newDocument = await tx.document.create({
        data: {
          title,
          content: extractedContent || null,
          fileUrl: `/uploads/${uniqueFileName}`,
          fileType: fileExtension.substring(1).toUpperCase(),
          fileSize: BigInt(file.size),
          status: DOCUMENT_STATUS.DRAFT,
          authorId: currentUserId,
          knowledgeBaseId: knowledgeBaseId || null,
        },
      });

      if (textChunks.length > 0) {
        const chunkData = textChunks.map((chunk, index) => ({
          documentId: newDocument.id,
          index,
          content: chunk,
        }));

        try {
          await tx.documentChunk.createMany({
            data: chunkData,
            skipDuplicates: true,
          });
          console.log(`[RAG 存储] 文档 "${title}" 成功存储 ${chunkData.length} 个片段`);
        } catch (chunkError) {
          console.error(`[RAG 存储] 文档片段存储失败:`, chunkError);
          throw chunkError;
        }
      }

      return newDocument;
    });

    return NextResponse.json(
      {
        message: "上传成功",
        document: {
          ...document,
          fileSize: document.fileSize?.toString() || null,
          chunkCount: textChunks.length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { message: "未登录，请先登录" },
          { status: 401 }
        );
      }
      if (error.message === "账号待审核，请联系管理员" || 
          error.message === "账号已被禁用，请联系管理员") {
        return NextResponse.json(
          { message: error.message },
          { status: 403 }
        );
      }
    }
    console.error("文件上传失败:", error);
    return NextResponse.json(
      { message: "上传失败，请稍后重试" },
      { status: 500 }
    );
  }
}
