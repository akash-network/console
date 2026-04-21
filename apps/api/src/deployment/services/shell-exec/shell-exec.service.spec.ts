import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";

import { buildShellUrl, parseShellMessage, type ShellExecOutput, ShellExecService } from "./shell-exec.service";

vi.mock("ws", () => ({
  WebSocket: vi.fn()
}));

describe(ShellExecService.name, () => {
  describe("buildShellUrl", () => {
    it("builds correct URL with single word command", () => {
      const input = createShellExecInput({ command: "ls" });

      const url = buildShellUrl(input);

      expect(url).toContain("/lease/test-dseq/1/1/shell");
      expect(url).toContain("stdin=0");
      expect(url).toContain("tty=0");
      expect(url).toContain("podIndex=0");
      expect(url).toContain("service=test-service");
      expect(url).toContain("cmd0=ls");
    });

    it("builds correct URL with multi-word command", () => {
      const input = createShellExecInput({ command: "echo hello world" });

      const url = buildShellUrl(input);

      expect(url).toContain("/lease/test-dseq/1/1/shell");
      expect(url).toContain("cmd0=echo");
      expect(url).toContain("cmd1=hello");
      expect(url).toContain("cmd2=world");
    });

    it("builds correct URL with command containing path", () => {
      const input = createShellExecInput({ command: "cat /run/secrets/db_password" });

      const url = buildShellUrl(input);

      expect(url).toContain("/lease/test-dseq/1/1/shell");
      expect(url).toContain("cmd0=cat");
      expect(url).toContain("cmd1=%2Frun%2Fsecrets%2Fdb_password");
    });

    it("removes trailing slash from provider base URL", () => {
      const input = createShellExecInput({ providerBaseUrl: "https://provider.example.com/" });

      const url = buildShellUrl(input);

      expect(url).toMatch(/^https:\/\/provider\.example\.com\/lease/);
    });

    it("handles special characters in command", () => {
      const input = createShellExecInput({ command: "echo hello&world" });

      const url = buildShellUrl(input);

      expect(url).toContain("cmd0=echo");
      expect(url).toContain("cmd1=hello%26world");
    });

    it("encodes service name with spaces", () => {
      const input = createShellExecInput({ service: "my service" });

      const url = buildShellUrl(input);

      expect(url).toContain("service=my%20service");
    });

    it("builds URL with correct gseq and oseq", () => {
      const input = createShellExecInput({ gseq: 3, oseq: 5 });

      const url = buildShellUrl(input);

      expect(url).toContain("/lease/test-dseq/3/5/shell");
    });

    it("handles empty command string", () => {
      const input = createShellExecInput({ command: "" });

      const url = buildShellUrl(input);

      expect(url).toContain("cmd0=");
      expect(url).not.toContain("cmd1=");
    });

    it("handles whitespace-only command string", () => {
      const input = createShellExecInput({ command: "   " });

      const url = buildShellUrl(input);

      expect(url).toContain("cmd0=");
      expect(url).not.toContain("cmd1=");
    });

    it("handles command with consecutive spaces", () => {
      const input = createShellExecInput({ command: "echo  hello" });

      const url = buildShellUrl(input);

      expect(url).toContain("cmd0=echo");
      expect(url).toContain("cmd1=hello");
    });

    it("whitespace-only command should not produce multiple cmd params", () => {
      const input = createShellExecInput({ command: "   " });

      const url = buildShellUrl(input);

      expect(url).not.toContain("cmd1=");
      expect(url).not.toContain("cmd2=");
      expect(url).not.toContain("cmd3=");
    });

    it("command with newline should be URL-encoded not literally split", () => {
      const input = createShellExecInput({ command: "echo\nhello" });

      const url = buildShellUrl(input);

      expect(url).toContain("cmd0=echo%0Ahello");
      expect(url).not.toContain("cmd1=");
    });

    it("command with leading spaces should filter them out", () => {
      const input = createShellExecInput({ command: "   echo hello" });

      const url = buildShellUrl(input);

      expect(url).toContain("cmd0=echo");
      expect(url).toContain("cmd1=hello");
      expect(url).not.toContain("cmd2=");
    });

    it("command with tab should be preserved in the command part", () => {
      const input = createShellExecInput({ command: "echo\thello" });

      const url = buildShellUrl(input);

      expect(url).toContain("cmd0=echo%09hello");
    });

    it("tabs are not treated as whitespace delimiters (only space splits)", () => {
      const input = createShellExecInput({ command: "echo \t hello" });

      const url = buildShellUrl(input);

      expect(url).toContain("cmd0=echo");
      expect(url).toContain("cmd1=%09");
      expect(url).toContain("cmd2=hello");
    });

    it("command with multiple consecutive tabs stays as single param (tabs not delimiters)", () => {
      const input = createShellExecInput({ command: "cmd\t\targ" });

      const url = buildShellUrl(input);

      expect(url).toContain("cmd0=cmd%09%09arg");
      expect(url).not.toContain("cmd1=");
    });

    it("handles service name with hash fragment character", () => {
      const input = createShellExecInput({ service: "svc#1" });

      const url = buildShellUrl(input);

      expect(url).toContain("service=svc%231");
    });

    it("handles service name with question mark", () => {
      const input = createShellExecInput({ service: "my?service" });

      const url = buildShellUrl(input);

      expect(url).toContain("service=my%3Fservice");
    });

    it("handles provider base URL without trailing slash", () => {
      const input = createShellExecInput({ providerBaseUrl: "https://provider.example.com" });

      const url = buildShellUrl(input);

      expect(url).toMatch(/^https:\/\/provider\.example\.com\/lease/);
    });

    it("command with carriage return should be URL-encoded", () => {
      const input = createShellExecInput({ command: "echo\rhello" });

      const url = buildShellUrl(input);

      expect(url).toContain("cmd0=echo%0Dhello");
      expect(url).not.toContain("cmd1=");
    });

    it("handles Unicode characters in command", () => {
      const input = createShellExecInput({ command: "echo 日本語" });

      const url = buildShellUrl(input);

      expect(url).toContain("cmd0=echo");
      expect(url).toContain("cmd1=%E6%97%A5%E6%9C%AC%E8%AA%9E");
    });

    it("handles gseq of 0 in URL path", () => {
      const input = createShellExecInput({ gseq: 0 });

      const url = buildShellUrl(input);

      expect(url).toContain("/lease/test-dseq/0/1/shell");
    });

    it("handles oseq of 0 in URL path", () => {
      const input = createShellExecInput({ oseq: 0 });

      const url = buildShellUrl(input);

      expect(url).toContain("/lease/test-dseq/1/0/shell");
    });

    it("builds URL with empty dseq (all slashes preserved)", () => {
      const input = createShellExecInput({ dseq: "" });

      const url = buildShellUrl(input);

      expect(url).toContain("/lease//1/1/shell");
    });

    it("builds URL with empty service name", () => {
      const input = createShellExecInput({ service: "" });

      const url = buildShellUrl(input);

      expect(url).toContain("service=");
    });

    it("builds URL with empty providerBaseUrl (should not produce double slash)", () => {
      const input = createShellExecInput({ providerBaseUrl: "" });

      const url = buildShellUrl(input);

      expect(url).toMatch(/^\/lease/);
    });
  });

  describe("binary message stream marker edge cases", () => {
    it("binary message with stream marker 3 (unexpected) should not corrupt state", () => {
      const result = parseShellMessage("[3, 72, 101, 108, 108, 111]");

      expect(result).toBeNull();
    });

    it("binary message with stream marker 255 (unexpected) should not corrupt state", () => {
      const result = parseShellMessage("[255, 72]");

      expect(result).toBeNull();
    });
  });

  describe("parseShellMessage", () => {
    it("should return exit_code parsed from JSON message", () => {
      const result = parseShellMessage('{"exit_code": 42}');

      expect(result).toEqual({ type: "exit_code", exit_code: 42 });
    });

    it("should return data with stream from JSON message containing message field", () => {
      const result = parseShellMessage('{"message": "hello"}');

      expect(result).toEqual({ type: "data", data: "hello", stream: "stdout" });
    });

    it("should return null for non-JSON string message", () => {
      const result = parseShellMessage("plain text");

      expect(result).toBeNull();
    });
  });

  describe("parseShellMessage edge cases", () => {
    it("returns null for empty JSON object", () => {
      const result = parseShellMessage("{}");

      expect(result).toBeNull();
    });

    it("returns null for JSON with null values", () => {
      const result = parseShellMessage('{"exit_code": null, "message": null}');

      expect(result).toBeNull();
    });

    it("prefers exit_code over message when both present", () => {
      const result = parseShellMessage('{"exit_code": 0, "message": "ignored"}');

      expect(result).toEqual({ type: "exit_code", exit_code: 0 });
    });

    it("returns null for JSON with undefined values", () => {
      const result = parseShellMessage('{"exit_code": undefined}');

      expect(result).toBeNull();
    });

    it("returns null for malformed JSON", () => {
      const result = parseShellMessage('{"exit_code": }');

      expect(result).toBeNull();
    });

    it("returns null when exit_code is string instead of number", () => {
      const result = parseShellMessage('{"exit_code": "42"}');

      expect(result).toBeNull();
    });

    it("returns null when exit_code is boolean true", () => {
      const result = parseShellMessage('{"exit_code": true}');

      expect(result).toBeNull();
    });

    it("returns null when exit_code is boolean false", () => {
      const result = parseShellMessage('{"exit_code": false}');

      expect(result).toBeNull();
    });

    it("returns null when message is number instead of string", () => {
      const result = parseShellMessage('{"message": 123}');

      expect(result).toBeNull();
    });

    it("returns null for array input masquerading as JSON object", () => {
      const result = parseShellMessage("[]");

      expect(result).toBeNull();
    });

    it("returns null for string input that looks like JSON but isn't", () => {
      const result = parseShellMessage('"not an object"');

      expect(result).toBeNull();
    });

    it("returns null for number input", () => {
      const result = parseShellMessage("123");

      expect(result).toBeNull();
    });

    it("returns null for boolean JSON", () => {
      const result = parseShellMessage("true");

      expect(result).toBeNull();
    });
  });

  describe("binary message parsing edge cases", () => {
    it("ignores empty binary array message", () => {
      const result = parseShellMessage("[]");

      expect(result).toBeNull();
    });

    it("ignores binary message with only stream marker and no payload", () => {
      const result = parseShellMessage("[1]");

      expect(result).toBeNull();
    });

    it("ignores binary message with invalid stream marker byte", () => {
      const result = parseShellMessage("[3, 72, 101, 108, 108, 111]");

      expect(result).toBeNull();
    });

    it("handles exit_code 0 as valid number", () => {
      const result = parseShellMessage('{"exit_code": 0}');

      expect(result).toEqual({ type: "exit_code", exit_code: 0 });
    });

    it("handles negative exit_code", () => {
      const result = parseShellMessage('{"exit_code": -1}');

      expect(result).toEqual({ type: "exit_code", exit_code: -1 });
    });

    it("returns null for exit_code as NaN", () => {
      const result = parseShellMessage('{"exit_code": NaN}');

      expect(result).toBeNull();
    });

    it("returns null for exit_code as Infinity", () => {
      const result = parseShellMessage('{"exit_code": Infinity}');

      expect(result).toBeNull();
    });

    it("returns null for exit_code as -Infinity", () => {
      const result = parseShellMessage('{"exit_code": -Infinity}');

      expect(result).toBeNull();
    });

    it("returns null for message as empty string", () => {
      const result = parseShellMessage('{"message": ""}');

      expect(result).toBeNull();
    });

    it("handles very large exit_code number", () => {
      const result = parseShellMessage('{"exit_code": 9999999999}');

      expect(result).toEqual({ type: "exit_code", exit_code: 9999999999 });
    });

    it("should fall back to message when exit_code is non-numeric string", () => {
      const result = parseShellMessage('{"exit_code": "invalid", "message": "hello"}');

      expect(result).toEqual({ type: "data", data: "hello", stream: "stdout" });
    });

    it("should fall back to message when exit_code is object", () => {
      const result = parseShellMessage('{"exit_code": {}, "message": "hello"}');

      expect(result).toEqual({ type: "data", data: "hello", stream: "stdout" });
    });

    it("returns null for JSON starting with whitespace before brace", () => {
      const result = parseShellMessage('  {"exit_code": 0}');

      expect(result).toBeNull();
    });
  });

  describe("binary message edge cases", () => {
    it("should handle exit_code 0 in JSON message", () => {
      // JSON messages with exit_code are handled by parseShellMessage
      const result = parseShellMessage('{"exit_code": 0}');

      expect(result).toEqual({ type: "exit_code", exit_code: 0 });
    });

    it("should return null for binary array with unexpected stream marker byte", () => {
      // Stream marker 3 is not valid (only 1=stdout, 2=stderr are valid)
      const result = parseShellMessage("[3, 72, 101, 108, 108, 111]");

      expect(result).toBeNull();
    });

    it("should return null for empty binary array", () => {
      const result = parseShellMessage("[]");

      expect(result).toBeNull();
    });
  });

  describe("buildShellUrl edge cases", () => {
    it("handles command containing backslash characters", () => {
      const input = createShellExecInput({ command: "echo \\hello\\world" });

      const url = buildShellUrl(input);

      expect(url).toContain("cmd0=echo");
      expect(url).toContain("cmd1=%5Chello%5Cworld");
    });

    it("URL-encodes dseq containing forward slash to prevent path traversal", () => {
      const input = createShellExecInput({ dseq: "foo/bar/baz" });

      const url = buildShellUrl(input);

      expect(url).toContain("/lease/foo%2Fbar%2Fbaz/");
    });

    it("handles negative gseq by including it in URL path (no validation)", () => {
      const input = createShellExecInput({ gseq: -1 });

      const url = buildShellUrl(input);

      expect(url).toContain("/lease/test-dseq/-1/1/shell");
    });

    it("handles negative oseq by including it in URL path (no validation)", () => {
      const input = createShellExecInput({ oseq: -5 });

      const url = buildShellUrl(input);

      expect(url).toContain("/lease/test-dseq/1/-5/shell");
    });

    it("command consisting only of tabs is trimmed to empty (tabs are whitespace)", () => {
      const input = createShellExecInput({ command: "\t\t" });

      const url = buildShellUrl(input);

      expect(url).toContain("cmd0=");
      expect(url).not.toContain("cmd1=");
    });

    it("command with only newlines and tabs is trimmed to empty like tabs (all Unicode whitespace trimmed by JS trim)", () => {
      const input = createShellExecInput({ command: "\n\t\n" });

      const url = buildShellUrl(input);

      expect(url).toContain("cmd0=");
      expect(url).not.toContain("cmd1=");
    });
  });

  describe("binary single-byte exit code edge cases", () => {
    it("binary message [0] as single byte exit code should set exitCode to 0", () => {
      const result = parseShellMessage("[0]");

      expect(result).toBeNull();
    });

    it("binary message with stream marker 1 and no payload should be ignored", () => {
      const result = parseShellMessage("[1]");

      expect(result).toBeNull();
    });

    it("binary message [0, 72] should handle exit code 0 via firstByte check", () => {
      const result = parseShellMessage("[0, 72]");

      expect(result).toBeNull();
    });

    it("binary message [0, 72, 101, 108, 108, 111] with stream marker 0 AND payload bytes should be ignored (exit code 0 followed by data is not valid)", () => {
      const result = parseShellMessage("[0, 72, 101, 108, 108, 111]");

      expect(result).toBeNull();
    });

    it("NaN exit_code should be rejected (typeof NaN === 'number' in JS)", () => {
      const result = parseShellMessage('{"exit_code": NaN}');

      expect(result).toBeNull();
    });
  });

  describe("parseShellMessage edge cases", () => {
    it("returns null for JSON string null literal", () => {
      const result = parseShellMessage("null");

      expect(result).toBeNull();
    });

    it("returns null for empty string input", () => {
      const result = parseShellMessage("");

      expect(result).toBeNull();
    });
  });

  function createShellExecInput(
    overrides?: Partial<{ command: string; timeout: number; providerBaseUrl: string; gseq: number; oseq: number; service: string; dseq: string }>
  ): Parameters<typeof ShellExecService.prototype.execute>[0] {
    return {
      providerBaseUrl: overrides?.providerBaseUrl ?? "https://provider.example.com",
      providerAddress: faker.string.alphanumeric(44),
      dseq: overrides?.dseq ?? "test-dseq",
      gseq: overrides?.gseq ?? 1,
      oseq: overrides?.oseq ?? 1,
      service: overrides?.service ?? "test-service",
      command: overrides?.command ?? "echo Hello",
      timeout: overrides?.timeout ?? 60,
      jwtToken: faker.string.alphanumeric(100)
    };
  }

  describe("buildShellUrl edge cases - undefined/null providerBaseUrl", () => {
    it("throws TypeError when providerBaseUrl is undefined (replace on undefined)", () => {
      const input = {
        providerBaseUrl: undefined as any,
        dseq: "test-dseq",
        gseq: 1,
        oseq: 1,
        service: "test-service",
        command: "echo hello"
      };

      expect(() => buildShellUrl(input)).toThrow(TypeError);
    });

    it("throws TypeError when providerBaseUrl is null (replace on null)", () => {
      const input = {
        providerBaseUrl: null as any,
        dseq: "test-dseq",
        gseq: 1,
        oseq: 1,
        service: "test-service",
        command: "echo hello"
      };

      expect(() => buildShellUrl(input)).toThrow(TypeError);
    });
  });

  describe("buildShellUrl edge cases - undefined inputs", () => {
    it("throws TypeError when command is undefined (trim on undefined)", () => {
      const input = {
        providerBaseUrl: "https://provider.example.com",
        dseq: "test-dseq",
        gseq: 1,
        oseq: 1,
        service: "test-service",
        command: undefined as any
      };

      expect(() => buildShellUrl(input)).toThrow(TypeError);
    });

    it("throws TypeError when command is null (trim on null)", () => {
      const input = {
        providerBaseUrl: "https://provider.example.com",
        dseq: "test-dseq",
        gseq: 1,
        oseq: 1,
        service: "test-service",
        command: null as any
      };

      expect(() => buildShellUrl(input)).toThrow(TypeError);
    });

    it("encodes undefined dseq as literal string 'undefined' in URL path", () => {
      const input = {
        providerBaseUrl: "https://provider.example.com",
        dseq: undefined as any,
        gseq: 1,
        oseq: 1,
        service: "test-service",
        command: "echo hello"
      };

      const url = buildShellUrl(input);

      expect(url).toContain("/lease/undefined/1/1/shell");
    });

    it("encodes undefined service as literal string 'undefined'", () => {
      const input = {
        providerBaseUrl: "https://provider.example.com",
        dseq: "test-dseq",
        gseq: 1,
        oseq: 1,
        service: undefined as any,
        command: "echo hello"
      };

      const url = buildShellUrl(input);

      expect(url).toContain("service=undefined");
    });
  });

  describe("parseShellMessage edge cases - null and object message types", () => {
    it("returns null when message.message is null (binary path)", () => {
      const result = parseShellMessage("[1, null]");

      expect(result).toBeNull();
    });

    it("returns null when message.message is an object instead of string/array", () => {
      const result = parseShellMessage('{"type": "websocket", "message": {}}');

      expect(result).toBeNull();
    });

    it("returns null when message.message is a number instead of string/array", () => {
      const result = parseShellMessage('{"type": "websocket", "message": 123}');

      expect(result).toBeNull();
    });
  });

  describe("binary message parsing - stream marker 0 with payload", () => {
    it("binary message [0, 72, 101] with stream marker 0 AND payload bytes should be ignored (exit code not set)", () => {
      const result = parseShellMessage("[0, 72, 101, 108, 108, 111]");

      expect(result).toBeNull();
    });

    it("binary message [0, 0] with stream marker 0 AND null byte should be ignored", () => {
      const result = parseShellMessage("[0, 0]");

      expect(result).toBeNull();
    });

    it("binary message [1, 256] with out-of-range byte should not crash (replacement character)", () => {
      const result = parseShellMessage("[1, 256]");

      expect(result).toBeNull();
    });

    it("binary message [1, -1] with negative byte value should not crash", () => {
      const result = parseShellMessage("[1, -1]");

      expect(result).toBeNull();
    });
  });

  describe("parseShellMessage - whitespace-only message string", () => {
    it("returns data for message with only spaces (length > 0 check passes)", () => {
      const result = parseShellMessage('{"message": "   "}');

      expect(result).toEqual({ type: "data", data: "   ", stream: "stdout" });
    });

    it("returns data for message with only tabs", () => {
      const result = parseShellMessage('{"message": "\\t\\t"}');

      expect(result).toEqual({ type: "data", data: "\t\t", stream: "stdout" });
    });

    it("returns data for message containing only newlines (whitespace IS valid shell output)", () => {
      const result = parseShellMessage('{"message": "\\n\\n\\n"}');

      expect(result).toEqual({ type: "data", data: "\n\n\n", stream: "stdout" });
    });

    it("returns data for message containing only carriage returns", () => {
      const result = parseShellMessage('{"message": "\\r\\r\\r"}');

      expect(result).toEqual({ type: "data", data: "\r\r\r", stream: "stdout" });
    });

    it("returns data for message containing mixed whitespace (space, newline, tab)", () => {
      const result = parseShellMessage('{"message": " \\n\\t "}');

      expect(result).toEqual({ type: "data", data: " \n\t ", stream: "stdout" });
    });
  });

  describe("parseShellMessage - binary stderr stream marker 2", () => {
    it("binary message [2, 72, 101, 108, 108, 111] with stderr stream marker returns null (binary path)", () => {
      const result = parseShellMessage("[2, 72, 101, 108, 108, 111]");

      expect(result).toBeNull();
    });

    it("binary message [2] with stderr stream marker and no payload returns null", () => {
      const result = parseShellMessage("[2]");

      expect(result).toBeNull();
    });
  });

  describe("execute - message.error field edge cases", () => {
    function createMockWebSocket() {
      const handlers: Record<string, Array<(...args: any[]) => void>> = {};
      return {
        on: vi.fn((event: string, handler: (...args: any[]) => void) => {
          if (!handlers[event]) handlers[event] = [];
          handlers[event].push(handler);
        }),
        send: vi.fn(),
        close: vi.fn(),
        _trigger(event: string, ...args: any[]) {
          (handlers[event] || []).forEach(h => h(...args));
        }
      };
    }

    it("message.error truthy string returns Err with provider error", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: '{"message": "some data"}' })));
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "error", error: "provider connection failed" })));

      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.val).toContain("Provider error: provider connection failed");
    });

    it("WebSocket error event returns Err with connection failure message", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: '{"message": "partial"}' })));
      mockWs._trigger("error", new Error("ECONNREFUSED"));

      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.val).toContain("WebSocket connection failed: ECONNREFUSED");
    });
  });

  describe("execute - timeout + close double resolve", () => {
    function createMockWebSocket() {
      const handlers: Record<string, Array<(...args: any[]) => void>> = {};
      return {
        on: vi.fn((event: string, handler: (...args: any[]) => void) => {
          if (!handlers[event]) handlers[event] = [];
          handlers[event].push(handler);
        }),
        send: vi.fn(),
        close: vi.fn(),
        _trigger(event: string, ...args: any[]) {
          (handlers[event] || []).forEach(h => h(...args));
        }
      };
    }

    it("timeout resolving then close event firing causes double resolve (first Err should win)", async () => {
      vi.useFakeTimers();
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput({ timeout: 5 }));

      mockWs._trigger("open");

      vi.advanceTimersByTime(5000);

      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.val).toBe("Command timed out");

      vi.useRealTimers();
    });

    it("negative timeout fires immediately returning timeout error", async () => {
      vi.useFakeTimers();
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput({ timeout: -1 }));

      mockWs._trigger("open");

      vi.advanceTimersByTime(0);

      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.val).toBe("Command timed out");

      vi.useRealTimers();
    });
  });

  describe("execute - string message parse failure silently dropped", () => {
    function createMockWebSocket() {
      const handlers: Record<string, Array<(...args: any[]) => void>> = {};
      return {
        on: vi.fn((event: string, handler: (...args: any[]) => void) => {
          if (!handlers[event]) handlers[event] = [];
          handlers[event].push(handler);
        }),
        send: vi.fn(),
        close: vi.fn(),
        _trigger(event: string, ...args: any[]) {
          (handlers[event] || []).forEach(h => h(...args));
        }
      };
    }

    it("string message that fails parseShellMessage is silently dropped (not accumulated)", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: JSON.stringify({ message: "first" }) })));
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: "this is not JSON so parseShellMessage returns null" })));
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: JSON.stringify({ message: "third" }) })));
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: '{"exit_code": 0}' })));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).stdout).toBe("firstthird");
    });
  });

  describe("execute - closed message after exitCode already set", () => {
    function createMockWebSocket() {
      const handlers: Record<string, Array<(...args: any[]) => void>> = {};
      return {
        on: vi.fn((event: string, handler: (...args: any[]) => void) => {
          if (!handlers[event]) handlers[event] = [];
          handlers[event].push(handler);
        }),
        send: vi.fn(),
        close: vi.fn(),
        _trigger(event: string, ...args: any[]) {
          (handlers[event] || []).forEach(h => h(...args));
        }
      };
    }

    it("message.closed true arrives after exit_code 0 - exitCode stays 0 (first exit_code wins)", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: '{"exit_code": 0}' })));
      mockWs._trigger("message", Buffer.from(JSON.stringify({ closed: true })));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).exitCode).toBe(0);
    });
  });

  describe("buildShellUrl - command with multiple consecutive spaces", () => {
    it("command with three consecutive spaces between words splits correctly", () => {
      const input = createShellExecInput({ command: "echo   hello   world" });

      const url = buildShellUrl(input);

      expect(url).toContain("cmd0=echo");
      expect(url).toContain("cmd1=hello");
      expect(url).toContain("cmd2=world");
      expect(url).not.toContain("cmd3=");
    });
  });

  describe("execute - WebSocket integration edge cases", () => {
    function createMockWebSocket() {
      const handlers: Record<string, Array<(...args: any[]) => void>> = {};
      return {
        on: vi.fn((event: string, handler: (...args: any[]) => void) => {
          if (!handlers[event]) handlers[event] = [];
          handlers[event].push(handler);
        }),
        send: vi.fn(),
        close: vi.fn(),
        _trigger(event: string, ...args: any[]) {
          (handlers[event] || []).forEach(h => h(...args));
        }
      };
    }

    it("discards binary payload with stream marker 0 instead of routing to stdout or stderr", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "websocket",
            message: [0, 72, 101, 108, 108, 111]
          })
        )
      );
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).stdout).toBe("");
      expect((result.val as ShellExecOutput).exitCode).toBe(0);
    });

    it("allows combined binary stdout+stderr to exceed MAX_OUTPUT_SIZE by checking each stream independently", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");

      const halfSize = 524288;
      const stdoutData = new Array(halfSize + 1).fill(65);
      stdoutData[0] = 1;
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: stdoutData })));

      const stderrData = new Array(halfSize + 2).fill(66);
      stderrData[0] = 2;
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: stderrData })));

      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: [0] })));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).truncated).toBe(true);
    });

    it("binary stream marker 1 (stdout) appends data to stdout and combines with string messages", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: JSON.stringify({ message: "string-" }) })));
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: [1, 66, 105, 110, 97, 114, 121] })));
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: '{"exit_code": 0}' })));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).stdout).toBe("string-Binary");
      expect((result.val as ShellExecOutput).exitCode).toBe(0);
    });

    it("unknown message type does not corrupt stdout accumulation", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: JSON.stringify({ message: "first" }) })));
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "unknown", data: "corrupt" })));
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: JSON.stringify({ message: "second" }) })));
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: '{"exit_code": 0}' })));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).stdout).toBe("firstsecond");
      expect((result.val as ShellExecOutput).exitCode).toBe(0);
    });

    it("binary message with stream marker 1 and no payload is ignored (length check)", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: JSON.stringify({ message: "data" }) })));
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: [1] })));
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: '{"exit_code": 0}' })));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).stdout).toBe("data");
      expect((result.val as ShellExecOutput).exitCode).toBe(0);
    });

    it("leaves promise unresolved when error event fires without close event", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput({ timeout: 30 }));

      mockWs._trigger("error", new Error("connection failed"));

      const raceResult = await Promise.race([
        promise.then(r => ({ status: "resolved" as const, result: r })),
        new Promise<{ status: "pending" }>(resolve => setTimeout(() => resolve({ status: "pending" }), 100))
      ]);

      mockWs._trigger("close");

      expect(raceResult.status).toBe("resolved");
    });

    it("error event resolves before close event can fire (first resolve wins)", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("error", new Error("connection failed"));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.val).toContain("WebSocket connection failed: connection failed");
    });

    it("discards accumulated stdout data when timeout fires returning only error string", async () => {
      vi.useFakeTimers();
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput({ timeout: 5 }));

      mockWs._trigger("open");
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: '{"message": "partial output"}' })));

      vi.advanceTimersByTime(5000);

      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.val).toBe("Command timed out");

      vi.useRealTimers();
    });

    it("defaults exitCode to 1 when message.closed arrives with no prior exit_code", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", Buffer.from(JSON.stringify({ closed: true })));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).exitCode).toBe(1);
    });

    it("uses last exit_code when multiple exit_code JSON messages arrive sequentially", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: '{"exit_code": 0}' })));
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: '{"exit_code": 42}' })));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).exitCode).toBe(42);
    });

    it("string message path falls back to message when exit_code is non-numeric string", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const shellExecService = new ShellExecService();
      const promise = shellExecService.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "websocket",
            message: JSON.stringify({ exit_code: "invalid", message: "fallback data" })
          })
        )
      );
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: '{"exit_code": 0}' })));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).stdout).toBe("fallback data");
      expect((result.val as ShellExecOutput).exitCode).toBe(0);
    });

    it("resolves with timeout error immediately when timeout is 0 (setTimeout 0ms)", async () => {
      vi.useFakeTimers();
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput({ timeout: 0 }));

      vi.advanceTimersByTime(0);

      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.val).toBe("Command timed out");
      expect(mockWs.close).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("resolves with error when WebSocket closes without ever receiving exit code", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.val).toBe("Connection closed without exit code");
    });

    it("message arriving before timeout does not cause double resolve when timeout fires and close event also fires", async () => {
      vi.useFakeTimers();
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput({ timeout: 5 }));

      mockWs._trigger("open");
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: '{"exit_code": 0}' })));

      vi.advanceTimersByTime(5000);
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).exitCode).toBe(0);

      vi.useRealTimers();
    });

    it("message.closed true followed by close event does not double-resolve (closed sets exitCode=1, close resolves)", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger("message", Buffer.from(JSON.stringify({ closed: true })));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).exitCode).toBe(1);
    });

    it("string message path never routes to stderr even with error-like content (parseShellMessage always returns stream: stdout)", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "websocket",
            message: JSON.stringify({ message: "error: something went wrong" })
          })
        )
      );
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: '{"exit_code": 0}' })));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).stdout).toBe("error: something went wrong");
      expect((result.val as ShellExecOutput).stderr).toBe("");
    });

    it("binary payload with firstByte 3-255 is silently discarded (dead zone in protocol)", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "websocket",
            message: [3, 72, 101, 108, 108, 111]
          })
        )
      );
      mockWs._trigger(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "websocket",
            message: [255, 87, 111, 114, 108, 100]
          })
        )
      );
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: [0] })));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).stdout).toBe("");
      expect((result.val as ShellExecOutput).stderr).toBe("");
      expect((result.val as ShellExecOutput).exitCode).toBe(0);
    });

    it("output at exactly MAX_OUTPUT_SIZE (1048576 bytes) is NOT truncated", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      const exactSize = 1024 * 1024;
      const data = "A".repeat(exactSize);
      mockWs._trigger(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "websocket",
            message: JSON.stringify({ message: data })
          })
        )
      );
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: '{"exit_code": 0}' })));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).truncated).toBe(false);
      expect((result.val as ShellExecOutput).stdout).toBe(data);
      expect((result.val as ShellExecOutput).stdout.length).toBe(1048576);
    });

    it("output exceeding MAX_OUTPUT_SIZE by 1 byte (1048577) IS truncated and data is discarded", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      const overSize = 1024 * 1024 + 1;
      const data = "A".repeat(overSize);
      mockWs._trigger(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "websocket",
            message: JSON.stringify({ message: data })
          })
        )
      );
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: '{"exit_code": 0}' })));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).truncated).toBe(true);
      expect((result.val as ShellExecOutput).stdout).toBe("");
    });

    it("pong messages interspersed with data messages do not corrupt output accumulation", async () => {
      const mockWs = createMockWebSocket();
      vi.mocked(WebSocket).mockImplementation(function (this: any) {
        return mockWs;
      });

      const service = new ShellExecService();
      const promise = service.execute(createShellExecInput());

      mockWs._trigger("open");
      mockWs._trigger(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "websocket",
            message: JSON.stringify({ message: "Hello " })
          })
        )
      );
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "pong" })));
      mockWs._trigger(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "websocket",
            message: JSON.stringify({ message: "World" })
          })
        )
      );
      mockWs._trigger("message", Buffer.from(JSON.stringify({ type: "websocket", message: '{"exit_code": 0}' })));
      mockWs._trigger("close");

      const result = await promise;
      expect(result.ok).toBe(true);
      expect((result.val as ShellExecOutput).stdout).toBe("Hello World");
      expect((result.val as ShellExecOutput).exitCode).toBe(0);
    });
  });
});
