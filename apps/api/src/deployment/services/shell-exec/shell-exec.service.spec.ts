import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import { WebSocket } from "ws";

import type { LoggerService } from "@src/core";
import type { DeploymentConfig } from "@src/deployment/config/config.provider";
import {
  buildShellUrl,
  isStrictBase64,
  isValidProviderHost,
  MAX_OUTPUT_SIZE,
  parseExitCode,
  type ShellExecInput,
  type ShellExecOutput,
  ShellExecService,
  toProxyWebSocketUrl
} from "./shell-exec.service";

vi.mock("ws", () => ({
  WebSocket: vi.fn()
}));

const PROXY_URL = "https://proxy.example.com";

describe(ShellExecService.name, () => {
  describe("toProxyWebSocketUrl", () => {
    it("maps https to wss", () => {
      expect(toProxyWebSocketUrl("https://proxy.example.com")).toBe("wss://proxy.example.com");
    });

    it("maps http to ws", () => {
      expect(toProxyWebSocketUrl("http://localhost:3000")).toBe("ws://localhost:3000");
    });
  });

  describe("isValidProviderHost", () => {
    it("accepts an https host with a domain name", () => {
      expect(isValidProviderHost("https://provider.example.com:8443")).toBe(true);
    });

    it("rejects a non-https (http) host", () => {
      expect(isValidProviderHost("http://provider.example.com")).toBe(false);
    });

    it("rejects an IPv4 host", () => {
      expect(isValidProviderHost("https://203.0.113.10:8443")).toBe(false);
    });

    it("rejects an IPv6 host", () => {
      expect(isValidProviderHost("https://[2001:db8::1]:8443")).toBe(false);
    });

    it("rejects a .local host", () => {
      expect(isValidProviderHost("https://provider.local:8443")).toBe(false);
    });

    it("rejects a malformed URL", () => {
      expect(isValidProviderHost("not a url")).toBe(false);
    });
  });

  describe("isStrictBase64", () => {
    it("accepts a valid base64 string", () => {
      expect(isStrictBase64(Buffer.from("hello").toString("base64"))).toBe(true);
    });

    it("rejects prose with spaces", () => {
      expect(isStrictBase64("Received error from provider websocket")).toBe(false);
    });

    it("rejects a string whose length is not a multiple of four", () => {
      expect(isStrictBase64("abc")).toBe(false);
    });

    it("rejects an empty string", () => {
      expect(isStrictBase64("")).toBe(false);
    });
  });

  describe("buildShellUrl (argv mapping)", () => {
    it("maps a single-token argv to cmd0", () => {
      const url = buildShellUrl(createShellExecInput({ command: ["ls"] }));

      expect(url).toContain("/lease/1234/1/1/shell");
      expect(url).toContain("stdin=0");
      expect(url).toContain("tty=0");
      expect(url).toContain("podIndex=0");
      expect(url).toContain("service=test-service");
      expect(url).toContain("cmd0=ls");
      expect(url).not.toContain("cmd1=");
    });

    it("maps a multi-token argv to cmd0..cmdN", () => {
      const url = buildShellUrl(createShellExecInput({ command: ["echo", "hello", "world"] }));

      expect(url).toContain("cmd0=echo");
      expect(url).toContain("cmd1=hello");
      expect(url).toContain("cmd2=world");
      expect(url).not.toContain("cmd3=");
    });

    it("URL-encodes each argv token independently, preserving whitespace inside a token", () => {
      const url = buildShellUrl(createShellExecInput({ command: ["sh", "-c", "echo SECRET=v > /run/secrets/.env"] }));

      expect(url).toContain("cmd0=sh");
      expect(url).toContain("cmd1=-c");
      expect(url).toContain("cmd2=echo%20SECRET%3Dv%20%3E%20%2Frun%2Fsecrets%2F.env");
      expect(url).not.toContain("cmd3=");
    });

    it("encodes reserved characters in a token", () => {
      const url = buildShellUrl(createShellExecInput({ command: ["echo", "a&b?c#d"] }));

      expect(url).toContain("cmd0=echo");
      expect(url).toContain("cmd1=a%26b%3Fc%23d");
    });

    it("encodes the service name", () => {
      const url = buildShellUrl(createShellExecInput({ service: "my service" }));

      expect(url).toContain("service=my%20service");
    });

    it("uses the provided gseq and oseq in the path", () => {
      const url = buildShellUrl(createShellExecInput({ gseq: 3, oseq: 5 }));

      expect(url).toContain("/lease/1234/3/5/shell");
    });

    it("removes a trailing slash from the provider base URL", () => {
      const url = buildShellUrl(createShellExecInput({ providerBaseUrl: "https://provider.example.com/" }));

      expect(url).toMatch(/^https:\/\/provider\.example\.com\/lease/);
    });

    it("URL-encodes the dseq path segment", () => {
      const url = buildShellUrl(createShellExecInput({ dseq: "foo/bar" }));

      expect(url).toContain("/lease/foo%2Fbar/1/1/shell");
    });
  });

  describe("buildShellUrl (stdin flag)", () => {
    it("emits stdin=0 when no stdin is provided", () => {
      const url = buildShellUrl(createShellExecInput());

      expect(url).toContain("stdin=0");
      expect(url).not.toContain("stdin=1");
    });

    it("emits stdin=1 when stdin is provided", () => {
      const url = buildShellUrl(createShellExecInput({ stdin: `SECRET=${faker.string.alphanumeric(16)}` }));

      expect(url).toContain("stdin=1");
      expect(url).not.toContain("stdin=0");
    });

    it("emits stdin=0 for an empty stdin string", () => {
      const url = buildShellUrl(createShellExecInput({ stdin: "" }));

      expect(url).toContain("stdin=0");
      expect(url).not.toContain("stdin=1");
    });

    it("never places the stdin payload in the URL", () => {
      const secret = `SUPER_SECRET_VALUE_${faker.string.alphanumeric(16)}`;
      const url = buildShellUrl(createShellExecInput({ command: ["sh", "-c", "cat > /run/secrets/.env"], stdin: secret }));

      expect(url).not.toContain(secret);
      expect(url).not.toContain(encodeURIComponent(secret));
    });
  });

  describe("parseExitCode", () => {
    it("parses a JSON exit_code body", () => {
      expect(parseExitCode(Buffer.from('{"exit_code":42}'))).toBe(42);
    });

    it("parses a JSON exit_code of 0", () => {
      expect(parseExitCode(Buffer.from('{"exit_code":0}'))).toBe(0);
    });

    it("maps a JSON null exit_code to 0", () => {
      expect(parseExitCode(Buffer.from('{"exit_code":null}'))).toBe(0);
    });

    it("parses a 4-byte little-endian int32 payload", () => {
      expect(parseExitCode(Buffer.from([42, 0, 0, 0]))).toBe(42);
    });

    it("parses a 4-byte LE int32 whose first byte is 0x7B ('{')", () => {
      expect(parseExitCode(Buffer.from([123, 0, 0, 0]))).toBe(123);
    });

    it("returns 0 for an empty payload", () => {
      expect(parseExitCode(Buffer.from([]))).toBe(0);
    });
  });

  describe("execute - provider host pre-check", () => {
    it("returns an Err without opening a socket when the host is not https", async () => {
      const { service } = setup();

      const result = await service.execute(createShellExecInput({ providerBaseUrl: "http://provider.example.com" }));

      expect(result.ok).toBe(false);
      expect(result.val).toContain("Invalid provider host");
      expect(vi.mocked(WebSocket)).not.toHaveBeenCalled();
    });

    it("returns an Err when the host is an IP address", async () => {
      const { service } = setup();

      const result = await service.execute(createShellExecInput({ providerBaseUrl: "https://203.0.113.10:8443" }));

      expect(result.ok).toBe(false);
      expect(result.val).toContain("Invalid provider host");
    });
  });

  describe("execute - proxy routing (D1)", () => {
    it("connects to the PROVIDER_PROXY_URL as wss and sends the envelope with the provider url and no data", async () => {
      const { service, mockWs, getConstructorArgs } = setup();
      const input = createShellExecInput();

      const promise = service.execute(input);
      mockWs._trigger("open");

      const [socketUrl, socketOptions] = getConstructorArgs();
      expect(socketUrl).toBe("wss://proxy.example.com");
      // No connection-level Authorization header: auth travels inside the envelope.
      expect(socketOptions).toBeUndefined();

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const envelope = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(envelope.type).toBe("websocket");
      expect(envelope.url).toBe(buildShellUrl(input));
      expect(envelope.url.startsWith("https://provider.example.com/lease/")).toBe(true);
      expect(envelope.auth).toEqual({ type: "jwt", token: input.jwtToken });
      expect(envelope.providerAddress).toBe(input.providerAddress);
      expect(envelope.isBase64).toBe(true);
      expect("data" in envelope).toBe(false);

      // finish so the promise settles
      mockWs._trigger("message", exitFrameJson(0));
      await promise;
    });
  });

  describe("execute - stdin injection (Task 2b)", () => {
    const STDIN_MARKER = 104;

    it("sends a 104 stdin data frame plus a 104 EOF frame, keeping the secret out of the URL", async () => {
      const { service, mockWs, getConstructorArgs } = setup();
      const secret = `SECRET=${faker.string.alphanumeric(16)}\nAPI_KEY=${faker.string.alphanumeric(12)}`;
      const input = createShellExecInput({
        command: ["sh", "-c", "cat > /run/secrets/.env && chmod 600 /run/secrets/.env"],
        stdin: secret
      });

      const promise = service.execute(input);
      mockWs._trigger("open");

      // Three frames: connect envelope, stdin data, stdin EOF.
      expect(mockWs.send).toHaveBeenCalledTimes(3);

      const connect = JSON.parse(mockWs.send.mock.calls[0][0]);
      const dataFrameMsg = JSON.parse(mockWs.send.mock.calls[1][0]);
      const eofFrameMsg = JSON.parse(mockWs.send.mock.calls[2][0]);

      // Connect frame opens stdin (stdin=1) and carries no data.
      expect(connect.url).toContain("stdin=1");
      expect("data" in connect).toBe(false);

      // The secret must not appear in the socket URL or the connect-frame url.
      const [socketUrl] = getConstructorArgs();
      expect(socketUrl).toBe("wss://proxy.example.com");
      expect(String(socketUrl)).not.toContain(secret);
      expect(connect.url).not.toContain(secret);
      expect(connect.url).not.toContain(encodeURIComponent(secret));

      // Data frame: full envelope + base64 of [104, ...secretBytes].
      expect(dataFrameMsg.type).toBe("websocket");
      expect(dataFrameMsg.url).toBe(connect.url);
      expect(dataFrameMsg.auth).toEqual({ type: "jwt", token: input.jwtToken });
      expect(dataFrameMsg.providerAddress).toBe(input.providerAddress);
      expect(dataFrameMsg.isBase64).toBe(true);
      const dataBytes = Buffer.from(dataFrameMsg.data, "base64");
      expect(dataBytes[0]).toBe(STDIN_MARKER);
      expect(dataBytes.subarray(1).toString("utf-8")).toBe(secret);
      expect([...dataBytes]).toEqual([STDIN_MARKER, ...Buffer.from(secret, "utf-8")]);

      // The base64 payload itself must not be the plaintext secret (sanity).
      expect(dataFrameMsg.data).not.toContain(secret);

      // EOF frame: full envelope + base64 of a bare [104] marker.
      expect(eofFrameMsg.url).toBe(connect.url);
      const eofBytes = Buffer.from(eofFrameMsg.data, "base64");
      expect([...eofBytes]).toEqual([STDIN_MARKER]);

      // A normal exit frame still yields the correct exit code.
      mockWs._trigger("message", exitFrameJson(0));
      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).exitCode).toBe(0);
    });

    it("does not send any 104 frame when stdin is omitted", async () => {
      const { service, mockWs } = setup();
      const input = createShellExecInput();

      const promise = service.execute(input);
      mockWs._trigger("open");

      // Only the connect envelope is sent.
      expect(mockWs.send).toHaveBeenCalledTimes(1);

      const connect = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(connect.url).toContain("stdin=0");
      expect("data" in connect).toBe(false);

      // No sent frame decodes to a 104 stdin marker.
      const has104Frame = mockWs.send.mock.calls.some(([raw]) => {
        const msg = JSON.parse(raw);
        if (typeof msg.data !== "string") return false;
        return Buffer.from(msg.data, "base64")[0] === STDIN_MARKER;
      });
      expect(has104Frame).toBe(false);

      mockWs._trigger("message", exitFrameJson(0));
      const result = await promise;
      expect(result.ok).toBe(true);
    });
  });

  describe("execute - receive / marker handling", () => {
    it("routes marker 100 to stdout with the marker byte stripped", async () => {
      const { service, mockWs } = setup();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", dataFrame(100, "hello"));
      mockWs._trigger("message", exitFrameJson(0));

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).stdout).toBe("hello");
      expect((result.val as ShellExecOutput).stderr).toBe("");
      expect((result.val as ShellExecOutput).exitCode).toBe(0);
    });

    it("routes marker 101 to stderr with the marker byte stripped", async () => {
      const { service, mockWs } = setup();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", dataFrame(101, "boom"));
      mockWs._trigger("message", exitFrameJson(1));

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).stderr).toBe("boom");
      expect((result.val as ShellExecOutput).stdout).toBe("");
      expect((result.val as ShellExecOutput).exitCode).toBe(1);
    });

    it("reads the exit code from a 102 JSON result frame", async () => {
      const { service, mockWs } = setup();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", exitFrameJson(7));

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).exitCode).toBe(7);
    });

    it("reads the exit code from a 102 4-byte LE int32 result frame", async () => {
      const { service, mockWs } = setup();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", bytesFrame([102, 9, 0, 0, 0]));

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).exitCode).toBe(9);
    });

    it("treats a 103 failure frame as a provider error (mapped 502), not output", async () => {
      const { service, mockWs } = setup();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", dataFrame(103, "container terminated"));

      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.val).toContain("Provider error");
      expect(result.val).toContain("container terminated");
    });

    it("decodes a base64-string data payload", async () => {
      const { service, mockWs } = setup();
      const promise = service.execute(createShellExecInput());

      const base64 = Buffer.from([100, ...Buffer.from("hi", "utf-8")]).toString("base64");
      mockWs._trigger("open");
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: { data: base64 } })));
      mockWs._trigger("message", exitFrameJson(0));

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).stdout).toBe("hi");
    });
  });

  describe("execute - error / robustness handling", () => {
    it("resolves an error-key frame as a mapped provider error without decoding it", async () => {
      const { service, mockWs } = setup();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "websocket",
            message: "Message doesn't match expected schema",
            error: "Invalid message format",
            errors: [{ path: ["url"], message: "URL must use https protocol" }]
          })
        )
      );

      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.val).toContain("Provider error: Invalid message format");
      expect(result.val).toContain("url: URL must use https protocol");
    });

    it("drops a non-base64 string payload instead of leaking it as output", async () => {
      const { service, mockWs, logger } = setup();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: { data: "this is not base64 !!!" } })));
      mockWs._trigger("message", exitFrameJson(0));

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).stdout).toBe("");
      expect((result.val as ShellExecOutput).stderr).toBe("");
      expect(logger.warn).toHaveBeenCalled();
    });

    it("ignores pong keepalive frames without corrupting output", async () => {
      const { service, mockWs } = setup();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", dataFrame(100, "Hello "));
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "pong" })));
      mockWs._trigger("message", dataFrame(100, "World"));
      mockWs._trigger("message", exitFrameJson(0));

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).stdout).toBe("Hello World");
    });

    it("returns an Err with the connection message on a socket error", async () => {
      const { service, mockWs } = setup();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("error", new Error("ECONNREFUSED"));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.val).toContain("WebSocket connection failed: ECONNREFUSED");
    });

    it("returns an Err when the socket closes before an exit code arrives", async () => {
      const { service, mockWs } = setup();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.val).toBe("Connection closed without exit code");
    });
  });

  describe("execute - truncation (M5)", () => {
    it("sets truncated but still reports the correct exit code when output exceeds the cap", async () => {
      const { service, mockWs } = setup();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", dataFrame(100, "A".repeat(MAX_OUTPUT_SIZE + 1)));
      // keeps reading past the cap so the exit frame is still processed
      mockWs._trigger("message", exitFrameJson(3));

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).truncated).toBe(true);
      expect((result.val as ShellExecOutput).exitCode).toBe(3);
    });

    it("does not truncate output that is exactly at the cap", async () => {
      const { service, mockWs } = setup();
      const promise = service.execute(createShellExecInput());

      const data = "A".repeat(MAX_OUTPUT_SIZE);
      mockWs._trigger("open");
      mockWs._trigger("message", dataFrame(100, data));
      mockWs._trigger("message", exitFrameJson(0));

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).truncated).toBe(false);
      expect((result.val as ShellExecOutput).stdout.length).toBe(MAX_OUTPUT_SIZE);
    });
  });

  describe("execute - auth expiry (M4)", () => {
    it("maps a 4001 close frame to an auth-expired error, not a generic provider error", async () => {
      const { service, mockWs } = setup();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: "", closed: true, code: 4001, reason: "token expired" })));

      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.val).toContain("Auth expired");
      expect(result.val).not.toContain("Provider error");
    });

    it("maps a 4003 ws close event to an auth-expired error", async () => {
      const { service, mockWs } = setup();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("close", 4003, Buffer.from("unauthorized"));

      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.val).toContain("Auth expired");
    });
  });

  describe("execute - timeout", () => {
    it("resolves with a timeout error when the command runs past the timeout", async () => {
      vi.useFakeTimers();
      const { service, mockWs } = setup();
      const promise = service.execute(createShellExecInput({ timeout: 5 }));

      mockWs._trigger("open");
      vi.advanceTimersByTime(5000);

      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.val).toBe("Command timed out");
      expect(mockWs.close).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  function createMockWebSocket() {
    const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
    return {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        (handlers[event] ??= []).push(handler);
      }),
      send: vi.fn(),
      close: vi.fn(),
      _trigger(event: string, ...args: unknown[]) {
        (handlers[event] || []).forEach(h => h(...args));
      }
    };
  }

  function setup(overrides: { proxyUrl?: string } = {}) {
    const mockWs = createMockWebSocket();
    let constructorArgs: unknown[] = [];
    vi.mocked(WebSocket).mockImplementation(function (this: unknown, ...args: unknown[]) {
      constructorArgs = args;
      return mockWs as unknown as WebSocket;
    } as unknown as typeof WebSocket);

    const logger = mock<LoggerService>();
    const config = { PROVIDER_PROXY_URL: overrides.proxyUrl ?? PROXY_URL } as DeploymentConfig;
    const service = new ShellExecService(config, logger);

    return { service, mockWs, logger, getConstructorArgs: () => constructorArgs };
  }

  function createShellExecInput(overrides?: Partial<ShellExecInput>): ShellExecInput {
    return {
      providerBaseUrl: overrides?.providerBaseUrl ?? "https://provider.example.com",
      providerAddress: overrides?.providerAddress ?? faker.string.alphanumeric(44),
      dseq: overrides?.dseq ?? "1234",
      gseq: overrides?.gseq ?? 1,
      oseq: overrides?.oseq ?? 1,
      service: overrides?.service ?? "test-service",
      command: overrides?.command ?? ["echo", "Hello"],
      stdin: overrides?.stdin,
      timeout: overrides?.timeout ?? 60,
      jwtToken: overrides?.jwtToken ?? faker.string.alphanumeric(100)
    };
  }

  // Provider -> proxy -> client frame shape: { type:"websocket", message:{ type:"Buffer", data:number[] } }
  function bytesFrame(data: number[]): Buffer {
    return Buffer.from(JSON.stringify({ type: "websocket", message: { type: "Buffer", data } }));
  }

  function dataFrame(marker: number, text: string): Buffer {
    return bytesFrame([marker, ...Buffer.from(text, "utf-8")]);
  }

  function exitFrameJson(code: number): Buffer {
    return bytesFrame([102, ...Buffer.from(JSON.stringify({ exit_code: code }), "utf-8")]);
  }
});
