// 基于内存的滑动窗口限流（单实例）：每 IP 每分钟最多 max 次请求。
// serverless 多实例部署下为近似限流，生产环境应替换为分布式实现（如 Upstash Redis）。
// 本模块零外部依赖、不引入 next/server，便于 node:test 直接测试。

export type RateLimiterOptions = {
  windowMs: number;
  max: number;
};

export class SlidingWindowLimiter {
  private readonly windowMs: number;
  private readonly max: number;
  private readonly hits = new Map<string, number[]>();

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
  }

  // 允许返回 true；拒绝返回 false。now 可注入以便测试。
  allow(ip: string, now: number = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(ip) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.max) {
      this.hits.set(ip, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(ip, recent);
    return true;
  }
}

// 每 IP 每分钟最多 10 次 LLM 请求
export const llmRateLimiter = new SlidingWindowLimiter({ windowMs: 60_000, max: 10 });

// 从请求头提取客户端 IP（兼容反向代理）；NextRequest 结构兼容此鸭子类型
export function getClientIp(req: {
  headers: { get(name: string): string | null };
}): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
