import type { RoutesConfig } from "@x402/core/server";
import { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { singleton } from "tsyringe";

export interface X402HttpServerOptions {
  facilitatorUrl: string;
  network: Network;
  routes: RoutesConfig;
}

@singleton()
export class X402HttpServerFactoryService {
  create(options: X402HttpServerOptions): x402HTTPResourceServer {
    const facilitatorClient = new HTTPFacilitatorClient({ url: options.facilitatorUrl });
    const resourceServer = new x402ResourceServer(facilitatorClient).register(options.network, new ExactEvmScheme());

    return new x402HTTPResourceServer(resourceServer, options.routes);
  }
}
