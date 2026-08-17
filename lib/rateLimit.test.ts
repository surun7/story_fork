import { test } from "node:test";
import assert from "node:assert/strict";
import { SlidingWindowLimiter, getClientIp } from "./rateLimit.ts";

test("滑动窗口：窗口内前 10 次放行，第 11 次拒绝，不同 IP 互不影响", () => {
  const limiter = new SlidingWindowLimiter({ windowMs: 60_000, max: 10 });
  const now = 1_000_000;
  for (let i = 0; i < 10; i++) {
    assert.equal(limiter.allow("1.2.3.4", now), true);
  }
  assert.equal(limiter.allow("1.2.3.4", now), false);
  assert.equal(limiter.allow("5.6.7.8", now), true);
});

test("滑动窗口：旧请求滑出窗口后恢复放行", () => {
  const limiter = new SlidingWindowLimiter({ windowMs: 60_000, max: 10 });
  const t0 = 1_000_000;
  for (let i = 0; i < 10; i++) {
    limiter.allow("1.2.3.4", t0 + i * 1000); // 第 0~9 秒各一次
  }
  assert.equal(limiter.allow("1.2.3.4", t0 + 10_000), false);
  // 61 秒后首批请求全部滑出窗口
  assert.equal(limiter.allow("1.2.3.4", t0 + 61_000), true);
});

test("getClientIp：优先 x-forwarded-for 首值，其次 x-real-ip，兜底 unknown", () => {
  const mk = (headers: Record<string, string>) => ({
    headers: { get: (name: string) => headers[name] ?? null },
  });
  assert.equal(getClientIp(mk({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })), "1.2.3.4");
  assert.equal(getClientIp(mk({ "x-real-ip": "9.9.9.9" })), "9.9.9.9");
  assert.equal(getClientIp(mk({})), "unknown");
});
