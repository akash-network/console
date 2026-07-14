import { isIP } from "node:net";
import { Err, Ok, Result } from "ts-results";
import { inject, singleton } from "tsyringe";
import { WebSocket } from "ws";

import { LoggerService } from "@src/core";
import { DEPLOYMENT_CONFIG, type DeploymentConfig } from "@src/deployment/config/config.provider";

const MAX_OUTPUT_SIZE = 1024 * 1024;

/**
 * LeaseShell protocol markers. The provider prefixes every shell frame with a
 * single marker byte, mirroring `LeaseShellCode` in the web client
 * (`apps/deploy-web/src/types/shell.ts`).
 */
const LeaseShellCode = {
  Stdout: 100,
  Stderr: 101,
  Result: 102,
  Failure: 103,
  Stdin: 104
} as const;

export type ShellExecInput = {
  providerBaseUrl: string;
  providerAddress: string;
  dseq: string;
  gseq: number;
  oseq: number;
  service: string;
  command: string[];
  timeout: number;
  jwtToken: string;
  /**
   * Optional data piped to the command's standard input. Kept out of the URL/argv
   * (which the provider-proxy logs) and streamed as `104` LeaseShellCodeStdin
   * frames instead, so secrets never touch the logged request URL.
   */
  stdin?: string;
};

export type ShellExecOutput = {
  stdout: string;
  stderr: string;
  exitCode: number;
  truncated: boolean;
};

type ProviderBufferMessage = {
  type?: string;
  data?: number[] | string;
};

type ReceivedMessage = {
  type?: string;
  message?: string | number[] | ProviderBufferMessage | null;
  closed?: boolean;
  code?: number;
  reason?: string | number[] | { data?: number[] } | null;
  error?: unknown;
  errors?: Array<{ path?: Array<string | number>; message?: string }>;
};

type WebSocketOutgoingMessage = {
  type: "websocket";
  url: string;
  auth: { type: "jwt"; token: string };
  providerAddress: string;
  isBase64: boolean;
};

// A post-connect frame carries a base64 `data` payload alongside the full
// envelope. The provider-proxy re-validates the envelope on every frame, so the
// url/auth/providerAddress fields must be resent, not just `data`.
type WebSocketDataMessage = WebSocketOutgoingMessage & { data: string };

@singleton()
export class ShellExecService {
  private readonly proxyWsUrl: string;

  constructor(
    @inject(DEPLOYMENT_CONFIG) config: DeploymentConfig,
    private readonly logger: LoggerService
  ) {
    this.proxyWsUrl = toProxyWebSocketUrl(config.PROVIDER_PROXY_URL);
    this.logger.setContext(ShellExecService.name);
  }

