import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { wait } from "@src/utils/timer";

export async function dispatchWsEvent(websocket: WebSocket, event: Event) {
  await wait(10);
  const methodName = `on${event.type}` as "onopen" | "onmessage" | "onerror" | "onclose";
  const method = websocket[methodName]?.bind(websocket);

  if (typeof method === "function") {
    method(event as any);
  }
}

export function createWebsocketMock(): WebSocket {
  const websocket = mock<WebSocket>({
    readyState: WebSocket.OPEN as WebSocket["readyState"],
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    close: vi.fn(() => {
      Object.assign(websocket, { readyState: WebSocket.CLOSED });
      dispatchWsEvent(websocket, new Event("close"));
    })
  });

  return websocket;
}
