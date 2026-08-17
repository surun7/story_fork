import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, EmptyContentError, truncatePathText } from "@/lib/llm";
import { BRANCH_SYSTEM_PROMPT, buildBranchesPrompt, buildToneSuffix } from "@/lib/prompts";
import { enforceRateLimit, errorResponse, toErrorResponse } from "@/lib/errors";
import { checkAccessCode } from "@/lib/accessCode";
import { normalizeTone } from "@/lib/tone";
import type { Branch } from "@/lib/types";

const MAX_BRANCHES = 3;
const LIMITS = { title: 10, summary: 60, conflict: 30 };

// 剥离可能的 ```json ... ``` 代码围栏后返回纯 JSON 文本
function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return (fenced ? fenced[1] : trimmed).trim();
}

// 解析并校验 LLM 返回的分支数组；不足 3 个或字段缺失视为失败，返回 null
function parseBranches(raw: string): Branch[] | null {
  let data: unknown;
  try {
    data = JSON.parse(extractJson(raw));
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;

  const branches: Branch[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const summary = typeof o.summary === "string" ? o.summary.trim() : "";
    const conflict = typeof o.conflict === "string" ? o.conflict.trim() : "";
    if (!title || !summary || !conflict) continue;
    branches.push({
      id: crypto.randomUUID(),
      title: title.slice(0, LIMITS.title),
      summary: summary.slice(0, LIMITS.summary),
      conflict: conflict.slice(0, LIMITS.conflict),
    });
    if (branches.length === MAX_BRANCHES) break;
  }
  return branches.length === MAX_BRANCHES ? branches : null;
}

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
  const { pathText, tone: toneRaw } = (body ?? {}) as {
    pathText?: unknown;
    tone?: unknown;
  };
  if (typeof pathText !== "string" || !pathText.trim()) {
    return errorResponse(
      400,
      "pathText 不能为空：请传入从开头到当前段落的故事全文。"
    );
  }
  // 创作基调：白名单校验，非法/缺失静默回退默认（默认不注入 prompt）
  const tone = normalizeTone(toneRaw);
  // 成本控制：超长全文中间截断，保留开头与最近内容
  const path = truncatePathText(pathText.trim());

  // JSON 解析失败或返回空内容时自动重试 1 次（共 2 次尝试）；
  // 配置缺失/超时/上游 HTTP 错误直接返回可读错误，不重复浪费配额与时间
  for (let attempt = 1; attempt <= 2; attempt++) {
    let raw: string;
    try {
      raw = await chatCompletion(
        [
          { role: "system", content: BRANCH_SYSTEM_PROMPT + buildToneSuffix(tone) },
          { role: "user", content: buildBranchesPrompt(path) },
        ],
        { temperature: attempt === 1 ? 0.85 : 0.95, maxTokens: 800 }
      );
    } catch (err) {
      // 空内容是偶发瞬时故障，给一次重试机会；其余错误直接返回
      if (attempt === 1 && err instanceof EmptyContentError) continue;
      return toErrorResponse(err);
    }
    const branches = parseBranches(raw);
    if (branches) {
      return NextResponse.json({ branches });
    }
  }

  return errorResponse(
    502,
    "AI 返回的分支格式无法解析，已自动重试一次仍失败，请稍后再试。"
  );
}
