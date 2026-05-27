import type { Manifest } from "@akashnetwork/chain-sdk/web";
import { manifestToSortedJSON } from "@akashnetwork/chain-sdk/web";
import type { HttpClient } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { K8sEventMessage, LogEntryMessage, ProviderCredentials } from "./provider-proxy.service";
import { ProviderProxyService, WS_ERRORS } from "./provider-proxy.service";

import { buildProvider } from "@tests/seeders";
import { createWebsocketMock, dispatchWsEvent } from "@tests/unit/websocketMock";

describe(ProviderProxyService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("sendManifest", () => {
    it("does nothing if provider is undefined", () => {
      const { service, httpClient } = setup();
      service.sendManifest(undefined, [] as Manifest, { dseq: "1" });
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it("sends manifest to provider", async () => {
      vi.useFakeTimers();

      const response = {};
      const httpClient = mock<HttpClient>({
        post: vi.fn().mockResolvedValue(response)
      } as unknown as HttpClient);
      const { service } = setup({ httpClient });
      const provider = buildProvider();

      const dseq = "1";
      const manifest: Manifest = [
        {
          name: "web",
          services: [
            {
              name: "web",
              image: "test",
              command: ["test"],
              args: [],
              count: 1,
              env: [],
              expose: [],
              credentials: undefined,
              params: undefined,
              resources: {
                id: 1,
                cpu: {
                  units: {
                    val: new TextEncoder().encode("0.5")
                  },
                  attributes: []
                },
                memory: {
                  quantity: {
                    val: new TextEncoder().encode("512Mi")
                  },
                  attributes: []
                },
                storage: [
                  {
                    name: "test",
                    quantity: {
                      val: new TextEncoder().encode("512Mi")
                    },
                    attributes: []
                  }
                ],
                gpu: undefined,
                endpoints: []
              }
            }
          ]
        }
      ];
      const credentials: ProviderCredentials = { type: "jwt", value: "jwt-token" };
      const promise = service.sendManifest(provider, manifest, { dseq, credentials });

      const [result] = await Promise.all([promise, vi.runAllTimersAsync()]);

      expect(httpClient.post).toHaveBeenCalledWith(
        "/",
        {
          method: "PUT",
          url: `${provider.hostUri}/deployment/${dseq}/manifest`,
          providerAddress: provider.owner,
          auth: {
            type: "jwt",
            token: credentials.value
          },
          body: manifestToSortedJSON(manifest)
        },
        { timeout: expect.any(Number) }
      );
      expect(result).toBe(response);
    });
  });

  describe("downloadLogs", () => {
    it("downloads logs successfully and saves file", async () => {
      const { service, saveFile, websocket } = setup();
      const input = {
        type: "logs" as const,
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("jwt-token"),
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

      const savedBlob = (saveFile as Mock).mock.calls[0][0];
      const savedContent = await savedBlob.text();

      expect(savedContent).toContain("[web]: Server started on port 8080");
      expect(savedContent).toContain("[web]: Database connected");
    });

    it("downloads events successfully and saves file", async () => {
      const { service, saveFile, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "456",
        gseq: 2,
        oseq: 3,
        type: "events" as const
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

      const savedBlob = (saveFile as Mock).mock.calls[0][0];
      const savedContent = await savedBlob.text();
      expect(savedContent).toContain("[web]: [Normal] [Started] [Pod] Container started successfully");
    });

    it("handles cancellation via AbortSignal", async () => {
      const { service, saveFile, websocket } = setup();
      const abortController = new AbortController();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("token123"),
        dseq: "789",
        gseq: 1,
        oseq: 1,
        type: "logs" as const,
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
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "111",
        gseq: 1,
        oseq: 1,
        type: "logs" as const
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
      const savedBlob = (saveFile as Mock).mock.calls[0][0];
      const savedContent = await savedBlob.text();
      expect(savedContent).toBe("[web]: Server started on port 8080\n");
    });

    it("handles WebSocket close without finishing", async () => {
      const { service, saveFile, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "222",
        gseq: 1,
        oseq: 1,
        type: "logs" as const
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
      vi.useFakeTimers();
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "111",
        gseq: 1,
        oseq: 1,
        type: "logs" as const
      };

      const promise = service.downloadLogs(input);

      await Promise.all([dispatchWsEvent(websocket, new Event("open")), vi.runOnlyPendingTimersAsync()]);
      await vi.advanceTimersByTimeAsync(3_001);

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
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "123",
        gseq: 1,
        oseq: 1,
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

      const savedBlob = (saveFile as Mock).mock.calls[0][0];
      const savedContent = await savedBlob.text();
      expect(savedContent).toBe(fileContent);
    });

    it("handles file download with multiple chunks", async () => {
      const { service, saveFile, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "456",
        gseq: 2,
        oseq: 3,
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
      const savedBlob = (saveFile as Mock).mock.calls[0][0];
      const savedContent = await savedBlob.text();
      expect(savedContent).toBe("First chunk Second chunk Third chunk");
    });

    it("handles error when exit code is non-zero", async () => {
      const { service, saveFile, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("token123"),
        dseq: "789",
        gseq: 1,
        oseq: 1,
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
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "999",
        gseq: 1,
        oseq: 1,
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
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "111",
        gseq: 1,
        oseq: 1,
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
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "222",
        gseq: 1,
        oseq: 1,
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
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "123",
        gseq: 1,
        oseq: 1,
        type: "logs" as const
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
        ensureToken: () => Promise.resolve("token123"),
        dseq: "456",
        gseq: 2,
        oseq: 3,
        type: "events" as const
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
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "789",
        gseq: 1,
        oseq: 1,
        type: "logs" as const
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
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "999",
        gseq: 1,
        oseq: 1,
        type: "logs" as const,
        signal: abortController.signal
      };

      const stream = service.getLogsStream(input);

      await dispatchWsEvent(websocket, new Event("open"));
      abortController.abort();
      const result = await stream.next();

      expect(result.done).toBe(true);
    });

    it("includes `tail`, `services` and `follow` parameters in request", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "111",
        gseq: 1,
        oseq: 1,
        type: "logs" as const,
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
      vi.useFakeTimers();

      const { service, websocket, createWebSocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "111",
        gseq: 1,
        oseq: 1,
        type: "logs" as const
      };

      const stream = service.getLogsStream(input);
      stream.next();
      await Promise.all([dispatchWsEvent(websocket, new Event("open")), vi.runOnlyPendingTimersAsync()]);
      await Promise.all([
        dispatchWsEvent(websocket, new CloseEvent("close", { code: WS_ERRORS.VIOLATED_POLICY, reason: "invalidCertificate.notSelfSigned" })),
        vi.runOnlyPendingTimersAsync()
      ]);

      await vi.advanceTimersByTimeAsync(10_000);

      expect(createWebSocket).toHaveBeenCalledTimes(1);
    });

    it("rotates the websocket when the server emits a tokenExpired payload", async () => {
      const { service, createWebSocket } = setupWithSocketSequence(2);
      const ensureToken = vi.fn().mockResolvedValueOnce("stale-token").mockResolvedValueOnce("fresh-token");

      const stream = service.getLogsStream({
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken,
        dseq: "111",
        gseq: 1,
        oseq: 1,
        type: "logs" as const,
        follow: true
      });

      const firstMessagePromise = stream.next();

      await vi.waitFor(() => expect(createWebSocket).toHaveBeenCalledTimes(1));
      const firstSocket = (createWebSocket as Mock).mock.results[0].value as WebSocket;
      await dispatchWsEvent(firstSocket, new Event("open"));
      await dispatchWsEvent(firstSocket, new MessageEvent("message", { data: JSON.stringify({ type: "websocket", error: "tokenExpired" }) }));

      await vi.waitFor(() => expect(createWebSocket).toHaveBeenCalledTimes(2));

      const secondSocket = (createWebSocket as Mock).mock.results[1].value as WebSocket;
      await dispatchWsEvent(secondSocket, new Event("open"));

      const logMessage: LogEntryMessage = { name: "web-1", message: "after rotation", service: "web" };
      await dispatchWsEvent(secondSocket, new MessageEvent("message", { data: JSON.stringify({ message: JSON.stringify(logMessage) }) }));

      const result = await firstMessagePromise;

      expect(result.value).toEqual({ message: logMessage });
      expect(ensureToken).toHaveBeenCalledTimes(2);
      const secondHandshake = JSON.parse((secondSocket.send as Mock).mock.calls[0][0]);
      expect(secondHandshake.auth).toEqual({ type: "jwt", token: "fresh-token" });

      await dispatchWsEvent(secondSocket, new Event("close"));
    });

    it("stops rotating after exceeding the rotation cap and logs WS_ROTATION_LIMIT_EXCEEDED", async () => {
      const { service, createWebSocket, logger } = setupWithSocketSequence(4);
      const ensureToken = vi.fn().mockResolvedValue("any-token");

      const stream = service.getLogsStream({
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken,
        dseq: "222",
        gseq: 1,
        oseq: 1,
        type: "logs" as const,
        follow: true
      });

      const consumePromise = (async () => {
        const messages = [];
        for await (const message of stream) {
          messages.push(message);
        }
        return messages;
      })();

      for (let attempt = 0; attempt < 4; attempt++) {
        await vi.waitFor(() => expect(createWebSocket).toHaveBeenCalledTimes(attempt + 1));
        const socket = (createWebSocket as Mock).mock.results[attempt].value as WebSocket;
        await dispatchWsEvent(socket, new Event("open"));
        await dispatchWsEvent(socket, new MessageEvent("message", { data: JSON.stringify({ type: "websocket", error: "tokenExpired" }) }));
      }

      await consumePromise;

      expect(createWebSocket).toHaveBeenCalledTimes(4);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "WS_ROTATION_LIMIT_EXCEEDED" }));
    });
  });

  describe("connectToShell", () => {
    it("constructs correct URL with default command (bash with sh fallback)", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.example.com",
        providerAddress: "akash1test",
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "100",
        gseq: 2,
        oseq: 3,
        service: "web-service"
      };

      const session = service.connectToShell(input);
      session.send(new Uint8Array());
      await dispatchWsEvent(websocket, new Event("open"));

      const sentMessage = JSON.parse((websocket.send as Mock).mock.calls[0][0]);
      expect(sentMessage.url).toBe(
        "https://provider.example.com/lease/100/2/3/shell?stdin=0&tty=0&podIndex=0&cmd0=sh&cmd1=-c&cmd2=command%20-v%20bash%20%3E%2Fdev%2Fnull%202%3E%261%20%26%26%20exec%20bash%20%7C%7C%20exec%20sh&service=web-service"
      );
    });

    it("constructs correct URL with custom command", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "456",
        gseq: 1,
        oseq: 1,
        service: "api",
        command: ["cat", "/app/config.json"]
      };

      const session = service.connectToShell(input);
      session.send(new Uint8Array());
      await dispatchWsEvent(websocket, new Event("open"));

      const sentMessage = JSON.parse((websocket.send as Mock).mock.calls[0][0]);
      expect(sentMessage.url).toContain("cmd0=cat");
      expect(sentMessage.url).toContain("cmd1=%2Fapp%2Fconfig.json");
    });

    it("handles stdin and tty options", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "789",
        gseq: 1,
        oseq: 1,
        service: "web",
        useStdIn: true,
        useTTY: true
      };

      const session = service.connectToShell(input);
      session.send(new Uint8Array());
      await dispatchWsEvent(websocket, new Event("open"));

      const sentMessage = JSON.parse((websocket.send as Mock).mock.calls[0][0]);
      expect(sentMessage.url).toContain("stdin=1");
      expect(sentMessage.url).toContain("tty=1");
    });

    it("handles command with multiple arguments", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "333",
        gseq: 1,
        oseq: 1,
        service: "web",
        command: ["ls", "-la", "/app"]
      };

      const session = service.connectToShell(input);
      session.send(new Uint8Array());
      await dispatchWsEvent(websocket, new Event("open"));

      const sentMessage = JSON.parse((websocket.send as Mock).mock.calls[0][0]);
      expect(sentMessage.url).toContain("cmd0=ls");
      expect(sentMessage.url).toContain("cmd1=-la");
      expect(sentMessage.url).toContain("cmd2=%2Fapp");
    });

    it("includes JWT credentials in sent messages", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("token123"),
        dseq: "555",
        gseq: 1,
        oseq: 1,
        service: "web"
      };

      const session = service.connectToShell(input);
      session.send(new Uint8Array([1, 2, 3]));
      await dispatchWsEvent(websocket, new Event("open"));

      const sentMessage = JSON.parse((websocket.send as Mock).mock.calls[0][0]);
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
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "666",
        gseq: 1,
        oseq: 1,
        service: "web"
      };

      const session = service.connectToShell(input);
      const encoder = new TextEncoder();
      session.send(encoder.encode("echo hello"));
      await dispatchWsEvent(websocket, new Event("open"));

      const sentMessage = JSON.parse((websocket.send as Mock).mock.calls[0][0]);
      expect(sentMessage.data).toBe("ZWNobyBoZWxsbw==");
    });

    it("does not include data field when message is empty", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "777",
        gseq: 1,
        oseq: 1,
        service: "web"
      };

      const session = service.connectToShell(input);
      session.send(new Uint8Array());
      await dispatchWsEvent(websocket, new Event("open"));

      const sentMessage = JSON.parse((websocket.send as Mock).mock.calls[0][0]);
      expect(sentMessage.data).toBeUndefined();
    });

    it("handles abort signal", async () => {
      const { service, websocket } = setup();
      const abortController = new AbortController();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "888",
        gseq: 1,
        oseq: 1,
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
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "1000",
        gseq: 1,
        oseq: 1,
        service: "web"
      };

      const session = service.connectToShell(input);
      const encoder = new TextEncoder();

      session.send(encoder.encode("first"));
      session.send(encoder.encode("second"));
      await dispatchWsEvent(websocket, new Event("open"));

      expect(websocket.send).toHaveBeenCalledTimes(2);

      const firstMessage = JSON.parse((websocket.send as Mock).mock.calls[0][0]);
      const secondMessage = JSON.parse((websocket.send as Mock).mock.calls[1][0]);

      expect(firstMessage.data).toBe("Zmlyc3Q=");
      expect(secondMessage.data).toBe("c2Vjb25k");
    });

    it("receives shell messages through async iterator", async () => {
      const { service, websocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "1111",
        gseq: 1,
        oseq: 1,
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
      vi.useFakeTimers();

      const { service, websocket, createWebSocket } = setup();
      const input = {
        providerBaseUrl: "https://provider.akash.network",
        providerAddress: "akash1provider",
        ensureToken: () => Promise.resolve("jwt-token"),
        dseq: "1111",
        gseq: 1,
        oseq: 1,
        service: "web"
      };

      const session = service.connectToShell(input);
      session.receive().next();
      await Promise.all([dispatchWsEvent(websocket, new Event("open")), vi.runOnlyPendingTimersAsync()]);
      await Promise.all([
        dispatchWsEvent(websocket, new CloseEvent("close", { code: WS_ERRORS.VIOLATED_POLICY, reason: "invalidCertificate.notSelfSigned" })),
        vi.runOnlyPendingTimersAsync()
      ]);

      await vi.advanceTimersByTimeAsync(10_000);

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
    const saveFile = input?.saveFile || vi.fn();
    const websocket = createWebsocketMock();
    const createWebSocket = vi.fn(() => websocket);
    const service = new ProviderProxyService(httpClient, logger, createWebSocket, saveFile);
    return { service, httpClient, logger, saveFile, websocket, createWebSocket };
  }

  function setupWithSocketSequence(count: number) {
    const httpClient = mock<HttpClient>();
    const logger = mock<LoggerService>();
    const saveFile = vi.fn();
    const sockets = Array.from({ length: count }, () => createWebsocketMock());
    const createWebSocket = vi.fn();
    sockets.forEach(socket => createWebSocket.mockReturnValueOnce(socket));
    const service = new ProviderProxyService(httpClient, logger, createWebSocket, saveFile);
    return { service, httpClient, logger, saveFile, sockets, createWebSocket };
  }
});
