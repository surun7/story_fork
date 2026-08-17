"use client";

import type { StoryTreeState } from "@/lib/types";
import { getPath } from "@/lib/storyTree";

type StoryTreePanelProps = {
  tree: StoryTreeState;
  activeLeafId: string;
  disabled: boolean;
  onNavigate: (nodeId: string) => void;
};

function summarize(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// 节点链导航面板：root → 激活节点的路径，分叉点（≥2 个子分支）下挂可跳转的子分支列表
export default function StoryTreePanel({
  tree,
  activeLeafId,
  disabled,
  onNavigate,
}: StoryTreePanelProps) {
  const path = getPath(tree, activeLeafId);

  return (
    <nav aria-label="故事路径" className="flex flex-col gap-1">
      {path.map((node, i) => {
        const isActive = node.id === activeLeafId;
        return (
          <div key={node.id}>
            <button
              type="button"
              onClick={() => onNavigate(node.id)}
              disabled={disabled || isActive}
              aria-current={isActive ? "location" : undefined}
              className={[
                "w-full rounded-lg border p-3 text-left transition-colors",
                isActive
                  ? "border-accent bg-accentSoft"
                  : "border-transparent hover:border-line hover:bg-card",
                disabled && !isActive ? "cursor-not-allowed opacity-60" : "cursor-pointer",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-sans text-[11px] text-sub">
                  第 {i + 1} 段
                  {i > 0 && node.chosenBranchTitle
                    ? ` · 沿「${node.chosenBranchTitle}」`
                    : ""}
                </span>
                {node.childIds.length > 0 && (
                  <span className="shrink-0 rounded-full border border-line bg-card px-2 py-0.5 font-sans text-[10px] text-sub">
                    已续写 {node.childIds.length} 个分支
                  </span>
                )}
              </div>
              <p className="mt-1.5 font-serif text-sm leading-snug text-ink/90">
                {summarize(node.content, 20)}
              </p>
            </button>

            {/* 分叉点可视化：该节点下 ≥2 个已续写分支时列出，可直接点击跳转 */}
            {node.childIds.length >= 2 && (
              <div className="ml-3 mt-1 space-y-1 border-l border-line pl-3">
                {node.childIds.map((childId) => {
                  const child = tree.nodes[childId];
                  if (!child) return null;
                  const childActive = child.id === activeLeafId;
                  return (
                    <button
                      key={childId}
                      type="button"
                      onClick={() => onNavigate(childId)}
                      disabled={disabled || childActive}
                      className={[
                        "flex w-full items-baseline gap-1.5 rounded-md px-2 py-1.5 text-left font-sans text-xs transition-colors",
                        childActive
                          ? "bg-accentSoft text-accent"
                          : "text-sub hover:bg-card hover:text-ink",
                        disabled && !childActive ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                      ].join(" ")}
                    >
                      <span className="truncate">
                        · {child.chosenBranchTitle ?? "续写"}
                      </span>
                      <span className="truncate text-sub/60">
                        {summarize(child.content, 12)}
                      </span>
                      {childActive && (
                        <span className="shrink-0 font-medium text-accent">当前</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <p className="mt-4 font-sans text-xs leading-relaxed text-sub/70">
        点击任意节点可回到那一刻重新选择方向；已生长的分支会完整保留在树中。
      </p>
    </nav>
  );
}
