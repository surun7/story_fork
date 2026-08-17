import { test } from "node:test";
import assert from "node:assert/strict";
import { buildExportFilename, buildMarkdown } from "./markdown.ts";
import { appendNode, createRoot } from "./storyTree.ts";

test("buildMarkdown：标题 + 段落空行 + 分支引用行，中文原样保留", () => {
  const t0 = createRoot("深夜十二点，我收到一条陌生号码发来的短信。");
  const t1 = appendNode(t0, t0.rootId, {
    content: "路灯灭了，我站在原地没有回头。",
    chosenBranchTitle: "冲突升级",
  });
  const path = [t1.nodes[t0.rootId], t1.nodes[t1.activeLeafId]];

  const md = buildMarkdown(path);

  const lines = md.split("\n");
  assert.equal(lines[0], "# 深夜十二点，我收到一条陌"); // 根节点前 12 字
  assert.equal(lines[1], "");
  assert.equal(lines[2], "深夜十二点，我收到一条陌生号码发来的短信。");
  assert.equal(lines[3], "");
  assert.equal(lines[4], "> 走向：冲突升级"); // 续写段落前的引用标注
  assert.equal(lines[5], "路灯灭了，我站在原地没有回头。");
  // 中文无乱码
  assert.ok(md.includes("深夜十二点"));
  assert.ok(md.includes("路灯灭了"));
});

test("buildMarkdown：根段落无引用行", () => {
  const t0 = createRoot("故事开头。");
  const md = buildMarkdown([t0.nodes[t0.rootId]]);
  assert.equal(md, "# 故事开头。\n\n故事开头。");
  assert.ok(!md.includes("> 走向"));
});

test("buildExportFilename：故事岔口-标题-日期.md，非法字符被过滤", () => {
  const t0 = createRoot("深/夜:十二*点");
  const name = buildExportFilename([t0.nodes[t0.rootId]], "2026-08-17");
  assert.equal(name, "故事岔口-深夜十二点-2026-08-17.md");
  // 标题全为非法字符时兜底为「未命名」
  const empty = createRoot("///");
  assert.equal(buildExportFilename([empty.nodes[empty.rootId]], "2026-08-17"), "故事岔口-未命名-2026-08-17.md");
});
