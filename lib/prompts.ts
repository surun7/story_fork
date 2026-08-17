// 分支生成与续写的 prompt 模板（按产品规格书写）
import { normalizeTone, toneLabel } from "./tone.ts";

// 基调注入：默认基调不追加任何内容；非默认时在系统提示末尾追加一句
export function buildToneSuffix(tone: string): string {
  const key = normalizeTone(tone);
  if (key === "free") return "";
  return `\n本故事的创作基调为：${toneLabel(key)}，分支方向与续写需贴合该基调的氛围与节奏。`;
}

export const BRANCH_SYSTEM_PROMPT =
  "你是一名资深的故事架构师，擅长为正在创作中的故事设计出人意料又自洽的分支走向。";

export function buildBranchesPrompt(pathText: string): string {
  return `基于用户给定的故事，输出 3 个互不相同的续写方向。

要求：
1. 三个方向之间必须有明显差异，建议分别采用不同类型，例如：冲突升级、视角转换、意外反转，也可构思更精彩的结构，但彼此不得雷同；
2. 每个方向包含三个字段：
   - title：方向标题，不超过 10 个字；
   - summary：剧情简介，不超过 60 个字；
   - conflict：核心冲突，不超过 30 个字；
3. 以严格 JSON 数组返回，格式如：[{"title":"标题","summary":"简介","conflict":"冲突"}]，恰好 3 个元素；
4. 只输出 JSON 本身，不要输出任何 JSON 之外的内容、解释或代码围栏。

用户的故事：
"""${pathText}"""`;
}

export const CONTINUE_SYSTEM_PROMPT =
  "你是一名文笔细腻、擅长把握氛围与节奏的中文小说家。";

export function buildContinuePrompt(
  pathText: string,
  branch: { title: string; summary: string; conflict: string }
): string {
  return `请沿用户选定的方向续写故事。

选定的方向：
- 方向标题：${branch.title}
- 剧情简介：${branch.summary}
- 核心冲突：${branch.conflict}

要求：
1. 严格沿该方向续写，不要偏离或另起炉灶；
2. 保持与上文一致的人设、语气和时态；
3. 输出 300-500 字的中文正文；
4. 只输出正文本身，不要输出标题、说明或其他任何内容。

故事全文：
"""${pathText}"""`;
}
