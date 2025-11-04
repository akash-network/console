import type { Registry } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";
import { HttpClient } from "@cosmjs/tendermint-rpc";
import { Comet38Client } from "@cosmjs/tendermint-rpc";
import * as uuid from "uuid";

import type { Wallet } from "@src/billing/lib/wallet/wallet";

/**
 * Factory function type for creating a SigningStargateClient instance.
 *
 * Creates a SigningStargateClient configured with an HTTP transport client
 * that includes a unique proxy key header for request identification.
 *
 * @param endpoint - The RPC endpoint URL to connect to.
 * @param wallet - The wallet (signer) instance to use for signing transactions.
 * @param options - Optional configuration including a custom registry for message types.
 * @returns A configured SigningStargateClient instance.
 */
export type CreateSigningStargateClient = (endpoint: string, wallet: Wallet, options?: { registry?: Registry }) => SigningStargateClient;

/**
 * Creates a factory function for SigningStargateClient instances.
 *
 * This higher-order function accepts HTTP client and Comet38 client constructors
 * along with a base factory function, and returns a configured factory that wraps
 * the RPC client with HTTP transport and adds a unique proxy key header.
 *
 * @param ProvidedHttpClient - The HTTP client constructor to use for transport.
 * @param ProvidedComet38Client - The Comet38 client constructor to use for RPC communication.
 * @param factory - The base factory function to wrap (e.g., SigningStargateClient.createWithSigner).
 * @returns A factory function that creates SigningStargateClient instances with HTTP transport.
 */
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
        "X-Proxy-Key": uuid.v4()
      }
    });
    const cometClient = ProvidedComet38Client.create(client);
    return factory(cometClient, signer, options);
  };

/**
 * Default factory function for creating SigningStargateClient instances.
 *
 * Uses SigningStargateClient.createWithSigner as the base factory and configures
 * it with HTTP transport and unique proxy key headers.
 */
export const createSigningStargateClient: CreateSigningStargateClient = createSigningStargateClientFactory(
  HttpClient,
  Comet38Client,
  SigningStargateClient.createWithSigner
);
