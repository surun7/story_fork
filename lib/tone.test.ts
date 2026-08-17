import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTone, toneLabel } from "./tone.ts";
import { buildToneSuffix } from "./prompts.ts";

test("normalizeTone：白名单内原样返回，非法/缺失一律回退默认", () => {
  assert.equal(normalizeTone("suspense"), "suspense");
  assert.equal(normalizeTone("warm"), "warm");
  assert.equal(normalizeTone("comedy"), "comedy");
  assert.equal(normalizeTone("dark"), "dark");
  assert.equal(normalizeTone("free"), "free");
  assert.equal(normalizeTone("bogus"), "free");
  assert.equal(normalizeTone(undefined), "free");
  assert.equal(normalizeTone(null), "free");
  assert.equal(normalizeTone(123), "free");
  assert.equal(normalizeTone(""), "free");
});

test("toneLabel：白名单内返回中文标签，未知回退「自由发挥」", () => {
  assert.equal(toneLabel("comedy"), "喜剧");
  assert.equal(toneLabel("dark"), "暗黑");
  assert.equal(toneLabel("unknown"), "自由发挥");
});

test("buildToneSuffix：默认基调不追加，非默认注入中文基调句，非法值同样不追加", () => {
  assert.equal(buildToneSuffix("free"), "");
  assert.equal(buildToneSuffix("bogus"), "");
  assert.equal(buildToneSuffix(undefined as unknown as string), "");
  const suspense = buildToneSuffix("suspense");
  assert.ok(suspense.includes("悬疑"));
  assert.ok(suspense.includes("氛围与节奏"));
  assert.ok(buildToneSuffix("dark").includes("暗黑"));
});
