import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";

export type ProviderProxySocketEvent = { data?: unknown; code?: number; reason?: string };

/** The subset of the WHATWG WebSocket surface the probe uses, so tests can script a socket without a network. */
export interface ProviderProxySocket {
  addEventListener(type: "open" | "message" | "close" | "error", listener: (event: ProviderProxySocketEvent) => void): void;
  send(data: string): void;
  close(): void;
}

export type ProviderProxySocketFactory = () => ProviderProxySocket;

export const PROVIDER_PROXY_SOCKET_FACTORY: InjectionToken<ProviderProxySocketFactory> = Symbol("PROVIDER_PROXY_SOCKET_FACTORY");

type WebSocketConstructor = new (url: string) => ProviderProxySocket;

container.register(PROVIDER_PROXY_SOCKET_FACTORY, {
  useFactory: instancePerContainerCachingFactory(c => {
    const url = c.resolve(DeploymentConfigService).get("PROVIDER_PROXY_URL").replace(/^http/, "ws");
    const WebSocket = (globalThis as unknown as { WebSocket: WebSocketConstructor }).WebSocket;

    return () => new WebSocket(url);
  })
});
