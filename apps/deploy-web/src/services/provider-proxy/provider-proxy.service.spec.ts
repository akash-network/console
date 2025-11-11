import type { HttpClient } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import { mock } from "jest-mock-extended";

import type { K8sEventMessage, LogEntryMessage, ProviderCredentials } from "./provider-proxy.service";
import { ProviderProxyService, WS_ERRORS } from "./provider-proxy.service";

import { buildProvider } from "@tests/seeders";
import { createWebsocketMock, dispatchWsEvent } from "@tests/unit/websocketMock";

describe(ProviderProxyService.name, () => {
  afterEach(() => {
    jest.useRealTimers();
  });

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

      await dispatchWsEvent(websocket, new Event("open"));

      const logMessages: LogEntryMessage[] = [
        {
          name: "web-service-abc123",
          message: "Server started on port 8080",
          service: "web"
        },
        {
          name: "web-service-abc123",
          message: "Database connected",
          service: "web"
        }
      ];
      for (const message of logMessages) {
        await dispatchWsEvent(
          websocket,
          new MessageEvent("message", {
            data: JSON.stringify({
              message: JSON.stringify(message)
            })
          })
        );
      }

      await dispatchWsEvent(websocket, new Event("close"));

      const result = await promise;

      expect(result).toEqual({ ok: true });
      expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/123-1-1-logs-\d{4}-\d{2}-\d{2}\.txt/));

      const savedBlob = (saveFile as jest.Mock).mock.calls[0][0];
      const savedContent = await savedBlob.text();

      expect(savedContent).toContain("[web]: Server started on port 8080");
      expect(savedContent).toContain("[web]: Database connected");
    });

    it("downloads events successfully and saves file", async () => {
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

      await dispatchWsEvent(websocket, new Event("open"));

      const eventMessage = JSON.stringify({
        message: JSON.stringify({
          type: "Normal",
          reason: "Started",
          object: { name: "web-pod-abc", kind: "Pod", namespace: "default" },
          note: "Container started successfully",
          message: "Container started successfully",
          service: "web",
          reportingController: "web-controller",
          reportingInstance: "web-instance"
        } satisfies K8sEventMessage)
      });
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: eventMessage }));
      await dispatchWsEvent(websocket, new Event("close"));

      const result = await promise;

      expect(result).toEqual({ ok: true });
      expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/456-2-3-events-\d{4}-\d{2}-\d{2}\.txt/));

      const savedBlob = (saveFile as jest.Mock).mock.calls[0][0];
      const savedContent = await savedBlob.text();
      expect(savedContent).toContain("[web]: [Normal] [Started] [Pod] Container started successfully");
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

      await dispatchWsEvent(websocket, new Event("open"));
      abortController.abort();

      const result = await promise;

      expect(result).toEqual({ ok: false, code: "cancelled" });
      expect(saveFile).not.toHaveBeenCalled();
      expect(websocket.close).toHaveBeenCalled();
    });

    it("stops downloading logs when closed message is received", async () => {
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

      await dispatchWsEvent(websocket, new Event("open"));
      await dispatchWsEvent(
        websocket,
        new MessageEvent("message", {
          data: JSON.stringify({
            message: JSON.stringify({
              name: "web-service-abc123",
              message: "Server started on port 8080",
              service: "web"
            } satisfies LogEntryMessage)
          })
        })
      );
      await dispatchWsEvent(
        websocket,
        new MessageEvent("message", {
          data: JSON.stringify({ closed: true })
        })
      );

      const result = await promise;

      expect(result).toEqual({ ok: true });
      const savedBlob = (saveFile as jest.Mock).mock.calls[0][0];
      const savedContent = await savedBlob.text();
      expect(savedContent).toBe("[web]: Server started on port 8080\n");
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

      await dispatchWsEvent(websocket, new Event("open"));

      // Close WebSocket immediately without finishing
      await dispatchWsEvent(websocket, new Event("close"));

      const result = await promise;

      expect(result).toEqual({ ok: false, code: "unknown", message: expect.any(String) });
      expect(saveFile).not.toHaveBeenCalled();
    });

    it("aborts download after 3 seconds if no messages are received", async () => {
      jest.useFakeTimers();
      const { service, websocket } = setup();
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

      await Promise.all([dispatchWsEvent(websocket, new Event("open")), jest.runOnlyPendingTimersAsync()]);
      await jest.advanceTimersByTimeAsync(3_001);

      const result = await promise;

      expect(result).toEqual({
        ok: false,
        code: "unknown",
        message: expect.stringMatching(/No log content received from server/i)
      });
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

      await dispatchWsEvent(websocket, new Event("open"));

      // Simulate file content chunks
      const fileContent = '{"setting": "value"}';
      const encoder = new TextEncoder();
      const contentBytes = encoder.encode(fileContent);

      const message1 = JSON.stringify({
        message: { data: [100, ...contentBytes] }
      });
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: message1 }));

      const message2 = JSON.stringify({
        message: { data: [0, ...encoder.encode('{"exit_code": 0}')] }
      });
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: message2 }));
      await dispatchWsEvent(websocket, new Event("close"));

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

      await dispatchWsEvent(websocket, new Event("open"));

      const encoder = new TextEncoder();
      const chunks = ["First chunk ", "Second chunk ", "Third chunk", `{"exit_code": 0}`];

      for (const chunk of chunks) {
        await dispatchWsEvent(
          websocket,
          new MessageEvent("message", {
            data: JSON.stringify({ message: { data: [0, ...encoder.encode(chunk)] } })
          })
        );
      }

      await dispatchWsEvent(websocket, new Event("close"));

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

      await dispatchWsEvent(websocket, new Event("open"));

      const encoder = new TextEncoder();
      const errorContent = "cat: /nonexistent/file.txt: No such file or directory";
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: JSON.stringify({ message: { data: [0, ...encoder.encode(errorContent)] } }) }));
      await dispatchWsEvent(
        websocket,
        new MessageEvent("message", { data: JSON.stringify({ message: { data: [0, ...encoder.encode('{"exit_code": 1}')] } }) })
      );
      await dispatchWsEvent(websocket, new Event("close"));

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

      await dispatchWsEvent(websocket, new Event("open"));
      abortController.abort();

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

      await dispatchWsEvent(websocket, new Event("open"));

      const encoder = new TextEncoder();
      await dispatchWsEvent(
        websocket,
        new MessageEvent("message", {
          data: JSON.stringify({
            message: { data: [0, ...encoder.encode('{"exit_code": 0}')] }
          })
        })
      );
      await dispatchWsEvent(websocket, new Event("close"));

      const result = await promise;
      expect(result).toEqual({ ok: false, code: "unknown", message: expect.any(String) });
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

      await dispatchWsEvent(websocket, new Event("open"));

      const encoder = new TextEncoder();
      await dispatchWsEvent(
        websocket,
        new MessageEvent("message", {
          data: JSON.stringify({ message: { data: [0, ...encoder.encode("log content")] } })
        })
      );

      await dispatchWsEvent(
        websocket,
        new MessageEvent("message", {
          data: JSON.stringify({ message: { data: [0, ...encoder.encode('{"exit_code": 0}')] } })
        })
      );

      await dispatchWsEvent(websocket, new Event("close"));

      await promise;

      expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), "myfile.log");
    });
  });

  describe("getLogsStream", () => {
    it("streams log messages", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "123",
        gseq: 1,
        oseq: 1,
        type: "logs" as const,
        chainNetwork: "mainnet"
      };

      const stream = service.getLogsStream(input);

      await dispatchWsEvent(websocket, new Event("open"));

      const logMessages: LogEntryMessage[] = [
        { name: "web-service-1", message: "Log message 1", service: "web" },
        { name: "web-service-2", message: "Log message 2", service: "web" }
      ];

      const messagesPromise = Promise.all([stream.next(), stream.next()]);

      for (const logMessage of logMessages) {
        await dispatchWsEvent(
          websocket,
          new MessageEvent("message", {
            data: JSON.stringify({
              message: JSON.stringify(logMessage)
            })
          })
        );
      }

      const results = await messagesPromise;

      expect(results[0].value).toEqual({ message: logMessages[0] });
      expect(results[1].value).toEqual({ message: logMessages[1] });
      expect(results[0].done).toBe(false);
      expect(results[1].done).toBe(false);

      await dispatchWsEvent(websocket, new Event("close"));
    });

    it("streams event messages", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "jwt" as const, value: "token123" },
        dseq: "456",
        gseq: 2,
        oseq: 3,
        type: "events" as const,
        chainNetwork: "testnet"
      };

      const stream = service.getLogsStream(input);

      await dispatchWsEvent(websocket, new Event("open"));

      const eventMessage: K8sEventMessage = {
        type: "Normal",
        reason: "Started",
        object: { name: "web-pod", kind: "Pod", namespace: "default" },
        note: "Container started",
        message: "Container started",
        service: "web",
        reportingController: "controller",
        reportingInstance: "instance"
      };

      const messagePromise = stream.next();

      await dispatchWsEvent(
        websocket,
        new MessageEvent("message", {
          data: JSON.stringify({
            message: JSON.stringify(eventMessage)
          })
        })
      );

      const result = await messagePromise;

      expect(result.value).toEqual({ message: eventMessage });
      expect(result.done).toBe(false);

      await dispatchWsEvent(websocket, new Event("close"));
    });

    it("stops streaming when closed message is received", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "789",
        gseq: 1,
        oseq: 1,
        type: "logs" as const,
        chainNetwork: "mainnet"
      };

      const stream = service.getLogsStream(input);
      const messages: LogEntryMessage[] = [];

      const consumeStream = (async () => {
        for await (const entry of stream) {
          if (entry.closed) break;
          if (entry.message) {
            messages.push(entry.message);
          }
        }
      })();

      await dispatchWsEvent(websocket, new Event("open"));

      await dispatchWsEvent(
        websocket,
        new MessageEvent("message", {
          data: JSON.stringify({
            message: JSON.stringify({
              name: "web-service",
              message: "First message",
              service: "web"
            } satisfies LogEntryMessage)
          })
        })
      );

      await dispatchWsEvent(
        websocket,
        new MessageEvent("message", {
          data: JSON.stringify({ closed: true })
        })
      );

      await dispatchWsEvent(websocket, new Event("close"));
      await consumeStream;

      expect(messages).toHaveLength(1);
      expect(messages[0].message).toBe("First message");
    });

    it("handles cancellation via AbortSignal", async () => {
      const { service, websocket } = setup();
      const abortController = new AbortController();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "999",
        gseq: 1,
        oseq: 1,
        type: "logs" as const,
        chainNetwork: "mainnet",
        signal: abortController.signal
      };

      const stream = service.getLogsStream(input);

      await dispatchWsEvent(websocket, new Event("open"));

      const [result] = await Promise.all([stream.next(), abortController.abort()]);

      expect(result.done).toBe(true);
      expect(websocket.close).toHaveBeenCalled();
    });

    it("includes `tail`, `services` and `follow` parameters in request", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "111",
        gseq: 1,
        oseq: 1,
        type: "logs" as const,
        chainNetwork: "mainnet",
        tail: 200,
        services: ["web", "api"],
        follow: true
      };

      service.getLogsStream(input).next();
      await dispatchWsEvent(websocket, new Event("open"));

      expect(websocket.send).toHaveBeenCalledWith(expect.stringContaining("tail=200"));
      expect(websocket.send).toHaveBeenCalledWith(expect.stringContaining("service=web,api"));
      expect(websocket.send).toHaveBeenCalledWith(expect.stringContaining("follow=true"));

      await dispatchWsEvent(websocket, new Event("close"));
    });

    it("does not retry on invalid provider certificate", async () => {
      jest.useFakeTimers();

      const { service, websocket, createWebSocket } = setup();
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

      const stream = service.getLogsStream(input);
      stream.next();
      await Promise.all([dispatchWsEvent(websocket, new Event("open")), jest.runOnlyPendingTimersAsync()]);
      await Promise.all([
        dispatchWsEvent(websocket, new CloseEvent("close", { code: WS_ERRORS.VIOLATED_POLICY, reason: "invalidCertificate.notSelfSigned" })),
        jest.runOnlyPendingTimersAsync()
      ]);

      await jest.advanceTimersByTimeAsync(10_000);

      expect(createWebSocket).toHaveBeenCalledTimes(1);
    });
  });

  describe("connectToShell", () => {
    it("constructs correct URL with default command", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.example.com",
        providerAddress: "akash1test",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "100",
        gseq: 2,
        oseq: 3,
        chainNetwork: "mainnet",
        service: "web-service"
      };

      const session = service.connectToShell(input);
      session.send(new Uint8Array());
      await dispatchWsEvent(websocket, new Event("open"));

      const sentMessage = JSON.parse((websocket.send as jest.Mock).mock.calls[0][0]);
      expect(sentMessage.url).toBe("https://provider.example.com/lease/100/2/3/shell?stdin=0&tty=0&podIndex=0&&cmd0=%2Fbin%2Fsh&service=web-service");
    });

    it("constructs correct URL with custom command", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "456",
        gseq: 1,
        oseq: 1,
        chainNetwork: "mainnet",
        service: "api",
        command: "cat /app/config.json"
      };

      const session = service.connectToShell(input);
      session.send(new Uint8Array());
      await dispatchWsEvent(websocket, new Event("open"));

      const sentMessage = JSON.parse((websocket.send as jest.Mock).mock.calls[0][0]);
      expect(sentMessage.url).toContain("cmd0=cat");
      expect(sentMessage.url).toContain("cmd1=%2Fapp%2Fconfig.json");
    });

    it("handles stdin and tty options", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "789",
        gseq: 1,
        oseq: 1,
        chainNetwork: "mainnet",
        service: "web",
        useStdIn: true,
        useTTY: true
      };

      const session = service.connectToShell(input);
      session.send(new Uint8Array());
      await dispatchWsEvent(websocket, new Event("open"));

      const sentMessage = JSON.parse((websocket.send as jest.Mock).mock.calls[0][0]);
      expect(sentMessage.url).toContain("stdin=1");
      expect(sentMessage.url).toContain("tty=1");
    });

    it("handles command with multiple arguments", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "333",
        gseq: 1,
        oseq: 1,
        chainNetwork: "mainnet",
        service: "web",
        command: "ls -la /app"
      };

      const session = service.connectToShell(input);
      session.send(new Uint8Array());
      await dispatchWsEvent(websocket, new Event("open"));

      const sentMessage = JSON.parse((websocket.send as jest.Mock).mock.calls[0][0]);
      expect(sentMessage.url).toContain("cmd0=ls");
      expect(sentMessage.url).toContain("cmd1=-la");
      expect(sentMessage.url).toContain("cmd2=%2Fapp");
    });

    it("includes credentials in sent messages", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "test-cert", key: "test-key" } },
        dseq: "444",
        gseq: 1,
        oseq: 1,
        chainNetwork: "mainnet",
        service: "web"
      };

      const session = service.connectToShell(input);
      session.send(new Uint8Array([1, 2, 3]));
      await dispatchWsEvent(websocket, new Event("open"));

      const sentMessage = JSON.parse((websocket.send as jest.Mock).mock.calls[0][0]);
      expect(sentMessage.auth).toEqual({
        type: "mtls",
        certPem: "test-cert",
        keyPem: "test-key"
      });
    });

    it("includes JWT credentials in sent messages", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "jwt" as const, value: "token123" },
        dseq: "555",
        gseq: 1,
        oseq: 1,
        chainNetwork: "mainnet",
        service: "web"
      };

      const session = service.connectToShell(input);
      session.send(new Uint8Array([1, 2, 3]));
      await dispatchWsEvent(websocket, new Event("open"));

      const sentMessage = JSON.parse((websocket.send as jest.Mock).mock.calls[0][0]);
      expect(sentMessage.auth).toEqual({
        type: "jwt",
        token: "token123"
      });
    });

    it("includes data field when message has content", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "666",
        gseq: 1,
        oseq: 1,
        chainNetwork: "mainnet",
        service: "web"
      };

      const session = service.connectToShell(input);
      const encoder = new TextEncoder();
      session.send(encoder.encode("echo hello"));
      await dispatchWsEvent(websocket, new Event("open"));

      const sentMessage = JSON.parse((websocket.send as jest.Mock).mock.calls[0][0]);
      expect(sentMessage.data).toBe(encoder.encode("echo hello").toString());
    });

    it("does not include data field when message is empty", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "777",
        gseq: 1,
        oseq: 1,
        chainNetwork: "mainnet",
        service: "web"
      };

      const session = service.connectToShell(input);
      session.send(new Uint8Array());
      await dispatchWsEvent(websocket, new Event("open"));

      const sentMessage = JSON.parse((websocket.send as jest.Mock).mock.calls[0][0]);
      expect(sentMessage.data).toBeUndefined();
    });

    it("handles abort signal", async () => {
      const { service, websocket } = setup();
      const abortController = new AbortController();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "888",
        gseq: 1,
        oseq: 1,
        chainNetwork: "mainnet",
        service: "web",
        signal: abortController.signal
      };

      const session = service.connectToShell(input);
      session.send(new Uint8Array());
      await dispatchWsEvent(websocket, new Event("open"));

      abortController.abort();

      expect(websocket.close).toHaveBeenCalled();
    });

    it("can send multiple messages", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "1000",
        gseq: 1,
        oseq: 1,
        chainNetwork: "mainnet",
        service: "web"
      };

      const session = service.connectToShell(input);
      const encoder = new TextEncoder();

      session.send(encoder.encode("first"));
      session.send(encoder.encode("second"));
      await dispatchWsEvent(websocket, new Event("open"));

      expect(websocket.send).toHaveBeenCalledTimes(2);

      const firstMessage = JSON.parse((websocket.send as jest.Mock).mock.calls[0][0]);
      const secondMessage = JSON.parse((websocket.send as jest.Mock).mock.calls[1][0]);

      expect(firstMessage.data).toBe(encoder.encode("first").toString());
      expect(secondMessage.data).toBe(encoder.encode("second").toString());
    });

    it("receives shell messages through async iterator", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "1111",
        gseq: 1,
        oseq: 1,
        chainNetwork: "mainnet",
        service: "web"
      };

      const session = service.connectToShell(input);
      session.send(new Uint8Array());

      const encoder = new TextEncoder();
      const messagePromise = session.receive().next();

      await dispatchWsEvent(websocket, new Event("open"));

      const shellMessage = {
        message: { data: [0, ...encoder.encode("output data")] }
      };

      await dispatchWsEvent(
        websocket,
        new MessageEvent("message", {
          data: JSON.stringify(shellMessage)
        })
      );

      const result = await messagePromise;

      expect(result.value).toEqual(shellMessage);
      expect(result.done).toBe(false);

      await dispatchWsEvent(websocket, new Event("close"));
    });

    it("does not retry on invalid provider certificate", async () => {
      jest.useFakeTimers();

      const { service, websocket, createWebSocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        providerCredentials: { type: "mtls" as const, value: { cert: "cert", key: "key" } },
        dseq: "1111",
        gseq: 1,
        oseq: 1,
        chainNetwork: "mainnet",
        service: "web"
      };

      const session = service.connectToShell(input);
      session.receive().next();
      await Promise.all([dispatchWsEvent(websocket, new Event("open")), jest.runOnlyPendingTimersAsync()]);
      await Promise.all([
        dispatchWsEvent(websocket, new CloseEvent("close", { code: WS_ERRORS.VIOLATED_POLICY, reason: "invalidCertificate.notSelfSigned" })),
        jest.runOnlyPendingTimersAsync()
      ]);

      await jest.advanceTimersByTimeAsync(10_000);

      expect(createWebSocket).toHaveBeenCalledTimes(1);
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
    const websocket = createWebsocketMock();
    const createWebSocket = jest.fn(() => websocket);
    const service = new ProviderProxyService(httpClient, logger, createWebSocket, saveFile);
    return { service, httpClient, logger, saveFile, websocket, createWebSocket };
  }
});
