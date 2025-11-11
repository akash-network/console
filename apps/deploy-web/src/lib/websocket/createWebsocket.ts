import { ExponentialBackoff, handleAll, handleWhen, retry } from "cockatiel";

export function createWebsocket(input: CreateWebsocketInput): WsEvents {
  const policy = retry(input.shouldRetry ? handleWhen(input.shouldRetry) : handleAll, {
    maxAttempts: 5,
    backoff: new ExponentialBackoff({
      initialDelay: 500,
      maxDelay: 10 * 1000
    })
  });

  const bus = new EventTarget();
  let listeners: Array<{ event: string; listener: EventListener }> = [];
  policy
    .execute(
      () =>
        new Promise<void>((resolve, reject) => {
          const ws = input.websocketFactory();

          input.signal?.addEventListener(
            "abort",
            () => {
              if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
              }
            },
            { once: true }
          );

          let pingPongTimerId: NodeJS.Timeout | undefined;
          ws.onopen = () => {
            bus.dispatchEvent(new CustomEvent("open", { detail: ws }));
            pingPongTimerId = setInterval(() => {
              if (ws.readyState !== WebSocket.OPEN) {
                clearInterval(pingPongTimerId);
                return;
              }
              ws.send(
                JSON.stringify({
                  type: "ping"
                })
              );
            }, 30 * 1000);
          };

          ws.onmessage = event => {
            bus.dispatchEvent(new CustomEvent("message", { detail: event.data }));
          };
          let isFailed = false;
          let forceCleanTimerId: NodeJS.Timeout | undefined;
          ws.onerror = event => {
            isFailed = true;
            // According to the WebSocket spec, when error event is dispatched,
            // there will be follow up "close" event. BUT let's ensure that state is cleaned
            forceCleanTimerId = setTimeout(() => {
              closeConn(event);
            }, 100);
          };
          const closeConn = (event: Event) => {
            clearTimeout(forceCleanTimerId);

            const error = createWsError(event);
            if (!isFailed) {
              bus.dispatchEvent(new CustomEvent("close"));
            } else {
              bus.dispatchEvent(new CustomEvent("attempt-error", { detail: error }));
            }

            clearInterval(pingPongTimerId);

            if (isFailed || input.shouldRetry?.(error)) {
              reject(error);
            } else {
              resolve();
            }
          };
          ws.onclose = closeConn;
        }),
      input.signal
    )
    .catch(error => {
      bus.dispatchEvent(new CustomEvent("error", { detail: error }));
    })
    .finally(() => {
      listeners.forEach(({ event, listener }) => {
        bus.removeEventListener(event, listener);
      });
    });

  return {
    addEventListener(type, listener, options) {
      listeners.push({ event: type, listener });
      bus.addEventListener(type, listener, options);
    },
    removeEventListener(type, listener) {
      listeners = listeners.filter(l => !(l.event === type && l.listener === listener));
      bus.removeEventListener(type, listener);
    }
  };
}

export interface WsEvents {
  addEventListener(type: string, listener: EventListener, options?: { once?: boolean }): void;
  removeEventListener(type: string, listener: EventListener): void;
}

export interface CreateWebsocketInput {
  websocketFactory: () => WebSocket;
  signal?: AbortSignal;
  shouldRetry?: (error: Error) => boolean;
}

export function waitForEvent<T>(target: WsEvents, type: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const onMessage = (event: Event) => {
      resolve((event as CustomEvent).detail as T);
      cleanup();
    };
    const onError = (event: Event) => {
      reject((event as CustomEvent).detail);
      cleanup();
    };
    const onClose = () => {
      resolve(undefined);
      cleanup();
    };
    const cleanup = () => {
      target.removeEventListener(type, onMessage);
      target.removeEventListener("error", onError);
      target.removeEventListener("close", onClose);
    };
    target.addEventListener(type, onMessage, { once: true });
    target.addEventListener("error", onError, { once: true });
    target.addEventListener("close", onClose, { once: true });
  });
}

function createWsError(event: Event): Error {
  if (event instanceof CloseEvent) {
    return new Error("websocket error", {
      cause: {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      }
    });
  }

  // https://websockets.spec.whatwg.org/#eventdef-websocket-error
  return new Error("Generic websocket error");
}
