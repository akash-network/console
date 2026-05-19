import { GroupSpec, MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { BidHttpService } from "@akashnetwork/http-sdk";
import { EncodeObject } from "@cosmjs/proto-signing";
import assert from "http-assert";
import { singleton } from "tsyringe";

import type { UserWalletOutput } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { Trace } from "@src/core/services/tracing/tracing.service";
import { AUDITOR, TRIAL_ATTRIBUTE, TRIAL_REGISTERED_ATTRIBUTE } from "@src/deployment/config/provider.config";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import {
  extractRequestedGpusFromBid,
  extractRequestedGpusFromGroupSpecs,
  findBlockedGpus,
  formatGpuLabel,
  toBlockedGpuSet
} from "@src/deployment/utils/blocked-gpu/blocked-gpu";
import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import type { UserOutput } from "@src/user/repositories";

const TRIAL_DEPLOYMENT_LIMIT = 5;

@singleton()
export class TrialValidationService {
  constructor(
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly config: BillingConfigService,
    private readonly providerRepository: ProviderRepository,
    private readonly bidHttpService: BidHttpService
  ) {}

  async validateTrialLimit(decoded: EncodeObject, userWallet: UserWalletOutput) {
    if (userWallet.isTrialing && decoded.typeUrl === `/${MsgCreateDeployment.$type}`) {
      const deployments = await this.deploymentReaderService.listWithResources({
        address: userWallet.address!,
        status: "active",
        limit: 1
      });
      assert(deployments.count < TRIAL_DEPLOYMENT_LIMIT, 402, "Trial limit reached. Add funds to your account to deploy more.");
    }
  }

  async validateLeaseProviders(decoded: EncodeObject, userWallet: UserWalletOutput, user: UserOutput) {
    if (decoded.typeUrl === `/${MsgCreateDeployment.$type}`) {
      const value = decoded.value as MsgCreateDeployment;

      if (!userWallet.isTrialing) {
        return true;
      }

      const isRegistered = user.userId;

      if (isRegistered) {
        this.validateAttribute(value.groups, TRIAL_REGISTERED_ATTRIBUTE);
      } else {
        this.validateAttribute(value.groups, TRIAL_ATTRIBUTE);
      }
    }

    return true;
  }

  @Trace()
  async validateLeaseProvidersAuditors(messages: EncodeObject[], _userWallet: UserWalletOutput) {
    const allowedAuditors = this.config.get("MANAGED_WALLET_LEASE_ALLOWED_AUDITORS");

    if (!allowedAuditors || allowedAuditors.length === 0) {
      return;
    }

    const bidIds = this.getLeaseBidIds(messages);
    if (bidIds.length === 0) return;

    const uniqueProviderAddresses = Array.from(new Set(bidIds.map(id => id.provider)));
    const providers = await this.providerRepository.getProvidersByAddressesWithAttributes(uniqueProviderAddresses);
    const providerMap = new Map(providers.map(provider => [provider.owner, provider]));

    for (const providerAddress of uniqueProviderAddresses) {
      const provider = providerMap.get(providerAddress);
      assert(provider, 404, `Provider ${providerAddress} not found`);

      const providerAuditors = provider.providerAttributeSignatures.map(signature => signature.auditor);
      const isAuditedByAllowedAuditor = providerAuditors.some(auditor => allowedAuditors.includes(auditor));

      assert(isAuditedByAllowedAuditor, 403, `Provider not authorized.`);
    }
  }

  @Trace()
  async validateDeploymentGpuModels(messages: EncodeObject[], userWallet: UserWalletOutput) {
    if (!userWallet.isTrialing) return;

    const blockedGpuModels = this.config.get("MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS");
    if (blockedGpuModels.length === 0) return;

    const deploymentMessages = messages.filter(message => message.typeUrl === `/${MsgCreateDeployment.$type}`);
    if (deploymentMessages.length === 0) return;

    const blockedSet = toBlockedGpuSet(blockedGpuModels);

    for (const message of deploymentMessages) {
      const groups = (message.value as MsgCreateDeployment).groups;
      const blocked = findBlockedGpus(extractRequestedGpusFromGroupSpecs(groups), blockedSet);
      if (blocked.length === 0) continue;

      const blockedList = blocked.map(formatGpuLabel).join(", ");
      assert(false, 402, `${blockedList} not available on free trial: Add credits to your account to deploy`);
    }
  }

  @Trace()
  async validateLeaseGpuModels(messages: EncodeObject[], userWallet: UserWalletOutput) {
    if (!userWallet.isTrialing) return;

    const blockedGpuModels = this.config.get("MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS");
    if (blockedGpuModels.length === 0) return;

    const leaseBidIds = this.getLeaseBidIds(messages);
    if (leaseBidIds.length === 0) return;

    const uniqueDseqs = Array.from(new Set(leaseBidIds.map(id => id.dseq.toString())));
    const owner = userWallet.address!;
    const blockedSet = toBlockedGpuSet(blockedGpuModels);

    const bidsByDseq = new Map<string, Awaited<ReturnType<BidHttpService["list"]>>>();
    await Promise.all(
      uniqueDseqs.map(async dseq => {
        bidsByDseq.set(dseq, await this.bidHttpService.list(owner, dseq));
      })
    );

    for (const bidId of leaseBidIds) {
      const bids = bidsByDseq.get(bidId.dseq.toString()) ?? [];
      const bid = bids.find(
        b => b.bid.id.gseq === bidId.gseq && b.bid.id.oseq === bidId.oseq && b.bid.id.provider === bidId.provider && b.bid.id.bseq === bidId.bseq
      );
      assert(
        bid,
        403,
        `Referenced lease bid not found: dseq=${bidId.dseq}, gseq=${bidId.gseq}, oseq=${bidId.oseq}, provider=${bidId.provider}, bseq=${bidId.bseq}`
      );

      const blocked = findBlockedGpus(extractRequestedGpusFromBid(bid), blockedSet);
      if (blocked.length === 0) continue;

      const blockedList = blocked.map(formatGpuLabel).join(", ");
      assert(false, 402, `${blockedList} not available on free trial: Add credits to your account to deploy`);
    }
  }

  private getLeaseBidIds(messages: EncodeObject[]): NonNullable<MsgCreateLease["bidId"]>[] {
    return messages
      .filter(message => message.typeUrl === `/${MsgCreateLease.$type}`)
      .map(message => (message.value as MsgCreateLease).bidId)
      .filter((id): id is NonNullable<MsgCreateLease["bidId"]> => !!id);
  }

  private validateAttribute(groups: GroupSpec[], key: string) {
    groups.forEach(group => {
      const hasAttribute = group.requirements?.attributes.some(attribute => {
        return attribute.key === key && attribute.value === "true";
      });

      const hasSignedByAllOf = group.requirements?.signedBy?.allOf.every(signedBy => {
        return signedBy === AUDITOR;
      });
      assert(hasAttribute && hasSignedByAllOf, 400, `provider not authorized: ${JSON.stringify(group.requirements?.attributes)}`);
    });
  }
}
