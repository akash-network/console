import type { HttpClient } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import { NetConfig } from "@akashnetwork/net";
import type { AxiosResponse } from "axios";
import saveFileInBrowser from "file-saver";

import type { ApiProviderList } from "@src/types/provider";
import { wait } from "@src/utils/timer";

export class ProviderProxyService {
  static readonly BEFORE_SEND_MANIFEST_DELAY = 5000;

  constructor(
    private readonly axios: HttpClient,
    private readonly logger: LoggerService,
    private readonly createWebSocket: () => WebSocket,
    private readonly saveFile: (data: Blob | string, filename?: string) => void = saveFileInBrowser,
    private readonly netConfig: NetConfig = new NetConfig()
  ) {}

  fetchProviderUrl<T>(url: string, options: ProviderProxyPayload): Promise<AxiosResponse<T>> {
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
          response = await this.fetchProviderUrl(`/deployment/${options.dseq}/manifest`, {
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

  private downloadMessages(url: string, options: DownloadMessagesOptions): Promise<DownloadMessagesResult> {
    return new Promise(resolve => {
      const ws = this.createWebSocket();
      const state = { isCancelled: false, isFinished: false };

      options.signal?.addEventListener(
        "abort",
        () => {
          state.isCancelled = true;
          ws.close();
        },
        { once: true }
      );

      ws.onmessage = event => {
        try {
          options.onMessage(event, state, ws);
        } catch (error) {
          this.logger.error({ event: "PROVIDER_DOWNLOAD_MESSAGES_ERROR", error });
          ws.close();
        }
      };
      ws.onclose = () => {
        if (state.isCancelled) {
          resolve({ ok: false, code: "cancelled" });
        } else if (state.isFinished) {
          resolve({ ok: true });
        } else {
          resolve({ ok: false, code: "unknown" });
          this.logger.error({ event: "PROVIDER_DOWNLOAD_MESSAGES_ERROR", error: "websocket closed with unknown reason", url });
        }
      };
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "websocket",
            url,
            auth: providerCredentialsToApiCredentials(options.providerCredentials),
            chainNetwork: options.chainNetwork,
            providerAddress: options.providerAddress
          })
        );
      };
      options.start?.(state, ws);
    });
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
    const baseUrl = `${input.providerBaseUrl}/lease/${input.dseq}/${input.gseq}/${input.oseq}`;
    const url = input.type === "logs" ? `${baseUrl}/logs?follow=false&tail=10000000` : `${baseUrl}/kubeevents?follow=false&tail=10000000`;

    let logFileContent = "";
    let lastMessageTimestamp = Date.now();
    const result = await this.downloadMessages(url, {
      signal: input.signal,
      providerAddress: input.providerAddress,
      chainNetwork: input.chainNetwork,
      providerCredentials: input.providerCredentials,
      start: (state, ws) => {
        setTimeout(function tick() {
          const elapsed = Date.now() - lastMessageTimestamp;

          if (elapsed > 3_000) {
            state.isFinished = true;
            if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
              ws.close();
            }
          } else {
            setTimeout(tick, 1_000);
          }
        }, 1_000);
      },
      onMessage: event => {
        const data = JSON.parse(event.data);
        if (data.closed || !data.message) return;

        const parsedLog = JSON.parse(data.message);

        let service: string;
        let message: string;
        if (input.type === "logs") {
          service = parsedLog?.name ? parsedLog?.name.split("-")[0] : "";
          message = `[${service}]: ${parsedLog.message}`;
        } else {
          service = parsedLog.object?.name ? parsedLog.object?.name.split("-")[0] : "";
          message = `[${service}]: [${parsedLog.type}] [${parsedLog.reason}] [${parsedLog.object?.kind}] ${parsedLog.note}`;
        }

        logFileContent += message + "\n";
        lastMessageTimestamp = Date.now();
      }
    });

    if (result.ok) {
      const fileName = `${input.dseq}-${input.gseq}-${input.oseq}-${input.type}-${new Date().toISOString().substring(0, 10)}.txt`;
      this.saveFile(new Blob([logFileContent], { type: "text/plain" }), fileName);
    }
    return result;
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
    const command = `${printCommand} ${input.filePath}`;
    const url = `${input.providerBaseUrl}/lease/${input.dseq}/${input.gseq}/${input.oseq}/shell?stdin=0&tty=0&podIndex=0${command
      .split(" ")
      .map((c, i) => `&cmd${i}=${encodeURIComponent(c.replace(" ", "+"))}`)
      .join("")}${`&service=${input.service}`}`;

    let fileContent: Uint8Array | null = null;
    let errorMessage = "";

    const textDecoder = new TextDecoder("utf-8");
    const result = await this.downloadMessages(url, {
      providerAddress: input.providerAddress,
      chainNetwork: input.chainNetwork,
      providerCredentials: input.providerCredentials,
      signal: input.signal,
      onMessage: (event, state, ws) => {
        let exitCode: unknown;
        const message = JSON.parse(event.data).message;

        const bufferData = new Uint8Array(message.data.slice(1));
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
            this.logger.info({ event: "DOWNLOAD_FILE_FROM_SHELL_ERROR", error: errorMessage });
          } else if (fileContent) {
            this.logger.info({ event: "DOWNLOAD_FILE_FROM_SHELL_SUCCESS", length: fileContent.length });
            state.isFinished = true;
          }

          ws.close();
        } else {
          if (!fileContent) {
            this.logger.info({ event: "DOWNLOAD_FILE_FROM_SHELL_INIT" });
            fileContent = bufferData;
          } else {
            this.logger.info({ event: "DOWNLOAD_FILE_FROM_SHELL_APPEND", length: fileContent.length });
            const newFileContent = new Uint8Array(fileContent.length + bufferData.length);
            newFileContent.set(fileContent, 0);
            newFileContent.set(bufferData, fileContent.length);
            fileContent = newFileContent;
          }
        }
      }
    });

    if (result.ok && fileContent) {
      this.logger.info({ event: "DOWNLOAD_FILE_FROM_SHELL_SUCCESS" });
      const fileName = input.filePath.replace(/^.*[\\/]/, "");
      this.saveFile(new Blob([fileContent]), fileName);
      return result;
    }

    if (errorMessage) {
      this.logger.error({ event: "DOWNLOAD_FILE_FROM_SHELL_ERROR", error: "File content is empty" });
      return { ok: false, code: "unknown", message: errorMessage };
    }

    return result;
  }
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
