import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PaymentMethodRepository, StripeTransactionRepository, WalletSettingRepository } from "@src/billing/repositories";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { TeamRecordRetentionService } from "./team-record-retention.service";

describe(TeamRecordRetentionService.name, () => {
  it("leaves every kind of record the member wrote for a team with that team", async () => {
    const { service, stripeTransactionRepository, paymentMethodRepository, walletSettingRepository, deploymentSettingRepository } = setup();
    const userId = faker.string.uuid();

    await service.releaseFromTeams(userId);

    expect(stripeTransactionRepository.detachFromTeams).toHaveBeenCalledWith(userId);
    expect(paymentMethodRepository.detachFromTeams).toHaveBeenCalledWith(userId);
    expect(walletSettingRepository.detachFromTeams).toHaveBeenCalledWith(userId);
    expect(deploymentSettingRepository.detachFromTeams).toHaveBeenCalledWith(userId);
  });

  function setup() {
    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    const paymentMethodRepository = mock<PaymentMethodRepository>();
    const walletSettingRepository = mock<WalletSettingRepository>();
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const service = new TeamRecordRetentionService(stripeTransactionRepository, paymentMethodRepository, walletSettingRepository, deploymentSettingRepository);

    return { service, stripeTransactionRepository, paymentMethodRepository, walletSettingRepository, deploymentSettingRepository };
  }
});
