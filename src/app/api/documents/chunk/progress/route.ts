import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUploadProgress } from "@/lib/uploadProgress";
import { getUploadSession } from "@/lib/uploadSession";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get("uploadId");

    if (!uploadId) {
      return NextResponse.json(
        { message: "uploadId 不能为空" },
        { status: 400 }
      );
    }

    const session = getUploadSession(uploadId);
    if (!session) {
      return NextResponse.json(
        { 
          message: "上传会话不存在或已过期",
          progress: {
            uploadId,
            stage: "error",
            progress: 0,
            message: "上传会话不存在或已过期",
            updatedAt: Date.now(),
          }
        },
        { status: 404 }
      );
    }

    if (session.userId !== userId) {
      return NextResponse.json(
        { message: "您没有权限查询此上传会话的进度" },
        { status: 403 }
      );
    }

    const progress = getUploadProgress(uploadId);
    
    if (!progress) {
      return NextResponse.json(
        {
          uploadId,
          stage: "idle",
          progress: 0,
          message: "等待上传",
          updatedAt: Date.now(),
        },
        { status: 200 }
      );
    }

    return NextResponse.json(progress, { status: 200 });
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

    console.error("获取上传进度失败:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";

    return NextResponse.json(
      {
        message: `获取进度失败: ${errorMessage}`,
        errorType: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
