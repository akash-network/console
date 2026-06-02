import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import WebSocket from "ws";
import { z } from "zod";

import { emitVerifiedWhenOpen, isJwtExpiredError } from "./WebsocketServer";

describe("emitVerifiedWhenOpen", () => {
  it("emits 'verified' synchronously when the socket is already OPEN", () => {
    const { ws } = setup({ readyState: WebSocket.OPEN });
    const listener = vi.fn();
    ws.on("verified", listener);

    emitVerifiedWhenOpen(ws);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("emits 'verified' only after the socket transitions to OPEN", () => {
    const { ws } = setup({ readyState: WebSocket.CONNECTING });
    const listener = vi.fn();
    ws.on("verified", listener);

    emitVerifiedWhenOpen(ws);

    expect(listener).not.toHaveBeenCalled();

    ws.emit("open");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("attaches a one-shot listener so subsequent 'open' events do not re-emit", () => {
    const { ws } = setup({ readyState: WebSocket.CONNECTING });
    const listener = vi.fn();
    ws.on("verified", listener);

    emitVerifiedWhenOpen(ws);
    ws.emit("open");
    ws.emit("open");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  function setup(input: { readyState: number }) {
    const emitter = new EventEmitter();
    const ws = mock<WebSocket>({
      readyState: input.readyState as WebSocket["readyState"],
      emit: emitter.emit.bind(emitter) as WebSocket["emit"],
      on: emitter.on.bind(emitter) as WebSocket["on"],
      once: emitter.once.bind(emitter) as WebSocket["once"]
    });
    return { ws };
  }
});

describe("isJwtExpiredError", () => {
  it("returns true for a custom issue on auth.token with 'Token has expired'", () => {
    const error = buildZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["auth", "token"],
        message: "is not a valid JWT token",
        params: { errors: ["Token has expired"] }
      }
    ]);

    expect(isJwtExpiredError(error)).toBe(true);
  });

  it("returns false when the issue path is not auth.token", () => {
    const error = buildZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["auth", "certPem"],
        message: "is not a valid certificate",
        params: { errors: ["Token has expired"] }
      }
    ]);

    expect(isJwtExpiredError(error)).toBe(false);
  });

  it("returns false when the issue code is not custom", () => {
    const error = buildZodError([
      {
        code: z.ZodIssueCode.invalid_type,
        path: ["auth", "token"],
        message: "Required",
        expected: "string",
        received: "undefined"
      }
    ]);

    expect(isJwtExpiredError(error)).toBe(false);
  });

  it("returns false when params.errors does not include the expired marker", () => {
    const error = buildZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["auth", "token"],
        message: "is not a valid JWT token",
        params: { errors: ["Invalid token"] }
      }
    ]);

    expect(isJwtExpiredError(error)).toBe(false);
  });

  it("returns false when params is missing", () => {
    const error = buildZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["auth", "token"],
        message: "is not a valid JWT token"
      }
    ]);

    expect(isJwtExpiredError(error)).toBe(false);
  });

  it("returns true when at least one issue in the list matches", () => {
    const error = buildZodError([
      { code: z.ZodIssueCode.custom, path: ["url"], message: "bad url" },
      {
        code: z.ZodIssueCode.custom,
        path: ["auth", "token"],
        message: "is not a valid JWT token",
        params: { errors: ["Token has expired"] }
      }
    ]);

    expect(isJwtExpiredError(error)).toBe(true);
  });

  function buildZodError(issues: z.ZodIssue[]) {
    return new z.ZodError(issues);
  }
});
