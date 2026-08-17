// LLM 调用封装：只读 process.env，兼容 OpenAI Chat Completions 格式。
// 未配置密钥时抛 ConfigError（中文说明），由路由层映射为 503 + LLM_NOT_CONFIGURED。

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export class UpstreamError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

// 上游返回空内容（偶发/瞬时故障），路由层可对其自动重试一次后再报错
export class EmptyContentError extends UpstreamError {
  constructor() {
    super("LLM 返回了空内容，请稍后重试。", 502);
    this.name = "EmptyContentError";
  }
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export const DEFAULT_LLM_BASE_URL = "https://api.deepseek.com";
export const DEFAULT_LLM_MODEL = "deepseek-chat";
export const LLM_TIMEOUT_MS = 30_000;

// pathText 成本控制：超过上限时中间截断，保留开头与最近内容
export const MAX_PATH_TEXT_CHARS = 20_000;
const PATH_TEXT_HEAD_CHARS = 4_000;
const PATH_TEXT_TRUNCATION_MARKER = "\n\n……（中间内容已省略，仅保留开头与最近内容）……\n\n";

export function truncatePathText(text: string): string {
  if (text.length <= MAX_PATH_TEXT_CHARS) return text;
  const tailChars = MAX_PATH_TEXT_CHARS - PATH_TEXT_HEAD_CHARS - PATH_TEXT_TRUNCATION_MARKER.length;
  return (
    text.slice(0, PATH_TEXT_HEAD_CHARS) +
    PATH_TEXT_TRUNCATION_MARKER +
    text.slice(-tailChars)
  );
}

export function getLLMConfig(): LLMConfig {
  const apiKey = (process.env.LLM_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new ConfigError(
      "尚未配置 LLM 密钥：请在项目根目录的 .env.local 中设置 LLM_API_KEY（LLM_BASE_URL、LLM_MODEL 可选，默认 DeepSeek），保存后重启 npm run dev。"
    );
  }
  const baseUrl = (
    (process.env.LLM_BASE_URL ?? "").trim() || DEFAULT_LLM_BASE_URL
  ).replace(/\/+$/, "");
  const model = (process.env.LLM_MODEL ?? "").trim() || DEFAULT_LLM_MODEL;
  return { apiKey, baseUrl, model };
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const { apiKey, baseUrl, model } = getLLMConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.8,
        max_tokens: options.maxTokens ?? 1024,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = "";
      try {
        const data = (await res.json()) as { error?: { message?: string } };
        detail = data?.error?.message ?? "";
      } catch {
        // 响应体不是 JSON 时忽略细节
      }
      const authHint =
        res.status === 401 || res.status === 403
          ? "。API Key 无效或没有调用权限，请检查 LLM_API_KEY"
          : "";
      throw new UpstreamError(
        `LLM 服务返回错误（HTTP ${res.status}）${detail ? `：${detail}` : ""}${authHint}`,
        res.status
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new EmptyContentError();
    }
    return text.trim();
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    const name =
      typeof err === "object" && err !== null && "name" in err
        ? String((err as { name?: unknown }).name)
        : "";
    if (name === "AbortError") {
      throw new TimeoutError(
        `请求 LLM 超时（${LLM_TIMEOUT_MS / 1000} 秒），请稍后重试。`
      );
    }
    throw new UpstreamError(
      `无法连接 LLM 服务：${err instanceof Error ? err.message : String(err)}`,
      502
    );
  } finally {
    clearTimeout(timer);
  }
}
