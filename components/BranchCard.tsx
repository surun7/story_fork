"use client";

import type { Branch } from "@/lib/types";

type BranchCardProps = {
  branch: Branch;
  selected: boolean;
  disabled: boolean;
  onSelect: (branch: Branch) => void;
};

export default function BranchCard({
  branch,
  selected,
  disabled,
  onSelect,
}: BranchCardProps) {
  const stateClass = selected
    ? "border-accent bg-accentSoft shadow-md ring-1 ring-accent/40"
    : "border-line hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md";
  const disabledClass = selected
    ? "cursor-wait"
    : disabled
      ? "cursor-not-allowed opacity-60"
      : "cursor-pointer";

  return (
    <button
      type="button"
      onClick={() => onSelect(branch)}
      disabled={disabled}
      aria-pressed={selected}
      className={`relative flex w-full flex-col rounded-xl border bg-card p-5 text-left transition-all duration-200 ${stateClass} ${disabledClass}`}
    >
      {selected && (
        <span className="absolute right-4 top-4 rounded-full bg-accent px-2.5 py-0.5 font-sans text-xs text-cream">
          续写中…
        </span>
      )}
      <h3 className="pr-16 font-serif text-lg font-bold leading-snug text-ink">
        {branch.title}
      </h3>
      <p className="mt-3 font-sans text-sm leading-relaxed text-ink/80">
        {branch.summary}
      </p>
      <div className="mt-4 border-t border-line pt-3">
        <span className="font-sans text-xs font-medium tracking-wider text-accent">
          核心冲突
        </span>
        <p className="mt-1 font-sans text-sm leading-relaxed text-sub">
          {branch.conflict}
        </p>
      </div>
    </button>
  );
}
