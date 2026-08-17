import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendNode,
  buildPathText,
  createRoot,
  getPath,
  setNodeBranches,
  switchActive,
} from "./storyTree.ts";

test("appendNode：追加子节点、清空父节点已选分支、激活移到新节点", () => {
  const t0 = createRoot("开头。");
  const withBranches = setNodeBranches(t0, t0.rootId, [
    { id: "b1", title: "冲突升级", summary: "简介", conflict: "冲突" },
  ]);

  const t1 = appendNode(withBranches, t0.rootId, {
    content: "A 段正文。",
    chosenBranchTitle: "冲突升级",
  });

  const root = t1.nodes[t0.rootId];
  assert.equal(root.childIds.length, 1);
  assert.deepEqual(root.branches, []); // 选中后清空
  const child = t1.nodes[root.childIds[0]];
  assert.equal(child.chosenBranchTitle, "冲突升级");
  assert.equal(child.parentId, t0.rootId);
  assert.equal(t1.activeLeafId, child.id); // 激活移到新节点
});

test("switchActive：回退切换不丢数据，可再切回", () => {
  const t0 = createRoot("开头。");
  const t1 = appendNode(t0, t0.rootId, { content: "A 段。", chosenBranchTitle: "方向甲" });
  const t2 = appendNode(t1, t1.activeLeafId, { content: "A1 段。", chosenBranchTitle: "方向乙" });

  const back = switchActive(t2, t1.activeLeafId);
  assert.equal(back.activeLeafId, t1.activeLeafId);
  // 旧链路数据完好保留
  assert.equal(back.nodes[t2.activeLeafId].content, "A1 段。");
  assert.deepEqual(
    getPath(back, t1.activeLeafId).map((n) => n.content),
    ["开头。", "A 段。"]
  );

  const again = switchActive(back, t2.activeLeafId);
  assert.equal(again.activeLeafId, t2.activeLeafId);
  assert.equal(buildPathText(again, t2.activeLeafId), "开头。\n\nA 段。\n\nA1 段。");
});

test("多子分支保留：根 → A → A1，回退 A 选另一分支 → A2，两者均可切回", () => {
  const t0 = createRoot("开头。");
  const t1 = appendNode(t0, t0.rootId, { content: "A 段。", chosenBranchTitle: "方向甲" });
  const t2 = appendNode(t1, t1.activeLeafId, { content: "A1 段。", chosenBranchTitle: "方向乙" });

  const back = switchActive(t2, t1.activeLeafId);
  const t3 = appendNode(back, t1.activeLeafId, { content: "A2 段。", chosenBranchTitle: "方向丙" });

  // 旧 childIds 未被清空：A 的分支列表同时包含 A1 与 A2
  const a = t3.nodes[t1.activeLeafId];
  assert.deepEqual(a.childIds, [t2.activeLeafId, t3.activeLeafId]);
  assert.equal(t3.nodes[t2.activeLeafId].content, "A1 段。");
  assert.equal(t3.nodes[t3.activeLeafId].content, "A2 段。");

  // 两条链路都能切回查看
  const toA1 = switchActive(t3, t2.activeLeafId);
  assert.equal(buildPathText(toA1, t2.activeLeafId), "开头。\n\nA 段。\n\nA1 段。");
  const toA2 = switchActive(t3, t3.activeLeafId);
  assert.equal(buildPathText(toA2, t3.activeLeafId), "开头。\n\nA 段。\n\nA2 段。");
});
