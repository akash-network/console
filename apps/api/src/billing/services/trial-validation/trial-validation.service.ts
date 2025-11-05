import { GroupSpec, MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { EncodeObject } from "@cosmjs/proto-signing";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { UserWalletOutput } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
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

  async validateLeaseProvider(decoded: EncodeObject, _userWallet: UserWalletOutput) {
    if (decoded.typeUrl !== `/${MsgCreateLease.$type}`) {
      return;
    }

    const allowedAuditors = this.config.get("MANAGED_WALLET_LEASE_ALLOWED_AUDITORS");

    if (!allowedAuditors || allowedAuditors.length === 0) {
      return;
    }

    const lease = decoded.value as MsgCreateLease;
    const providerAddress = lease.bidId?.provider;
    assert(providerAddress, 400, "Provider address not found in lease message");

    const provider = await this.providerRepository.getProviderByAddressWithAttributes(providerAddress);
    assert(provider, 404, "Provider not found");

    const providerAuditors = provider.providerAttributeSignatures.map(signature => signature.auditor);
    const isAuditedByAllowedAuditor = providerAuditors.some(auditor => allowedAuditors.includes(auditor));

    assert(isAuditedByAllowedAuditor, 403, `Provider not authorized.`);
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
