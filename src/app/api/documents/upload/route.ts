import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { formatFileSize } from "@/lib/utils";

const ALLOWED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
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

    // 后端再次校验文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: `文件大小不能超过 10MB，当前文件大小为 ${formatFileSize(file.size)}` },
        { status: 400 }
      );
    }

    // 后端再次校验文件类型
    const isMimeTypeAllowed = ALLOWED_TYPES.includes(file.type);
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    const isExtensionAllowed = ALLOWED_EXTENSIONS.includes(fileExtension);

    if (!isMimeTypeAllowed && !isExtensionAllowed) {
      return NextResponse.json(
        { message: "不支持的文件类型，只支持 PDF、DOCX、TXT 格式" },
        { status: 400 }
      );
    }

    // 确保 uploads 目录存在
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // 生成唯一的文件名
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const uniqueFileName = `${timestamp}-${randomString}${fileExtension}`;
    const filePath = path.join(uploadsDir, uniqueFileName);

    // 读取文件内容并写入到本地
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // 保存到数据库
    const document = await prisma.document.create({
      data: {
        title,
        content: content || null,
        fileUrl: `/uploads/${uniqueFileName}`,
        fileType: fileExtension.substring(1).toUpperCase(),
        fileSize: BigInt(file.size),
        knowledgeBaseId: knowledgeBaseId || null,
      },
    });

    return NextResponse.json(
      {
        message: "上传成功",
        document: {
          ...document,
          fileSize: document.fileSize.toString(),
          formattedSize: formatFileSize(document.fileSize),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("文件上传失败:", error);
    return NextResponse.json(
      { message: "上传失败，请稍后重试" },
      { status: 500 }
    );
  }
}
