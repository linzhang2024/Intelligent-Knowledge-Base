import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { writeFile, mkdirSync, existsSync } from "fs";
import path from "path";
import { getUploadSession, updateUploadSession } from "@/lib/uploadSession";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const userId = user.id;

    const formData = await request.formData();
    const uploadId = formData.get("uploadId") as string | null;
    const chunkIndex = formData.get("chunkIndex") as string | null;
    const chunk = formData.get("chunk") as Blob | null;

    if (!uploadId) {
      return NextResponse.json(
        { message: "uploadId 不能为空" },
        { status: 400 }
      );
    }

    if (chunkIndex === null || chunkIndex === undefined) {
      return NextResponse.json(
        { message: "chunkIndex 不能为空" },
        { status: 400 }
      );
    }

    if (!chunk) {
      return NextResponse.json(
        { message: "没有上传的文件块" },
        { status: 400 }
      );
    }

    const session = getUploadSession(uploadId);
    if (!session) {
      return NextResponse.json(
        { message: "上传会话不存在或已过期，请重新开始上传" },
        { status: 404 }
      );
    }

    if (session.userId !== userId) {
      return NextResponse.json(
        { message: "您没有权限操作此上传会话" },
        { status: 403 }
      );
    }

    const index = parseInt(chunkIndex, 10);
    if (isNaN(index) || index < 0 || index >= session.totalChunks) {
      return NextResponse.json(
        { message: `无效的 chunkIndex: ${chunkIndex}，有效范围: 0-${session.totalChunks - 1}` },
        { status: 400 }
      );
    }

    const tempDir = path.join(process.cwd(), "uploads", "temp", uploadId);
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    const chunkPath = path.join(tempDir, `chunk_${index}`);
    const buffer = Buffer.from(await chunk.arrayBuffer());

    await new Promise<void>((resolve, reject) => {
      writeFile(chunkPath, buffer, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const newUploadedChunks = new Set(session.uploadedChunks);
    newUploadedChunks.add(index);
    updateUploadSession(uploadId, { uploadedChunks: newUploadedChunks });

    const uploadedCount = newUploadedChunks.size;
    const progress = Math.round((uploadedCount / session.totalChunks) * 100);

    return NextResponse.json(
      {
        uploadId,
        chunkIndex: index,
        uploaded: true,
        uploadedCount,
        totalChunks: session.totalChunks,
        progress,
        message: `块 ${index} 上传成功`,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "未授权访问") {
        return NextResponse.json(
          { message: "未登录，请先登录" },
          { status: 401 }
        );
      }
      if (
        error.message === "账号待审核，请联系管理员" ||
        error.message === "账号已被禁用，请联系管理员"
      ) {
        return NextResponse.json(
          { message: error.message },
          { status: 403 }
        );
      }
    }

    console.error("文件块上传失败:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";

    return NextResponse.json(
      {
        message: `上传失败: ${errorMessage}`,
        errorType: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
