import { GroupSpec, MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { EncodeObject } from "@cosmjs/proto-signing";
import assert from "http-assert";
import { singleton } from "tsyringe";

import type { UserWalletOutput } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { Trace } from "@src/core/services/tracing/tracing.service";
import { AUDITOR, TRIAL_ATTRIBUTE, TRIAL_REGISTERED_ATTRIBUTE } from "@src/deployment/config/provider.config";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import type { UserOutput } from "@src/user/repositories";

const TRIAL_DEPLOYMENT_LIMIT = 5;

@singleton()
export class TrialValidationService {
  constructor(
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly config: BillingConfigService,
    private readonly providerRepository: ProviderRepository
  ) {}

  async validateTrialLimit(decoded: EncodeObject, userWallet: UserWalletOutput) {
    if (userWallet.isTrialing && decoded.typeUrl === `/${MsgCreateDeployment.$type}`) {
      const deployments = await this.deploymentReaderService.listWithResources({
        address: userWallet.address!,
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

    const leaseMessages = messages
      .filter(message => message.typeUrl === `/${MsgCreateLease.$type}`)
      .map(message => (message.value as MsgCreateLease).bidId?.provider)
      .filter((provider): provider is string => !!provider);

    if (leaseMessages.length === 0) {
      return;
    }

    const uniqueProviderAddresses = Array.from(new Set(leaseMessages));
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
