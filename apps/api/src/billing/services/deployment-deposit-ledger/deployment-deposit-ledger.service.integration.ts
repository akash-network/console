import { MsgAccountDeposit, Scope } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { ProjectBudgetAlertHandler } from "@src/organization/services/project-budget-alert/project-budget-alert.handler";
import { DeploymentDepositLedgerService } from "./deployment-deposit-ledger.service";

import { findDeploymentDepositsOf, seedDeploymentDeposit } from "@test/seeders/db/deployment-deposit.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { useJobWorkers } from "@test/services/job-queue-harness";

const jobQueue = useJobWorkers(() => [container.resolve(ProjectBudgetAlertHandler)]);

describe(DeploymentDepositLedgerService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses a job's top-up from a team organization's wallet once its project's budget is spent and stops top-ups, with every flag off", async () => {
    const { ledger, wallet, topUp, organization } = await setup({ stopTopUps: true });

    await expect(ledger.recordPending(wallet.id, [topUp])).rejects.toMatchObject({ status: 403, errorCode: "project_budget_exceeded" });

    expect((await findDeploymentDepositsOf(organization.id)).map(({ kind }) => kind)).toEqual(["deployment_create"]);
  });

  it("records a job's top-up from a team organization's wallet past its project's budget when the budget lets top-ups through", async () => {
    const { ledger, wallet, topUp, organization, dseq } = await setup({ stopTopUps: false });

    await ledger.recordPending(wallet.id, [topUp]);

    expect(await findDeploymentDepositsOf(organization.id)).toContainEqual(
      expect.objectContaining({ kind: "top_up", dseq, status: "pending", amountCents: 10 })
    );
  });

  async function setup(input: { stopTopUps: boolean }) {
    await jobQueue();
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockReturnValue(false);
    const { organization, project } = await seedOrganizationWithOwner();
    const { wallet, address } = await seedUserWithWallet({ organizationId: organization.id });
    const setting = await seedDeploymentSetting({ userId: wallet.userId, organizationId: organization.id, projectId: project.id });
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("ProjectBudgets"))
      .values({ organizationId: organization.id, projectId: project.id, monthlyAmountCents: 1000, stopTopUps: input.stopTopUps });
    await seedDeploymentDeposit({ organizationId: organization.id, projectId: project.id, kind: "deployment_create", amountCents: 1000, status: "confirmed" });

    const topUp: EncodeObject = {
      typeUrl: `/${MsgAccountDeposit.$type}`,
      value: MsgAccountDeposit.fromPartial({
        signer: address,
        id: { scope: Scope.deployment, xid: `${address}/${setting.dseq}` },
        deposit: { amount: { denom: "uact", amount: "100000" } }
      })
    };

    return { ledger: container.resolve(DeploymentDepositLedgerService), wallet, topUp, organization, dseq: setting.dseq };
  }
});
