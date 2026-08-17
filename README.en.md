# StoryFork (故事岔口)

## Product Overview

StoryFork is an AI-powered branching story co-creation tool that solves the problem of "getting stuck writing a story alone, without being locked into a single ending": you enter a story opening, the AI generates 3 distinctly different plot directions, you pick one, the AI continues the story along that path, then branches into 3 new directions again — and the story grows like a tree. The core philosophy is **"AI diverges, humans choose"** — the AI offers possibilities, while you hold the narrative direction. When you go back to any historical node and choose again, previously grown branches are fully preserved; this "grown tree" is itself the work.

## Quick Start (Local Development)

Prerequisites: Node.js 18.17+ (20+ recommended; unit tests run TypeScript directly and require Node 22.6+)

```bash
# Clone this repository
git clone https://github.com/surun7/story_fork.git
cd story_fork

npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm run dev                  # open http://localhost:3000
```

Environment variables (keys are read from `process.env` on the server side only, never committed):

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `LLM_API_KEY` | ✅ | none | Your LLM API key (e.g., from DeepSeek Open Platform platform.deepseek.com) |
| `LLM_BASE_URL` | no | `https://api.deepseek.com` | OpenAI Chat Completions compatible endpoint |
| `LLM_MODEL` | no | `deepseek-chat` | Model name |
| `ACCESS_CODE` | no | none | Optional access code; empty disables it. When set, the homepage asks for it and the server validates it via a request header |

Other commands:

```bash
npm test                                  # unit tests (node:test, zero-dependency, no build step)
npm run build && npm run start            # production build and start
```

## Deployment (Production)

```bash
# 1. Clone the repository
git clone https://github.com/surun7/story_fork.git
cd story_fork

# 2. Install dependencies
npm install

# 3. Configure environment variables (server-side only; .env.local is gitignored)
cp .env.example .env.local   # Windows: copy .env.example .env.local
# Edit .env.local: set LLM_API_KEY; consider setting ACCESS_CODE in production

# 4. Build and start
npm run build
npm run start                 # default port 3000; change it with: npm run start -- -p 8080 or PORT=8080

# 5. Health check
curl -I http://localhost:3000
```

Production notes:

- **Reverse proxy & HTTPS**: point your domain to `127.0.0.1:3000` with Nginx / Caddy or similar and enable HTTPS; make sure the `X-Forwarded-For` header is forwarded so rate limiting counts the real client IP (otherwise it falls back to `x-real-ip` / `unknown`);
- **Process manager**: run `npm run start` under pm2 or similar (e.g., `pm2 start npm --name story-fork -- run start`); Node 20+ recommended in production;
- **Access code**: set `ACCESS_CODE` in production to prevent unauthorized use (see Security Notes);
- **Multi-instance deployment**: the rate limiter is an in-memory single-instance implementation — it is an approximation with multiple replicas; use a distributed limiter such as Upstash Redis for production multi-instance setups;
- **Key safety**: environment files (`.env`, `.env.*`, `.env.local`) are all gitignored; run `git status` before pushing to confirm that keys and local agent data (e.g., `.zcode/`) never reach the remote repository.

## Features & Experience Path

The main path has three steps:

1. **Start**: enter a story opening on the homepage (or click a sample to fill it in) → "Start creating", which automatically creates a new work and opens the writing page;
2. **Choose**: 3 branch cards appear at the bottom of the writing page (direction title / plot summary / core conflict); click one;
3. **Grow**: the AI continues 300–500 characters along the chosen direction, appends the paragraph, then automatically generates the next round of 3 directions — repeat.

Advanced capabilities:

- **Backtracking & the branch tree**: the "Story Path" panel (fixed left sidebar on desktop / drawer from the top bar on mobile) shows the full chain from root to the current node. Click any historical node to go back to that moment and choose a new direction. Backtracking never deletes anything: old branches are fully preserved, and fork points (≥2 child branches) list clickable child branches;
- **Auto-save**: every tree change is debounced 500ms and written to browser LocalStorage. After a refresh, the work, the branch tree, and the active position are fully restored. The "My Works" list on the homepage supports continuing or deleting works (delete requires a two-step confirmation); multiple works never interfere with each other;
- **Export as Markdown**: the "Export" button at the top of the writing page downloads the current active chain (root → activeLeaf) as Markdown — `# title` (first 12 characters of the root node) plus each paragraph, blank lines between paragraphs, and paragraphs continued along a branch are prefixed with a quote line `> Direction: xx`. Filename: `StoryFork-<title>-<date>.md`, downloaded directly by the browser;
- **Error handling**: when the LLM key is missing, a clear Chinese configuration guide is shown (503); upstream failures / parse failures return readable errors (502); the page error panel supports retry, and retry only replays the failed step.

