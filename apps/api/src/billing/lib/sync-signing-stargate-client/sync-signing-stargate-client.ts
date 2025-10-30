import type { OfflineSigner } from "@cosmjs/proto-signing";
import type { SigningStargateClientOptions } from "@cosmjs/stargate";
import { SigningStargateClient } from "@cosmjs/stargate";
import type { CometClient } from "@cosmjs/tendermint-rpc";
import { HttpClient } from "@cosmjs/tendermint-rpc";
import { Comet38Client } from "@cosmjs/tendermint-rpc";
import type { BroadcastTxSyncResponse } from "@cosmjs/tendermint-rpc/build/comet38";

export type { BroadcastTxSyncResponse };

export class SyncSigningStargateClient extends SigningStargateClient {
  public static init(endpoint: string, signer: OfflineSigner, options: SigningStargateClientOptions = {}): SyncSigningStargateClient {
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
}
