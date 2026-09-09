export type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };

  const json = JSON.stringify(record);
  if (level === "error") {
    console.error(json);
    return;
  }

  console.log(json);
}
