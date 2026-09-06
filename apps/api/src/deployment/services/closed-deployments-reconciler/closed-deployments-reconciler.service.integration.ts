import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { CHAIN_DB } from "@src/chain";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { UserRepository } from "@src/user/repositories";
import { ClosedDeploymentsReconcilerService } from "./closed-deployments-reconciler.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDeployment } from "@test/seeders/deployment.seeder";

describe(ClosedDeploymentsReconcilerService.name, () => {
  it("marks a record closed once the chain has closed its deployment", async () => {
    const { service, recordDeployment, readClosed } = await setup();
    const settled = await recordDeployment({ autoTopUpEnabled: true, closedOnChain: true });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(await readClosed(settled.id)).toBe(true);
  });

  it("marks a record closed even when its owner turned funding off, which the funding sweep never selects", async () => {
    const { service, recordDeployment, readClosed } = await setup();
    const fundingOff = await recordDeployment({ autoTopUpEnabled: false, closedOnChain: true });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(await readClosed(fundingOff.id)).toBe(true);
  });

  it("leaves a record open while its deployment is still running on chain", async () => {
    const { service, recordDeployment, readClosed } = await setup();
    const running = await recordDeployment({ autoTopUpEnabled: true, closedOnChain: false });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(await readClosed(running.id)).toBe(false);
  });

  it("leaves a record alone when the indexer holds no deployment for it", async () => {
    const { service, recordDeployment, readClosed } = await setup();
    const unindexed = await recordDeployment({ autoTopUpEnabled: true, closedOnChain: null });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(await readClosed(unindexed.id)).toBe(false);
  });

  it("matches a record whose dseq carries leading zeros the indexer does not", async () => {
    const { service, recordDeployment, readClosed } = await setup();
    const padded = await recordDeployment({ autoTopUpEnabled: true, closedOnChain: true, padDseq: true });

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(await readClosed(padded.id)).toBe(true);
  });

  it("changes nothing during a dry run", async () => {
    const { service, recordDeployment, readClosed } = await setup();
    const settled = await recordDeployment({ autoTopUpEnabled: true, closedOnChain: true });

    await service.reconcileClosedDeployments({ dryRun: true });

    expect(await readClosed(settled.id)).toBe(false);
  });

  it("converges a set larger than one batch", async () => {
    const { service, recordDeployment, readClosed } = await setup();
    const settled = await Promise.all(Array.from({ length: 5 }, () => recordDeployment({ autoTopUpEnabled: faker.datatype.boolean(), closedOnChain: true })));

    await service.reconcileClosedDeployments({ dryRun: false });

    expect(await Promise.all(settled.map(({ id }) => readClosed(id)))).toEqual([true, true, true, true, true]);
  });

  async function setup() {
    container.resolve(CHAIN_DB);

    const service = container.resolve(ClosedDeploymentsReconcilerService);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
    const userRepository = container.resolve(UserRepository);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const deploymentSettingsTable = resolveTable("DeploymentSettings");
    const userWalletsTable = resolveTable("UserWallets");

    const user = await userRepository.create({ userId: faker.string.uuid() });
    const address = createAkashAddress();
    await db.insert(userWalletsTable).values({ userId: user.id, address, deploymentAllowance: "0", feeAllowance: "0", isTrialing: false });

    async function recordDeployment(input: { autoTopUpEnabled: boolean; closedOnChain: boolean | null; padDseq?: boolean }) {
      const dseq = faker.number.int({ min: 100_000, max: 9_999_999 }).toString();

      if (input.closedOnChain !== null) {
        await createDeployment({ owner: address, dseq, closedHeight: input.closedOnChain ? 5_000_000 : undefined });
      }

      return await deploymentSettingRepository.create({
        userId: user.id,
        dseq: input.padDseq ? `000${dseq}` : dseq,
        autoTopUpEnabled: input.autoTopUpEnabled
      });
    }

    async function readClosed(id: string) {
      return (await deploymentSettingRepository.findById(id))!.closed;
    }

    return { service, deploymentSettingRepository, db, deploymentSettingsTable, user, address, recordDeployment, readClosed };
  }
});
