import { describe, expect, it } from "vitest";

import { decodeProviderFrame, parseShellExit } from "./provider-frame";

function bufferFrame(bytes: number[]): string {
  return JSON.stringify({ type: "websocket", message: { type: "Buffer", data: bytes } });
}

describe("provider frame", () => {
  describe("decodeProviderFrame", () => {
    it("splits a binary shell frame into its stream code and payload", () => {
      const frame = decodeProviderFrame(bufferFrame([100, ...Buffer.from("hello")]));

      expect(frame).toEqual({ kind: "shell", stream: "stdout", payload: "hello" });
    });

    it("maps every known stream code and falls back to unknown", () => {
      expect(decodeProviderFrame(bufferFrame([101, 65]))).toMatchObject({ stream: "stderr" });
      expect(decodeProviderFrame(bufferFrame([102, 65]))).toMatchObject({ stream: "result" });
      expect(decodeProviderFrame(bufferFrame([103, 65]))).toMatchObject({ stream: "failure" });
      expect(decodeProviderFrame(bufferFrame([7, 65]))).toMatchObject({ stream: "unknown" });
    });

    it("passes a text frame through as text", () => {
      expect(decodeProviderFrame(JSON.stringify({ type: "websocket", message: '{"name":"web-1","message":"up"}' }))).toEqual({
        kind: "text",
        payload: '{"name":"web-1","message":"up"}'
      });
    });

    it("recognises proxy close and error outcomes", () => {
      expect(
        decodeProviderFrame(JSON.stringify({ type: "websocket", message: "", closed: true, code: 1008, reason: "invalidCertificate.unknownCertificate" }))
      ).toEqual({
        kind: "closed",
        code: 1008,
        reason: "invalidCertificate.unknownCertificate"
      });
      expect(decodeProviderFrame(JSON.stringify({ type: "websocket", error: "tokenExpired" }))).toEqual({ kind: "error", error: "tokenExpired" });
    });

    it("ignores keepalives, empty frames and anything that is not JSON", () => {
      expect(decodeProviderFrame(JSON.stringify({ type: "pong" }))).toEqual({ kind: "ignore" });
      expect(decodeProviderFrame(bufferFrame([]))).toEqual({ kind: "ignore" });
      expect(decodeProviderFrame(JSON.stringify({ type: "websocket", message: "" }))).toEqual({ kind: "ignore" });
      expect(decodeProviderFrame("not json")).toEqual({ kind: "ignore" });
    });
  });

  describe("parseShellExit", () => {
    it("reads the exit code from a result payload", () => {
      expect(parseShellExit('{"exit_code":0}')).toEqual({ exitCode: 0, message: undefined });
      expect(parseShellExit('{"exit_code":127,"message":"not found"}')).toEqual({ exitCode: 127, message: "not found" });
    });

    it("returns nothing for a payload that is not a result", () => {
      expect(parseShellExit("plain output")).toBeUndefined();
      expect(parseShellExit('{"other":1}')).toBeUndefined();
    });
  });
});
