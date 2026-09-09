export type MemoryLayer = "SHORT_TERM" | "CONVERSATION" | "LONG_TERM";

export interface MemoryRecord {
  layer: MemoryLayer;
  scope: string;
  ownerId: string;
  source: string;
  confidence: number;
  content: string;
}
