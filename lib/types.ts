export type Branch = {
  id: string;
  title: string;
  summary: string;
  conflict: string;
};

// 故事树节点：一段正文 + 该节点当时的待选分支 + 已发生的续写子节点
export type StoryNode = {
  id: string;
  parentId: string | null; // null 为根节点（用户开头）
  content: string; // 该段正文
  chosenBranchTitle: string | null; // 沿哪个分支续写出来的，根节点为 null
  branches: Branch[]; // 当前最新一轮待选分支（选中后清空）
  childIds: string[]; // 已发生的续写子节点（保留全部历史）
  createdAt: number;
};

// 树状态：activeLeafId 表示"用户当前所在位置"，正文区展示 root → activeLeaf 的路径
export type StoryTreeState = {
  nodes: Record<string, StoryNode>;
  rootId: string;
  activeLeafId: string;
};

export type ApiErrorBody = {
  error: string;
  code?: string;
};

// 作品：一棵完整的故事树 + 元信息，持久化到 LocalStorage
export type Project = {
  id: string;
  title: string;
  tree: StoryTreeState;
  tone: string; // 创作基调（tone.ts 白名单 key；旧数据无此字段时按默认处理）
  updatedAt: number;
  createdAt: number;
};

export const ERROR_CODE_LLM_NOT_CONFIGURED = "LLM_NOT_CONFIGURED";
