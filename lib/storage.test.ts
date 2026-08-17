import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deserializeProjects,
  deriveTitle,
  removeProject,
  serializeProjects,
  upsertProject,
} from "./storage.ts";
import { appendNode, createRoot } from "./storyTree.ts";

test("作品序列化/反序列化往返：字段与故事树结构完整保留", () => {
  const t0 = createRoot("深夜十二点，我收到一条陌生号码发来的短信。");
  const t1 = appendNode(t0, t0.rootId, {
    content: "路灯灭了。",
    chosenBranchTitle: "冲突升级",
  });
  const projects = [
    { id: "p1", title: "深夜十二点", tree: t1, tone: "suspense", createdAt: 1000, updatedAt: 2000 },
  ];

  const restored = deserializeProjects(serializeProjects(projects));

  assert.equal(restored.length, 1);
  const p = restored[0];
  assert.equal(p.id, "p1");
  assert.equal(p.title, "深夜十二点");
  assert.equal(p.tone, "suspense");
  assert.equal(p.createdAt, 1000);
  assert.equal(p.updatedAt, 2000);
  // 树结构与激活位置完整恢复
  assert.equal(p.tree.rootId, t1.rootId);
  assert.equal(p.tree.activeLeafId, t1.activeLeafId);
  assert.deepEqual(p.tree.nodes[p.tree.rootId].childIds, t1.nodes[t1.rootId].childIds);
  assert.equal(p.tree.nodes[p.tree.activeLeafId].content, "路灯灭了。");
  assert.equal(p.tree.nodes[p.tree.activeLeafId].chosenBranchTitle, "冲突升级");
});

test("损坏数据容错：JSON 解析失败与结构不合法一律返回空列表，不抛异常", () => {
  // 解析失败
  assert.deepEqual(deserializeProjects("not-json{{{"), []);
  assert.deepEqual(deserializeProjects(null), []);
  assert.deepEqual(deserializeProjects(""), []);
  // 顶层不是数组
  assert.deepEqual(deserializeProjects('{"id":"p1"}'), []);
  // 结构合法但字段缺失/类型错误：整条过滤
  assert.deepEqual(deserializeProjects(JSON.stringify([{ id: 1 }])), []);
  assert.deepEqual(deserializeProjects(JSON.stringify([42, "x"])), []);
  assert.deepEqual(
    deserializeProjects(
      JSON.stringify([
        { id: "p1", title: "x", tree: { nodes: {}, rootId: "nope" }, updatedAt: 1, createdAt: 1 },
      ])
    ),
    []
  );
});

test("upsertProject / removeProject / deriveTitle", () => {
  const a = { id: "a", title: "甲", tree: createRoot("甲"), tone: "free", createdAt: 1, updatedAt: 1 };
  const b = { id: "b", title: "乙", tree: createRoot("乙"), tone: "warm", createdAt: 2, updatedAt: 2 };
  const both = upsertProject([a], b);
  assert.equal(both.length, 2);
  // 同 id 覆盖而非追加
  const updated = upsertProject(both, { ...a, title: "甲改", updatedAt: 3 });
  assert.equal(updated.length, 2);
  assert.equal(updated.find((p) => p.id === "a")?.title, "甲改");
  const removed = removeProject(updated, "a");
  assert.equal(removed.length, 1);
  assert.equal(removed[0].id, "b");
  assert.equal(deriveTitle("  深夜十二点，我收到一条陌生号码发来的短信。  "), "深夜十二点，我收到一条陌");
});

test("旧数据兼容：无 tone 字段的作品反序列化后回退为默认基调，不报错", () => {
  const t0 = createRoot("旧作品开头。");
  const oldProject = {
    id: "old-1",
    title: "旧作品",
    tree: JSON.parse(JSON.stringify(t0)),
    createdAt: 100,
    updatedAt: 200,
    // 故意不写 tone 字段，模拟 M5 之前保存的数据
  };
  const restored = deserializeProjects(JSON.stringify([oldProject]));
  assert.equal(restored.length, 1);
  assert.equal(restored[0].tone, "free");
  assert.equal(restored[0].tree.rootId, t0.rootId);
  // 非法 tone 值同样回退默认
  const badTone = deserializeProjects(JSON.stringify([{ ...oldProject, tone: "bogus" }]));
  assert.equal(badTone[0].tone, "free");
});
