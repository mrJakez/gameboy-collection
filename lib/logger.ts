type Level = "info" | "warn" | "error";

interface LogEntry {
  ts: string;
  level: Level;
  [key: string]: unknown;
}

function emit(level: Level, data: Record<string, unknown>) {
  const entry: LogEntry = { ts: new Date().toISOString(), level, ...data };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (data: Record<string, unknown>) => emit("info", data),
  warn: (data: Record<string, unknown>) => emit("warn", data),
  error: (data: Record<string, unknown>) => emit("error", data),

  action: (action: string, extra?: Record<string, unknown>) =>
    emit("info", { type: "action", action, ...extra }),

  access: (method: string, path: string, status: number, extra?: Record<string, unknown>) =>
    emit("info", { type: "access", method, path, status, ...extra }),
};
