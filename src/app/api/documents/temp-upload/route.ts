import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { requireAuth } from "@/lib/auth";

const TEMP_UPLOAD_DIR = "upload/temp";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json(
        { message: "请选择要上传的文件" },
        { status: 400 }
      );
    }

    // 确保临时目录存在
    const tempDir = path.join(process.cwd(), TEMP_UPLOAD_DIR);
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // 生成唯一文件名
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const fileExtension = "." + (file.name.split(".").pop()?.toLowerCase() || "");
    const tempFileName = `${uniqueId}${fileExtension}`;
    const tempFilePath = path.join(tempDir, tempFileName);

    // 保存文件
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tempFilePath, buffer);

    return NextResponse.json({
      success: true,
      tempFileName,
      tempFilePath,
      originalFileName: file.name,
      fileSize: file.size,
    });
  } catch (error) {
    console.error("临时文件上传失败:", error);
    return NextResponse.json(
      { message: "临时文件上传失败", error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}