  async execute(input: ShellExecInput): Promise<Result<ShellExecOutput, string>> {
    if (!isValidProviderHost(input.providerBaseUrl)) {
      return Err(`Invalid provider host: ${input.providerBaseUrl}`);
    }

    const providerUrl = buildShellUrl(input);
    const auth = { type: "jwt" as const, token: input.jwtToken };

    return new Promise(resolve => {
      let settled = false;
      const settle = (result: Result<ShellExecOutput, string>) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(result);
      };

      let stdout = "";
      let stderr = "";
      let outputBytes = 0;
      let exitCode: number | undefined;
      let truncated = false;

      // Connect to the provider-proxy (NOT the provider): no Authorization header,
      // the provider credentials travel inside the envelope instead.
      const ws = new WebSocket(this.proxyWsUrl);

      const timeoutId = setTimeout(() => {
        settle(Err("Command timed out"));
        ws.close();
      }, input.timeout * 1000);

      ws.on("open", () => {
        // Connect frame. Omit `data`: with `stdin=0` the command runs one-shot
        // from the URL query params, and the proxy's `!message.data` guard still
        // opens and links the provider socket.
        const message: WebSocketOutgoingMessage = {
          type: "websocket",
          url: providerUrl,
          auth,
          providerAddress: input.providerAddress,
          isBase64: true
        };
        ws.send(JSON.stringify(message));

        // Task 2b: stream any stdin as `104` LeaseShellCodeStdin frames instead
        // of embedding secrets in the (logged) URL/argv. The provider-proxy
        // queues data frames until the provider socket is verified, so no fixed
        // settle delay is needed here. Each frame resends the full envelope
        // (url/auth/providerAddress) with a base64 `data` payload.
        if (input.stdin && input.stdin.length > 0) {
          const sendData = (payload: Buffer) => {
            const dataMessage: WebSocketDataMessage = { ...message, data: payload.toString("base64") };
            ws.send(JSON.stringify(dataMessage));
          };
          // Marker byte 104 prefixes the raw UTF-8 stdin bytes.
          sendData(Buffer.concat([Buffer.from([LeaseShellCode.Stdin]), Buffer.from(input.stdin, "utf-8")]));
          // EOF: a bare `104` marker with no payload closes stdin so the command
          // (e.g. `cat`) sees end-of-input and can exit.
          sendData(Buffer.from([LeaseShellCode.Stdin]));
        }
      });

      const appendOutput = (marker: number, text: string) => {
        if (truncated) return;
        // Enforce the cap in UTF-8 bytes (not UTF-16 code units) so multi-byte
        // output is accounted for by its true wire size.
        const chunkBytes = Buffer.byteLength(text, "utf8");
        if (outputBytes + chunkBytes <= MAX_OUTPUT_SIZE) {
          outputBytes += chunkBytes;
          if (marker === LeaseShellCode.Stdout) {
            stdout += text;
          } else {
            stderr += text;
          }
        } else {
          // M5: stop appending once over the cap, but keep reading so the
          // exit/close frame still arrives and `exitCode` stays accurate.
          truncated = true;
        }
      };

      const handleClose = (code?: number, reason?: string) => {
        if (isAuthExpiryClose(code, reason)) {
          settle(Err(`Auth expired: provider closed connection${code !== undefined ? ` (code ${code})` : ""}`));
          return;
        }
        if (exitCode !== undefined) {
          settle(Ok({ stdout, stderr, exitCode, truncated }));
        } else {
          settle(Err("Connection closed without exit code"));
        }
      };

      ws.on("message", (raw: Buffer) => {
        let message: ReceivedMessage;
        try {
          message = JSON.parse(raw.toString()) as ReceivedMessage;
        } catch {
          // Non-JSON frame: ignore.
          return;
        }

        // 1. Filter keepalives and unknown frame types.
        if (message.type === "pong") return;
        if (message.type !== undefined && message.type !== "websocket") return;

        // 2. Error BEFORE decode (M1). The proxy reports failures as a
        // `type:"websocket"` frame carrying an `error` key — never decode it.
        if (message.error !== undefined && message.error !== null && message.error !== "") {
          settle(Err(`Provider error: ${flattenError(message)}`));
          ws.close();
          return;
        }

        if (message.closed) {
          handleClose(message.code, reasonToString(message.reason));
          ws.close();
          return;
        }

        // 3. Decode payload. `message.message.data` is either a byte list (Node
        // Buffer -> JSON) or a base64 string.
        const inner = message.message;
        const rawData = Array.isArray(inner) ? inner : inner && typeof inner === "object" ? (inner as ProviderBufferMessage).data : undefined;

        let bytes: Buffer;
        if (Array.isArray(rawData)) {
          bytes = Buffer.from(rawData);
        } else if (typeof rawData === "string") {
          if (!isStrictBase64(rawData)) {
            // Never dispatch a non-base64 prose frame as fake output.
            this.logger.warn({ event: "SHELL_EXEC_INVALID_BASE64", length: rawData.length });
            return;
          }
          bytes = Buffer.from(rawData, "base64");
        } else {
          return;
        }

        if (bytes.length === 0) return;

        // 4. Marker dispatch (M2). marker = data[0]; payload = data.slice(1).
        const marker = bytes[0];
        const payload = bytes.subarray(1);

        switch (marker) {
          case LeaseShellCode.Stdout:
          case LeaseShellCode.Stderr:
            appendOutput(marker, payload.toString("utf-8"));
            return;
          case LeaseShellCode.Result:
            // M3: exit code is either JSON `{"exit_code":N}` or a 4-byte LE int32.
            exitCode = parseExitCode(payload);
            settle(Ok({ stdout, stderr, exitCode, truncated }));
            ws.close();
            return;
          case LeaseShellCode.Failure: {
            // M2: distinct provider-error end state, not output.
            const detail = payload.toString("utf-8").trim();
            settle(Err(`Provider error: shell failure${detail ? `: ${detail}` : ""}`));
            ws.close();
            return;
          }
          default:
            // Unknown marker (e.g. stdin/resize echoes) — ignore.
            return;
        }
      });

      ws.on("error", err => {
        settle(Err(`WebSocket connection failed: ${err.message}`));
        ws.close();
      });

      ws.on("close", (code?: number, reason?: Buffer) => {
        handleClose(code, reason ? reason.toString() : undefined);
      });
    });
  }
}

