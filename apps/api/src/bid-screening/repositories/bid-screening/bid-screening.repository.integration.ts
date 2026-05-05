import { Provider, ProviderAttributeSignature, ProviderSnapshot, ProviderSnapshotStorage } from "@akashnetwork/database/dbSchemas/akash";
import { Op } from "sequelize";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { CHAIN_DB } from "@src/chain";
import { BidScreeningRepository } from "./bid-screening.repository";

import { createAkashAddress, createProviderSeed, createProviderSnapshot, createProviderSnapshotNode } from "@test/seeders";

describe(BidScreeningRepository.name, () => {
  const providerOwners = new Set<string>();
  const snapshotIds = new Set<string>();

  afterEach(async () => {
    if (providerOwners.size > 0) {
      await Provider.update({ lastSuccessfulSnapshotId: null, lastSnapshotId: null }, { where: { owner: { [Op.in]: Array.from(providerOwners) } } });
      await Provider.destroy({ where: { owner: { [Op.in]: Array.from(providerOwners) } }, cascade: true });
      providerOwners.clear();
    }
    if (snapshotIds.size > 0) {
      await ProviderSnapshot.destroy({ where: { id: { [Op.in]: Array.from(snapshotIds) } }, cascade: true });
      snapshotIds.clear();
    }
  });

  describe("getOnlineProvidersWithSnapshots", () => {
    it("returns full provider and snapshot data", async () => {
      const { repository } = setup();
      const provider = await createTestProvider({ availableCPU: 4000, availableMemory: 4294967296, availableEphemeralStorage: 10737418240 });
      const other = await createTestProvider({ availableCPU: 4000, availableMemory: 4294967296, availableEphemeralStorage: 10737418240 });

      const results = await repository.getOnlineProvidersWithSnapshots();

      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ owner: other.owner, lastSuccessfulSnapshot: expect.any(Object) }),
          expect.objectContaining({ owner: provider.owner, lastSuccessfulSnapshot: expect.any(Object) })
        ])
      );
    });

    it("includes nodes and storage in the snapshot", async () => {
      const { repository } = setup();
      const provider = await createTestProvider({ availableCPU: 4000, availableMemory: 4294967296, availableEphemeralStorage: 10737418240 });
      await ProviderSnapshotStorage.create({ snapshotId: provider.snapshotId, class: "beta3", allocatable: 100000000000, allocated: 0 });

      const results = await repository.getOnlineProvidersWithSnapshots();

      expect(results[0].lastSuccessfulSnapshot.nodes).toHaveLength(1);
      expect(results[0].lastSuccessfulSnapshot.storage).toHaveLength(1);
      expect(results[0].lastSuccessfulSnapshot.storage[0].class).toBe("beta3");
    });

    it("returns empty array when owner list is empty", async () => {
      const { repository } = setup();

      const results = await repository.getOnlineProvidersWithSnapshots();

      expect(results).toEqual([]);
    });
  });

  describe("getAuditedProviderAddresses", () => {
    it("returns provider addresses signed by any of the given auditors", async () => {
      const { repository } = setup();
      const auditor = createAkashAddress();

      const audited = await createTestProviderWithoutSnapshot();
      await ProviderAttributeSignature.create({ provider: audited.owner, auditor, key: "region", value: "us-east" });

      const notAudited = await createTestProviderWithoutSnapshot();

      const result = await repository.getAuditedProviderAddresses([auditor]);

      expect(result).toBeInstanceOf(Set);
      expect(result.has(audited.owner)).toBe(true);
      expect(result.has(notAudited.owner)).toBe(false);
    });

    it("returns addresses audited by any of multiple auditors", async () => {
      const { repository } = setup();
      const [auditor1, auditor2] = [createAkashAddress(), createAkashAddress()];

      const byFirst = await createTestProviderWithoutSnapshot();
      await ProviderAttributeSignature.create({ provider: byFirst.owner, auditor: auditor1, key: "region", value: "us-east" });

      const bySecond = await createTestProviderWithoutSnapshot();
      await ProviderAttributeSignature.create({ provider: bySecond.owner, auditor: auditor2, key: "region", value: "us-east" });

      const result = await repository.getAuditedProviderAddresses([auditor1, auditor2]);

      expect(result.has(byFirst.owner)).toBe(true);
      expect(result.has(bySecond.owner)).toBe(true);
    });

    it("returns empty set when no providers are audited", async () => {
      const { repository } = setup();
      const auditor = createAkashAddress();

      const result = await repository.getAuditedProviderAddresses([auditor]);

      expect(result.size).toBe(0);
    });
  });

  function setup() {
    return { repository: new BidScreeningRepository() };
  }

  let providerIndex = 0;

  async function createTestProvider(
    snapshotOverrides: {
      availableCPU?: number;
      availableMemory?: number;
      availableEphemeralStorage?: number;
      availableGPU?: number;
      availablePersistentStorage?: number;
      isOnline?: boolean;
      deletedHeight?: number;
      skipDefaultNode?: boolean;
    } = {}
  ): Promise<{ owner: string; hostUri: string; snapshotId: string }> {
    const { isOnline = true, deletedHeight, skipDefaultNode = false, ...snapshotFields } = snapshotOverrides;
    const height = await container.resolve(CHAIN_DB).models.block.max("height");

    const owner = createAkashAddress();
    const hostUri = `https://test-provider-${++providerIndex}-${Date.now()}.akash.network:8443`;
    const provider = await Provider.create({
      ...createProviderSeed({ owner, hostUri, isOnline, lastSnapshotId: null, createdHeight: height, updatedHeight: height }),
      deletedHeight: deletedHeight ?? null,
      lastSuccessfulSnapshotId: null
    });
    providerOwners.add(provider.owner);

    const nodeCpu = snapshotFields.availableCPU ?? 8000;
    const nodeMemory = snapshotFields.availableMemory ?? 17179869184;
    const nodeEphemeral = snapshotFields.availableEphemeralStorage ?? 107374182400;
    const nodeGpu = snapshotFields.availableGPU ?? 0;

    const snapshot = await createProviderSnapshot({
      owner: provider.owner,
      availableCPU: nodeCpu,
      availableMemory: nodeMemory,
      availableEphemeralStorage: nodeEphemeral,
      availableGPU: nodeGpu,
      availablePersistentStorage: snapshotFields.availablePersistentStorage ?? 0
    });
    snapshotIds.add(snapshot.id);

    if (!skipDefaultNode) {
      await createProviderSnapshotNode({
        snapshotId: snapshot.id,
        cpuAllocatable: nodeCpu,
        cpuAllocated: 0,
        memoryAllocatable: nodeMemory,
        memoryAllocated: 0,
        ephemeralStorageAllocatable: nodeEphemeral,
        ephemeralStorageAllocated: 0,
        gpuAllocatable: nodeGpu,
        gpuAllocated: 0,
        capabilitiesStorageSSD: false,
        capabilitiesStorageHDD: false,
        capabilitiesStorageNVME: false
      });
    }

    await provider.update({ lastSuccessfulSnapshotId: snapshot.id });

    return { owner: provider.owner, hostUri: provider.hostUri, snapshotId: snapshot.id };
  }

  async function createTestProviderWithoutSnapshot(): Promise<{ owner: string }> {
    const height = await container.resolve(CHAIN_DB).models.block.max("height");
    const owner = createAkashAddress();
    const hostUri = `https://test-provider-${++providerIndex}-${Date.now()}.akash.network:8443`;
    await Provider.create({
      ...createProviderSeed({ owner, hostUri, isOnline: true, lastSnapshotId: null, createdHeight: height, updatedHeight: height }),
      lastSuccessfulSnapshotId: null
    });
    providerOwners.add(owner);
    return { owner };
  }
});
