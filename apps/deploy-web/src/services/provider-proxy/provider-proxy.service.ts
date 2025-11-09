import type { HttpClient } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import { NetConfig } from "@akashnetwork/net";
import type { AxiosResponse } from "axios";
import saveFileInBrowser from "file-saver";

import { WebsocketSession } from "@src/lib/websocket/WebsocketSession";
import type { ApiProviderList } from "@src/types/provider";
import { wait } from "@src/utils/timer";
import { formatK8sEvent, formatLogMessage } from "./logFormatters";

// @see https://www.rfc-editor.org/rfc/rfc6455.html#page-46
export const WS_ERRORS = {
  VIOLATED_POLICY: 1008
};

export class ProviderProxyService {
  static readonly BEFORE_SEND_MANIFEST_DELAY = 5000;

  constructor(
    private readonly axios: HttpClient,
    private readonly logger: LoggerService,
    private readonly createWebSocket: () => WebSocket,
    private readonly saveFile: (data: Blob | string, filename?: string) => void = saveFileInBrowser,
    private readonly netConfig: NetConfig = new NetConfig()
  ) {}

  request<T>(url: string, options: ProviderProxyPayload): Promise<AxiosResponse<T>> {
    const { chainNetwork, providerIdentity, timeout, credentials, ...params } = options;
    return this.axios.post(
      "/",
      {
        ...params,
        method: options.method || "GET",
        url: providerIdentity.hostUri + url,
        providerAddress: providerIdentity.owner,
        network: this.netConfig.mapped(options.chainNetwork),
        auth: credentials ? providerCredentialsToApiCredentials(credentials) : undefined
      },
      { timeout }
    );
  }

  async sendManifest(providerInfo: ApiProviderList | undefined | null, manifest: unknown, options: SendManifestToProviderOptions) {
    if (!providerInfo) return;
    this.logger.info({ event: "START_SEND_MANIFEST", providerAddress: providerInfo.owner, dseq: options.dseq });

    const jsonStr = JSON.stringify(manifest, (_, value) => {
      if (typeof value !== "object" || value === null || !("quantity" in value)) return value;

      const { quantity, ...rest } = value;
      if (typeof quantity !== "object" || quantity === null || !("val" in quantity)) return value;
      return { ...rest, size: quantity };
    });

    // Waiting for provider to have lease
    await wait(ProviderProxyService.BEFORE_SEND_MANIFEST_DELAY);

    let response: AxiosResponse | undefined;

    for (let i = 1; i <= 3 && !response; i++) {
      this.logger.info({ event: "ATTEMPT_SEND_MANIFEST", attempt: i, providerAddress: providerInfo.owner, dseq: options.dseq });
      try {
        if (!response) {
          response = await this.request(`/deployment/${options.dseq}/manifest`, {
            method: "PUT",
            credentials: options.credentials,
            body: jsonStr,
            timeout: 60_000,
            providerIdentity: providerInfo,
            chainNetwork: options.chainNetwork
          });
          this.logger.info({ event: "SEND_MANIFEST_SUCCESS", response, providerAddress: providerInfo.owner, dseq: options.dseq });
        }
      } catch (err) {
        if (typeof err === "string" && err.indexOf("no lease for deployment") !== -1 && i < 3) {
          this.logger.info({
            event: "LEASE_NOT_FOUND",
            error: err,
            message: "Lease not found, retrying...",
            providerAddress: providerInfo.owner,
            dseq: options.dseq
          });
          await wait(ProviderProxyService.BEFORE_SEND_MANIFEST_DELAY + 1000);
        } else {
          this.logger.error({ event: "SEND_MANIFEST_ERROR", error: err, providerAddress: providerInfo.owner, dseq: options.dseq });
          throw err;
        }
      }
    }

    // Waiting for provider to boot up workload
    await wait(5000);

    return response;
  }

  async downloadLogs(input: {
    providerBaseUrl: string;
    providerAddress: string;
    providerCredentials: ProviderCredentials;
    dseq: string;
    gseq: number;
    oseq: number;
    type: "logs" | "events";
    chainNetwork: string;
    signal?: AbortSignal;
  }): Promise<DownloadMessagesResult> {
    const abortController = new AbortController();
    const logsStream = this.getLogsStream({
      ...input,
      follow: false,
      tail: 10000000,
      signal: input.signal ? AbortSignal.any([abortController.signal, input.signal]) : abortController.signal
    });
    let abortTimerId: NodeJS.Timeout | undefined;
    const scheduleAbortTimeout = () => {
      if (abortTimerId) clearTimeout(abortTimerId);
      abortTimerId = setTimeout(() => abortController.abort(), 3_000);
    };

    scheduleAbortTimeout();
    let logFileContent = "";
    for await (const logEntry of logsStream) {
      scheduleAbortTimeout();

      if (logEntry.closed) {
        clearTimeout(abortTimerId);
        break;
      }
      if (!logEntry.message) continue;

      const logMessage = input.type === "logs" ? formatLogMessage(logEntry.message as LogEntryMessage) : formatK8sEvent(logEntry.message as K8sEventMessage);
      logFileContent += logMessage + "\n";
    }

    if (input.signal?.aborted) {
      return { ok: false, code: "cancelled" };
    }

    if (logFileContent) {
      const fileName = `${input.dseq}-${input.gseq}-${input.oseq}-${input.type}-${new Date().toISOString().substring(0, 10)}.txt`;
      this.saveFile(new Blob([logFileContent], { type: "text/plain" }), fileName);
      return { ok: true };
    }
    return { ok: false, code: "unknown", message: "No log content received from server" };
  }

