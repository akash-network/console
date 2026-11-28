import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { inject, singleton } from "tsyringe";

import type { SignAndBroadcastDerivedRequestInput, SignAndBroadcastFundingRequestInput, SignAndBroadcastResponseOutput } from "@src/http-schemas/tx.schema";
import { InjectTypeRegistry } from "@src/providers/type-registry.provider";
import { TxManagerService } from "@src/services/tx-manager/tx-manager.service";
import { TxPolicyService } from "@src/services/tx-policy/tx-policy.service";

type EncodedMessage = (SignAndBroadcastFundingRequestInput | SignAndBroadcastDerivedRequestInput)["data"]["messages"][number];

@singleton()
export class TxController {
  constructor(
    @InjectTypeRegistry() private readonly registry: Registry,
    @inject(TxManagerService) private readonly txManagerService: TxManagerService,
    @inject(TxPolicyService) private readonly txPolicyService: TxPolicyService
  ) {}

  async signWithFundingWallet({ data: { messages, granteeDerivationIndex } }: SignAndBroadcastFundingRequestInput): Promise<SignAndBroadcastResponseOutput> {
    const decoded = this.decodeMessages(messages);
    const [fundingWalletAddresses, granteeAddress] = await Promise.all([
      this.txManagerService.getFundingWalletAddresses(),
      granteeDerivationIndex === undefined ? undefined : this.txManagerService.getDerivedWalletAddress(granteeDerivationIndex)
    ]);
    const fundingWalletAddress = this.txPolicyService.resolveFundingSigner(decoded, fundingWalletAddresses);
    this.txPolicyService.assertActingOnBehalfOf(decoded, fundingWalletAddress);
    this.txPolicyService.assertWithinGrantLimits(decoded);
    this.txPolicyService.assertGrantedToManagedWallet(decoded, granteeAddress);
    this.txPolicyService.assertSentToAnotherFundingWallet(decoded, fundingWalletAddresses);
    const tx = await this.txManagerService.signAndBroadcastWithFundingWallet(fundingWalletAddress, decoded);
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
    const [derivedWalletAddress, fundingWalletAddresses] = await Promise.all([
      this.txManagerService.getDerivedWalletAddress(derivationIndex),
      this.txManagerService.getFundingWalletAddresses()
    ]);
    this.txPolicyService.assertActingOnBehalfOf(decoded, derivedWalletAddress);
    this.txPolicyService.assertFeeGranter(options?.fee.granter, fundingWalletAddresses);
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
