import type { HttpClient } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import { mock } from "jest-mock-extended";

import type { ProviderCredentials } from "./provider-proxy.service";
import { ProviderProxyService } from "./provider-proxy.service";

import { buildProvider } from "@tests/seeders";

describe(ProviderProxyService.name, () => {
  describe("sendManifest", () => {
    it("does nothing if provider is undefined", () => {
      const { service, httpClient } = setup();
      service.sendManifest(undefined, {}, { dseq: "1", chainNetwork: "akash" });
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it("sends manifest to provider", async () => {
      jest.useFakeTimers();

      const response = {};
      const httpClient = mock<HttpClient>({
        post: jest.fn().mockResolvedValue(response)
      } as unknown as HttpClient);
      const { service } = setup({ httpClient });
      const provider = buildProvider();

      const dseq = "1";
      const manifest = [
        {
          profiles: {
            compute: {
              web: {
                resources: {
                  cpu: {
                    units: {
                      val: "0.5"
                    }
                  }
                },
                memory: {
                  quantity: {
                    val: "512Mi"
                  }
                },
                storage: {
                  quantity: {
                    val: "512Mi"
                  }
                }
              }
            }
          }
        }
      ];
      const credentials: ProviderCredentials = { type: "mtls", value: { cert: "certPem", key: "keyPem" } };
      const promise = service.sendManifest(provider, manifest, { dseq, chainNetwork: "mainnet", credentials });

      const [result] = await Promise.all([promise, jest.runAllTimersAsync()]);

      expect(httpClient.post).toHaveBeenCalledWith(
        "/",
        {
          method: "PUT",
          url: `${provider.hostUri}/deployment/${dseq}/manifest`,
          providerAddress: provider.owner,
          network: "mainnet",
          auth: {
            type: "mtls",
            certPem: credentials.value?.cert,
            keyPem: credentials.value?.key
          },
          body: JSON.stringify([
            {
              profiles: {
                compute: {
                  web: {
                    resources: {
                      cpu: {
                        units: {
                          val: "0.5"
                        }
                      }
                    },
                    memory: {
                      size: {
                        val: "512Mi"
                      }
                    },
                    storage: {
                      size: {
                        val: "512Mi"
                      }
                    }
                  }
                }
              }
            }
          ])
        },
        { timeout: expect.any(Number) }
      );
      expect(result).toBe(response);

      jest.useRealTimers();
    });
  });

  describe("downloadLogs", () => {
    it("downloads logs successfully and saves file", async () => {
      jest.useFakeTimers();
      const { service, saveFile, websocket } = setup();
      const input = {
        type: "logs" as const,
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        chainNetwork: "mainnet",
        dseq: "123",
        gseq: 1,
        oseq: 1
      };

      const promise = service.downloadLogs(input);

      websocket.onopen?.({} as Event);

      const logMessages = [
        JSON.stringify({
          message: JSON.stringify({
            name: "web-service-abc123",
            message: "Server started on port 8080"
          })
        }),
        JSON.stringify({
          message: JSON.stringify({
            name: "web-service-abc123",
            message: "Database connected"
          })
        })
      ];
      websocket.onmessage?.({ data: logMessages[0] } as MessageEvent);
      websocket.onmessage?.({ data: logMessages[1] } as MessageEvent);

      await jest.advanceTimersByTimeAsync(4000);

      websocket.onclose?.({} as CloseEvent);

      const result = await promise;

      expect(result).toEqual({ ok: true });
      expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/123-1-1-logs-\d{4}-\d{2}-\d{2}\.txt/));

      const savedBlob = (saveFile as jest.Mock).mock.calls[0][0];
      const savedContent = await savedBlob.text();
      expect(savedContent).toContain("[web]: Server started on port 8080");
      expect(savedContent).toContain("[web]: Database connected");

      jest.useRealTimers();
    });

    it("downloads events successfully and saves file", async () => {
      jest.useFakeTimers();
      const { service, saveFile, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "456",
        gseq: 2,
        oseq: 3,
        type: "events" as const,
        chainNetwork: "testnet"
      };

      const promise = service.downloadLogs(input);

      websocket.onopen?.({} as Event);

      const eventMessage = JSON.stringify({
        message: JSON.stringify({
          type: "Normal",
          reason: "Started",
          object: { name: "web-pod-abc", kind: "Pod" },
          note: "Container started successfully"
        })
      });
      websocket.onmessage?.({ data: eventMessage } as MessageEvent);

      await jest.advanceTimersByTimeAsync(4000);
      websocket.onclose?.({} as CloseEvent);

      const result = await promise;

      expect(result).toEqual({ ok: true });
      expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/456-2-3-events-\d{4}-\d{2}-\d{2}\.txt/));

      const savedBlob = (saveFile as jest.Mock).mock.calls[0][0];
      const savedContent = await savedBlob.text();
      expect(savedContent).toContain("[web]: [Normal] [Started] [Pod] Container started successfully");

      jest.useRealTimers();
    });

    it("handles cancellation via AbortSignal", async () => {
      const { service, saveFile, websocket } = setup();
      const abortController = new AbortController();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "jwt" as const, value: "token123" },
        dseq: "789",
        gseq: 1,
        oseq: 1,
        type: "logs" as const,
        chainNetwork: "mainnet",
        signal: abortController.signal
      };

      const promise = service.downloadLogs(input);

      websocket.onopen?.({} as Event);
      abortController.abort();

      websocket.onclose?.({} as CloseEvent);

      const result = await promise;

      expect(result).toEqual({ ok: false, code: "cancelled" });
      expect(saveFile).not.toHaveBeenCalled();
      expect(websocket.close).toHaveBeenCalled();
    });

    it("ignores closed messages", async () => {
      jest.useFakeTimers();
      const { service, saveFile, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "111",
        gseq: 1,
        oseq: 1,
        type: "logs" as const,
        chainNetwork: "mainnet"
      };

      const promise = service.downloadLogs(input);

      websocket.onopen?.({} as Event);

      const closedMessage = JSON.stringify({ closed: true });
      websocket.onmessage?.({ data: closedMessage } as MessageEvent);

      await jest.advanceTimersByTimeAsync(4000);
      websocket.onclose?.({} as CloseEvent);

      const result = await promise;

      expect(result).toEqual({ ok: true });
      const savedBlob = (saveFile as jest.Mock).mock.calls[0][0];
      const savedContent = await savedBlob.text();
      expect(savedContent).toBe("");

      jest.useRealTimers();
    });

    it("handles WebSocket close without finishing", async () => {
      const { service, saveFile, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "222",
        gseq: 1,
        oseq: 1,
        type: "logs" as const,
        chainNetwork: "mainnet"
      };

      const promise = service.downloadLogs(input);

      websocket.onopen?.({} as Event);

      // Close WebSocket immediately without finishing
      websocket.onclose?.({} as CloseEvent);

      const result = await promise;

      expect(result).toEqual({ ok: false, code: "unknown" });
      expect(saveFile).not.toHaveBeenCalled();
    });
  });

  describe("downloadFileFromShell", () => {
    it("downloads file successfully and saves it", async () => {
      const { service, saveFile, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "123",
        gseq: 1,
        oseq: 1,
        chainNetwork: "mainnet",
        service: "web",
        filePath: "/app/config.json"
      };

      const promise = service.downloadFileFromShell(input);

      websocket.onopen?.({} as Event);

      // Simulate file content chunks
      const fileContent = '{"setting": "value"}';
      const encoder = new TextEncoder();
      const contentBytes = encoder.encode(fileContent);

      // First chunk - file content
      const chunk1 = new Uint8Array([0, ...contentBytes]);
      const message1 = JSON.stringify({
        message: { data: Array.from(chunk1) }
      });
      websocket.onmessage?.({ data: message1 } as MessageEvent);

      // Exit message with success
      const exitMessage = new Uint8Array([0, ...encoder.encode('{"exit_code": 0}')]);
      const message2 = JSON.stringify({
        message: { data: Array.from(exitMessage) }
      });
      websocket.onmessage?.({ data: message2 } as MessageEvent);

      websocket.onclose?.({} as CloseEvent);

      const result = await promise;

      expect(result).toEqual({ ok: true });
      expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), "config.json");

      const savedBlob = (saveFile as jest.Mock).mock.calls[0][0];
      const savedContent = await savedBlob.text();
      expect(savedContent).toBe(fileContent);
    });

    it("handles file download with multiple chunks", async () => {
      const { service, saveFile, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "456",
        gseq: 2,
        oseq: 3,
        chainNetwork: "testnet",
        service: "api",
        filePath: "/data/largefile.txt"
      };

      const promise = service.downloadFileFromShell(input);

      websocket.onopen?.({} as Event);

      const encoder = new TextEncoder();
      const chunks = ["First chunk ", "Second chunk ", "Third chunk", `{"exit_code": 0}`];

      chunks.forEach(chunk => {
        const data = new Uint8Array([0, ...encoder.encode(chunk)]);
        websocket.onmessage?.({
          data: JSON.stringify({ message: { data: Array.from(data) } })
        } as MessageEvent);
      });

      websocket.onclose?.({} as CloseEvent);

      const result = await promise;

      expect(result).toEqual({ ok: true });
      const savedBlob = (saveFile as jest.Mock).mock.calls[0][0];
      const savedContent = await savedBlob.text();
      expect(savedContent).toBe("First chunk Second chunk Third chunk");
    });

    it("handles error when exit code is non-zero", async () => {
      const { service, saveFile, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "jwt" as const, value: "token123" },
        dseq: "789",
        gseq: 1,
        oseq: 1,
        chainNetwork: "mainnet",
        service: "web",
        filePath: "/nonexistent/file.txt"
      };

      const promise = service.downloadFileFromShell(input);

      websocket.onopen?.({} as Event);

      const encoder = new TextEncoder();
      const errorContent = "cat: /nonexistent/file.txt: No such file or directory";
      const errorData = new Uint8Array([0, ...encoder.encode(errorContent)]);
      websocket.onmessage?.({
        data: JSON.stringify({ message: { data: Array.from(errorData) } })
      } as MessageEvent);

      const exitData = new Uint8Array([0, ...encoder.encode('{"exit_code": 1}')]);
      websocket.onmessage?.({
        data: JSON.stringify({ message: { data: Array.from(exitData) } })
      } as MessageEvent);

      websocket.onclose?.({} as CloseEvent);

      const result = await promise;

      expect(result).toEqual({ ok: false, code: "unknown", message: errorContent });
      expect(saveFile).not.toHaveBeenCalled();
    });

    it("handles cancellation via AbortSignal", async () => {
      const { service, saveFile, websocket } = setup();
      const abortController = new AbortController();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "999",
        gseq: 1,
        oseq: 1,
        chainNetwork: "mainnet",
        service: "web",
        filePath: "/app/file.txt",
        signal: abortController.signal
      };

      const promise = service.downloadFileFromShell(input);

      websocket.onopen?.({} as Event);
      abortController.abort();
      websocket.onclose?.({} as CloseEvent);

      const result = await promise;

      expect(result).toEqual({ ok: false, code: "cancelled" });
      expect(saveFile).not.toHaveBeenCalled();
      expect(websocket.close).toHaveBeenCalled();
    });

    it("handles error when no file content is received", async () => {
      const { service, saveFile, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "111",
        gseq: 1,
        oseq: 1,
        chainNetwork: "mainnet",
        service: "web",
        filePath: "/app/file.txt"
      };

      const promise = service.downloadFileFromShell(input);

      websocket.onopen?.({} as Event);

      const encoder = new TextEncoder();
      const exitData = new Uint8Array([0, ...encoder.encode('{"exit_code": 0}')]);
      websocket.onmessage?.({
        data: JSON.stringify({ message: { data: Array.from(exitData) } })
      } as MessageEvent);

      websocket.onclose?.({} as CloseEvent);

      const result = await promise;

      expect(result).toEqual({ ok: false, code: "unknown" });
      expect(saveFile).not.toHaveBeenCalled();
    });

    it("extracts filename correctly from path", async () => {
      const { service, saveFile, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "222",
        gseq: 1,
        oseq: 1,
        chainNetwork: "mainnet",
        service: "web",
        filePath: "/very/long/path/to/myfile.log"
      };

      const promise = service.downloadFileFromShell(input);

      websocket.onopen?.({} as Event);

      const encoder = new TextEncoder();
      const content = new Uint8Array([0, ...encoder.encode("log content")]);
      websocket.onmessage?.({
        data: JSON.stringify({ message: { data: Array.from(content) } })
      } as MessageEvent);

      const exitData = new Uint8Array([0, ...encoder.encode('{"exit_code": 0}')]);
      websocket.onmessage?.({
        data: JSON.stringify({ message: { data: Array.from(exitData) } })
      } as MessageEvent);

      websocket.onclose?.({} as CloseEvent);

      await promise;

      expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), "myfile.log");
    });
  });

  function setup(input?: {
    httpClient?: HttpClient;
    logger?: LoggerService;
    saveFile?: (data: Blob | string, filename?: string) => void;
    providerProxyUrlWs?: string;
  }) {
    const httpClient = input?.httpClient || mock<HttpClient>();
    const logger = input?.logger || mock<LoggerService>();
    const saveFile = input?.saveFile || jest.fn();
    const websocket = {
      send: jest.fn(),
      close: jest.fn(),
      onopen: null as (() => void) | null,
      onmessage: null as ((event: MessageEvent) => void) | null,
      onclose: null as (() => void) | null,
      readyState: WebSocket.OPEN
    } as unknown as WebSocket;
    const createWebSocket = jest.fn(() => websocket);
    const service = new ProviderProxyService(httpClient, logger, createWebSocket, saveFile);
    return { service, httpClient, logger, saveFile, websocket };
  }
});
