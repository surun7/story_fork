import { NextRequest, NextResponse } from "next/server";
import { ConfigError, TimeoutError, UpstreamError } from "./llm";
import { ERROR_CODE_LLM_NOT_CONFIGURED } from "./types";
import { getClientIp, llmRateLimiter } from "./rateLimit";

// API 统一错误格式：{ error: string, code?: string }
export function errorResponse(
  status: number,
  message: string,
  code?: string
): NextResponse {
  return NextResponse.json(
    { error: message, ...(code ? { code } : {}) },
    { status }
  );
}

// 把 LLM 层的异常映射为带可读中文信息的 HTTP 响应
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ConfigError) {
    return errorResponse(503, err.message, ERROR_CODE_LLM_NOT_CONFIGURED);
  }
  if (err instanceof TimeoutError) {
    return errorResponse(504, err.message);
  }
  if (err instanceof UpstreamError) {
    return errorResponse(502, err.message);
  }
  const message = err instanceof Error ? err.message : String(err);
  return errorResponse(500, `服务器内部错误：${message}`);
}

// 入口限流：超限返回 429 + 中文提示，通过返回 null
export function enforceRateLimit(req: NextRequest): NextResponse | null {
  if (!llmRateLimiter.allow(getClientIp(req))) {
    return errorResponse(429, "请求太频繁，请稍后再试");
  }
  return null;
}
