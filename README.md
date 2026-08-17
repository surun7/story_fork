# 故事岔口 StoryFork

> 🇬🇧 English: [README.en.md](README.en.md)

## 产品简介

故事岔口（StoryFork）是一个 AI 分支式故事共创工具，解决「一个人写故事容易卡住、又不想被单一结局绑架」的问题：输入一段故事开头，AI 生成 3 个风格迥异的剧情走向，你选定一个方向后 AI 沿此续写正文，再分岔出新的三个方向，循环往复，故事像树一样生长。核心理念是 **「AI 负责发散，人负责选择」**——AI 提供可能性，人掌握叙事的方向感；回退到任意历史节点重新选择时，已生长的分支完整保留，这棵「生长过的树」本身就是作品。

## 快速开始（本地开发）

前置要求：Node.js 18.17+（推荐 20+；单元测试直接运行 TypeScript，需 Node 22.6+）

```bash
# 拉取本仓库代码
git clone https://github.com/surun7/story_fork.git
cd story_fork

npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm run dev                  # 打开 http://localhost:3000
```

环境变量（密钥只读 `process.env`，仅存在于服务端，绝不入库）：

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `LLM_API_KEY` | ✅ | 无 | 你的 LLM API Key（如 DeepSeek 开放平台 platform.deepseek.com） |
| `LLM_BASE_URL` | 否 | `https://api.deepseek.com` | OpenAI Chat Completions 兼容的接口地址 |
| `LLM_MODEL` | 否 | `deepseek-v4-flash` | 模型名 |

> 提示：模型偶发返回空内容时，接口会自动重试 1 次后再报错；页面错误面板的「重试」只重放失败的那一步。
| `ACCESS_CODE` | 否 | 无 | 可选访问口令；留空不启用，配置后前端要求输入口令并随请求头校验 |

其他命令：

```bash
npm test                                  # 单元测试（node:test，零依赖零构建）
npm run build && npm run start            # 生产构建与启动
```

## 部署（生产环境）

```bash
# 1. 拉取代码
git clone https://github.com/surun7/story_fork.git
cd story_fork

# 2. 安装依赖
npm install

# 3. 配置环境变量（密钥只存服务端；.env.local 已被 .gitignore 忽略，不会入库）
cp .env.example .env.local   # Windows: copy .env.example .env.local
# 编辑 .env.local：填入 LLM_API_KEY；生产环境建议同时配置 ACCESS_CODE

# 4. 构建并启动
npm run build
npm run start                 # 默认 3000 端口；换端口：npm run start -- -p 8080 或 PORT=8080

# 5. 健康检查
curl -I http://localhost:3000
```

生产注意事项：

- **反向代理与 HTTPS**：用 Nginx / Caddy 等把域名转发到 `127.0.0.1:3000` 并启用 HTTPS；务必传递 `X-Forwarded-For` 请求头，限流才会按真实客户端 IP 计数（未配置时兜底 `x-real-ip` / unknown）；
- **进程守护**：用 pm2 等守护进程托管 `npm run start`（示例：`pm2 start npm --name story-fork -- run start`）；生产环境建议 Node 20+；
- **访问口令**：生产环境建议设置 `ACCESS_CODE`，防止未授权使用（详见「安全说明」）；
- **多实例部署**：当前限流为单实例内存实现，多副本下为近似限流，生产多实例应接入 Upstash Redis 等分布式限流；
- **密钥安全**：`.env`、`.env.*`、`.env.local` 等环境变量文件均已写入 .gitignore，推送前可执行 `git status` 复核，确保密钥与 agent 本地数据（`.zcode/` 等）不会进入远端仓库。

## 功能与体验路径

主路径三步：

1. **开始**：首页输入故事开头（或点击示例一键填入）→「开始创作」，自动创建新作品并进入写作页；
2. **选择**：写作页底部出现 3 张分支卡片（方向标题 / 剧情简介 / 核心冲突），点击其一；
3. **生长**：AI 沿所选方向续写 300–500 字并追加到正文，随后自动生成下一轮 3 个方向，循环往复。

进阶能力：

