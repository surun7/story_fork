// 导出成稿：把当前激活链路（root → activeLeaf）拼成 Markdown。
// 格式：# 标题（根节点前 12 字）+ 各段正文，段落间空行，沿分支续写的段落前标注 > 走向：xx
import type { StoryNode } from "./types";
import { deriveTitle } from "./storage.ts";

export function buildMarkdown(path: StoryNode[]): string {
  if (path.length === 0) return "";
  const title = deriveTitle(path[0].content);
  const lines: string[] = [`# ${title}`];
  for (const node of path) {
    lines.push("");
    if (node.chosenBranchTitle) {
      lines.push(`> 走向：${node.chosenBranchTitle}`);
    }
    lines.push(node.content);
  }
  return lines.join("\n");
}

// 文件名：故事岔口-标题-日期.md（过滤 Windows 非法字符）
export function buildExportFilename(path: StoryNode[], dateStr: string): string {
  const title =
    path.length > 0
      ? deriveTitle(path[0].content).replace(/[\\/:*?"<>|]/g, "") || "未命名"
      : "未命名";
  return `故事岔口-${title}-${dateStr}.md`;
}
