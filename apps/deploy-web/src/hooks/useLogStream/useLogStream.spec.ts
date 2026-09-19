import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import type { K8sEventMessage, ProviderProxyMessage, ProviderProxyService } from "@src/services/provider-proxy/provider-proxy.service";
import { SILENT_STREAM_TIMEOUT_MS, useLogStream } from "./useLogStream";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

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
    const { result, stream } = setup();

    await act(async () => {
      stream.push({ closed: true });
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe("closed");
  });

  it("reports a closed stream when the generator ends on its own", async () => {
    const { result, stream } = setup();

    await act(async () => {
      stream.end();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe("closed");
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

  it("subscribes again from scratch on reconnect", async () => {
    const { result, providerProxy } = setup();

    await advanceTime(SILENT_STREAM_TIMEOUT_MS);
    expect(result.current.status).toBe("silent");

    await act(async () => {
      result.current.reconnect();
    });

    expect(result.current.status).toBe("connecting");
    expect(providerProxy.getLogsStream).toHaveBeenCalledTimes(2);
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

  async function advanceTime(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
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

  function setup(input?: { enabled?: boolean; services?: string[]; selectedServices?: string[] }) {
    vi.useFakeTimers();

    const stream = createControllableStream();
    const providerProxy = mock<ProviderProxyService>();
    providerProxy.getLogsStream.mockImplementation(() => stream.generate() as ReturnType<ProviderProxyService["getLogsStream"]>);
    const errorHandler = mock<ErrorHandlerService>();
    const ensureToken = async () => "jwt-token";
    const services = input?.services ?? ["web"];
    const selectedServices = input?.selectedServices ?? ["web"];

    const { result, unmount } = setupQuery(
      () =>
        useLogStream({
          mode: "events",
          enabled: input?.enabled ?? true,
          providerBaseUrl: "https://provider.akash.network",
          providerAddress: "akash1provider",
          ensureToken,
          dseq: "1234567",
          gseq: 1,
          oseq: 1,
          services,
          selectedServices
        }),
      { services: { providerProxy: () => providerProxy, errorHandler: () => errorHandler } }
    );

    return { result, unmount, stream, providerProxy, errorHandler };
  }
});

type ControllableStream = ReturnType<typeof createControllableStream>;

function createControllableStream() {
  const pending: Array<ProviderProxyMessage<K8sEventMessage>> = [];
  let notify: (() => void) | undefined;
  let finished = false;

  const wake = () => {
    notify?.();
    notify = undefined;
  };

  return {
    async *generate(): AsyncGenerator<ProviderProxyMessage<K8sEventMessage>> {
      while (true) {
        while (pending.length > 0) yield pending.shift() as ProviderProxyMessage<K8sEventMessage>;
        if (finished) return;
        await new Promise<void>(resolve => {
          notify = resolve;
        });
      }
    },
    push(message: ProviderProxyMessage<K8sEventMessage>) {
      pending.push(message);
      wake();
    },
    end() {
      finished = true;
      wake();
    }
  };
}