  async downloadFileFromShell(input: {
    providerBaseUrl: string;
    providerAddress: string;
    providerCredentials: ProviderCredentials;
    dseq: string;
    gseq: number;
    oseq: number;
    chainNetwork: string;
    signal?: AbortSignal;
    service: string;
    filePath: string;
  }): Promise<DownloadMessagesResult> {
    const printCommand = "cat"; // print command on Windows is "type"
    const session = this.connectToShell({ ...input, command: `${printCommand} ${input.filePath}` });

    session.send(new Uint8Array());

    const textDecoder = new TextDecoder("utf-8");
    let fileContent: Uint8Array | null = null;
    let exitCode: unknown;
    let errorMessage = "";

    for await (const message of session.receive()) {
      if (!message.message?.data) continue;

      const bufferData = new Uint8Array(message.message.data.slice(1));
      const stringData = textDecoder.decode(bufferData).trim();

      if (stringData[0] === "{" && stringData[stringData.length - 1] === "}" && stringData.includes('"exit_code"')) {
        try {
          const jsonData = JSON.parse(stringData);
          exitCode = jsonData["exit_code"];
          errorMessage = jsonData["message"];
        } catch {
          // empty
        }
      }

      if (exitCode !== undefined) {
        if (exitCode !== 0) {
          errorMessage = fileContent ? textDecoder.decode(fileContent!).trim() : "Did not receive file content from server";
          fileContent = null;
          this.logger.error({ event: "DOWNLOAD_FILE_FROM_SHELL_ERROR", error: errorMessage });
        } else if (fileContent) {
          this.logger.info({ event: "DOWNLOAD_FILE_FROM_SHELL_SUCCESS", length: fileContent.length });
        }

        session.disconnect();
        break;
      }

      if (!fileContent) {
        this.logger.info({ event: "DOWNLOAD_FILE_FROM_SHELL_INIT" });
        fileContent = bufferData;
      } else {
        this.logger.info({ event: "DOWNLOAD_FILE_FROM_SHELL_APPEND", length: fileContent.length });
        const newFileContent: Uint8Array = new Uint8Array(fileContent.length + bufferData.length);
        newFileContent.set(fileContent, 0);
        newFileContent.set(bufferData, fileContent.length);
        fileContent = newFileContent;
      }
    }

    if (input.signal?.aborted) {
      return { ok: false, code: "cancelled" };
    }

    if (fileContent) {
      this.logger.info({ event: "DOWNLOAD_FILE_FROM_SHELL_SUCCESS" });
      const fileName = input.filePath.replace(/^.*[\\/]/, "");
      this.saveFile(new Blob([fileContent as BlobPart]), fileName);
      return { ok: true };
    }

    if (errorMessage) {
      this.logger.error({ event: "DOWNLOAD_FILE_FROM_SHELL_ERROR", error: errorMessage });
      return { ok: false, code: "unknown", message: errorMessage };
    }

    return { ok: false, code: "unknown", message: "No file content received from server" };
  }

  async *getLogsStream<T extends "logs" | "events">(input: {
    providerBaseUrl: string;
    providerAddress: string;
    providerCredentials: ProviderCredentials;
    dseq: string;
    gseq: number;
    oseq: number;
    type: T;
    chainNetwork: string;
    follow?: boolean;
    tail?: number;
    signal?: AbortSignal;
    services?: string[];
  }): AsyncGenerator<T extends "logs" ? ProviderProxyMessage<LogEntryMessage> : ProviderProxyMessage<K8sEventMessage>> {
    const tail = input.tail ? `&tail=${input.tail}` : "";
    const url = `${providerLeaseUrl(input)}?follow=${input.follow ? "true" : "false"}${tail}${input.services ? `&service=${input.services.join(",")}` : ""}`;

    const session = new WebsocketSession<undefined, T extends "logs" ? ProviderProxyMessage<LogEntryMessage> : ProviderProxyMessage<K8sEventMessage>>({
      websocketFactory: this.createWebSocket,
      shouldRetry: error => !error.cause || !isInvalidProviderCertificate(error.cause as CloseEvent),
      signal: input.signal,
      transformSentMessage: () =>
        JSON.stringify({
          type: "websocket",
          url,
          auth: providerCredentialsToApiCredentials(input.providerCredentials),
          chainNetwork: this.netConfig.mapped(input.chainNetwork),
          providerAddress: input.providerAddress
        }),
      transformReceivedMessage: rawMessage => {
        const message = JSON.parse(rawMessage as string);
        if (!message.message) return message;

        return {
          ...message,
          message: JSON.parse(message.message)
        };
      }
    });

    session.send(undefined);

    return yield* session.receive();
  }

