import { Err, Ok, Result } from "ts-results";
import { singleton } from "tsyringe";
import { WebSocket } from "ws";

const MAX_OUTPUT_SIZE = 1024 * 1024;

export type ShellExecInput = {
  providerBaseUrl: string;
  providerAddress: string;
  dseq: string;
  gseq: number;
  oseq: number;
  service: string;
  command: string;
  timeout: number;
  jwtToken: string;
};

export type ShellExecOutput = {
  stdout: string;
  stderr: string;
  exitCode: number;
  truncated: boolean;
};

@singleton()
export class ShellExecService {
  constructor() {}

  async execute(input: ShellExecInput): Promise<Result<ShellExecOutput, string>> {
    const url = buildShellUrl(input);
    const auth = { type: "jwt" as const, token: input.jwtToken };

    return new Promise(resolve => {
      const timeoutId = setTimeout(() => {
        ws.close();
        resolve(Err("Command timed out"));
      }, input.timeout * 1000);

      let stdout = "";
      let stderr = "";
      let exitCode: number | undefined;
      let truncated = false;

      const ws = new WebSocket(url, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });

      ws.on("open", () => {
        const message: WebSocketOutgoingMessage = {
          type: "websocket",
          url,
          auth,
          providerAddress: input.providerAddress,
          isBase64: true
        };
        ws.send(JSON.stringify(message));
      });

      ws.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as ReceivedMessage;

          if (message.type === "pong") {
            return;
          }

          if (message.type === "websocket" && message.message) {
            if (typeof message.message === "string") {
              const parsed = parseShellMessage(message.message);
              if (parsed) {
                if (parsed.type === "exit_code") {
                  exitCode = parsed.exit_code;
                  clearTimeout(timeoutId);
                  ws.close();
                } else if (parsed.type === "data" && parsed.data) {
                  if (truncated) {
                    return;
                  }
                  const output = parsed.data;
                  if (output.length + stdout.length + stderr.length <= MAX_OUTPUT_SIZE) {
                    if (parsed.stream === "stdout") {
                      stdout += output;
                    } else {
                      stderr += output;
                    }
                  } else {
                    truncated = true;
                  }
                }
              }
            } else if (Array.isArray(message.message)) {
              const messageData = message.message;
              if (messageData.length > 1) {
                const firstByte = messageData[0];
                const payload = messageData.slice(1);
                const textDecoder = new TextDecoder("utf-8");
                const output = textDecoder.decode(Buffer.from(payload));

                if (firstByte === 0) {
                  exitCode = 0;
                  clearTimeout(timeoutId);
                  ws.close();
                } else if (firstByte === 1) {
                  if (truncated) {
                    return;
                  }
                  if (output.length + stdout.length + stderr.length <= MAX_OUTPUT_SIZE) {
                    stdout += output;
                  } else {
                    truncated = true;
                  }
                } else if (firstByte === 2) {
                  if (truncated) {
                    return;
                  }
                  if (output.length + stderr.length + stdout.length <= MAX_OUTPUT_SIZE) {
                    stderr += output;
                  } else {
                    truncated = true;
                  }
                }
              }

              if (messageData.length === 1 && messageData[0] === 0) {
                exitCode = 0;
                clearTimeout(timeoutId);
                ws.close();
              }
            }
          }

          if (message.closed || message.error) {
            clearTimeout(timeoutId);
            if (exitCode === undefined) {
              if (message.error) {
                resolve(Err(`Provider error: ${message.error}`));
              } else {
                exitCode = 1;
              }
            }
            ws.close();
          }
        } catch {
          // Ignore parse errors
        }
      });

      ws.on("error", err => {
        clearTimeout(timeoutId);
        ws.close();
        resolve(Err(`WebSocket connection failed: ${err.message}`));
      });

      ws.on("close", () => {
        clearTimeout(timeoutId);
        if (exitCode !== undefined) {
          resolve(
            Ok({
              stdout,
              stderr,
              exitCode,
              truncated
            })
          );
        } else {
          resolve(Err("Connection closed without exit code"));
        }
      });
    });
  }
}

export function buildShellUrl(input: Pick<ShellExecInput, "providerBaseUrl" | "dseq" | "gseq" | "oseq" | "service" | "command">): string {
  const trimmed = input.command.trim();
  const cmdParts =
    trimmed.length > 0
      ? trimmed
          .split(" ")
          .filter(c => c)
          .map((c, i) => `&cmd${i}=${encodeURIComponent(c)}`)
      : [`&cmd0=`];
  const baseUrl = input.providerBaseUrl.replace(/\/$/, "");
  return `${baseUrl}/lease/${encodeURIComponent(input.dseq)}/${input.gseq}/${input.oseq}/shell?stdin=0&tty=0&podIndex=0&service=${encodeURIComponent(input.service)}${cmdParts.join("")}`;
}

export function parseShellMessage(message: string): { type: "data" | "exit_code"; data?: string; stream?: "stdout" | "stderr"; exit_code?: number } | null {
  if (message.startsWith("{")) {
    try {
      const parsed = JSON.parse(message);
      if (typeof parsed.exit_code === "number") {
        return { type: "exit_code", exit_code: parsed.exit_code };
      }
      if (typeof parsed.message === "string" && parsed.message.length > 0) {
        return { type: "data", data: parsed.message, stream: "stdout" };
      }
    } catch {
      return null;
    }
  }
  return null;
}

type WebSocketOutgoingMessage = {
  type: "websocket";
  url: string;
  auth: { type: "jwt"; token: string };
  providerAddress: string;
  isBase64: boolean;
};

type ReceivedMessage = {
  type?: string;
  message?: string | number[];
  closed?: boolean;
  error?: string;
};
