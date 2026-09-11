export type ShellStream = "stdout" | "stderr" | "result" | "failure" | "unknown";

/** Akash provider shell frames carry the stream in their first byte and the payload after it. */
const SHELL_STREAM_BY_CODE: Record<number, ShellStream> = { 100: "stdout", 101: "stderr", 102: "result", 103: "failure" };

export type ProviderFrame =
  | { kind: "shell"; stream: ShellStream; payload: string }
  | { kind: "text"; payload: string }
  | { kind: "closed"; code?: number; reason?: string }
  | { kind: "error"; error: string }
  | { kind: "ignore" };

const IGNORED_FRAME: ProviderFrame = { kind: "ignore" };

/** Decodes one provider-proxy client message, where binary provider frames arrive as a JSON-serialized Buffer, text frames as a plain string, and proxy outcomes as `closed` / `error`. */
export function decodeProviderFrame(raw: string): ProviderFrame {
  const parsed = parseJson(raw);
  if (!isRecord(parsed)) return IGNORED_FRAME;
  if (parsed.type === "ping" || parsed.type === "pong") return IGNORED_FRAME;
  if (typeof parsed.error === "string") return { kind: "error", error: parsed.error };
  if (parsed.closed === true) {
    return {
      kind: "closed",
      code: typeof parsed.code === "number" ? parsed.code : undefined,
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined
    };
  }

  const message = parsed.message;
  if (typeof message === "string") return message.length > 0 ? { kind: "text", payload: message } : IGNORED_FRAME;

  if (isRecord(message) && message.type === "Buffer" && Array.isArray(message.data)) {
    const bytes = Buffer.from(message.data as number[]);
    if (bytes.length === 0) return IGNORED_FRAME;
    return { kind: "shell", stream: SHELL_STREAM_BY_CODE[bytes[0]] ?? "unknown", payload: bytes.subarray(1).toString("utf8") };
  }

  return IGNORED_FRAME;
}

export function parseShellExit(payload: string): { exitCode: number; message?: string } | undefined {
  const parsed = parseJson(payload.trim());
  if (!isRecord(parsed) || typeof parsed.exit_code !== "number") return undefined;

  return { exitCode: parsed.exit_code, message: typeof parsed.message === "string" ? parsed.message : undefined };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