  connectToShell(input: {
    providerBaseUrl: string;
    providerAddress: string;
    providerCredentials: ProviderCredentials;
    dseq: string;
    gseq: number;
    oseq: number;
    chainNetwork: string;
    service: string;
    useStdIn?: boolean;
    useTTY?: boolean;
    command?: string;
    signal?: AbortSignal;
  }): WebsocketSession<Uint8Array, ReceivedShellMessage> {
    const command = (input.command || "/bin/sh")
      .split(" ")
      .map((c, i) => `&cmd${i}=${encodeURIComponent(c.replace(" ", "+"))}`)
      .join("");
    const url = `${providerLeaseUrl({ ...input, type: "shell" })}?stdin=${input.useStdIn ? "1" : "0"}&tty=${input.useTTY ? "1" : "0"}&podIndex=0&${command}&service=${encodeURIComponent(input.service)}`;

    return new WebsocketSession<Uint8Array, ReceivedShellMessage>({
      websocketFactory: this.createWebSocket,
      shouldRetry: error => !error.cause || !isInvalidProviderCertificate(error.cause as CloseEvent),
      signal: input.signal,
      transformSentMessage: message => {
        const remoteMessage: Record<string, unknown> = {
          type: "websocket",
          url,
          auth: providerCredentialsToApiCredentials(input.providerCredentials),
          chainNetwork: this.netConfig.mapped(input.chainNetwork),
          providerAddress: input.providerAddress
        };

        if (message.length > 0) {
          remoteMessage.data = message.toString();
        }

        return JSON.stringify(remoteMessage);
      }
    });
  }
}

function providerLeaseUrl(input: { providerBaseUrl: string; dseq: string; gseq: number; oseq: number; type: "logs" | "events" | "shell" }): string {
  const type = input.type === "events" ? "kubeevents" : input.type;
  return `${input.providerBaseUrl}/lease/${input.dseq}/${input.gseq}/${input.oseq}/${type}`;
}

export interface ReceivedShellMessage {
  message?: {
    data: number[];
  };
  error?: string;
  closed?: boolean;
}

export interface ProviderProxyPayload {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  credentials?: ProviderCredentials | null;
  body?: string;
  timeout?: number;
  chainNetwork: string;
  providerIdentity: ProviderIdentity;
}

export interface ProviderIdentity {
  owner: string;
  hostUri: string;
}

export interface SendManifestToProviderOptions {
  dseq: string;
  credentials?: ProviderCredentials | null;
  chainNetwork: string;
}

export type ProviderCredentials =
  | {
      type: "mtls";
      value:
        | {
            cert: string;
            key: string;
          }
        | null
        | undefined;
    }
  | {
      type: "jwt";
      value: string | undefined | null;
    };

export type ProviderApiCredentials =
  | {
      type: "mtls";
      certPem: string;
      keyPem: string;
    }
  | {
      type: "jwt";
      token: string;
    };
export function providerCredentialsToApiCredentials(credentials: ProviderCredentials | null | undefined): ProviderApiCredentials | undefined {
  if (!credentials?.value) return;
  if (credentials.type === "mtls")
    return {
      type: credentials.type,
      certPem: credentials.value.cert,
      keyPem: credentials.value.key
    };
  return {
    type: credentials.type,
    token: credentials.value
  };
}

export interface DownloadMessagesOptions {
  providerAddress: string;
  providerCredentials: ProviderCredentials;
  chainNetwork: string;
  onMessage(event: MessageEvent<string>, state: DownloadState, ws: WebSocket): void;
  start?(state: DownloadState, ws: WebSocket): void;
  signal?: AbortSignal;
}

interface DownloadState {
  isFinished: boolean;
  isCancelled: boolean;
}

export type DownloadMessagesResult = { ok: false; code: "cancelled" | "unknown"; message?: string } | { ok: true };

function isInvalidProviderCertificate(event: Record<string, any>): boolean {
  return "code" in event && "reason" in event && event.code === WS_ERRORS.VIOLATED_POLICY && event.reason.startsWith("invalidCertificate.");
}

export interface ProviderProxyMessage<T> {
  closed?: boolean;
  message?: T;
}

export interface LogEntryMessage {
  name: string;
  message: string;
  service: string;
}

export interface K8sEventMessage {
  message: string;
  note: string;
  reason: string;
  type: string;
  object?: {
    kind: string;
    name: string;
    namespace: string;
  };
  service: string;
  reportingController: string;
  reportingInstance: string;
}
