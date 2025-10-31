import type { OfflineSigner } from "@cosmjs/proto-signing";
import type { SigningStargateClientOptions } from "@cosmjs/stargate";
import { SigningStargateClient } from "@cosmjs/stargate";
import type { CometClient } from "@cosmjs/tendermint-rpc";
import { HttpClient } from "@cosmjs/tendermint-rpc";
import { Comet38Client } from "@cosmjs/tendermint-rpc";
import type { BroadcastTxSyncResponse } from "@cosmjs/tendermint-rpc/build/comet38";

export type { BroadcastTxSyncResponse };

/**
 * A synchronous signing Stargate client that wraps the standard SigningStargateClient.
 *
 * This client provides a factory method for creating instances with a given endpoint,
 * signer, and options. It uses HTTP transport for communication with the blockchain.
 *
 * The class extends SigningStargateClient and maintains compatibility with all
 * standard Stargate client functionality while providing a simplified creation interface.
 */
export class SyncSigningStargateClient extends SigningStargateClient {
  /**
   * Creates a new SyncSigningStargateClient instance with the specified endpoint and signer.
   *
   * @param endpoint - The RPC endpoint URL (HTTP) to connect to the blockchain.
   * @param signer - The offline signer used to sign transactions.
   * @param options - Optional configuration for the Stargate client (e.g., registry, gas prices).
   * @returns A new instance of SyncSigningStargateClient.
   */
  public static createWithEndpoint(endpoint: string, signer: OfflineSigner, options: SigningStargateClientOptions = {}): SyncSigningStargateClient {
    const client = new HttpClient(endpoint);
    const cometClient = Comet38Client.create(client);
    return new SyncSigningStargateClient(cometClient, signer, options);
  }

  protected constructor(
    cometClient: CometClient | undefined,
    private readonly localSigner: OfflineSigner,
    options: SigningStargateClientOptions
  ) {
    super(cometClient, localSigner, options);
  }

  /**
   * Ensures the underlying client connection is established.
   *
   * This method performs a test query to verify the connection is active.
   * Useful for waiting for the connection to be ready before making queries.
   *
   * @returns A promise that resolves when the connection is confirmed.
   * @throws If the connection cannot be established.
   */
  async connected() {
    await this.forceGetCometClient().status();
  }
}
