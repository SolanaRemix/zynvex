export const MEMORY_TYPES = ["PROFILE", "PREFERENCE", "PROJECT", "FACT", "TASK", "DECISION", "CONTEXT"] as const;
export const MEMORY_POLICIES = ["NEVER_SAVE", "ASK_FIRST", "AUTO_SAVE_LOW_RISK"] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];
export type MemoryPolicy = (typeof MEMORY_POLICIES)[number];

export interface MemoryRecord {
  id?: string;
  scope: string;
  ownerId: string;
  agentId?: string | null;
  projectId?: string | null;
  type: MemoryType;
  policy: MemoryPolicy;
  source: string;
  confidence: number;
  content: string;
  metadata?: Record<string, unknown> | null;
  expiresAt?: Date | null;
}

export function canAutoSaveMemory(record: Pick<MemoryRecord, "policy" | "confidence" | "type">) {
  if (record.policy === "NEVER_SAVE") return false;
  if (record.policy === "ASK_FIRST") return false;
  return record.confidence >= 0.5 && record.type !== "PROFILE";
}

export function memoryExpires(record: Pick<MemoryRecord, "expiresAt">, now = new Date()) {
  return Boolean(record.expiresAt && record.expiresAt.getTime() <= now.getTime());
}

export function searchMemories<T extends Pick<MemoryRecord, "content" | "type" | "scope">>(
  memories: T[],
  query: string,
  types?: MemoryType[]
) {
  const lowered = query.trim().toLowerCase();
  const allowedTypes = types ? new Set(types) : null;

  return memories.filter((memory) => {
    if (allowedTypes && !allowedTypes.has(memory.type as MemoryType)) return false;
    return memory.content.toLowerCase().includes(lowered) || memory.scope.toLowerCase().includes(lowered);
  });
}
