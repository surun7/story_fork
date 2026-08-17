"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";
import {
  ACCESS_CODE_STORAGE_KEY,
  loadProjects,
  removeProject,
  saveProjects,
} from "@/lib/storage";
import { getPath } from "@/lib/storyTree";
import { TONES, type ToneKey } from "@/lib/tone";

const SAMPLE_OPENINGS = [
  "深夜十二点，我收到一条陌生号码发来的短信：「别回头，你身后的路灯今晚会灭。」",
  "考古队在沙漠深处挖出一扇青铜门，门缝里夹着一张纸条，上面写着一个现代人的名字。",
  "这家茶馆只在午夜之后营业。老板说，十二点以后进门的客人，都不再是人。",
];

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `今天 ${time}`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`;
}

export default function HomePage() {
  const router = useRouter();
  const [seed, setSeed] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // 访问口令（仅当服务端配置了 ACCESS_CODE 时才要求输入）
  const [accessRequired, setAccessRequired] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  // 创作基调（单选，默认自由发挥）
  const [tone, setTone] = useState<ToneKey>("free");

  useEffect(() => {
    setProjects([...loadProjects()].sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  useEffect(() => {
    // 同会话内已输入过的口令直接带回
    setAccessCode(sessionStorage.getItem(ACCESS_CODE_STORAGE_KEY) ?? "");
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAccessRequired(!!d?.accessCodeRequired))
      .catch(() => {
        // 配置探测失败时按无需口令处理，保证本地开发无感
      });
  }, []);

  const trimmed = seed.trim();
  const canStart = trimmed.length > 0 && (!accessRequired || accessCode.trim().length > 0);

  const handleStart = () => {
    if (!canStart) return;
    if (accessRequired) {
      sessionStorage.setItem(ACCESS_CODE_STORAGE_KEY, accessCode.trim());
    }
    const toneParam = tone === "free" ? "" : `&tone=${tone}`;
    router.push(`/write?seed=${encodeURIComponent(trimmed)}${toneParam}`);
  };

  // 第一次点击进入确认态，3 秒内再次点击才真正删除
  const handleDelete = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => {
        setConfirmDeleteId((cur) => (cur === id ? null : cur));
      }, 3000);
      return;
    }
    saveProjects(removeProject(loadProjects(), id));
    setProjects([...loadProjects()].sort((a, b) => b.updatedAt - a.updatedAt));
    setConfirmDeleteId(null);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-16">
      <p className="font-sans text-xs font-medium tracking-[0.35em] text-accent">
        STORYFORK
      </p>
      <h1 className="mt-3 font-serif text-4xl font-bold text-ink sm:text-5xl">
        故事岔口
      </h1>
      <p className="mt-4 font-sans text-base leading-relaxed text-sub">
        AI 负责发散，人负责选择。写下一个故事的开头，让 AI
        为你分岔出三种截然不同的命运。
      </p>

      <div className="mt-10">
        <p className="font-sans text-xs text-sub">创作基调</p>
        <div className="mt-2 mb-5 flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTone(t.key)}
              aria-pressed={tone === t.key}
              className={
                tone === t.key
                  ? "rounded-full bg-ink px-3 py-1.5 font-sans text-xs text-cream transition hover:bg-accent"
                  : "rounded-full border border-line bg-card px-3 py-1.5 font-sans text-xs text-sub transition hover:border-accent/50 hover:text-accent"
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <label htmlFor="seed" className="sr-only">
          故事开头
        </label>
        <textarea
          id="seed"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="在这里写下你的故事开头……"
          rows={5}
          className="w-full resize-y rounded-xl border border-line bg-card p-4 font-serif text-base leading-8 text-ink placeholder:text-sub/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        <p className="mt-3 font-sans text-xs text-sub">试试这些开头：</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SAMPLE_OPENINGS.map((s) => (
            <button
              key={s}
              type="button"
              title={s}
              onClick={() => setSeed(s)}
              className="rounded-full border border-line bg-card px-3 py-1.5 font-sans text-xs text-sub transition hover:border-accent/50 hover:text-accent"
            >
              示例：{s.slice(0, 14)}…
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        {accessRequired && (
          <div className="mb-3">
            <label
              htmlFor="access-code"
              className="font-sans text-xs text-sub"
            >
              访问口令
            </label>
            <input
              id="access-code"
              type="password"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="请输入访问口令"
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-line bg-card p-3 font-sans text-base text-ink placeholder:text-sub/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:w-72"
            />
          </div>
        )}
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className="w-full rounded-xl bg-ink px-6 py-3.5 font-sans text-base font-medium text-cream transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          开始创作 →
        </button>
      </div>

      {/* 历史作品列表 */}
      <section aria-label="我的作品" className="mt-14">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-xl font-bold text-ink">我的作品</h2>
          <span className="font-sans text-xs text-sub">
            {projects.length > 0 ? `已保存 ${projects.length} 个故事` : ""}
          </span>
        </div>

        {projects.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line bg-card/50 p-6 text-center font-sans text-sm text-sub">
            还没有作品。在上方写下故事开头，开始你的第一段旅程。
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {projects.map((p) => {
              const segmentCount = getPath(p.tree, p.tree.activeLeafId).length;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card p-4"
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-serif text-base font-bold text-ink">
                      {p.title || "未命名"}
                    </h3>
                    <p className="mt-1 font-sans text-xs text-sub">
                      最近编辑：{formatTime(p.updatedAt)} · 当前链 {segmentCount} 段
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/write?project=${p.id}`)}
                      className="rounded-lg bg-ink px-3.5 py-2 font-sans text-xs text-cream transition hover:bg-accent"
                    >
                      继续创作
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className={
                        confirmDeleteId === p.id
                          ? "rounded-lg bg-accent px-3.5 py-2 font-sans text-xs text-cream transition hover:bg-accent/90"
                          : "rounded-lg border border-line bg-cream px-3.5 py-2 font-sans text-xs text-sub transition hover:border-accent/50 hover:text-accent"
                      }
                    >
                      {confirmDeleteId === p.id ? "确认删除？" : "删除"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
