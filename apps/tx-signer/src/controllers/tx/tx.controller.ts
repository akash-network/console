import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { inject, singleton } from "tsyringe";

import type { SignAndBroadcastDerivedRequestInput, SignAndBroadcastFundingRequestInput, SignAndBroadcastResponseOutput } from "@src/http-schemas/tx.schema";
import { InjectTypeRegistry } from "@src/providers/type-registry.provider";
import { TxManagerService } from "@src/services/tx-manager/tx-manager.service";

type EncodedMessage = SignAndBroadcastFundingRequestInput["data"]["messages"][number];

@singleton()
export class TxController {
  constructor(
    @InjectTypeRegistry() private readonly registry: Registry,
    @inject(TxManagerService) private readonly txManagerService: TxManagerService
  ) {}

  async signWithFundingWallet({ data: { messages } }: SignAndBroadcastFundingRequestInput): Promise<SignAndBroadcastResponseOutput> {
    const decoded = this.decodeMessages(messages);
    const tx = await this.txManagerService.signAndBroadcastWithFundingWallet(decoded);
    return {
      data: {
        code: tx.code,
        hash: tx.hash,
        rawLog: tx.rawLog
      }
    };
  }

  async signWithDerivedWallet({ data: { derivationIndex, messages, options } }: SignAndBroadcastDerivedRequestInput): Promise<SignAndBroadcastResponseOutput> {
    const decoded = this.decodeMessages(messages);
    const tx = await this.txManagerService.signAndBroadcastWithDerivedWallet(derivationIndex, decoded, options);
    return {
      data: {
        code: tx.code,
        hash: tx.hash,
        rawLog: tx.rawLog
      }
    };
  }

  private decodeMessages(messages: EncodedMessage[]): EncodeObject[] {
    return messages.map(message => {
      const value = new Uint8Array(Buffer.from(message.value, "base64"));
      const decoded = this.registry.decode({ value, typeUrl: message.typeUrl });

      return {
        typeUrl: message.typeUrl,
        value: decoded
      };
    });
  }
}
