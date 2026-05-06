import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPublicStorageConfig } from "@/lib/storageConfig";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const config = await getPublicStorageConfig();

    return NextResponse.json(
      {
        config,
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
    }
    console.error("获取存储配置失败:", error);
    return NextResponse.json(
      { message: "获取存储配置失败，请稍后重试" },
      { status: 500 }
    );
  }
}