- **回退与分支树**：「故事路径」面板（桌面端左侧固定栏 / 移动端顶部抽屉）展示 root → 当前节点的完整链路；点击任意历史节点即可回到那一刻重新选择方向。回退不删除任何已生成内容，旧分支完整保留；分叉点（≥2 个子分支）会列出可跳转的子分支列表；
- **自动保存**：每次树变更防抖 500ms 自动写入浏览器 LocalStorage，刷新页面后作品、分支树与激活位置完整恢复；首页「我的作品」列表可继续创作或删除（删除需二次确认），多个作品互不干扰；
- **导出成稿**：写作页顶部「导出成稿」下载当前激活链路（root → activeLeaf）的 Markdown，格式为 `# 标题`（根节点前 12 字）+ 各段正文，段落间空行，沿分支续写的段落前标注 `> 走向：xx`；文件名「故事岔口-标题-日期.md」，浏览器直接下载；
- **错误处理**：LLM 密钥未配置时给出中文配置指引（503）；JSON 解析失败或模型返回空内容时自动重试 1 次，仍失败返回可读错误（502）；页面错误面板支持重试，且只重放失败的那一步。

## 技术架构

- **Next.js 14（App Router）+ TypeScript + Tailwind CSS**，单项目、无独立后端；
- **LLM 调用**：`app/api/` 下两个 Route Handler（`POST /api/branches`、`POST /api/continue`），通过环境变量配置，兼容 OpenAI Chat Completions 协议（DeepSeek 等可直接使用）；两个接口在 JSON 解析失败或模型返回空内容时均自动重试 1 次；
- **纯函数故事树**：`lib/storyTree.ts` 以不可变方式管理节点树（`createRoot / appendNode / switchActive / setNodeBranches`）；`lib/storage.ts` 负责作品序列化与 LocalStorage 读写（损坏数据容错、配额超限静默降级）；`lib/markdown.ts` 生成导出成稿。三者均有单元测试覆盖；
- **前端状态**：React state 管理全部交互，无数据库。

```
app/
  api/branches/route.ts    # POST 生成 3 个分支（解析失败/空内容自动重试 1 次）
  api/continue/route.ts    # POST 沿选定分支续写正文（空内容自动重试 1 次）
  page.tsx                 # 首页（开始创作 + 我的作品列表）
  write/page.tsx           # 写作页入口（Suspense 包裹）
components/
  WriteView.tsx            # 写作页核心（树状态机 / 回退 / 自动保存 / 导出）
  StoryTreePanel.tsx       # 故事路径导航面板（桌面侧栏 / 移动抽屉）
  BranchCard.tsx           # 分支卡片（hover / 选中 / 禁用三态）
  Skeletons.tsx            # 段落与卡片骨架屏
lib/
  types.ts                 # Branch / StoryNode / Project 等共享类型
  storyTree.ts             # 分支树纯函数
  storage.ts               # 作品序列化 / LocalStorage 持久化（容错）
  markdown.ts              # 导出成稿 Markdown 生成
  llm.ts                   # 环境变量校验 + OpenAI 兼容调用 + 超时
  prompts.ts               # 分支生成 / 续写 prompt
  errors.ts                # 统一错误响应
  *.test.ts                # node:test 单元测试（npm test）
```

## 安全说明

- **密钥仅服务端持有**：LLM API Key 只读 `process.env`，仅存在于服务端路由层，绝不下发到客户端代码包，也不进入任何日志或错误响应；
- **频率限制**：`/api/branches` 与 `/api/continue` 入口按 IP 做内存滑动窗口限流，每 IP 每分钟最多 10 次请求，超限返回 `429` +「请求太频繁，请稍后再试」；
- **访问口令（可选）**：配置 `ACCESS_CODE` 后启用，首页要求输入口令，前端通过请求头 `x-access-code` 上送，服务端校验不符返回 `403`；未配置该变量时完全跳过校验，本地开发无感。口令只存在于环境变量与浏览器会话（sessionStorage），不进仓库、不写死在代码里、不进 URL；
- **成本控制**：LLM 请求统一 `max_tokens` 上限（分支 800 / 续写 1200）；`pathText` 超过 20000 字时中间截断（保留开头与最近内容，标记省略段）；请求 30 秒超时，超时返回 `504` 中文提示。

## 已知边界

- 作品保存在浏览器 LocalStorage，**无账号体系**：换设备、清缓存即丢失，不同浏览器互不可见；
- **无云端同步**，无作品分享能力；
- LLM 调用为真实请求，**按 API 用量计费**；
- 限流为单实例内存实现：**serverless 多实例下为近似限流，生产应换 Upstash Redis** 等分布式限流；
- 无并发协作、无分支对比/合并视图。

## 下一步优先级

1. 云端存储与作品分享（账号体系 + 服务端持久化）；
2. 分支对比视图（并排比较同一节点的多个分支走向）；
3. 故事基调自定义（风格 / 题材 / 篇幅偏好注入 prompt）。
