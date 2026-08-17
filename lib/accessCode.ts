// 可选访问口令：仅当环境变量 ACCESS_CODE 配置后才启用校验；
// 未配置时完全跳过（本地开发无感）。口令不写死在代码中。
import type { NextRequest } from "next/server";
import { errorResponse } from "./errors";

export const ACCESS_CODE_HEADER = "x-access-code";

export function getConfiguredAccessCode(): string | null {
  const code = (process.env.ACCESS_CODE ?? "").trim();
  return code || null;
}

// 校验请求头口令；通过返回 null，不通过返回 403 响应
export function checkAccessCode(req: NextRequest): ReturnType<typeof errorResponse> | null {
  const configured = getConfiguredAccessCode();
  if (!configured) return null;
  const provided = (req.headers.get(ACCESS_CODE_HEADER) ?? "").trim();
  if (provided !== configured) {
    return errorResponse(
      403,
      "访问口令缺失或错误：请在首页输入正确的口令后重新开始创作。"
    );
  }
  return null;
}
