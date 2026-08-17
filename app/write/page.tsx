import { Suspense } from "react";
import WriteView from "@/components/WriteView";

function WritePageFallback() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-6 w-40 rounded bg-line/70" />
        <div className="h-4 w-full rounded bg-line/50" />
        <div className="h-4 w-5/6 rounded bg-line/50" />
        <div className="h-4 w-4/6 rounded bg-line/50" />
      </div>
    </div>
  );
}

export default function WritePage() {
  return (
    <Suspense fallback={<WritePageFallback />}>
      <WriteView />
    </Suspense>
  );
}
