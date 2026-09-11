import { inject, singleton } from "tsyringe";

import { decodeProviderFrame, parseShellExit, type ProviderFrame } from "@src/workload-abuse/lib/provider-frame/provider-frame";
import { truncateToUtf8Bytes } from "@src/workload-abuse/lib/utf8-text/utf8-text";
import {
  PROVIDER_PROXY_SOCKET_FACTORY,
  type ProviderProxySocketEvent,
  type ProviderProxySocketFactory
} from "@src/workload-abuse/providers/provider-proxy-socket.provider";

export type ProviderStreamStatus =
  | "completed"
  | "idle_timeout"
  | "hard_timeout"
  | "output_capped"
  | "token_expired"
  | "invalid_certificate"
  | "proxy_error"
  | "connection_error";

export type CollectedFrame = Extract<ProviderFrame, { kind: "shell" | "text" }>;

export type ProviderStreamResult = {
  status: ProviderStreamStatus;
  frames: CollectedFrame[];
  exitCode?: number;
  closeCode?: number;
  closeReason?: string;
  error?: string;
};

export type ProviderStreamInput = {
  url: string;
  providerAddress: string;
  token: string;
  idleTimeoutMs: number;
  hardTimeoutMs: number;
  maxBytes: number;
};

const INVALID_CERTIFICATE_REASON_PREFIX = "invalidCertificate";
const TOKEN_EXPIRED_ERROR = "tokenExpired";

/** Collects one provider stream to completion through provider-proxy, whose opening message must carry no `data` because the proxy dials the provider on it. */
@singleton()
export class ProviderStreamService {
  constructor(@inject(PROVIDER_PROXY_SOCKET_FACTORY) private readonly createSocket: ProviderProxySocketFactory) {}

  collect(input: ProviderStreamInput): Promise<ProviderStreamResult> {
    return new Promise(resolve => {
      const socket = this.createSocket();
      const frames: CollectedFrame[] = [];
      let collectedBytes = 0;
      let exitCode: number | undefined;
      let settled = false;
      let idleTimer: NodeJS.Timeout | undefined;

      const finish = (status: ProviderStreamStatus, extra: Pick<ProviderStreamResult, "closeCode" | "closeReason" | "error"> = {}) => {
        if (settled) return;
        settled = true;
        clearTimeout(idleTimer);
        clearTimeout(hardTimer);
        try {
          socket.close();
        } catch {
          return resolve({ status, frames, exitCode, ...extra });
        }
        resolve({ status, frames, exitCode, ...extra });
      };

      const hardTimer = setTimeout(() => finish("hard_timeout"), input.hardTimeoutMs);
      const armIdleTimer = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => finish("idle_timeout"), input.idleTimeoutMs);
      };

      socket.addEventListener("open", () => {
        socket.send(
          JSON.stringify({
            type: "websocket",
            url: input.url,
            providerAddress: input.providerAddress,
            auth: { type: "jwt", token: input.token },
            isBase64: true
          })
        );
        armIdleTimer();
      });

      socket.addEventListener("message", (event: ProviderProxySocketEvent) => {
        if (settled) return;

        const raw = toText(event.data);
        if (raw === undefined) return;

        const frame = decodeProviderFrame(raw);
        if (frame.kind === "ignore") return;

        armIdleTimer();

        if (frame.kind === "error") return finish(frame.error === TOKEN_EXPIRED_ERROR ? "token_expired" : "proxy_error", { error: frame.error });
        if (frame.kind === "closed") {
          const status = frame.reason?.startsWith(INVALID_CERTIFICATE_REASON_PREFIX) ? "invalid_certificate" : "completed";
          return finish(status, { closeCode: frame.code, closeReason: frame.reason });
        }

        const payloadBytes = Buffer.byteLength(frame.payload, "utf8");
        const remainingBytes = input.maxBytes - collectedBytes;

        if (payloadBytes > remainingBytes) {
          frames.push({ ...frame, payload: truncateToUtf8Bytes(frame.payload, remainingBytes) });
          return finish("output_capped");
        }

        frames.push(frame);
        collectedBytes += payloadBytes;

        if (frame.kind === "shell" && frame.stream === "result") {
          exitCode = parseShellExit(frame.payload)?.exitCode;
          return finish("completed");
        }

        if (collectedBytes >= input.maxBytes) finish("output_capped");
      });

      socket.addEventListener("close", event => finish("connection_error", { closeCode: event.code, closeReason: event.reason }));
      socket.addEventListener("error", () => finish("connection_error"));
    });
  }
}

function toText(data: unknown): string | undefined {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return undefined;
}
