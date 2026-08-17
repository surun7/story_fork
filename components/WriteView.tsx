"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ApiErrorBody, Branch, Project, StoryTreeState } from "@/lib/types";
import { ERROR_CODE_LLM_NOT_CONFIGURED } from "@/lib/types";
import {
  appendNode,
  buildPathText,
  createRoot,
  getPath,
  setNodeBranches,
  switchActive,
} from "@/lib/storyTree";
import {
  ACCESS_CODE_STORAGE_KEY,
  deriveTitle,
  loadProjects,
  saveProjects,
  upsertProject,
} from "@/lib/storage";
import { buildExportFilename, buildMarkdown } from "@/lib/markdown";
import { normalizeTone, toneLabel } from "@/lib/tone";
import BranchCard from "./BranchCard";
import StoryTreePanel from "./StoryTreePanel";
import { BranchCardsSkeleton, ParagraphSkeleton } from "./Skeletons";

type Phase = "loading" | "ready" | "continuing" | "error";
type FailedStep = "branches" | "continue" | null;

class RequestError extends Error {
  isConfigError: boolean;

  constructor(message: string, isConfigError: boolean) {
    super(message);
    this.name = "RequestError";
    this.isConfigError = isConfigError;
  }
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  // 访问口令随请求头 x-access-code 上送（未配置 ACCESS_CODE 时服务端忽略）
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const accessCode =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem(ACCESS_CODE_STORAGE_KEY)
      : null;
  if (accessCode) headers["x-access-code"] = accessCode;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    throw new RequestError("网络连接失败，请检查网络后重试。", false);
  }
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  if (!res.ok) {
    throw new RequestError(
      body?.error ?? "请求失败，请稍后重试。",
      body?.code === ERROR_CODE_LLM_NOT_CONFIGURED
    );
  }
  if (!body) {
    throw new RequestError("服务器返回了无法解析的响应，请稍后重试。", false);
  }
  return body as T;
}

function loadProjectById(id: string): Project | null {
  return loadProjects().find((p) => p.id === id) ?? null;
}

