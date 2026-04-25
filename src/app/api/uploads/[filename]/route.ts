import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
};

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    const uploadsDir = path.join(process.cwd(), "uploads");
    const filePath = path.join(uploadsDir, filename);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { message: "文件不存在" },
        { status: 404 }
      );
    }

    const fileExtension = "." + filename.split(".").pop()?.toLowerCase();
    const contentType = MIME_TYPES[fileExtension] || "application/octet-stream";

    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("文件读取失败:", error);
    return NextResponse.json(
      { message: "文件读取失败" },
      { status: 500 }
    );
  }
}
