import { LoggerService } from "@akashnetwork/logging";
import { SupportedChainNetworks } from "@akashnetwork/net";
import http from "http";
import https from "https";
import { TLSSocket } from "tls";
import { v4 as uuidv4 } from "uuid";
import WebSocket from "ws";

import { ClientWebSocketStats, WebSocketUsage } from "../ClientSocketStats";
import { container } from "../container";
import { CertificateValidator } from "./CertificateValidator";

// @see https://www.rfc-editor.org/rfc/rfc6455.html#page-46
const WS_ERRORS = {
  VIOLATED_POLICY: 1008
};

export class WebsocketServer {
  private readonly openProviderSockets: Record<
    string,
    {
      ws: WebSocket;
      isVerified: boolean;
    }
  > = {};
  private wss?: WebSocket.Server;

  constructor(
    private readonly appServer: http.Server,
    private readonly certificateValidator: CertificateValidator,
    private readonly createLogger: LoggerService["setContext"]
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
      const wsLogger = this.createLogger?.(id);

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
          this.openProviderSockets[id].ws.terminate();
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

    let socketDetails = this.openProviderSockets[stats.id];
    if (
      !socketDetails ||
      socketDetails.ws.url !== url ||
      socketDetails.ws.readyState === WebSocket.CLOSED ||
      socketDetails.ws.readyState === WebSocket.CLOSING
    ) {
      socketDetails?.ws.terminate();
      logger?.info(`Initializing new provider websocket connection: ${url}`);
      socketDetails = this.createProviderSocket(url, {
        wsId: stats.id,
        cert: message.certPem,
        key: message.keyPem,
        chainNetwork: message.chainNetwork,
        providerAddress: message.providerAddress,
        logger
      });
      this.linkSockets(socketDetails.ws, ws, stats, logger);
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

    if (socketDetails.ws.readyState === WebSocket.OPEN && socketDetails.isVerified) {
      socketDetails.ws.send(data, callback);
    } else {
      socketDetails.ws.once("verified", () => socketDetails.ws.send(data, callback));
    }
  }

  private createProviderSocket(url: string, options: CreateProviderSocketOptions) {
    const pws = new WebSocket(url, {
      key: options.key,
      cert: options.cert,
      agent: new https.Agent({
        // do not use TLS session resumption for websocket
        sessionTimeout: 0,
        rejectUnauthorized: false
      })
    });

    this.openProviderSockets[options.wsId] = { ws: pws, isVerified: false };

    pws.on("upgrade", response => {
      // Using sync function here to ensure that no data is processed by event handlers until SSL cert validation is finished
      const certificate = response.socket && response.socket instanceof TLSSocket ? response.socket.getPeerX509Certificate() : undefined;

      if (!certificate) {
        // call destroy manually because at this time websocket is not connected with the actual socket
        response.socket.destroy();
        pws.close(1008, `Server ${url} didn't provide SSL certificate`);
        return;
      }

      if (!options.chainNetwork || !options.providerAddress) {
        // temporary certificate validation is optional
        pws.once("open", () => {
          this.openProviderSockets[options.wsId].isVerified = true;
          pws.emit("verified");
        });
        return;
      }

      // stop reading data from socket until we validate certificate
      response.socket.pause();
      this.certificateValidator
        .validate(certificate, options.chainNetwork, options.providerAddress)
        .catch(error => {
          options.logger?.error({
            message: "Could not validate SSL certificate",
            error,
            chainNetwork: options.chainNetwork,
            providerAddress: options.providerAddress
          });
          return {
            ok: false,
            code: "serverError"
          } as const;
        })
        .then(result => {
          if (result.ok === false) {
            // ensure that no messages are proxied from untrusted websocket
            pws.removeAllListeners("message");
            pws.removeAllListeners("verified");

            pws.close(WS_ERRORS.VIOLATED_POLICY, `invalidCertificate.${result.code}`);
          } else {
            // ensure that socket was not closed while its certificate was validating
            if (pws.readyState === WebSocket.OPEN && this.openProviderSockets[options.wsId]) {
              this.openProviderSockets[options.wsId].isVerified = true;
              pws.emit("verified");
            }
          }

          // need to call this in error and success case, otherwise listeners will not be notified about close event
          response.socket.resume();
        });
    });

    return this.openProviderSockets[options.wsId];
  }

  private linkSockets(providerWs: WebSocket, ws: WebSocket, stats: ClientWebSocketStats, logger?: LoggerService): void {
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

    providerWs.on("close", (code, reason) => {
      delete this.openProviderSockets[stats.id];
      logger?.info({
        message: "Provider websocket was closed",
        code,
        reason
      });
      const data = JSON.stringify({
        type: "websocket",
        message: "",
        closed: true,
        code,
        reason
      });
      stats.logDataTransfer(Buffer.from(data).length);
      ws.send(data);
    });
  }
}

interface CreateProviderSocketOptions {
  wsId: string;
  cert: string;
  key: string;
  chainNetwork?: SupportedChainNetworks;
  providerAddress?: string;
  logger?: LoggerService;
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
  chainNetwork?: SupportedChainNetworks;
  providerAddress?: string;
  /**
   * Currently it's used only for service shell communication
   * and stores only buffered representation of string in char codes
   */
  data?: string;
}
