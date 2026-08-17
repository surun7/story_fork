// 创作基调：白名单常量与归一化（旧数据无 tone 字段时按默认处理）
export const TONES = [
  { key: "free", label: "自由发挥" },
  { key: "suspense", label: "悬疑" },
  { key: "warm", label: "温情" },
  { key: "comedy", label: "喜剧" },
  { key: "dark", label: "暗黑" },
] as const;

export type ToneKey = (typeof TONES)[number]["key"];

export const DEFAULT_TONE: ToneKey = "free";

// 非法/缺失值一律静默回退默认
export function normalizeTone(value: unknown): ToneKey {
  return typeof value === "string" && TONES.some((t) => t.key === value)
    ? (value as ToneKey)
    : DEFAULT_TONE;
}

export function toneLabel(key: string): string {
  return TONES.find((t) => t.key === key)?.label ?? "自由发挥";
}