## Tech Architecture

- **Next.js 14 (App Router) + TypeScript + Tailwind CSS**, single project, no separate backend;
- **LLM calls**: two Route Handlers under `app/api/` (`POST /api/branches`, `POST /api/continue`), configured via environment variables and compatible with the OpenAI Chat Completions protocol (DeepSeek and similar work directly). The branches endpoint automatically retries once when JSON parsing fails;
- **Pure-function story tree**: `lib/storyTree.ts` manages the node tree immutably (`createRoot / appendNode / switchActive / setNodeBranches`); `lib/storage.ts` handles serialization and LocalStorage persistence (corrupted-data tolerance, silent degrade on quota overflow); `lib/markdown.ts` generates the exported Markdown. All three have unit test coverage;
- **Frontend state**: all interaction is managed with React state; no database.

```
app/
  api/branches/route.ts    # POST generate 3 branches (auto-retry once on JSON parse failure)
  api/continue/route.ts    # POST continue along the selected branch
  api/config/route.ts      # GET feature detection (whether an access code is required)
  page.tsx                 # Homepage (start creating + My Works list)
  write/page.tsx           # Writing page entry (wrapped in Suspense)
components/
  WriteView.tsx            # Writing page core (tree state machine / backtracking / auto-save / export)
  StoryTreePanel.tsx       # Story Path navigation panel (desktop sidebar / mobile drawer)
  BranchCard.tsx           # Branch card (hover / selected / disabled states)
  Skeletons.tsx            # Paragraph and card skeletons
lib/
  types.ts                 # Shared types: Branch / StoryNode / Project ...
  storyTree.ts             # Pure functions for the branch tree
  storage.ts               # Work serialization / LocalStorage persistence (fault-tolerant)
  markdown.ts              # Markdown generation for export
  llm.ts                   # Env validation + OpenAI-compatible calls + timeout
  prompts.ts               # Branch generation / continuation prompts
  errors.ts                # Unified error responses
  rateLimit.ts             # In-memory sliding-window rate limiter (per IP)
  accessCode.ts            # Optional access-code validation
  *.test.ts                # node:test unit tests (npm test)
```

## Security Notes

- **Keys are server-side only**: the LLM API key is read from `process.env`, exists only in the server route layer, is never shipped to the client bundle, and never appears in logs or error responses;
- **Rate limiting**: both LLM endpoints enforce an in-memory sliding-window limit per IP (10 requests per minute per IP), returning `429` + "Too many requests, please try again later" when exceeded;
- **Optional access code**: set `ACCESS_CODE` to enable. The homepage asks for the code, the frontend sends it via the `x-access-code` request header, and the server returns `403` on mismatch. When the variable is unset, validation is skipped entirely — zero friction for local development. The code lives only in the environment variable and the browser session (sessionStorage), never in the repo, never hardcoded, never in the URL;
- **Cost control**: LLM requests use a unified `max_tokens` cap (800 for branches / 1200 for continuation); `pathText` over 20,000 characters is truncated in the middle (keeping the beginning and the most recent content, with an ellipsis marker); requests time out after 30 seconds, returning `504` with a Chinese message.

## Known Limitations

- Works are stored in browser LocalStorage with **no account system**: they are lost when switching devices or clearing browser data, and different browsers cannot see each other's works;
- **No cloud sync**, no sharing capability;
- LLM calls are real requests billed **by API usage**;
- Rate limiting is a single-instance in-memory implementation: **it is an approximation under serverless multi-instance deployments — switch to Upstash Redis (distributed rate limiting) in production**;
- No concurrent collaboration, no branch diff/merge views.

## Next Steps (Priority Order)

1. Cloud storage & work sharing (account system + server-side persistence);
2. Branch comparison view (side-by-side comparison of multiple branches at the same node);
3. Story tone customization (style / genre / length preferences injected into the prompt).

## AI-Assisted Development Notes

This project is an AI-assisted coding product: the AI wrote the vast majority of the code across three iterations (M1 main path → M2 branch tree & backtracking → M3 persistence & export), while humans were responsible for requirement convergence, prompt design, acceptance testing, and bug review.

A representative case: **during M2, a leftover M1 retry bug was found and fixed** — in M1, clicking "Retry" after a failed continuation was silently blocked by a `phase !== "ready"` guard, so the error panel stayed stuck in the error state. The M2 refactor moved double-click protection to the UI disabled state, restoring the retry path. The bug was discovered through a manual, line-by-line review of the error paths, which shows why the "AI writes, humans review" collaboration model matters for delivery quality.