export default function WriteView() {
  const searchParams = useSearchParams();
  const seed = (searchParams.get("seed") ?? "").trim();
  const projectParam = searchParams.get("project") ?? null;
  const toneParam = searchParams.get("tone") ?? null;

  // seed 存在 → 新建作品（带创作基调，非法值回退默认）；project 存在 → 从 LocalStorage 恢复完整树与激活位置
  const [project, setProject] = useState<Project | null>(() => {
    if (seed) {
      const now = Date.now();
      return {
        id: crypto.randomUUID(),
        title: deriveTitle(seed),
        tree: createRoot(seed),
        tone: normalizeTone(toneParam),
        createdAt: now,
        updatedAt: now,
      };
    }
    if (projectParam) return loadProjectById(projectParam) ?? null;
    return null;
  });
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorIsConfig, setErrorIsConfig] = useState(false);
  const [failedStep, setFailedStep] = useState<FailedStep>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // 命运硬币：被随机选中的卡片 id（0.6s 脉冲动画期间展示）
  const [diceBranchId, setDiceBranchId] = useState<string | null>(null);

  // ref 镜像：回调里读取最新值，避免闭包过期
  const projectRef = useRef(project);
  const phaseRef = useRef<Phase>("loading");
  const lastBranchRef = useRef<Branch | null>(null);
  const continueNodeRef = useRef<string | null>(null);
  const branchesForNodeRef = useRef<string | null>(null);
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diceRunningRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const updateProject = (next: Project) => {
    projectRef.current = next;
    setProject(next);
  };

  // 树变更统一入口：同时更新 updatedAt，触发防抖自动保存
  const applyTreeUpdate = (nextTree: StoryTreeState) => {
    const cur = projectRef.current;
    if (!cur) return;
    updateProject({ ...cur, tree: nextTree, updatedAt: Date.now() });
  };

  const updatePhase = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const tree = project?.tree ?? null;
  const activePath = tree ? getPath(tree, tree.activeLeafId) : [];
  const activeNode = tree ? (tree.nodes[tree.activeLeafId] ?? null) : null;
  const navDisabled = phase === "loading" || phase === "continuing";

  // 故事统计（数据源为树状态，随树变更实时更新）
  const totalChars = activePath.reduce((n, node) => n + node.content.length, 0);
  const forkCount = tree
    ? Object.values(tree.nodes).filter((n) => n.childIds.length >= 2).length
    : 0;
  const depth = activePath.length;

  // 命运硬币：随机选中一个分支，0.6s 脉冲后自动进入续写（复用 continueStory）
  const handleDice = () => {
    if (phaseRef.current !== "ready" || diceRunningRef.current) return;
    const node = projectRef.current!.tree.nodes[projectRef.current!.tree.activeLeafId];
    if (!node || node.branches.length === 0) return;
    const branch = node.branches[Math.floor(Math.random() * node.branches.length)];
    diceRunningRef.current = true;
    setDiceBranchId(branch.id);
    setTimeout(() => {
      diceRunningRef.current = false;
      setDiceBranchId(null);
      void continueStory(branch);
    }, 600);
  };

  // 为指定节点请求一轮新分支（回退到 branches 为空的节点时自动调用）
  const fetchBranches = useCallback(async (nodeId: string) => {
    branchesForNodeRef.current = nodeId;
    updatePhase("loading");
    setErrorMessage(null);
    setErrorIsConfig(false);
    setFailedStep(null);
    try {
      const data = await postJson<{ branches: Branch[] }>("/api/branches", {
        pathText: buildPathText(projectRef.current!.tree, nodeId),
        tone: projectRef.current!.tone,
      });
      applyTreeUpdate(setNodeBranches(projectRef.current!.tree, nodeId, data.branches));
      setSelectedBranchId(null);
      updatePhase("ready");
    } catch (err) {
      const e =
        err instanceof RequestError
          ? err
          : new RequestError("生成分支失败，请稍后重试。", false);
      setErrorMessage(e.message);
      setErrorIsConfig(e.isConfigError);
      setFailedStep("branches");
      updatePhase("error");
    }
  }, []);

  // 选定分支续写：新节点挂到当前节点下，随后自动请求下一轮分支
  const continueStory = useCallback(
    async (branch: Branch) => {
      const nodeId = continueNodeRef.current ?? projectRef.current!.tree.activeLeafId;
      lastBranchRef.current = branch;
      continueNodeRef.current = nodeId;
      setSelectedBranchId(branch.id);
      setErrorMessage(null);
      setErrorIsConfig(false);
      setFailedStep(null);
      updatePhase("continuing");
      try {
        const data = await postJson<{ content: string }>("/api/continue", {
          pathText: buildPathText(projectRef.current!.tree, nodeId),
          tone: projectRef.current!.tone,
          branch,
        });
        applyTreeUpdate(
          appendNode(projectRef.current!.tree, nodeId, {
            content: data.content,
            chosenBranchTitle: branch.title,
          })
        );
        // 新段落落定后，自动请求下一轮 3 个分支
        await fetchBranches(projectRef.current!.tree.activeLeafId);
      } catch (err) {
        const e =
          err instanceof RequestError
            ? err
            : new RequestError("续写失败，请重试。", false);
        setErrorMessage(e.message);
        setErrorIsConfig(e.isConfigError);
        setFailedStep("continue");
        updatePhase("error");
      }
    },
    [fetchBranches]
  );

  // 回退 / 跳转：切到历史节点；若该节点没有待选分支则自动请求新一轮
  const handleNavigate = useCallback(
    (nodeId: string) => {
      if (phaseRef.current === "loading" || phaseRef.current === "continuing") return;
      if (nodeId === projectRef.current!.tree.activeLeafId) return;
      applyTreeUpdate(switchActive(projectRef.current!.tree, nodeId));
      setSelectedBranchId(null);
      setDrawerOpen(false);
      const node = projectRef.current!.tree.nodes[nodeId];
      if (node && node.branches.length === 0) {
        void fetchBranches(nodeId);
      } else {
        setErrorMessage(null);
        setErrorIsConfig(false);
        setFailedStep(null);
        updatePhase("ready");
      }
    },
    [fetchBranches]
  );

  // 重试只重放失败的那一步：续写失败重试续写，分支失败重试分支
  const handleRetry = () => {
    if (failedStep === "continue" && lastBranchRef.current) {
      void continueStory(lastBranchRef.current);
    } else {
      void fetchBranches(
        branchesForNodeRef.current ?? projectRef.current!.tree.activeLeafId
      );
    }
  };

  // 导出当前激活链路（root → activeLeaf）为 Markdown 并触发浏览器下载
  const handleExport = () => {
    const p = projectRef.current;
    if (!p) return;
    const path = getPath(p.tree, p.tree.activeLeafId);
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const blob = new Blob([buildMarkdown(path)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildExportFilename(path, dateStr);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // 挂载：新建作品请求根节点分支；恢复的作品若激活节点有缓存分支则直接展示
  useEffect(() => {
    const p = projectRef.current;
    if (!p) return;
    const active = p.tree.nodes[p.tree.activeLeafId];
    if (active && active.branches.length > 0) {
      updatePhase("ready");
    } else {
      void fetchBranches(p.tree.activeLeafId);
    }
  }, [fetchBranches]);

  // 防抖自动保存：树变更后 500ms 写入 LocalStorage；cleanup 只清定时器不置空 ref
  useEffect(() => {
    if (!project) return;
    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    pendingSaveRef.current = setTimeout(() => {
      pendingSaveRef.current = null;
      saveProjects(upsertProject(loadProjects(), projectRef.current!));
    }, 500);
    return () => {
      if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    };
  }, [project]);

  // 组件卸载（如导航回首页）时立即落盘未保存的变更，保证「返回首页不丢失进度」
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
        pendingSaveRef.current = null;
        const p = projectRef.current;
        if (p) saveProjects(upsertProject(loadProjects(), p));
      }
    };
  }, []);

  // 新段落 / 新分支 / 状态变化时滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [project, phase]);

  // 移动端抽屉打开时锁定背景滚动
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  if (!project || !tree) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-20 text-center">
        <p className="font-serif text-xl text-ink">没有找到故事开头。</p>
        <p className="mt-2 font-sans text-sm text-sub">
          它可能已被删除，或链接不完整。请回到首页重新开始。
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-ink px-5 py-2.5 font-sans text-sm text-cream transition hover:bg-accent"
        >
          返回首页
        </Link>
      </div>
    );
  }

  const branchHeading =
    phase === "loading"
      ? activePath.length <= 1
        ? "正在构思故事的第一组走向…"
        : "新段落已落定，正在构思接下来的走向…"
      : "接下来的走向，由你选择";

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 py-8 sm:px-6">
      {/* 桌面端：左侧固定导航栏 */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="lg:sticky lg:top-8">
          <h2 className="font-serif text-lg font-bold text-ink">故事路径</h2>
          <p className="mt-1 font-sans text-xs text-sub">
            从开端到当前位置的完整链路
          </p>
          <div className="mt-4 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
            <StoryTreePanel
              tree={tree}
              activeLeafId={tree.activeLeafId}
              disabled={navDisabled}
              onNavigate={handleNavigate}
            />
          </div>
        </div>
      </aside>

      {/* 移动端：故事路径抽屉 */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="故事路径"
        >
          <div
            className="animate-fade-in absolute inset-0 bg-ink/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="animate-drawer-in absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col bg-cream shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-serif text-lg font-bold text-ink">故事路径</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="关闭故事路径"
                className="rounded-md p-1.5 font-sans text-sub transition hover:bg-card hover:text-ink"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <StoryTreePanel
                tree={tree}
                activeLeafId={tree.activeLeafId}
                disabled={navDisabled}
                onNavigate={handleNavigate}
              />
            </div>
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-2 pb-6">
          <Link
            href="/"
            className="shrink-0 font-sans text-sm text-sub transition hover:text-accent"
          >
            ← 返回首页
          </Link>
          <span className="font-serif text-lg font-bold text-ink">
            故事岔口
            <span className="ml-2 font-sans text-xs font-medium tracking-widest text-accent">
              STORYFORK
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="rounded-lg border border-line bg-card px-3 py-1.5 font-sans text-xs text-sub transition hover:border-accent/50 hover:text-accent"
            >
              导出成稿
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg border border-line bg-card px-3 py-1.5 font-sans text-xs text-sub transition hover:border-accent/50 hover:text-accent lg:hidden"
            >
              故事路径
            </button>
          </div>
        </header>

        {/* 面包屑 + 基调标签 + 故事统计 */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <nav
            aria-label="当前位置"
            className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-sans text-xs text-sub"
          >
            {activePath.map((node, i) => (
              <Fragment key={node.id}>
                {i > 0 && <span aria-hidden="true">→</span>}
                <button
                  type="button"
                  onClick={() => handleNavigate(node.id)}
                  disabled={navDisabled || node.id === tree.activeLeafId}
                  className={[
                    node.id === tree.activeLeafId
                      ? "font-medium text-ink"
                      : "transition hover:text-accent",
                    navDisabled && node.id !== tree.activeLeafId
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer",
                  ].join(" ")}
                >
                  第 {i + 1} 段
                  {node.chosenBranchTitle ? ` · 沿「${node.chosenBranchTitle}」` : ""}
                </button>
              </Fragment>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-3 font-sans text-xs text-sub">
            <span className="whitespace-nowrap rounded-full border border-line bg-card px-2 py-0.5">
              基调 · {toneLabel(project.tone)}
            </span>
            <span className="whitespace-nowrap">
              {totalChars} 字 · {forkCount} 个分叉 · 第 {depth} 段
            </span>
          </div>
        </div>

        {/* 故事正文 */}
        <section aria-label="故事正文" className="mt-2">
          {activePath.map((node, i) => (
            <article key={node.id} className="py-6 first:pt-0">
              <div className="flex items-center justify-between">
                <span className="font-sans text-xs text-sub">
                  {i === 0 ? "故事开端" : `沿「${node.chosenBranchTitle}」续写`}
                </span>
                <span className="font-sans text-xs text-sub/60">
                  第 {i + 1} 段
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap font-serif text-lg leading-8 text-ink">
                {node.content}
              </p>
              {i < activePath.length - 1 && (
                <div className="mt-6 border-t border-line" />
              )}
            </article>
          ))}
          {phase === "continuing" && (
            <div className="py-6">
              <p className="font-sans text-xs text-sub">正在续写正文…</p>
              <ParagraphSkeleton />
            </div>
          )}
        </section>

        {/* 分支方向 */}
        <section aria-label="分支方向" className="mt-8 border-t border-line pt-8">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-serif text-xl font-bold text-ink">
              {branchHeading}
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden font-sans text-xs text-sub sm:inline">
                每轮 3 个方向
              </span>
              <button
                type="button"
                onClick={handleDice}
                disabled={
                  phase !== "ready" ||
                  !activeNode ||
                  activeNode.branches.length === 0
                }
                className="rounded-lg border border-line bg-card px-3 py-1.5 font-sans text-xs text-sub transition hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                🎲 让命运决定
              </button>
            </div>
          </div>

          <div className="mt-5">
            {phase === "loading" && <BranchCardsSkeleton />}

            {(phase === "ready" || phase === "continuing") &&
              activeNode &&
              activeNode.branches.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-3">
                  {activeNode.branches.map((b) => (
                    <BranchCard
                      key={b.id}
                      branch={b}
                      selected={
                        phase === "continuing" && selectedBranchId === b.id
                      }
                      disabled={phase === "continuing"}
                      dicePulse={diceBranchId === b.id}
                      onSelect={continueStory}
                    />
                  ))}
                </div>
              )}

            {phase === "error" && (
              <div className="rounded-xl border border-line bg-card p-6">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 font-sans text-sm font-bold text-accent">
                    !
                  </span>
                  <div className="min-w-0">
                    <p className="font-sans text-sm font-medium text-ink">
                      出错了
                    </p>
                    <p className="mt-1 font-sans text-sm leading-relaxed text-sub">
                      {errorMessage}
                    </p>
                    {errorIsConfig && (
                      <div className="mt-3 rounded-lg bg-cream p-3 font-sans text-xs leading-relaxed text-sub">
                        在项目根目录创建{" "}
                        <code className="text-accent">.env.local</code> 并写入
                        <code className="mt-1 block whitespace-pre text-accent">
                          LLM_API_KEY=你的密钥
                        </code>
                        （可选 LLM_BASE_URL、LLM_MODEL），保存后重启{" "}
                        <code className="text-accent">npm run dev</code>。
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="mt-4 rounded-lg bg-ink px-5 py-2 font-sans text-sm text-cream transition hover:bg-accent"
                    >
                      重试
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="mt-6 text-center font-sans text-xs text-sub/70">
            选择方向后，AI 将沿此路续写 300–500 字，再为你分岔出新的三个方向
          </p>
        </section>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
