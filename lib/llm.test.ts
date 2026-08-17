import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PATH_TEXT_CHARS, truncatePathText } from "./llm.ts";

const MARKER = "\n\n……（中间内容已省略，仅保留开头与最近内容）……\n\n";

test("truncatePathText：超长全文截断到上限，保留开头与最近内容，中间省略", () => {
  const long = "开".repeat(30_000);
  const out = truncatePathText(long);
  assert.equal(out.length, MAX_PATH_TEXT_CHARS);
  assert.equal(out.slice(0, 4000), "开".repeat(4000)); // 开头保留
  assert.ok(out.includes(MARKER.trim())); // 省略标记
  const tailLen = MAX_PATH_TEXT_CHARS - 4000 - MARKER.length;
  assert.ok(out.endsWith("开".repeat(tailLen))); // 最近内容保留
});

test("truncatePathText：未超限原样返回", () => {
  const short = "深夜十二点，我收到一条短信。";
  assert.equal(truncatePathText(short), short);
});
