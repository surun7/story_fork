import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, truncatePathText } from "@/lib/llm";
import { CONTINUE_SYSTEM_PROMPT, buildContinuePrompt } from "@/lib/prompts";
import { enforceRateLimit, errorResponse, toErrorResponse } from "@/lib/errors";
import { checkAccessCode } from "@/lib/accessCode";

// 300-500 字中文的宽松下限，仅用于拦截异常空/过短输出
const MIN_CONTENT_LENGTH = 80;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 入口：限流 → 访问口令（未配置则跳过）
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const denied = checkAccessCode(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "请求体不是有效的 JSON。");
  }
  const { pathText, branch } = (body ?? {}) as {
    pathText?: unknown;
    branch?: unknown;
  };
  if (typeof pathText !== "string" || !pathText.trim()) {
    return errorResponse(
      400,
      "pathText 不能为空：请传入从开头到当前段落的故事全文。"
    );
  }
  // 成本控制：超长全文中间截断，保留开头与最近内容
  const path = truncatePathText(pathText.trim());
  if (typeof branch !== "object" || branch === null) {
    return errorResponse(400, "branch 不能为空：请传入用户选定的分支。");
  }
  const b = branch as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const summary = typeof b.summary === "string" ? b.summary.trim() : "";
  const conflict = typeof b.conflict === "string" ? b.conflict.trim() : "";
  if (!title || !summary || !conflict) {
    return errorResponse(
      400,
      "branch 必须包含非空的 title、summary、conflict 三个字段。"
    );
  }

  try {
    const content = await chatCompletion(
      [
        { role: "system", content: CONTINUE_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildContinuePrompt(path, {
            title,
            summary,
            conflict,
          }),
        },
      ],
      { temperature: 0.7, maxTokens: 1200 }
    );
    if (content.length < MIN_CONTENT_LENGTH) {
      return errorResponse(502, "AI 返回的续写内容过短，请点击重试。");
    }
    return NextResponse.json({ content });
  } catch (err) {
    return toErrorResponse(err);
  }
}
