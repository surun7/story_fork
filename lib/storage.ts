// 作品持久化：序列化/反序列化为纯函数（可单测），LocalStorage 读写带容错。
// 存储失败（如超出配额）时静默降级为仅内存：不影响使用，仅 console.warn。
import type { Project, StoryNode, StoryTreeState } from "./types";

export const STORAGE_KEY = "storyfork-projects";

// 访问口令的会话级暂存 key（sessionStorage，不进 URL、不落盘持久化）
export const ACCESS_CODE_STORAGE_KEY = "storyfork-access-code";

// 作品标题取根节点正文前 12 字（导出成稿的 # 标题同样用此规则）
export function deriveTitle(content: string): string {
  return content.trim().slice(0, 12);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStoryNode(v: unknown): v is StoryNode {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    (v.parentId === null || typeof v.parentId === "string") &&
    typeof v.content === "string" &&
    (v.chosenBranchTitle === null || typeof v.chosenBranchTitle === "string") &&
    Array.isArray(v.branches) &&
    Array.isArray(v.childIds) &&
    typeof v.createdAt === "number"
  );
}

function isStoryTree(v: unknown): v is StoryTreeState {
  if (!isRecord(v)) return false;
  if (typeof v.rootId !== "string" || typeof v.activeLeafId !== "string") return false;
  if (!isRecord(v.nodes)) return false;
  // 至少根节点必须在场且结构合法，防止损坏数据流入渲染
  if (!isStoryNode(v.nodes[v.rootId])) return false;
  return true;
}

function isProject(v: unknown): v is Project {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    isStoryTree(v.tree) &&
    typeof v.updatedAt === "number" &&
    typeof v.createdAt === "number"
  );
}

export function serializeProjects(projects: Project[]): string {
  return JSON.stringify(projects);
}

// 容错反序列化：损坏 JSON / 结构不合法一律不抛异常，返回空列表或过滤后的合法条目
export function deserializeProjects(raw: string | null): Project[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.filter(isProject);
}

export function loadProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    return deserializeProjects(window.localStorage.getItem(STORAGE_KEY));
  } catch (err) {
    console.warn("[storyfork] 读取作品列表失败，按空列表处理：", err);
    return [];
  }
}

// 返回是否写入成功；失败（如超出配额）时仅内存保留，不影响使用
export function saveProjects(projects: Project[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeProjects(projects));
    return true;
  } catch (err) {
    console.warn(
      "[storyfork] 保存作品失败（可能超出存储配额），本次变更仅保留在内存中：",
      err
    );
    return false;
  }
}

export function upsertProject(projects: Project[], project: Project): Project[] {
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx === -1) return [...projects, project];
  const next = [...projects];
  next[idx] = project;
  return next;
}

export function removeProject(projects: Project[], id: string): Project[] {
  return projects.filter((p) => p.id !== id);
}
