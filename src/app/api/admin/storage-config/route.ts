import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getPublicStorageConfig,
  saveStorageConfig,
  StorageConfig,
} from "@/lib/storageConfig";

export const dynamic = "force-dynamic";

function validateStorageConfig(config: Partial<StorageConfig>): { valid: boolean; message?: string } {
  if (config.maxFileSizeMB !== undefined && (config.maxFileSizeMB < 1 || config.maxFileSizeMB > 500)) {
    return { valid: false, message: "单文件大小限制必须在 1-500 MB 之间" };
  }
  if (config.storageQuotaGB !== undefined && config.storageQuotaGB < 0) {
    return { valid: false, message: "存储配额不能为负数" };
  }
  if (config.sessionTimeoutMinutes !== undefined && (config.sessionTimeoutMinutes < 1 || config.sessionTimeoutMinutes > 1440)) {
    return { valid: false, message: "会话超时时间必须在 1-1440 分钟（24小时）之间" };
  }

  return { valid: true };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

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
      if (error.message === "无权限访问此资源") {
        return NextResponse.json(
          { message: "无权限访问此资源" },
          { status: 403 }
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

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const {
      maxFileSizeMB,
      storageQuotaGB,
      sessionTimeoutMinutes,
      forceMfa,
    } = body;

    const updateData: Partial<StorageConfig> = {};

    if (maxFileSizeMB !== undefined) updateData.maxFileSizeMB = Number(maxFileSizeMB);
    if (storageQuotaGB !== undefined) updateData.storageQuotaGB = Number(storageQuotaGB);
    if (sessionTimeoutMinutes !== undefined) updateData.sessionTimeoutMinutes = Number(sessionTimeoutMinutes);
    if (forceMfa !== undefined) updateData.forceMfa = Boolean(forceMfa);

    const validation = validateStorageConfig(updateData);
    if (!validation.valid) {
      return NextResponse.json(
        { message: validation.message },
        { status: 400 }
      );
    }

    await saveStorageConfig(updateData);

    const updatedConfig = await getPublicStorageConfig();

    return NextResponse.json(
      {
        message: "存储配置保存成功，新配置将立即生效",
        config: updatedConfig,
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
      if (error.message === "无权限访问此资源") {
        return NextResponse.json(
          { message: "无权限访问此资源" },
          { status: 403 }
        );
      }
    }
    console.error("保存存储配置失败:", error);
    return NextResponse.json(
      { message: "保存存储配置失败，请稍后重试" },
      { status: 500 }
    );
  }
}
