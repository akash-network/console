import type { OfflineSigner } from "@cosmjs/proto-signing";
import type { HttpEndpoint, SigningStargateClientOptions } from "@cosmjs/stargate";
import { SigningStargateClient } from "@cosmjs/stargate";
import type { CometClient } from "@cosmjs/tendermint-rpc";
import { connectComet } from "@cosmjs/tendermint-rpc";
import type { BroadcastTxSyncResponse } from "@cosmjs/tendermint-rpc/build/comet38";

export type { BroadcastTxSyncResponse };

export class SyncSigningStargateClient extends SigningStargateClient {
  public static async connectWithSigner(
    endpoint: string | HttpEndpoint,
    signer: OfflineSigner,
    options: SigningStargateClientOptions = {}
  ): Promise<SyncSigningStargateClient> {
    const cometClient = await connectComet(endpoint);
    return this.createWithSigner(cometClient, signer, options);
  }

  public static async createWithSigner(
    cometClient: CometClient,
    signer: OfflineSigner,
    options: SigningStargateClientOptions = {}
  ): Promise<SyncSigningStargateClient> {
    return new SyncSigningStargateClient(cometClient, signer, options);
  }

  protected constructor(
    cometClient: CometClient | undefined,
    private readonly localSigner: OfflineSigner,
    options: SigningStargateClientOptions
  ) {
    super(cometClient, localSigner, options);
  }

  public async tmBroadcastTxSync(tx: Uint8Array): Promise<BroadcastTxSyncResponse> {
    return (await this.forceGetCometClient().broadcastTxSync({ tx })) as BroadcastTxSyncResponse;
  }
}
