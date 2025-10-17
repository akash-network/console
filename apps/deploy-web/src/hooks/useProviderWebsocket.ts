import { useEffect, useRef } from "react";
import type { Options as WebsocketOptions } from "react-use-websocket";
import useWebSocket from "react-use-websocket";
import type { WebSocketHook as LibWebSocketHook } from "react-use-websocket/dist/lib/types";
import { netConfig } from "@akashnetwork/net";

import { providerProxyUrlWs } from "@src/config/ws.config";
import { providerCredentialsToApiCredentials } from "@src/services/provider-proxy/provider-proxy.service";
import networkStore from "@src/store/networkStore";
import type { ApiProviderList } from "@src/types/provider";
import { useProviderCredentials } from "./useProviderCredentials/useProviderCredentials";

// @see https://www.rfc-editor.org/rfc/rfc6455.html#page-46
const WS_ERRORS = {
  VIOLATED_POLICY: 1008
};

export function useProviderWebsocket(provider: ProviderInfo | undefined, options: ProviderWebsocketOptions): WebSocketHook {
  const chainNetwork = networkStore.useSelectedNetworkId();
  const providerRef = useRef<{ owner: string | undefined; hostUri: string | undefined }>({ owner: provider?.owner, hostUri: provider?.hostUri });
  const providerCredentials = useProviderCredentials();

  useEffect(() => {
    providerRef.current = { owner: provider?.owner, hostUri: provider?.hostUri };
  }, [provider]);

  const wsHook = useWebSocket(providerProxyUrlWs, {
    reconnectAttempts: 5,
    reconnectInterval: 500,
    onError: error => console.error("error", error),
    shouldReconnect: reconnectUnlessCertInvalid,
    ...options
  });

  useEffect(() => {
    if (options.setupPingPong) {
      const intervalId = setInterval(() => {
        wsHook.sendJsonMessage({ type: "ping" });
      }, 30 * 1000);

      return () => clearInterval(intervalId);
    }
  }, [wsHook, options.setupPingPong]);

  return {
    ...wsHook,
    sendJsonMessage(message, keep) {
      if (message.type === "ping") return wsHook.sendJsonMessage(message, keep);

      const { owner, hostUri } = providerRef.current;
      if (!owner || !hostUri) {
        throw new Error("Provider owner and hostUri must be defined to send WebSocket messages");
      }

      return wsHook.sendJsonMessage(
        {
          ...message,
          providerAddress: owner,
          url: `${hostUri}${message.url}`,
          chainNetwork: netConfig.mapped(chainNetwork),
          auth: providerCredentialsToApiCredentials(providerCredentials.details)
        },
        keep
      );
    }
  };
}

export type ProviderInfo = Pick<ApiProviderList, "owner" | "hostUri">;

export interface WebSocketHook extends LibWebSocketHook {
  sendJsonMessage(message: ProviderWebsocketMessage, keep?: boolean): void;
}
export type ProviderWebsocketMessage = PayloadWebsocketMessage | PingMessage;

export interface PingMessage {
  type: "ping";
}

export interface PayloadWebsocketMessage {
  type: "websocket";
  url: string;
  /**
   * Currently it's used only for service shell communication
   * and stores only buffered representation of string in char codes
   */
  data?: string;
}

export interface ProviderWebsocketOptions extends Pick<WebsocketOptions, "onOpen" | "onMessage" | "onError" | "onClose" | "onReconnectStop"> {
  onMessage?: WebsocketOptions["onMessage"];
  setupPingPong?: boolean;
}

function reconnectUnlessCertInvalid(event?: CloseEvent) {
  const isInvalidProviderCert = event && event.code === WS_ERRORS.VIOLATED_POLICY && event.reason.startsWith("invalidCertificate.");
  return !event || !isInvalidProviderCert;
}
