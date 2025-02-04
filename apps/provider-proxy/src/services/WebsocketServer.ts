import { LoggerService } from "@akashnetwork/logging";
import http from "http";
import https from "https";
import { v4 as uuidv4 } from "uuid";
import WebSocket from "ws";

import { ClientWebSocketStats, WebSocketUsage } from "../ClientSocketStats";
import { container } from "../container";

export class WebsocketServer {
  private readonly openProviderSockets: Record<string, WebSocket> = {};
  private wss?: WebSocket.Server;

  static from(appServer: http.Server, logger?: LoggerService): WebsocketServer {
    return new WebsocketServer(appServer, logger);
  }

  constructor(
    private readonly appServer: http.Server,
    private readonly logger?: LoggerService
  ) {}

  close(): void {
    this.wss?.close();
  }

  listen(): this {
    this.wss = new WebSocket.Server({ noServer: true });

    this.appServer.on("upgrade", (request, socket, head) => {
      this.wss.handleUpgrade(request, socket, head, socket => {
        this.wss.emit("connection", socket, request);
      });
    });

    this.wss.on("connection", ws => {
      const id = uuidv4();
      const wsLogger = this.logger?.setContext(id);

      const stats = new ClientWebSocketStats(id);
      container.wsStats.add(stats);

      ws.on("message", async (messageStr: string) => {
        const message = parseMessage(messageStr, wsLogger);
        if (!message) {
          return ws.send(
            JSON.stringify({
              type: "websocket",
              message: "Invalid message format",
              error: "Invalid message format"
            })
          );
        }
        this.handleMessage(message, ws, stats, wsLogger);
      });

      ws.on("close", () => {
        wsLogger?.info("Closing socket");
        stats.close();

        if (id in this.openProviderSockets) {
          this.openProviderSockets[id].terminate();
          delete this.openProviderSockets[id];
        } else {
          wsLogger?.debug("Corresponding provider socket not found");
        }
      });
    });

    return this;
  }

  private handleMessage(message: WsMessage, ws: WebSocket, stats: ClientWebSocketStats, logger?: LoggerService): void {
    stats.setUsage(getWebSocketUsage(message));

    try {
      if (message.type === "ping") {
        ws.send(
          JSON.stringify({
            type: "pong"
          })
        );
      } else if (message.type === "websocket") {
        this.proxyMessageToProvider(message, ws, stats, logger);
      } else {
        throw new Error("Invalid message type: " + message.type);
      }
    } catch (err: any) {
      logger?.error({
        message: "Unable to send message to provider socket",
        error: err
      });
      ws.send(
        JSON.stringify({
          id: message.id,
          error: err.message || err,
          type: message.type
        })
      );
    }
  }

  private proxyMessageToProvider(message: WsMessage, ws: WebSocket, stats: ClientWebSocketStats, logger?: LoggerService): void {
    const url = message.url.replace("https://", "wss://");

    let providerWs = this.openProviderSockets[stats.id];
    if (!providerWs || providerWs?.url !== url) {
      providerWs?.terminate();
      logger?.info(`Initializing new provider websocket connection: ${url}`);
      providerWs = new WebSocket(url, {
        cert: message.certPem,
        key: message.keyPem,
        agent: new https.Agent({
          // create new Agent to ensure TLS resumption is not used for websockets
          sessionTimeout: 0,
          rejectUnauthorized: false
        })
      });
      linkSockets(providerWs, ws, stats, logger);
      this.openProviderSockets[stats.id] = providerWs;
    }

    if (!message.data) {
      return;
    }

    const data = Buffer.from(message.data.split(",") as any);
    const callback = (error?: Error) => {
      if (error)
        logger?.error({
          message: "Cannot send message to provider socket",
          error
        });
    };

    if (providerWs.readyState === WebSocket.OPEN) {
      providerWs.send(data, callback);
    } else {
      providerWs.once("open", () => providerWs.send(data, callback));
    }
  }
}

function linkSockets(providerWs: WebSocket, ws: WebSocket, stats: ClientWebSocketStats, logger?: LoggerService): void {
  providerWs.on("open", function open() {
    logger?.info(`Connected to provider websocket: ${providerWs.url}`);
  });

  providerWs.on("message", socketMessage => {
    if (!socketMessage) return;
    const data = JSON.stringify({
      type: "websocket",
      message: socketMessage
    });
    stats.logDataTransfer(Buffer.from(data).length);
    ws.send(data);
  });

  providerWs.on("error", error => {
    logger?.error({
      message: "Websocket received an error",
      error
    });
    const data = JSON.stringify({
      type: "websocket",
      message: error,
      error
    });
    stats.logDataTransfer(Buffer.from(data).length);
    ws.send(data);
  });

  providerWs.on("close", event => {
    logger?.info({
      message: "Provider websocket was closed",
      event
    });
    const data = JSON.stringify({
      type: "websocket",
      message: "",
      closed: true
    });
    stats.logDataTransfer(Buffer.from(data).length);
    ws.send(data);
  });
}

function getWebSocketUsage(message: any): WebSocketUsage {
  if (message.type === "websocket") {
    if (message.url.includes("logs?follow=false&tail=10000000")) return "DownloadLogs";
    if (message.url.includes("logs?follow=true")) return "StreamLogs";
    if (message.url.includes("kubeevents?follow=true")) return "StreamEvents";
    if (message.url.includes("/shell?stdin=")) return "Shell";
  }

  return "Unknown";
}

function parseMessage(messageStr: string, logger?: LoggerService): WsMessage | null {
  logger?.debug(`received raw message: ${messageStr}`);
  try {
    const message = JSON.parse(messageStr);
    logger?.debug({
      message: "Received JSON message: ",
      ...message,
      certPem: message.certPem ? "***REDACTED***" : undefined,
      keyPem: message.keyPem ? "***REDACTED***" : undefined
    });
    return message;
  } catch {
    logger?.error({
      message: "Received message is not a JSON string",
      receivedMessage: messageStr
    });
    return null;
  }
}

interface WsMessage {
  type: string;
  id: unknown;
  url: string;
  certPem?: string;
  keyPem?: string;
  /**
   * Currently it's used only for service shell communication
   * and stores only buffered representation of string in char codes
   */
  data?: string;
}