/** Maps an http(s) proxy URL to its ws(s) equivalent. */
export function toProxyWebSocketUrl(url: string): string {
  return url.replace(/^http/, "ws");
}

/**
 * The provider-proxy silently rejects a lease-shell URL that is not https or
 * that points at an IP / `.local` host. Pre-check so we can surface a clear
 * error instead of a mystery timeout.
 */
export function isValidProviderHost(hostUri: string): boolean {
  try {
    const parsed = new URL(hostUri);
    const hostname = parsed.hostname.startsWith("[") ? parsed.hostname.slice(1, -1) : parsed.hostname;
    return parsed.protocol === "https:" && !hostname.endsWith(".local") && !isIP(hostname);
  } catch {
    return false;
  }
}

/**
 * Builds the provider lease-shell URL consumed by the proxy as the envelope
 * `url`. Each argv token maps to one `cmdN` query param; the provider execs the
 * tokens as argv with no shell re-interpretation of its own.
 */
export function buildShellUrl(input: Pick<ShellExecInput, "providerBaseUrl" | "dseq" | "gseq" | "oseq" | "service" | "command" | "stdin">): string {
  const cmdParts = input.command.map((arg, i) => `&cmd${i}=${encodeURIComponent(arg)}`).join("");
  const baseUrl = input.providerBaseUrl.replace(/\/$/, "");
  // `stdin=1` opens the provider stdin channel so `104` frames are accepted; the
  // payload itself is NEVER placed in the URL (it would be logged by the proxy).
  const stdinFlag = input.stdin && input.stdin.length > 0 ? 1 : 0;
  return `${baseUrl}/lease/${encodeURIComponent(input.dseq)}/${input.gseq}/${input.oseq}/shell?stdin=${stdinFlag}&tty=0&podIndex=0&service=${encodeURIComponent(input.service)}${cmdParts}`;
}

/**
 * Parses the exit-code payload of a `102` result frame. Providers use one of two
 * encodings (version-dependent): a JSON body `{"exit_code":N}` or a raw 4-byte
 * little-endian int32. `null` and missing codes map to 0.
 */
export function parseExitCode(payload: Buffer): number {
  const text = payload.toString("utf-8").trim();

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as { exit_code?: unknown };
      const code = parsed?.exit_code;
      // Successfully parsed JSON body: a null/absent/non-numeric code maps to 0.
      return typeof code === "number" && Number.isFinite(code) ? code : 0;
    } catch {
      // Malformed JSON that only happens to start with "{" (e.g. a 4-byte LE
      // int32 whose first byte is 0x7B) — fall through to the binary encoding.
    }
  }

  if (payload.length >= 4) return payload.readInt32LE(0);
  return 0;
}

/** Strict base64 validation so prose frames are dropped, not decoded as output. */
export function isStrictBase64(value: string): boolean {
  if (value.length === 0 || value.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]*={0,2}$/.test(value);
}

function isAuthExpiryClose(code?: number, reason?: string): boolean {
  if (code === 4001 || code === 4003) return true;
  if (reason && /expired|unauthorized/i.test(reason)) return true;
  return false;
}

function reasonToString(reason: ReceivedMessage["reason"]): string | undefined {
  if (reason === undefined || reason === null) return undefined;
  if (typeof reason === "string") return reason;
  if (Array.isArray(reason)) return Buffer.from(reason).toString("utf-8");
  if (Array.isArray(reason.data)) return Buffer.from(reason.data).toString("utf-8");
  return undefined;
}

/** Flattens a proxy error frame, including any Zod-style `errors[].path: message`. */
function flattenError(message: ReceivedMessage): string {
  const base = typeof message.error === "string" ? message.error : JSON.stringify(message.error);
  if (Array.isArray(message.errors) && message.errors.length > 0) {
    const flat = message.errors
      .map(issue => {
        const path = Array.isArray(issue?.path) ? issue.path.join(".") : "";
        return path ? `${path}: ${issue?.message ?? ""}` : `${issue?.message ?? ""}`;
      })
      .filter(Boolean)
      .join("; ");
    if (flat) return `${base} (${flat})`;
  }
  return base;
}
