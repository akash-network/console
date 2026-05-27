import type { LoggerService } from "@akashnetwork/logging";

import type { WebsocketSession } from "@src/lib/websocket/WebsocketSession";
import { isTokenExpiredMessage, mergeSignals, RotationTracker } from "./ws-rotation";

export interface ReceivedShellMessage {
  message?: {
    data: number[];
  };
  error?: string;
  closed?: boolean;
}

export class RotatingShellSession {
  private static readonly OUTBOUND_QUEUE_CAP = 256;
  private currentSession?: WebsocketSession<Uint8Array, ReceivedShellMessage>;
  private currentSessionAbort?: AbortController;
  private outboundQueue: Uint8Array[] = [];
  private readonly tracker: RotationTracker;
  private isDisconnected = false;
  private sessionReady: Promise<void>;

  constructor(
    private readonly options: {
      ensureToken: () => Promise<string>;
      createSession: (token: string, signal: AbortSignal) => WebsocketSession<Uint8Array, ReceivedShellMessage>;
      logger: LoggerService;
      url: string;
      signal?: AbortSignal;
    }
  ) {
    this.tracker = new RotationTracker(options.logger, options.url);
    this.sessionReady = this.openNextSession();
    this.sessionReady.catch(() => {});
  }

  private async openNextSession(): Promise<void> {
    if (this.isDisconnected || this.options.signal?.aborted) return;
    const token = await this.options.ensureToken();
    if (this.isDisconnected || this.options.signal?.aborted) return;
    const sessionAbort = new AbortController();
    const session = this.options.createSession(token, mergeSignals(this.options.signal, sessionAbort.signal));
    this.currentSession = session;
    this.currentSessionAbort = sessionAbort;
    while (this.outboundQueue.length > 0) {
      session.send(this.outboundQueue.shift()!);
    }
  }

  send(message: Uint8Array): void {
    if (this.isDisconnected) return;
    if (this.currentSession) {
      this.currentSession.send(message);
      return;
    }
    if (this.outboundQueue.length >= RotatingShellSession.OUTBOUND_QUEUE_CAP) {
      this.options.logger.warn({ event: "SHELL_OUTBOUND_QUEUE_OVERFLOW", url: this.options.url, dropped: 1 });
      this.outboundQueue.shift();
    }
    this.outboundQueue.push(message);
  }

  async disconnect(): Promise<void> {
    this.isDisconnected = true;
    this.outboundQueue = [];
    this.currentSessionAbort?.abort();
    if (this.currentSession) {
      await this.currentSession.disconnect();
      this.currentSession = undefined;
    }
  }

  async *receive(): AsyncGenerator<ReceivedShellMessage> {
    while (!this.isDisconnected && !this.options.signal?.aborted) {
      try {
        await this.sessionReady;
      } catch {
        yield { closed: true } as ReceivedShellMessage;
        return;
      }
      const session = this.currentSession;
      const sessionAbort = this.currentSessionAbort;
      if (!session) return;

      let rotate = false;
      try {
        for await (const message of session.receive()) {
          if (isTokenExpiredMessage(message)) {
            rotate = true;
            break;
          }
          yield message;
        }
      } finally {
        sessionAbort?.abort();
        await session.disconnect();
        if (this.currentSession === session) {
          this.currentSession = undefined;
          this.currentSessionAbort = undefined;
        }
      }

      if (!rotate) return;
      if (!this.tracker.allowRotation()) {
        yield { closed: true } as ReceivedShellMessage;
        return;
      }
      this.sessionReady = this.openNextSession();
      this.sessionReady.catch(() => {});
    }
  }
}
