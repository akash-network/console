import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProviderProxySocket, ProviderProxySocketEvent } from "@src/workload-abuse/providers/provider-proxy-socket.provider";
import { ProviderStreamService } from "./provider-stream.service";

type Listener = (event: ProviderProxySocketEvent) => void;

class FakeSocket implements ProviderProxySocket {
  readonly sent: string[] = [];
  closed = false;
  readonly #listeners = new Map<string, Listener[]>();

  addEventListener(type: string, listener: Listener): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, event: ProviderProxySocketEvent = {}): void {
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }

  emitProxyFrame(frame: Record<string, unknown>): void {
    this.emit("message", { data: JSON.stringify({ type: "websocket", ...frame }) });
  }

  emitShellBytes(bytes: number[]): void {
    this.emitProxyFrame({ message: { type: "Buffer", data: bytes } });
  }
}

const INPUT = {
  url: "https://provider.example:8443/lease/1/1/1/shell?stdin=0",
  providerAddress: "akash1provider",
  token: "jwt-token",
  idleTimeoutMs: 5_000,
  hardTimeoutMs: 30_000,
  maxBytes: 1_000
};

describe(ProviderStreamService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the provider stream with an auth message that carries no data", async () => {
    const { service, socket } = setup();

    const pending = service.collect(INPUT);
    socket.emit("open");
    socket.emitShellBytes([102, ...Buffer.from('{"exit_code":0}')]);
    await pending;

    expect(socket.sent).toEqual([
      JSON.stringify({ type: "websocket", url: INPUT.url, providerAddress: INPUT.providerAddress, auth: { type: "jwt", token: INPUT.token }, isBase64: true })
    ]);
  });

  it("collects frames until the result frame and reports its exit code", async () => {
    const { service, socket } = setup();

    const pending = service.collect(INPUT);
    socket.emit("open");
    socket.emitShellBytes([100, ...Buffer.from("out")]);
    socket.emitShellBytes([101, ...Buffer.from("err")]);
    socket.emitShellBytes([102, ...Buffer.from('{"exit_code":3}')]);
    const result = await pending;

    expect(result).toEqual({
      status: "completed",
      exitCode: 3,
      frames: [
        { kind: "shell", stream: "stdout", payload: "out" },
        { kind: "shell", stream: "stderr", payload: "err" },
        { kind: "shell", stream: "result", payload: '{"exit_code":3}' }
      ]
    });
    expect(socket.closed).toBe(true);
  });

  it("treats the proxy closing the provider stream as completion", async () => {
    const { service, socket } = setup();

    const pending = service.collect(INPUT);
    socket.emit("open");
    socket.emitProxyFrame({ message: '{"name":"web-1","message":"line"}' });
    socket.emitProxyFrame({ message: "", closed: true, code: 1000, reason: "" });
    const result = await pending;

    expect(result).toMatchObject({ status: "completed", closeCode: 1000, frames: [{ kind: "text", payload: '{"name":"web-1","message":"line"}' }] });
  });

  it("reports a rejected provider certificate and an expired token as distinct statuses", async () => {
    const { service, socket } = setup();
    const { service: otherService, socket: otherSocket } = setup();

    const certificate = service.collect(INPUT);
    socket.emit("open");
    socket.emitProxyFrame({ message: "", closed: true, code: 1008, reason: "invalidCertificate.fingerprintMismatch" });
    const token = otherService.collect(INPUT);
    otherSocket.emit("open");
    otherSocket.emitProxyFrame({ error: "tokenExpired" });

    expect(await certificate).toMatchObject({ status: "invalid_certificate", closeReason: "invalidCertificate.fingerprintMismatch" });
    expect(await token).toMatchObject({ status: "token_expired", error: "tokenExpired" });
  });

  it("gives up on a stream that goes silent", async () => {
    vi.useFakeTimers();
    const { service, socket } = setup();

    const pending = service.collect(INPUT);
    socket.emit("open");
    socket.emitShellBytes([100, ...Buffer.from("partial")]);
    await vi.advanceTimersByTimeAsync(INPUT.idleTimeoutMs + 1);
    const result = await pending;

    expect(result).toMatchObject({ status: "idle_timeout", frames: [{ stream: "stdout", payload: "partial" }] });
    expect(socket.closed).toBe(true);
  });

  it("enforces the hard timeout even while frames keep arriving", async () => {
    vi.useFakeTimers();
    const { service, socket } = setup();

    const pending = service.collect(INPUT);
    socket.emit("open");
    for (let elapsed = 0; elapsed < INPUT.hardTimeoutMs; elapsed += 1_000) {
      socket.emitShellBytes([100, 65]);
      await vi.advanceTimersByTimeAsync(1_000);
    }
    const result = await pending;

    expect(result.status).toBe("hard_timeout");
  });

  it("stops collecting once the output cap is reached", async () => {
    const { service, socket } = setup();

    const pending = service.collect({ ...INPUT, maxBytes: 5 });
    socket.emit("open");
    socket.emitShellBytes([100, ...Buffer.from("123456")]);
    socket.emitShellBytes([100, ...Buffer.from("ignored")]);
    const result = await pending;

    expect(result).toMatchObject({ status: "output_capped", frames: [{ payload: "12345" }] });
  });

  it("counts the cap across frames and truncates the one that crosses it", async () => {
    const { service, socket } = setup();

    const pending = service.collect({ ...INPUT, maxBytes: 5 });
    socket.emit("open");
    socket.emitShellBytes([100, ...Buffer.from("12")]);
    socket.emitShellBytes([100, ...Buffer.from("3456")]);
    socket.emitShellBytes([102, ...Buffer.from('{"exit_code":0}')]);
    const result = await pending;

    expect(result).toEqual({
      status: "output_capped",
      exitCode: undefined,
      frames: [
        { kind: "shell", stream: "stdout", payload: "12" },
        { kind: "shell", stream: "stdout", payload: "345" }
      ]
    });
  });

  it("keeps a result frame that exactly fills the cap and still reports its exit code", async () => {
    const { service, socket } = setup();
    const payload = '{"exit_code":7}';

    const pending = service.collect({ ...INPUT, maxBytes: Buffer.byteLength(payload) });
    socket.emit("open");
    socket.emitShellBytes([102, ...Buffer.from(payload)]);
    const result = await pending;

    expect(result).toEqual({ status: "completed", exitCode: 7, frames: [{ kind: "shell", stream: "result", payload }] });
  });

  it("counts the cap in UTF-8 bytes and never keeps more than it", async () => {
    const { service, socket } = setup();

    const pending = service.collect({ ...INPUT, maxBytes: 5 });
    socket.emit("open");
    socket.emitShellBytes([100, ...Buffer.from("ééé")]);
    const result = await pending;

    expect(result).toMatchObject({ status: "output_capped", frames: [{ payload: "éé" }] });
  });

  it("reports a connection error when the socket closes without the proxy announcing completion", async () => {
    const { service, socket } = setup();

    const pending = service.collect(INPUT);
    socket.emit("open");
    socket.emitShellBytes([100, ...Buffer.from("partial")]);
    socket.emit("close", { code: 1006 });
    const result = await pending;

    expect(result).toMatchObject({ status: "connection_error", closeCode: 1006, frames: [{ stream: "stdout", payload: "partial" }] });
  });

  it("reports a connection error when the socket never opens", async () => {
    const { service, socket } = setup();

    const pending = service.collect(INPUT);
    socket.emit("error");
    socket.emit("close");

    expect(await pending).toMatchObject({ status: "connection_error", frames: [] });
  });

  function setup() {
    const socket = new FakeSocket();
    const service = new ProviderStreamService(() => socket);

    return { service, socket };
  }
});
