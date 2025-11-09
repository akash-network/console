import type { CreateWebsocketInput, WsEvents } from "./createWebsocket";
import { createWebsocket, waitForEvent } from "./createWebsocket";

export class WebsocketSession<TInput, TOutput> {
  private wsEvents?: WsEvents;
  private ws?: WebSocket;
  private readonly options: Required<Omit<WebsocketSessionOptions<TInput, TOutput>, "signal" | "shouldRetry">> &
    Pick<WebsocketSessionOptions<TInput, TOutput>, "signal" | "shouldRetry">;
  private messageQueue: TInput[] = [];

  constructor(options: WebsocketSessionOptions<TInput, TOutput>) {
    this.options = {
      transformReceivedMessage: value => JSON.parse(value as string) as TOutput,
      transformSentMessage: value => JSON.stringify(value),
      ignoreMessage: ignorePingPongMessage,
      ...options
    };
  }

  private connect(): WsEvents {
    if (this.wsEvents) return this.wsEvents;
    this.wsEvents = createWebsocket(this.options);
    this.wsEvents.addEventListener("open", event => {
      this.ws = (event as CustomEvent<WebSocket>).detail;
      while (this.messageQueue.length > 0) {
        this.send(this.messageQueue.shift()!);
      }
    });
    const cleanup = () => this.cleanup();
    this.wsEvents.addEventListener("close", cleanup, { once: true });
    this.wsEvents.addEventListener("error", cleanup, { once: true });

    return this.wsEvents;
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      const closePromise = this.wsEvents ? waitForEvent(this.wsEvents, "close") : Promise.resolve();
      this.ws.close();
      await closePromise;
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.ws = undefined;
    this.wsEvents = undefined;
    this.messageQueue = [];
  }

  send(message: TInput): void {
    this.connect();

    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(message);
      return;
    }

    this.ws.send(this.options.transformSentMessage(message));
  }

  async *receive(): AsyncGenerator<TOutput> {
    const wsEvents = this.connect();

    while (true) {
      const message = await waitForEvent<TOutput>(wsEvents, "message");
      if (!message) break;
      const transformedMessage = this.options.transformReceivedMessage(message);
      if (!this.options.ignoreMessage || !this.options.ignoreMessage(transformedMessage)) {
        yield transformedMessage;
      }
    }
  }
}

export interface WebsocketSessionOptions<TInput, TOutput> extends CreateWebsocketInput {
  transformReceivedMessage?(message: unknown): TOutput;
  transformSentMessage?(message: TInput): string | ArrayBufferLike | Blob | ArrayBufferView<ArrayBufferLike>;
  ignoreMessage?(message: unknown): boolean;
}

function ignorePingPongMessage(message: unknown): boolean {
  return !!message && typeof message === "object" && "type" in message && (message.type === "ping" || message.type === "pong");
}
