import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import crypto from "crypto";
import { 
  initUploadProgress, 
  getUploadProgress, 
  updateUploadProgress, 
  setUploadProgressStage 
} from "@/lib/uploadProgress";
import { 
  createUploadSession, 
  getUploadSession, 
  updateUploadSession, 
  deleteUploadSession 
} from "@/lib/uploadSession";
import { getStorageConfig, getMaxFileSizeBytes } from "@/lib/storageConfig";

const CHUNK_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const userId = user.id;
    const storageConfig = await getStorageConfig();
    const maxFileSizeBytes = getMaxFileSizeBytes(storageConfig.maxFileSizeMB);

    const body = await request.json();
    const { fileName, fileSize, fileType } = body;

    if (!fileName) {
      return NextResponse.json(
        { message: "文件名不能为空" },
        { status: 400 }
      );
    }

    if (!fileSize || fileSize <= 0) {
      return NextResponse.json(
        { message: "文件大小无效" },
        { status: 400 }
      );
    }

    if (fileSize > maxFileSizeBytes) {
      return NextResponse.json(
        { message: `文件大小不能超过 ${storageConfig.maxFileSizeMB}MB，当前文件大小为 ${(fileSize / 1024 / 1024).toFixed(2)}MB` },
        { status: 400 }
      );
    }

    const fileExtension = "." + (fileName.split(".").pop()?.toLowerCase() || "");
    const allowedExtensions = [".pdf", ".docx", ".txt", ".sql"];
    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { 
          message: `不支持的文件格式 "${fileExtension}"，仅支持 PDF、DOCX、TXT、SQL 格式`,
          errorType: "UNSUPPORTED_FORMAT"
        },
        { status: 400 }
      );
    }

    const uploadId = crypto.randomUUID();
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

    const tempDir = path.join(process.cwd(), "uploads", "temp", uploadId);
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    const session = {
      uploadId,
      fileName,
      fileSize,
      chunkSize: CHUNK_SIZE,
      totalChunks,
      uploadedChunks: new Set<number>(),
      createdAt: Date.now(),
      userId,
      fileExtension,
    };

    createUploadSession(session);
    initUploadProgress(uploadId);
    setUploadProgressStage(uploadId, "initializing");

    return NextResponse.json(
      {
        uploadId,
        chunkSize: CHUNK_SIZE,
        totalChunks,
        message: "分块上传初始化成功",
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

    console.error("分块上传初始化失败:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";

    return NextResponse.json(
      {
        message: `初始化失败: ${errorMessage}`,
        errorType: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
