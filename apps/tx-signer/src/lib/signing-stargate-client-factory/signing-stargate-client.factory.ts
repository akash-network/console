import type { Registry } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";
import { Comet38Client, HttpClient } from "@cosmjs/tendermint-rpc";
import { randomUUID } from "node:crypto";

import type { Wallet } from "@src/lib/wallet/wallet";

export type CreateSigningStargateClient = (endpoint: string, wallet: Wallet, options?: { registry?: Registry }) => SigningStargateClient;

export const createSigningStargateClientFactory =
  (
    ProvidedHttpClient: typeof HttpClient,
    ProvidedComet38Client: typeof Comet38Client,
    factory: typeof SigningStargateClient.createWithSigner
  ): CreateSigningStargateClient =>
  (endpoint, signer, options = {}): SigningStargateClient => {
    const client = new ProvidedHttpClient({
      url: endpoint,
      headers: {
        "X-Proxy-Key": randomUUID()
      }
    });
    const cometClient = ProvidedComet38Client.create(client);
    return factory(cometClient, signer, options);
  };

export const createSigningStargateClient: CreateSigningStargateClient = createSigningStargateClientFactory(
  HttpClient,
  Comet38Client,
  SigningStargateClient.createWithSigner
);
