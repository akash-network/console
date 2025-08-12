import { JwtTokenPayload } from "@akashnetwork/jwt";
import { LoggerService } from "@akashnetwork/logging";
import { SupportedChainNetworks } from "@akashnetwork/net";
import { MongoAbility } from "@casl/ability";
import { WSContext } from "hono/ws";
import assert from "http-assert";
import https from "https";
import { singleton } from "tsyringe";
import WebSocket from "ws";

import { UserWalletRepository } from "@src/billing/repositories";
import { propagateTracingContext } from "@src/core/lib/telemetry";
import { JwtTokenService } from "@src/provider/services/jwt-token/jwt-token.service";
import { UserOutput } from "@src/user/repositories";
import { WsMessage } from "@src/websocket/http-schemas/websocket.schema";
import { ClientWebSocketStats } from "@src/websocket/services/websocket-stats/websocket-stats.service";

const logger = LoggerService.forContext("ProviderWebsocketService");

type ProxiableWsMessage = Extract<WsMessage, { type: "websocket" }>;

@singleton()
export class ProviderWebsocketService {
  private readonly openProviderSockets: Record<
    string,
    {
      ws: WebSocket;
      waitlist: ProxiableWsMessage[];
    }
  > = {};

  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly userWalletRepository: UserWalletRepository
  ) {}

  async proxyMessageToProvider(message: ProxiableWsMessage, ws: WSContext, stats: ClientWebSocketStats): Promise<void> {
    const url = message.url.replace("https://", "wss://");

    let socketDetails = this.openProviderSockets[stats.id];
    if (
      !socketDetails ||
      socketDetails.ws.url !== url ||
      socketDetails.ws.readyState === WebSocket.CLOSED ||
      socketDetails.ws.readyState === WebSocket.CLOSING
    ) {
      socketDetails?.ws.terminate();
      const userInfo = stats.getUser();
      if (!userInfo) {
        throw new Error("User not found");
      }
      const wallet = await this.getWalletByUserId(userInfo.currentUser, userInfo.ability);
      socketDetails = await this.createProviderSocket(url, {
        wsId: stats.id,
        chainNetwork: message.chainNetwork,
        walletId: wallet.id,
        providerAddress: message.providerAddress
      });
      this.linkSockets(socketDetails.ws, ws, stats);
    }

    if (!message.data) {
      logger.info(`Do not proxy "${message.type}" message because it has no data`);
      return;
    }

    const data = Buffer.from(message.data.split(",") as any);
    const callback = propagateTracingContext((error?: Error) => {
      if (error) {
        logger.error({
          event: "CLIENT_MESSAGE_SEND_ERROR",
          error
        });
      }
    });
    const proxyMessage = propagateTracingContext(() => {
      logger.debug(`Proxying "${message.type}" message`);
      socketDetails.ws.send(data, callback);
    });

    if (socketDetails.ws.readyState === WebSocket.OPEN) {
      proxyMessage();
    } else {
      logger.info(`Provider websocket is not open, adding message to waitlist`);
      socketDetails.ws.once("verified", proxyMessage);
      socketDetails.waitlist.push(message);
    }
  }

  closeProviderSocket(statsId: string): void {
    if (statsId in this.openProviderSockets) {
      this.openProviderSockets[statsId].ws.terminate();
      delete this.openProviderSockets[statsId];
    }
  }

  private async createProviderSocket(url: string, options: CreateProviderSocketOptions) {
    logger.info(`Initializing new provider websocket connection: ${url}`);

    const jwtToken = await this.jwtTokenService.generateJwtToken({
      walletId: options.walletId,
      leases: this.getLeasesForUrl({
        provider: options.providerAddress,
        url
      })
    });
    const pws = new WebSocket(url, {
      agent: new https.Agent({
        sessionTimeout: 0,
        rejectUnauthorized: false,
        servername: ""
      }),
      headers: {
        Authorization: `Bearer ${jwtToken}`
      }
    });
    this.openProviderSockets[options.wsId] = { ws: pws, waitlist: [] };

    return this.openProviderSockets[options.wsId];
  }

  private getLeasesForUrl({ provider, url }: { provider: string; url: string }): JwtTokenPayload["leases"] {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    if (/\/lease\/\d+\/\d+\/\d+\/logs(?:\?.*)?$/.test(pathname)) {
      return this.jwtTokenService.getScopedLeases({
        provider,
        scope: ["logs"]
      });
    }

    if (/\/lease\/\d+\/\d+\/\d+\/kubeevents(?:\?.*)?$/.test(pathname)) {
      return this.jwtTokenService.getScopedLeases({
        provider,
        scope: ["events"]
      });
    }

    logger.warn(`Unknown url: ${url}, returning full access`);
    return this.jwtTokenService.getFullAccessLeases({ provider });
  }

  private linkSockets(providerWs: WebSocket, ws: WSContext, stats: ClientWebSocketStats): void {
    providerWs.on(
      "open",
      propagateTracingContext(() => {
        logger.info(`Connected to provider websocket: ${providerWs.url}`);
        const waitlist = this.openProviderSockets[stats.id].waitlist;
        while (waitlist.length > 0) {
          const message = waitlist.shift();
          if (message) {
            this.proxyMessageToProvider(message, ws, stats);
          }
        }
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
          logger.info(`Received empty message from provider. Skipping...`);
          return;
        }

        const data = JSON.stringify({
          type: "websocket",
          message: socketMessage.toString()
        });
        stats.logDataTransfer(Buffer.from(data).length);
        ws.send(data);
      })
    );

    providerWs.on(
      "error",
      propagateTracingContext(error => {
        logger.error({
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
        logger.info({
          event: "PROVIDER_WEBSOCKET_CLOSED",
          code,
          reason
        });
        const data = JSON.stringify({
          type: "websocket",
          message: "",
          closed: true,
          code,
          reason: reason.toString()
        });
        stats.logDataTransfer(Buffer.from(data).length);
        ws.send(data);
      })
    );
  }

  private async getWalletByUserId(currentUser: UserOutput, ability: MongoAbility) {
    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(currentUser.id);
    assert(userWallet, 404, "UserWallet Not Found");

    return userWallet;
  }
}

interface CreateProviderSocketOptions {
  wsId: string;
  cert?: string;
  key?: string;
  chainNetwork: SupportedChainNetworks;
  providerAddress: string;
  walletId: number;
}
