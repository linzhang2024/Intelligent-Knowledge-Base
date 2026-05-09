import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { tryMultipleEncodings, cleanText } from "@/lib/encodingUtils";

const TEMP_UPLOAD_DIR = "upload/temp";

function formatDateTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "没有上传文件" },
        { status: 400 }
      );
    }

    const absoluteTempDir = path.join(process.cwd(), TEMP_UPLOAD_DIR);
    await mkdir(absoluteTempDir, { recursive: true });

    const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    const fileExtension = path.extname(file.name);
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const dateTimeStr = formatDateTime();
    const tempFileName = `${baseName}_${dateTimeStr}_${fileId}${fileExtension}`;
    const absoluteTempPath = path.join(absoluteTempDir, tempFileName);

    const buffer = Buffer.from(await file.arrayBuffer());

    console.log(`[temp-upload] 开始处理文件: ${file.name}, 大小: ${buffer.length} bytes`);

    let textContent: string;

    try {
      const result = tryMultipleEncodings(buffer);
      console.log(`[temp-upload] 编码检测: ${result.originalEncoding}, 无效字符: ${result.invalidByteCount}`);
      textContent = cleanText(result.text);
      console.log(`[temp-upload] 使用 ${result.originalEncoding} 编码解码`);
    } catch (encodeError) {
      console.warn(`[temp-upload] 编码检测失败，尝试 UTF-8: ${encodeError}`);
      textContent = cleanText(buffer.toString("utf-8"));
    }

    await writeFile(absoluteTempPath, textContent, "utf-8");

    console.log(`[temp-upload] 文件保存到: ${absoluteTempPath}`);

    const relativeTempPath = path.join(TEMP_UPLOAD_DIR, tempFileName);

    return NextResponse.json({
      success: true,
      tempFilePath: relativeTempPath,
      tempFileName,
      fileId,
      originalName: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error("[temp-upload] 上传失败:", error);
    return NextResponse.json(
      { success: false, message: "上传失败" },
      { status: 500 }
    );
  }
}
