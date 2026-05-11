import type { Registry } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";
import type { RpcClient } from "@cosmjs/tendermint-rpc";
import { Comet38Client, HttpClient } from "@cosmjs/tendermint-rpc";
import { randomUUID } from "node:crypto";

import type { Wallet } from "@src/lib/wallet/wallet";
import { RetryingRpcClient } from "../retrying-rpc-client/retrying-rpc-client";

export type CreateSigningStargateClient = (endpoint: string, wallet: Wallet, options?: { registry?: Registry }) => SigningStargateClient;

export const createSigningStargateClientFactory =
  (
    createRpcClient: (endpoint: string) => RpcClient,
    ProvidedComet38Client: typeof Comet38Client,
    factory: typeof SigningStargateClient.createWithSigner
  ): CreateSigningStargateClient =>
  (endpoint, signer, options = {}): SigningStargateClient => {
    const rpcClient = createRpcClient(endpoint);
    const cometClient = ProvidedComet38Client.create(rpcClient);
    return factory(cometClient, signer, options);
  };

export const createSigningStargateClient: CreateSigningStargateClient = createSigningStargateClientFactory(
  (endpoint: string) => new RetryingRpcClient(
    new HttpClient({
      url: endpoint,
      headers: {
        "X-Proxy-Key": randomUUID()
      }
    })
  ),
  Comet38Client,
  SigningStargateClient.createWithSigner
);
