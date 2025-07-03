import type { LoggerService } from "@akashnetwork/logging";
import { netConfig, type SupportedChainNetworks } from "@akashnetwork/net";
import type { Attributes } from "@opentelemetry/api";
import { trace } from "@opentelemetry/api";
import { bech32 } from "bech32";
import type http from "http";
import https from "https";
import { TLSSocket } from "tls";
import WebSocket from "ws";
import { z } from "zod";

import { propagateTracingContext, traceActiveSpan } from "../utils/telemetry";
import type { CertificateValidator } from "./CertificateValidator";
import type { ClientWebSocketStats, WebsocketStats, WebSocketUsage } from "./WebsocketStats";

const MESSAGE_SCHEMA = z.object({
  type: z.enum(["ping", "websocket"]),
  url: z.string().url(),
  certPem: z.string().optional(),
  keyPem: z.string().optional(),
  chainNetwork: z.enum(netConfig.getSupportedNetworks() as [SupportedChainNetworks]),
  providerAddress: z.string().refine(v => !!bech32.decodeUnsafe(v), "is not bech32 address"),
  data: z
    .string()
    .optional()
    .describe(
      "Currently it's used only for service shell communication and stores only buffered representation of string in char codes something like this: Array.from(Uint8Array).join(', ')"
    )
});
type WsMessage = z.infer<typeof MESSAGE_SCHEMA> & { id: unknown };

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
    private readonly wsStats: WebsocketStats,
    private readonly logger?: LoggerService
  ) {}

  close(): void {
    this.wss?.close();
  }

  listen(): this {
    const wss = new WebSocket.Server({ noServer: true });
    this.wss = wss;

    this.appServer.on("upgrade", (request, socket, head) =>
      traceActiveSpan("ws.connection", span => {
        this.logger?.info(`Upgrading connection to websocket: ${request.url}`);
        wss.handleUpgrade(
          request,
          socket,
          head,
          propagateTracingContext(socket => {
            wss.emit("connection", socket, request);
            span.end();
          })
        );
      })
    );

    this.wss.on("connection", ws => {
      const stats = this.wsStats.create();
      const trackingSpan = trace.getActiveSpan();
      trackingSpan?.setAttribute("ws.id", stats.id);
      trackingSpan?.setAttribute("ws.url", ws.url);

      ws.on(
        "message",
        propagateTracingContext((messageStr: string) =>
          traceActiveSpan("ws.message", span => {
            let message: WsMessage | undefined;
            try {
              message = typeof messageStr === "string" ? JSON.parse(messageStr) : undefined;
            } catch (error) {
              this.logger?.error({
                event: "CLIENT_MESSAGE_INVALID_JSON",
                message: "Received message is not a JSON string",
                messageLength: messageStr?.length,
                messageType: typeof messageStr,
                messageConstructor: messageStr?.constructor?.name
              });
            }

            if (!message) {
              return ws.send(
                JSON.stringify({
                  type: "websocket",
                  message: "Message is not a JSON string",
                  error: "Invalid message format"
                })
              );
            }

            const parsedMessage = MESSAGE_SCHEMA.safeParse(message);
            if (parsedMessage.error) {
              this.logger?.error({
                event: "CLIENT_MESSAGE_INVALID_JSON",
                message: "Message doesn't match expected schema",
                error: parsedMessage.error
              });
              return ws.send(
                JSON.stringify({
                  type: "websocket",
                  message: "Message doesn't match expected schema",
                  error: "Invalid message format"
                })
              );
            }

            const attributes: Attributes = {
              type: message.type
            };
            if (message.type === "websocket") {
              attributes.providerUrl = message.url;
              attributes.providerAddress = message.providerAddress;
              attributes.chainNetwork = message.chainNetwork;
              attributes.certPem = message.certPem ? "***REDACTED***" : "***No cert provided***";
              attributes.keyPem = message.keyPem ? "***REDACTED***" : "***No key provided***";
              attributes.function = getWebSocketUsage(message);
            }

            span.setAttributes(attributes);
            this.logger?.info({
              event: "NEW_WEBSOCKET_MESSAGE",
              attributes
            });

            this.handleMessage(message, ws, stats);
            span.end();
          })
        )
      );

      ws.on(
        "close",
        propagateTracingContext(() => {
          this.logger?.info("Closing socket");
          stats.close();

          if (stats.id in this.openProviderSockets) {
            this.openProviderSockets[stats.id].ws.terminate();
            delete this.openProviderSockets[stats.id];
          } else {
            this.logger?.debug("Corresponding provider socket not found");
          }

          trackingSpan?.end();
        })
      );

      ws.on(
        "error",
        propagateTracingContext(error => {
          this.logger?.error({
            event: "CLIENT_WEBSOCKET_ERROR",
            error
          });
        })
      );
    });

    return this;
  }

  private handleMessage(message: WsMessage, ws: WebSocket, stats: ClientWebSocketStats): void {
    stats.setUsage(getWebSocketUsage(message));

    try {
      if (message.type === "ping") {
        ws.send(
          JSON.stringify({
            type: "pong"
          })
        );
      } else if (message.type === "websocket") {
        this.proxyMessageToProvider(message, ws, stats);
      } else {
        throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (err) {
      this.logger?.error({
        event: "CLIENT_MESSAGE_SEND_ERROR",
        error: err
      });
      ws.send(
        JSON.stringify({
          id: message.id,
          error: "Unable to send message to provider socket",
          type: message.type
        })
      );
    }
  }

  private proxyMessageToProvider(message: WsMessage, ws: WebSocket, stats: ClientWebSocketStats): void {
    const url = message.url.replace("https://", "wss://");

    let socketDetails = this.openProviderSockets[stats.id];
    if (
      !socketDetails ||
      socketDetails.ws.url !== url ||
      socketDetails.ws.readyState === WebSocket.CLOSED ||
      socketDetails.ws.readyState === WebSocket.CLOSING
    ) {
      socketDetails?.ws.terminate();
      socketDetails = this.createProviderSocket(url, {
        wsId: stats.id,
        cert: message.certPem,
        key: message.keyPem,
        chainNetwork: message.chainNetwork,
        providerAddress: message.providerAddress
      });
      this.linkSockets(socketDetails.ws, ws, stats);
    }

    if (!message.data) {
      this.logger?.info(`Do not proxy "${message.type}" message because it has no data`);
      return;
    }

    const data = Buffer.from(message.data.split(",") as any);
    const callback = (error?: Error) => {
      if (error) {
        this.logger?.error({
          event: "CLIENT_MESSAGE_SEND_ERROR",
          error
        });
      }
    };
    const proxyMessage = () => {
      this.logger?.debug(`Provider is verified, proxying "${message.type}" message`);
      socketDetails.ws.send(data, callback);
    };

    if (socketDetails.ws.readyState === WebSocket.OPEN && socketDetails.isVerified) {
      proxyMessage();
    } else {
      this.logger?.info(`Provider is not verified, waiting for certificate validation`);
      socketDetails.ws.once("verified", proxyMessage);
    }
  }

  private createProviderSocket(url: string, options: CreateProviderSocketOptions) {
    this.logger?.info(`Initializing new provider websocket connection: ${url}`);

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

    pws.on(
      "upgrade",
      propagateTracingContext(response => {
        // Using sync function here to ensure that no data is processed by event handlers until SSL cert validation is finished
        const certificate = response.socket && response.socket instanceof TLSSocket ? response.socket.getPeerX509Certificate() : undefined;

        if (!certificate) {
          this.logger?.info(`Server ${url} didn't provide SSL certificate. Closing websocket connection`);
          // call destroy manually because at this time websocket is not connected with the actual socket
          response.socket.destroy();
          pws.close(WS_ERRORS.VIOLATED_POLICY, "noCertificate");
          return;
        }

        // stop reading data from socket until we validate certificate
        response.socket.pause();
        this.certificateValidator
          .validate(certificate, options.chainNetwork, options.providerAddress)
          .catch(error => {
            this.logger?.error({
              message: "Could not validate SSL certificate",
              chainNetwork: options.chainNetwork,
              providerAddress: options.providerAddress,
              error
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
      })
    );

    return this.openProviderSockets[options.wsId];
  }

  private linkSockets(providerWs: WebSocket, ws: WebSocket, stats: ClientWebSocketStats): void {
    providerWs.on(
      "open",
      propagateTracingContext(() => {
        this.logger?.info(`Connected to provider websocket: ${providerWs.url}`);
      })
    );

    providerWs.on(
      "message",
      propagateTracingContext(socketMessage => {
        if (
          !socketMessage ||
          (Object.hasOwn(socketMessage, "byteLength") && (socketMessage as Buffer).byteLength === 0) ||
          (Object.hasOwn(socketMessage, "length") && (socketMessage as string | unknown[]).length === 0)
        ) {
          this.logger?.info(`Received empty message from provider. Skipping...`);
          return;
        }

        const data = JSON.stringify({
          type: "websocket",
          message: socketMessage
        });
        stats.logDataTransfer(Buffer.from(data).length);
        ws.send(data);
      })
    );

    providerWs.on(
      "error",
      propagateTracingContext(error => {
        this.logger?.error({
          event: "PROVIDER_WEBSOCKET_ERROR",
          error
        });
        const data = JSON.stringify({
          type: "websocket",
          message: "Received error from provider websocket",
          error: "Received error from provider websocket"
        });
        stats.logDataTransfer(Buffer.from(data).length);
        ws.send(data);
      })
    );

    providerWs.on(
      "close",
      propagateTracingContext((code, reason) => {
        delete this.openProviderSockets[stats.id];
        this.logger?.info({
          event: "PROVIDER_WEBSOCKET_CLOSED",
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
      })
    );
  }
}

interface CreateProviderSocketOptions {
  wsId: string;
  cert?: string;
  key?: string;
  chainNetwork: SupportedChainNetworks;
  providerAddress: string;
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
