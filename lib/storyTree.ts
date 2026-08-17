// 故事树纯函数：所有操作返回新 state，绝不就地修改。
// 回退 ≠ 删除：appendNode 只追加 childIds，从不移除既有子节点与内容。
import type { Branch, StoryNode, StoryTreeState } from "./types";

function nextId(): string {
  return crypto.randomUUID();
}

export function createRoot(content: string): StoryTreeState {
  const root: StoryNode = {
    id: nextId(),
    parentId: null,
    content,
    chosenBranchTitle: null,
    branches: [],
    childIds: [],
    createdAt: Date.now(),
  };
  return { nodes: { [root.id]: root }, rootId: root.id, activeLeafId: root.id };
}

export function getNode(state: StoryTreeState, nodeId: string): StoryNode | undefined {
  return state.nodes[nodeId];
}

// 从根到指定节点的完整路径（含两端）
export function getPath(state: StoryTreeState, nodeId: string): StoryNode[] {
  const path: StoryNode[] = [];
  let cur: StoryNode | undefined = state.nodes[nodeId];
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? state.nodes[cur.parentId] : undefined;
  }
  return path;
}

// 路径全文：root → node 各段正文按 \n\n 拼接，作为 LLM 的完整上下文
export function buildPathText(state: StoryTreeState, nodeId: string): string {
  return getPath(state, nodeId)
    .map((n) => n.content)
    .join("\n\n");
}

// 选中分支续写：新节点挂到 parent 下（追加进 childIds，不覆盖旧子节点），
// 父节点待选分支清空（选中即消耗），activeLeafId 移到新节点
export function appendNode(
  state: StoryTreeState,
  parentId: string,
  opts: { content: string; chosenBranchTitle: string }
): StoryTreeState {
  const parent = state.nodes[parentId];
  if (!parent) return state;

  const child: StoryNode = {
    id: nextId(),
    parentId,
    content: opts.content,
    chosenBranchTitle: opts.chosenBranchTitle,
    branches: [],
    childIds: [],
    createdAt: Date.now(),
  };
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [parentId]: { ...parent, branches: [], childIds: [...parent.childIds, child.id] },
      [child.id]: child,
    },
    activeLeafId: child.id,
  };
}

// 把一轮新生成的分支挂到指定节点（回退后 branches 为空时自动重新请求）
export function setNodeBranches(
  state: StoryTreeState,
  nodeId: string,
  branches: Branch[]
): StoryTreeState {
  const node = state.nodes[nodeId];
  if (!node) return state;
  return { ...state, nodes: { ...state.nodes, [nodeId]: { ...node, branches } } };
}

// 回退切换：只移动 activeLeafId，树上的既有内容分毫不动
export function switchActive(state: StoryTreeState, nodeId: string): StoryTreeState {
  if (!state.nodes[nodeId] || nodeId === state.activeLeafId) return state;
  return { ...state, activeLeafId: nodeId };
}
