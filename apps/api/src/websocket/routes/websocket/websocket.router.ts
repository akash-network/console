import { trace } from "@opentelemetry/api";
import type { Hono } from "hono";
import type { UpgradeWebSocket, WSContext } from "hono/ws";
import { container } from "tsyringe";

import { propagateTracingContext } from "@src/core/lib/telemetry";
import type { AppEnv } from "@src/core/types/app-context";
import { WebsocketController } from "@src/websocket/controllers/websocket/websocket.controller";
import { WebsocketStatsService } from "@src/websocket/services/websocket-stats/websocket-stats.service";

export const initLeaseWebsocketRoute = (app: Hono<AppEnv>, upgradeWebSocket: UpgradeWebSocket) => {
  app.get(
    "/v1/ws",
    upgradeWebSocket(() => {
      const controller = container.resolve(WebsocketController);
      const stats = container.resolve(WebsocketStatsService).create();
      const trackingSpan = trace.getActiveSpan();
      trackingSpan?.setAttribute("ws.id", stats.id);

      return {
        onOpen: async (_event: Event, wsContext: WSContext<unknown>) => {
          trackingSpan?.setAttribute("ws.url", wsContext.url?.toString() ?? "");
          controller.handleOpen(stats);
        },

        onMessage: async (event, wsContext) => {
          propagateTracingContext((message: string) => {
            controller.handleMessage(message, wsContext, stats);
          })(event.data.toString());
        },

        onClose: async (event, wsContext) => {
          propagateTracingContext(() => {
            if (wsContext.url) {
              trackingSpan?.setAttribute("ws.url", wsContext.url.toString());
            }

            controller.handleClose(event, stats, trackingSpan);
          })();
        },

        onError: async event => {
          propagateTracingContext(() => {
            controller.handleError(event);
          })();
        }
      };
    })
  );
};
