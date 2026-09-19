import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import type { K8sEventMessage, LogEntryMessage, ProviderProxyMessage, ProviderProxyService } from "@src/services/provider-proxy/provider-proxy.service";
import type { LOGS_MODE } from "./useLogStream";
import { SILENT_STREAM_TIMEOUT_MS, useLogStream } from "./useLogStream";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

const FLUSH_INTERVAL_MS = 1000;

describe(useLogStream.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits on the provider before reporting anything", () => {
    const { result } = setup();

    expect(result.current.status).toBe("connecting");
    expect(result.current.logText).toBe("");
  });

  it("reports a silent stream when the provider sends nothing for the whole grace period", async () => {
    const { result } = setup();

    await advanceTime(SILENT_STREAM_TIMEOUT_MS);

    expect(result.current.status).toBe("silent");
  });

  it("stays connecting until the grace period is over", async () => {
    const { result } = setup();

    await advanceTime(SILENT_STREAM_TIMEOUT_MS - 1);

    expect(result.current.status).toBe("connecting");
  });

  it("streams an event that arrives within the grace period", async () => {
    const { result, stream } = setup();

    await pushEvent(stream, { reason: "Started", note: "Started container web" });

    expect(result.current.status).toBe("streaming");
    expect(result.current.logText).toBe("[web]: [Normal] [Started] [Pod] Started container web");
  });

  it("puts each event on its own line", async () => {
    const { result, stream } = setup();

    await pushEvent(stream, { reason: "Pulled", note: "Pulled image" });
    await pushEvent(stream, { reason: "Started", note: "Started container web" });
    await advanceTime(FLUSH_INTERVAL_MS);

    expect(result.current.logText).toBe("[web]: [Normal] [Pulled] [Pod] Pulled image\n[web]: [Normal] [Started] [Pod] Started container web");
  });

  it("formats log lines rather than events in logs mode", async () => {
    const { result, stream } = setup({ mode: "logs" });

    await act(async () => {
      stream.push({ message: mock<LogEntryMessage>({ name: "web-abc123", message: "listening on 8080" }) });
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.logText).toBe("[web]: listening on 8080");
  });

  it("never turns silent once an event has arrived", async () => {
    const { result, stream } = setup();

    await pushEvent(stream, { reason: "Started", note: "Started container web" });
    await advanceTime(SILENT_STREAM_TIMEOUT_MS * 2);

    expect(result.current.status).toBe("streaming");
  });

  it("recovers from silence when a later event arrives", async () => {
    const { result, stream } = setup();

    await advanceTime(SILENT_STREAM_TIMEOUT_MS);
    expect(result.current.status).toBe("silent");

    await pushEvent(stream, { reason: "Killing", note: "Stopping container web" });

    expect(result.current.status).toBe("streaming");
  });

  it("reports a closed stream when the provider hangs up", async () => {
    const { result, stream, errorHandler } = setup();

    await closeStream(stream);

    expect(result.current.status).toBe("closed");
    expect(errorHandler.reportError).not.toHaveBeenCalled();
  });

  it("reports a closed stream when the generator ends on its own", async () => {
    const { result, stream } = setup();

    await act(async () => {
      stream.end();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe("closed");
  });

  it("stays closed instead of turning silent after the stream ends", async () => {
    const { result, stream } = setup();

    await closeStream(stream);
    await advanceTime(SILENT_STREAM_TIMEOUT_MS * 2);

    expect(result.current.status).toBe("closed");
  });

  it("closes the stream and reports the failure when it throws", async () => {
    const { result, stream, errorHandler } = setup();
    const error = new Error("websocket blew up");

    await act(async () => {
      stream.fail(error);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe("closed");
    expect(errorHandler.reportError).toHaveBeenCalledWith({ error, tags: { category: "deployments", label: "followLogs" } });
  });

  it("swallows a failure that lands after the consumer went away", async () => {
    const { stream, errorHandler, unmount } = setup();

    unmount();
    await act(async () => {
      stream.fail(new Error("websocket blew up"));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(errorHandler.reportError).not.toHaveBeenCalled();
  });

  it("stays idle and asks the provider for nothing when disabled", () => {
    const { result, providerProxy } = setup({ enabled: false });

    expect(result.current.status).toBe("idle");
    expect(providerProxy.getLogsStream).not.toHaveBeenCalled();
  });

  it("stays idle while no service is selected", () => {
    const { result, providerProxy } = setup({ selectedServices: [] });

    expect(result.current.status).toBe("idle");
    expect(providerProxy.getLogsStream).not.toHaveBeenCalled();
  });

  it("stays idle while the lease reports no services", () => {
    const { result, providerProxy } = setup({ services: [] });

    expect(result.current.status).toBe("idle");
    expect(providerProxy.getLogsStream).not.toHaveBeenCalled();
  });

  it("stays idle without a gseq", () => {
    const { result, providerProxy } = setup({ gseq: undefined });

    expect(result.current.status).toBe("idle");
    expect(providerProxy.getLogsStream).not.toHaveBeenCalled();
  });

  it("stays idle without an oseq", () => {
    const { result, providerProxy } = setup({ oseq: undefined });

    expect(result.current.status).toBe("idle");
    expect(providerProxy.getLogsStream).not.toHaveBeenCalled();
  });

  it("subscribes again from scratch on every reconnect", async () => {
    const { result, providerProxy } = setup();

    await advanceTime(SILENT_STREAM_TIMEOUT_MS);
    expect(result.current.status).toBe("silent");

    await act(async () => {
      result.current.reconnect();
    });
    expect(result.current.status).toBe("connecting");

    await act(async () => {
      result.current.reconnect();
    });

    expect(providerProxy.getLogsStream).toHaveBeenCalledTimes(3);
  });

  it("requests the whole lease when every service is selected", () => {
    const { providerProxy } = setup({ services: ["web", "db"], selectedServices: ["web", "db"] });

    expect(providerProxy.getLogsStream).toHaveBeenCalledWith(expect.objectContaining({ services: undefined, follow: true, type: "events" }));
  });

  it("requests a single service when only part of the lease is selected", () => {
    const { providerProxy } = setup({ services: ["web", "db"], selectedServices: ["db"] });

    expect(providerProxy.getLogsStream).toHaveBeenCalledWith(expect.objectContaining({ services: ["db"] }));
  });

  it("aborts the stream when the consumer goes away", () => {
    const { unmount, providerProxy } = setup();
    const { signal } = providerProxy.getLogsStream.mock.calls[0][0];

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it("disarms the grace period when the consumer goes away", () => {
    const { unmount } = setup();
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  async function advanceTime(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  async function closeStream(stream: ControllableStream) {
    await act(async () => {
      stream.push({ closed: true });
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  async function pushEvent(stream: ControllableStream, event: Partial<K8sEventMessage>) {
    await act(async () => {
      stream.push({
        message: mock<K8sEventMessage>({ type: "Normal", object: { kind: "Pod", name: "web-abc123", namespace: "akash" }, ...event })
      });
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  function setup(input?: { mode?: LOGS_MODE; enabled?: boolean; services?: string[]; selectedServices?: string[]; gseq?: number; oseq?: number }) {
    vi.useFakeTimers();

    const stream = createControllableStream();
    const providerProxy = mock<ProviderProxyService>();
    providerProxy.getLogsStream.mockImplementation(() => stream.generate() as ReturnType<ProviderProxyService["getLogsStream"]>);
    const errorHandler = mock<ErrorHandlerService>();
    const ensureToken = async () => "jwt-token";
    const mode = input?.mode ?? "events";
    const services = input?.services ?? ["web"];
    const selectedServices = input?.selectedServices ?? ["web"];
    const gseq = input && "gseq" in input ? input.gseq : 1;
    const oseq = input && "oseq" in input ? input.oseq : 1;

    const { result, unmount } = setupQuery(
      () =>
        useLogStream({
          mode,
          enabled: input?.enabled ?? true,
          providerBaseUrl: "https://provider.akash.network",
          providerAddress: "akash1provider",
          ensureToken,
          dseq: "1234567",
          gseq,
          oseq,
          services,
          selectedServices
        }),
      { services: { providerProxy: () => providerProxy, errorHandler: () => errorHandler } }
    );

    return { result, unmount, stream, providerProxy, errorHandler };
  }
});

type ControllableStream = ReturnType<typeof createControllableStream>;

type StreamMessage = ProviderProxyMessage<K8sEventMessage> | ProviderProxyMessage<LogEntryMessage>;

function createControllableStream() {
  const pending: StreamMessage[] = [];
  let notify: (() => void) | undefined;
  let finished = false;
  let failure: Error | undefined;

  const wake = () => {
    notify?.();
    notify = undefined;
  };

  return {
    async *generate(): AsyncGenerator<StreamMessage> {
      while (true) {
        while (pending.length > 0) yield pending.shift() as StreamMessage;
        if (failure) throw failure;
        if (finished) return;
        await new Promise<void>(resolve => {
          notify = resolve;
        });
      }
    },
    push(message: StreamMessage) {
      pending.push(message);
      wake();
    },
    end() {
      finished = true;
      wake();
    },
    fail(error: Error) {
      failure = error;
      wake();
    }
  };
}
