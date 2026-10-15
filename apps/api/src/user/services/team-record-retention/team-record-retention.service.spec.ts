import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PaymentMethodRepository, StripeTransactionRepository, WalletSettingRepository } from "@src/billing/repositories";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { UserTemplateRepository } from "@src/user/repositories/user-template/user-template.repository";
import { TeamRecordRetentionService } from "./team-record-retention.service";

describe(TeamRecordRetentionService.name, () => {
  it("leaves every kind of record the member wrote for a team with that team", async () => {
    const { service, stripeTransactionRepository, paymentMethodRepository, walletSettingRepository, deploymentSettingRepository, userTemplateRepository } =
      setup();
    const user = { id: faker.string.uuid(), userId: `auth0|${faker.string.alphanumeric(24)}` };

    await service.releaseFromTeams(user);

    expect(stripeTransactionRepository.detachFromTeams).toHaveBeenCalledWith(user.id);
    expect(paymentMethodRepository.detachFromTeams).toHaveBeenCalledWith(user.id);
    expect(walletSettingRepository.detachFromTeams).toHaveBeenCalledWith(user.id);
    expect(deploymentSettingRepository.detachFromTeams).toHaveBeenCalledWith(user.id);
    expect(userTemplateRepository.detachFromTeams).toHaveBeenCalledWith(user.userId);
  });

  it("looks for no template of a member without an Auth0 identity", async () => {
    const { service, deploymentSettingRepository, userTemplateRepository } = setup();
    const user = { id: faker.string.uuid(), userId: null };

    await service.releaseFromTeams(user);

    expect(deploymentSettingRepository.detachFromTeams).toHaveBeenCalledWith(user.id);
    expect(userTemplateRepository.detachFromTeams).not.toHaveBeenCalled();
  });

  function setup() {
    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    const paymentMethodRepository = mock<PaymentMethodRepository>();
    const walletSettingRepository = mock<WalletSettingRepository>();
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const userTemplateRepository = mock<UserTemplateRepository>();
    const service = new TeamRecordRetentionService(
      stripeTransactionRepository,
      paymentMethodRepository,
      walletSettingRepository,
      deploymentSettingRepository,
      userTemplateRepository
    );

    return { service, stripeTransactionRepository, paymentMethodRepository, walletSettingRepository, deploymentSettingRepository, userTemplateRepository };
  }
});
