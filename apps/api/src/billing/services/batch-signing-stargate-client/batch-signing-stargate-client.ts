import type { OfflineSigner } from "@cosmjs/proto-signing";
import { HttpEndpoint, SigningStargateClient, SigningStargateClientOptions } from "@cosmjs/stargate";
import { CometClient, connectComet } from "@cosmjs/tendermint-rpc";
import type { BroadcastTxSyncResponse } from "@cosmjs/tendermint-rpc/build/comet38";

export type { BroadcastTxSyncResponse };

export class BatchSigningStargateClient extends SigningStargateClient {
  public static async connectWithSigner(
    endpoint: string | HttpEndpoint,
    signer: OfflineSigner,
    options: SigningStargateClientOptions = {}
  ): Promise<BatchSigningStargateClient> {
    const cometClient = await connectComet(endpoint);
    return this.createWithSigner(cometClient, signer, options);
  }

  public static async createWithSigner(
    cometClient: CometClient,
    signer: OfflineSigner,
    options: SigningStargateClientOptions = {}
  ): Promise<BatchSigningStargateClient> {
    return new BatchSigningStargateClient(cometClient, signer, options);
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
