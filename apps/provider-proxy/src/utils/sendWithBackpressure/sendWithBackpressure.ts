import type { Socket } from "net";
import type WebSocket from "ws";

/** The provider is paused while more than this is waiting to reach the client, so a client that reads slowly holds provider output on the provider's side. */
export const CLIENT_SEND_HIGH_WATER_BYTES = 1024 * 1024;

export function sendWithBackpressure(
  client: Pick<WebSocket, "send" | "bufferedAmount">,
  data: string,
  provider: Pick<Socket, "pause" | "resume" | "isPaused"> | undefined
): void {
  client.send(data, () => {
    if (provider?.isPaused() && client.bufferedAmount <= CLIENT_SEND_HIGH_WATER_BYTES) provider.resume();
  });

  if (client.bufferedAmount > CLIENT_SEND_HIGH_WATER_BYTES) provider?.pause();
}
