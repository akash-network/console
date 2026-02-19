import { afterEach, describe, expect, it, type Mock, vi } from "vitest";

import { wait } from "@src/utils/timer";
import { createWebsocket, waitForEvent } from "./createWebsocket";

import { createWebsocketMock, dispatchWsEvent } from "@tests/unit/websocketMock";

describe(createWebsocket.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createWebsocket", () => {
    it("provides access to websocket instance in `open` event", async () => {
      const { websocket, websocketFactory } = setup();
      const wsEvents = createWebsocket({ websocketFactory });

      const openPromise = waitForEvent(wsEvents, "open");
      await dispatchWsEvent(websocket, new Event("open"));

      const result = await openPromise;
      expect(result).toBe(websocket);
    });

    it("re-dispatches `message` events", async () => {
      const { websocket, websocketFactory } = setup();
      const wsEvents = createWebsocket({ websocketFactory });

      const messagePromise = waitForEvent(wsEvents, "message");
      await dispatchWsEvent(websocket, new Event("open"));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: "test message" }));

      const message = await messagePromise;
      expect(message).toBe("test message");
    });

    it("dispatches `close` event", async () => {
      const { websocket, websocketFactory } = setup();
      const wsEvents = createWebsocket({ websocketFactory });

      const closePromise = waitForEvent(wsEvents, "close");

      await dispatchWsEvent(websocket, new Event("open"));
      await dispatchWsEvent(websocket, new CloseEvent("close"));

      await closePromise;
    });

    it("sends ping messages every 30 seconds", async () => {
      vi.useFakeTimers();
      const { websocket, websocketFactory } = setup();
      createWebsocket({ websocketFactory });

      await Promise.all([dispatchWsEvent(websocket, new Event("open")), vi.runOnlyPendingTimersAsync()]);

      expect(websocket.send).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(30_000);
      expect(websocket.send).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(websocket.send).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(websocket.send).toHaveBeenCalledTimes(3);

      expect((websocket.send as Mock).mock.calls).toEqual(Array.from({ length: 3 }, () => [JSON.stringify({ type: "ping" })]));
    });

    it("stops sending pings after close", async () => {
      vi.useFakeTimers();
      const { websocket, websocketFactory } = setup();
      createWebsocket({ websocketFactory });

      await Promise.all([dispatchWsEvent(websocket, new Event("open")), vi.runOnlyPendingTimersAsync()]);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(websocket.send).toHaveBeenCalledTimes(1);

      await Promise.all([dispatchWsEvent(websocket, new CloseEvent("close")), vi.runOnlyPendingTimersAsync()]);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(websocket.send).toHaveBeenCalledTimes(1);
    });

    it("stops sending pings after error", async () => {
      vi.useFakeTimers();
      const { websocket, websocketFactory } = setup();
      createWebsocket({ websocketFactory });

      await Promise.all([dispatchWsEvent(websocket, new Event("open")), vi.runOnlyPendingTimersAsync()]);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(websocket.send).toHaveBeenCalledTimes(1);

      await Promise.all([dispatchWsEvent(websocket, new Event("error")), vi.runOnlyPendingTimersAsync()]);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(websocket.send).toHaveBeenCalledTimes(1);
    });

    it("handles abort signal by closing websocket", async () => {
      const { websocket, websocketFactory } = setup();
      const abortController = new AbortController();

      createWebsocket({
        websocketFactory,
        signal: abortController.signal
      });

      await wait(10);
      abortController.abort();

      expect(websocket.close).toHaveBeenCalled();
    });

    it("does not close websocket if already closed when aborting", async () => {
      const { websocketFactory } = setup({ readyState: WebSocket.CLOSED });

      const abortController = new AbortController();
      createWebsocket({
        websocketFactory,
        signal: abortController.signal
      });

      await wait(10);
      abortController.abort();

      expect(websocketFactory).toHaveBeenCalled();
      const websocket = websocketFactory.mock.results[0].value;
      expect(websocket.close).not.toHaveBeenCalled();
    });

    it("closes websocket when CONNECTING and abort signal is fired", async () => {
      const { websocket, websocketFactory } = setup({ readyState: WebSocket.CONNECTING });

      const abortController = new AbortController();
      createWebsocket({
        websocketFactory,
        signal: abortController.signal
      });

      await wait(10);
      abortController.abort();

      expect(websocket.close).toHaveBeenCalled();
    });

    it("allows adding and removing event listeners", async () => {
      const { websocket, websocketFactory } = setup();
      const wsEvents = createWebsocket({ websocketFactory });

      const listener = vi.fn();
      wsEvents.addEventListener("message", listener);

      await dispatchWsEvent(websocket, new Event("open"));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: "test" }));

      expect(listener).toHaveBeenCalledTimes(1);

      wsEvents.removeEventListener("message", listener);

      await dispatchWsEvent(websocket, new MessageEvent("message", { data: "test2" }));

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("removes all listeners on `close`", async () => {
      const { websocket, websocketFactory } = setup();
      const wsEvents = createWebsocket({ websocketFactory });

      const openListener = vi.fn();
      const messageListener = vi.fn();

      wsEvents.addEventListener("open", openListener);
      wsEvents.addEventListener("message", messageListener);

      await dispatchWsEvent(websocket, new Event("open"));
      expect(openListener).toHaveBeenCalledTimes(1);

      await dispatchWsEvent(websocket, new CloseEvent("close"));

      await dispatchWsEvent(websocket, new Event("open"));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: "test" }));

      expect(openListener).toHaveBeenCalledTimes(1);
      expect(messageListener).not.toHaveBeenCalled();
    });

    it("removes all listeners on final `error` event", async () => {
      vi.useFakeTimers();
      let ws: WebSocket;
      const websocketFactory = vi.fn(() => (ws = createWebsocketMock()));
      const wsEvents = createWebsocket({ websocketFactory });

      const openListener = vi.fn();
      const messageListener = vi.fn();

      wsEvents.addEventListener("open", openListener);
      wsEvents.addEventListener("message", messageListener);

      await Promise.all([dispatchWsEvent(ws!, new Event("open")), vi.runOnlyPendingTimersAsync()]);
      expect(openListener).toHaveBeenCalledTimes(1);

      for (let i = 0; i < 6; i++) {
        await Promise.all([dispatchWsEvent(ws!, new Event("error")), vi.runOnlyPendingTimersAsync()]);
        await vi.runOnlyPendingTimersAsync(); // flush auto close timer
        await vi.runOnlyPendingTimersAsync(); // flush retry timers
      }

      await Promise.all([dispatchWsEvent(ws!, new Event("open")), vi.runOnlyPendingTimersAsync()]);
      await Promise.all([dispatchWsEvent(ws!, new MessageEvent("message", { data: "test" })), vi.runOnlyPendingTimersAsync()]);

      expect(openListener).toHaveBeenCalledTimes(1);
      expect(messageListener).not.toHaveBeenCalled();
    });

    it("supports once option for event listeners", async () => {
      const { websocket, websocketFactory } = setup();
      const wsEvents = createWebsocket({ websocketFactory });

      const listener = vi.fn();
      wsEvents.addEventListener("message", listener, { once: true });

      await dispatchWsEvent(websocket, new Event("open"));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: "first" }));

      await dispatchWsEvent(websocket, new MessageEvent("message", { data: "second" }));

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("creates websocket using factory", () => {
      const { websocket, websocketFactory } = setup();
      createWebsocket({ websocketFactory });

      expect(websocketFactory).toHaveBeenCalledTimes(1);
      expect(websocket.onopen).toBeDefined();
      expect(websocket.onmessage).toBeDefined();
      expect(websocket.onerror).toBeDefined();
      expect(websocket.onclose).toBeDefined();
    });

    it("can handle multiple message events", async () => {
      const { websocket, websocketFactory } = setup();
      const wsEvents = createWebsocket({ websocketFactory });

      const messages: string[] = [];
      wsEvents.addEventListener("message", event => {
        messages.push((event as CustomEvent).detail);
      });

      await dispatchWsEvent(websocket, new Event("open"));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: "msg1" }));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: "msg2" }));
      await dispatchWsEvent(websocket, new MessageEvent("message", { data: "msg3" }));

      expect(messages).toEqual(["msg1", "msg2", "msg3"]);
    });

    describe("retry behavior", () => {
      it("retries on error up to 5 times", async () => {
        vi.useFakeTimers();
        const websocketFactory = vi.fn(() => createWebsocketMock());
        const wsEvents = createWebsocket({ websocketFactory });
        const onError = vi.fn();
        wsEvents.addEventListener("error", onError);

        for (let i = 0; i < 7; i++) {
          const ws = websocketFactory.mock.results.at(-1)!.value;
          const errorPromise = new Promise(resolve => wsEvents.addEventListener("attempt-error", resolve));
          await Promise.all([dispatchWsEvent(ws, new Event("error")), vi.runOnlyPendingTimersAsync()]);
          await vi.runOnlyPendingTimersAsync();
          await errorPromise;
          await vi.runOnlyPendingTimersAsync();
        }

        expect(websocketFactory).toHaveBeenCalledTimes(6);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0]?.detail?.message).toMatch(/Generic websocket error/i);
      });

      it("do not retrying after successful connection", async () => {
        const websocketFactory = vi.fn(() => createWebsocketMock());

        createWebsocket({ websocketFactory });
        const ws = websocketFactory.mock.results.at(-1)!.value;

        await dispatchWsEvent(ws, new Event("open"));
        await dispatchWsEvent(ws, new CloseEvent("close"));

        expect(websocketFactory).toHaveBeenCalledTimes(1);
      });

      it("uses `shouldRetry` option to determine if should retry", async () => {
        vi.useFakeTimers();
        const websocketFactory = vi.fn(() => createWebsocketMock());
        const shouldRetry = vi.fn((error: Error) => {
          const event = error.cause as CloseEvent;
          return !error.cause || !event.reason?.includes("fatal");
        });

        createWebsocket({ websocketFactory, shouldRetry });

        await Promise.all([dispatchWsEvent(websocketFactory.mock.results.at(-1)!.value, new Event("error")), vi.runOnlyPendingTimersAsync()]);
        const closeEvent = new CloseEvent("close", { reason: "fatal", code: 22 });
        await Promise.all([dispatchWsEvent(websocketFactory.mock.results.at(-1)!.value, closeEvent), vi.runOnlyPendingTimersAsync()]);

        await vi.runOnlyPendingTimersAsync();

        expect(websocketFactory).toHaveBeenCalledTimes(1);
        expect(shouldRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "websocket error",
            cause: {
              code: closeEvent.code,
              reason: closeEvent.reason,
              wasClean: closeEvent.wasClean
            }
          })
        );
      });

      it("does not retry after abort signal", async () => {
        vi.useFakeTimers();
        const abortController = new AbortController();
        const websocketFactory = vi.fn(() => createWebsocketMock());

        createWebsocket({ websocketFactory, signal: abortController.signal });

        await Promise.all([dispatchWsEvent(websocketFactory.mock.results.at(-1)!.value, new Event("error")), vi.runOnlyPendingTimersAsync()]);
        expect(websocketFactory).toHaveBeenCalledTimes(1);

        abortController.abort();

        await vi.advanceTimersByTimeAsync(10_000);

        expect(websocketFactory).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("waitForEvent", () => {
    it("resolves with event detail when event is dispatched", async () => {
      const events = new EventTarget();

      const promise = waitForEvent<string>(events, "message");
      events.dispatchEvent(new CustomEvent("message", { detail: "test data" }));

      const result = await promise;
      expect(result).toBe("test data");
    });

    it("resolves with undefined when close event is dispatched", async () => {
      const events = new EventTarget();

      const promise = waitForEvent<string>(events, "message");
      events.dispatchEvent(new CustomEvent("close"));
      const result = await promise;

      expect(result).toBeUndefined();
    });

    it("rejects when error event is dispatched", async () => {
      const events = new EventTarget();

      const promise = waitForEvent<string>(events, "message");
      const error = new Error("test error");
      events.dispatchEvent(new CustomEvent("error", { detail: error }));

      await expect(promise).rejects.toThrow(error);
    });

    it("cleans up listeners after resolving", async () => {
      const events = new EventTarget();
      const promise = waitForEvent<string>(events, "message");

      vi.spyOn(events, "removeEventListener");
      events.dispatchEvent(new CustomEvent("message", { detail: "test" }));

      await promise;

      expect(events.removeEventListener).toHaveBeenCalledWith("message", expect.any(Function));
      expect(events.removeEventListener).toHaveBeenCalledWith("error", expect.any(Function));
      expect(events.removeEventListener).toHaveBeenCalledWith("close", expect.any(Function));
    });
  });

  function setup(options?: { readyState?: WebSocket["readyState"] }) {
    const websocket = createWebsocketMock();
    if (options?.readyState !== undefined) {
      Object.defineProperty(websocket, "readyState", {
        value: options.readyState,
        writable: true
      });
    }

    const websocketFactory = vi.fn(() => websocket);

    return { websocket, websocketFactory };
  }
});
