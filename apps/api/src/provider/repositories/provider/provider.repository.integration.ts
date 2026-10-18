import type { Provider } from "@akashnetwork/database/dbSchemas/akash";
import type { CreationAttributes } from "sequelize";
import { container } from "tsyringe";
import { beforeAll, describe, expect, it } from "vitest";

import { CHAIN_DB } from "@src/chain";
import { ProviderRepository } from "./provider.repository";

import { createAkashAddress, createProvider, createProviderSnapshot, createProviderSnapshotNode, createProviderSnapshotNodeGpu } from "@test/seeders";

describe(ProviderRepository.name, () => {
  beforeAll(async () => {
    await container.resolve(CHAIN_DB).authenticate();
  });

  describe("getWithAttributesAndAuditors", () => {
    it("pages providers created at the same height in owner order whatever order they were written in", async () => {
      const { repository, seedProvidersInReverseOwnerOrder } = setup();
      const owners = await seedProvidersInReverseOwnerOrder(3, { createdHeight: 42 });

      const firstPage = await repository.getWithAttributesAndAuditors({ addresses: owners, limit: 2, offset: 0 });
      const secondPage = await repository.getWithAttributesAndAuditors({ addresses: owners, limit: 2, offset: 2 });

      expect(firstPage.map(provider => provider.owner)).toEqual(owners.slice(0, 2));
      expect(secondPage.map(provider => provider.owner)).toEqual(owners.slice(2));
    });
  });

  describe("getProviderWithNodes", () => {
    it("pages providers in owner order whatever order they were written in", async () => {
      const { repository, seedProvidersInReverseOwnerOrder } = setup();
      const owners = await seedProvidersInReverseOwnerOrder(3);

      const firstPage = await repository.getProviderWithNodes({ addresses: owners, limit: 2, offset: 0 });
      const secondPage = await repository.getProviderWithNodes({ addresses: owners, limit: 2, offset: 2 });

      expect(firstPage.map(provider => provider.owner)).toEqual(owners.slice(0, 2));
      expect(secondPage.map(provider => provider.owner)).toEqual(owners.slice(2));
    });

    it("lists a provider's nodes and their gpus by name whatever order they were written in", async () => {
      const { repository, seedSnapshotOf } = setup();
      const provider = await seedSnapshotOf(await createProvider(), [
        { name: "node-b", gpus: ["h100"] },
        { name: "node-a", gpus: ["rtx4090", "a100"] }
      ]);

      const [found] = await repository.getProviderWithNodes({ addresses: [provider.owner], limit: 1, offset: 0 });

      expect(found.lastSuccessfulSnapshot.nodes.map(node => node.gpus.map(gpu => gpu.name))).toEqual([["a100", "rtx4090"], ["h100"]]);
    });
  });

  function setup() {
    const repository = new ProviderRepository();

    async function seedSnapshotOf(provider: Provider, nodes: { name: string; gpus: string[] }[]) {
      const snapshot = await createProviderSnapshot({ owner: provider.owner });
      await provider.update({ lastSuccessfulSnapshotId: snapshot.id });
      for (const { name, gpus } of nodes) {
        const node = await createProviderSnapshotNode({ snapshotId: snapshot.id, name });
        for (const gpu of gpus) {
          await createProviderSnapshotNodeGpu({ snapshotNodeId: node.id, name: gpu });
        }
      }

      return provider;
    }

    async function seedProvidersInReverseOwnerOrder(count: number, overrides: Partial<CreationAttributes<Provider>> = {}) {
      const owners = Array.from({ length: count }, () => createAkashAddress()).sort();
      for (const owner of owners.toReversed()) {
        await seedSnapshotOf(await createProvider({ ...overrides, owner }), []);
      }

      return owners;
    }

    return { repository, seedSnapshotOf, seedProvidersInReverseOwnerOrder };
  }
});
