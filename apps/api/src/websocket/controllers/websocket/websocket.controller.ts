import { LoggerService } from "@akashnetwork/logging";
import { Attributes, Span } from "@opentelemetry/api";
import { WSContext } from "hono/ws";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { traceActiveSpan } from "@src/core/lib/telemetry";
import { MESSAGE_SCHEMA, WsMessage } from "@src/websocket/http-schemas/websocket.schema";
import { ProviderWebsocketService } from "@src/websocket/services/provider-websocket/provider-websocket.service";
import { ClientWebSocketStats, WebSocketUsage } from "@src/websocket/services/websocket-stats/websocket-stats.service";

const logger = LoggerService.forContext("LeaseWebsocketController");

@singleton()
export class WebsocketController {
  constructor(
    private readonly authService: AuthService,
    private readonly providerWebsocketService: ProviderWebsocketService
  ) {}

  async handleOpen(stats: ClientWebSocketStats) {
    const { currentUser, ability } = this.authService;

    logger.info({
      event: "WEBSOCKET_CONNECTION_OPENED",
      userId: currentUser?.id,
      hasAbility: !!ability
    });

    stats.setUserIfExists(currentUser, ability);
  }

  async handleMessage(messageStr: string, ws: WSContext, stats: ClientWebSocketStats) {
    logger.debug({
      event: "WEBSOCKET_MESSAGE_RECEIVED",
      messageLength: messageStr?.length
    });

    const userInfo = stats.getUser();
    if (userInfo) {
      logger.debug({
        event: "WEBSOCKET_USER_INFO_RETRIEVED",
        userId: userInfo.currentUser?.id
      });
    }

    traceActiveSpan("ws.message", async span => {
      let message: WsMessage | undefined;
      try {
        message = typeof messageStr === "string" ? JSON.parse(messageStr) : undefined;
      } catch (error) {
        logger.error({
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
        logger.error({
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
        attributes.function = getWebSocketUsage(message);
      }

      span.setAttributes(attributes);
      logger.info({
        event: "NEW_WEBSOCKET_MESSAGE",
        attributes
      });

      stats.setUsage(getWebSocketUsage(message));

      try {
        if (message.type === "ping") {
          ws.send(
            JSON.stringify({
              type: "pong"
            })
          );
        } else if (message.type === "websocket") {
          await this.providerWebsocketService.proxyMessageToProvider(message, ws, stats);
        }
      } catch (err) {
        logger.error({
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

      span.end();
    });
  }

  async handleClose(_event: any, stats: ClientWebSocketStats, span?: Span) {
    logger.info("Closing socket");
    stats.close();

    this.providerWebsocketService.closeProviderSocket(stats.id);

    span?.end();
  }

  async handleError(event: Event) {
    logger.error({
      event: "CLIENT_WEBSOCKET_ERROR",
      error: event
    });
  }
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
