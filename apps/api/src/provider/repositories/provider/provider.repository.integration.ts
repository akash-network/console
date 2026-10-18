import type { Provider } from "@akashnetwork/database/dbSchemas/akash";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { CHAIN_DB } from "@src/chain";
import { ProviderRepository } from "./provider.repository";

import { createAkashAddress, createProvider, createProviderSnapshot } from "@test/seeders";

describe(ProviderRepository.name, () => {
  describe("getProviderWithNodes", () => {
    it("pages through providers in owner order so each one is read exactly once", async () => {
      const { repository, owners } = await setup({ count: 6 });

      const pagedOwners = await readOwnersPageByPage(2, offset => repository.getProviderWithNodes({ limit: 2, offset }));

      expect(pagedOwners.filter(owner => owners.includes(owner))).toEqual([...owners].sort());
    });
  });

  describe("getWithAttributesAndAuditors", () => {
    it("pages through providers created in the same block in owner order so each one is read exactly once", async () => {
      const { repository, owners } = await setup({ count: 6, createdHeight: 4242 });

      const pagedOwners = await readOwnersPageByPage(1, offset => repository.getWithAttributesAndAuditors({ limit: 1, offset }));

      expect(pagedOwners.filter(owner => owners.includes(owner))).toEqual([...owners].sort());
    });
  });

  async function readOwnersPageByPage(pageSize: number, readPage: (offset: number) => Promise<Provider[]>) {
    const owners: string[] = [];
    let page: Provider[];
    do {
      page = await readPage(owners.length);
      owners.push(...page.map(provider => provider.owner));
    } while (page.length === pageSize);

    return owners;
  }

  async function setup(input: { count: number; createdHeight?: number }) {
    await container.resolve(CHAIN_DB).authenticate();
    const ownersInReverseOrder = Array.from({ length: input.count }, () => createAkashAddress())
      .sort()
      .reverse();
    for (const owner of ownersInReverseOrder) {
      const provider = await createProvider({ owner, createdHeight: input.createdHeight });
      const snapshot = await createProviderSnapshot({ owner, isOnline: true });
      await provider.update({ lastSuccessfulSnapshotId: snapshot.id });
    }

    return { repository: container.resolve(ProviderRepository), owners: ownersInReverseOrder };
  }
});
