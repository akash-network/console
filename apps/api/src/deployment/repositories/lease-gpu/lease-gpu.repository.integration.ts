import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import type { DetectedGpuRecord } from "@src/deployment/model-schemas";
import type { UserOutput } from "@src/user/repositories";
import { LeaseGpuRepository } from "./lease-gpu.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

function h100(overrides: Partial<DetectedGpuRecord> = {}): DetectedGpuRecord {
  return { rawName: "NVIDIA H100 80GB HBM3", pciDeviceId: "0x233010DE", memoryMb: 81559, count: 1, ...overrides };
}

describe(LeaseGpuRepository.name, () => {
  describe("upsertMany", () => {
    it("replaces the previous reading for a lease service rather than adding a second row", async () => {
      const { repository, user, lease } = await setup();

      await repository.upsertMany([{ ...lease, service: "web", gpus: [h100()], source: "nvidia-smi", driverVersion: "550.54.15" }]);
      await repository.upsertMany([
        { ...lease, service: "web", gpus: [h100({ rawName: "NVIDIA A100-SXM4-40GB", count: 2 })], source: "nvidia-smi", driverVersion: "565.57.01" }
      ]);

      const rows = await repository.findForDeployments({ userId: user.id, dseqs: [lease.dseq] });

      expect(rows).toHaveLength(1);
      expect(rows[0].gpus).toEqual([expect.objectContaining({ rawName: "NVIDIA A100-SXM4-40GB", count: 2 })]);
      expect(rows[0].driverVersion).toBe("565.57.01");
    });

    it("keeps one row per service of the same lease", async () => {
      const { repository, user, lease } = await setup();

      await repository.upsertMany([
        { ...lease, service: "web", gpus: [h100()], source: "nvidia-smi" },
        { ...lease, service: "worker", gpus: [h100()], source: "nvidia-smi" }
      ]);

      const rows = await repository.findForDeployments({ userId: user.id, dseqs: [lease.dseq] });

      expect(rows.map(row => row.service).sort()).toEqual(["web", "worker"]);
    });

    it("keeps a row for a container that answered without a gpu tool", async () => {
      const { repository, user, lease } = await setup();

      await repository.upsertMany([{ ...lease, service: "web", gpus: [], source: "none" }]);

      const rows = await repository.findForDeployments({ userId: user.id, dseqs: [lease.dseq] });

      expect(rows).toHaveLength(1);
      expect(rows[0].gpus).toEqual([]);
    });

    it("writes nothing for an empty batch", async () => {
      const { repository } = await setup();

      await expect(repository.upsertMany([])).resolves.toEqual([]);
    });
  });

  describe("findForDeployments", () => {
    it("answers several deployments in one read", async () => {
      const { repository, user, lease, otherLeaseOfSameUser } = await setup();

      await repository.upsertMany([
        { ...lease, service: "web", gpus: [h100()], source: "nvidia-smi" },
        { ...otherLeaseOfSameUser, service: "web", gpus: [h100()], source: "nvidia-smi" }
      ]);

      const rows = await repository.findForDeployments({ userId: user.id, dseqs: [lease.dseq, otherLeaseOfSameUser.dseq] });

      expect(rows.map(row => row.dseq).sort()).toEqual([lease.dseq, otherLeaseOfSameUser.dseq].sort());
    });

    it("does not answer with another user's rows", async () => {
      const { repository, user, lease, otherUserLease } = await setup();

      await repository.upsertMany([
        { ...lease, service: "web", gpus: [h100()], source: "nvidia-smi" },
        { ...otherUserLease, service: "web", gpus: [h100()], source: "nvidia-smi" }
      ]);

      const rows = await repository.findForDeployments({ userId: user.id, dseqs: [lease.dseq, otherUserLease.dseq] });

      expect(rows).toHaveLength(1);
      expect(rows[0].dseq).toBe(lease.dseq);
    });

    it("answers a row the reader's own ability covers", async () => {
      const { repository, abilityFor, user, lease } = await setup();

      await repository.upsertMany([{ ...lease, service: "web", gpus: [h100()], source: "nvidia-smi" }]);

      const rows = await repository.accessibleBy(abilityFor(user), "read").findForDeployments({ userId: user.id, dseqs: [lease.dseq] });

      expect(rows.map(row => row.dseq)).toEqual([lease.dseq]);
    });

    it("refuses a row the reader's ability does not cover", async () => {
      const { repository, abilityFor, otherUser, user, lease } = await setup();

      await repository.upsertMany([{ ...lease, service: "web", gpus: [h100()], source: "nvidia-smi" }]);

      const rows = await repository.accessibleBy(abilityFor(otherUser), "read").findForDeployments({ userId: user.id, dseqs: [lease.dseq] });

      expect(rows).toEqual([]);
    });

    it("returns nothing for an empty dseq list", async () => {
      const { repository, user } = await setup();

      await expect(repository.findForDeployments({ userId: user.id, dseqs: [] })).resolves.toEqual([]);
    });
  });

  describe("deleteForDeployment", () => {
    it("removes only the named deployment's rows", async () => {
      const { repository, user, lease, otherLeaseOfSameUser } = await setup();

      await repository.upsertMany([
        { ...lease, service: "web", gpus: [h100()], source: "nvidia-smi" },
        { ...otherLeaseOfSameUser, service: "web", gpus: [h100()], source: "nvidia-smi" }
      ]);

      await repository.deleteForDeployment({ userId: user.id, dseq: lease.dseq });

      const rows = await repository.findForDeployments({ userId: user.id, dseqs: [lease.dseq, otherLeaseOfSameUser.dseq] });

      expect(rows.map(row => row.dseq)).toEqual([otherLeaseOfSameUser.dseq]);
    });
  });

  describe("deleteForClosedDeployments", () => {
    it("removes the rows of a closed deployment and keeps those of an open one", async () => {
      const { repository, user, lease, otherLeaseOfSameUser } = await setup();

      await seedDeploymentSetting({ userId: user.id, dseq: lease.dseq, closed: true });
      await seedDeploymentSetting({ userId: user.id, dseq: otherLeaseOfSameUser.dseq, closed: false });
      await repository.upsertMany([
        { ...lease, service: "web", gpus: [h100()], source: "nvidia-smi" },
        { ...otherLeaseOfSameUser, service: "web", gpus: [h100()], source: "nvidia-smi" }
      ]);

      await repository.deleteForClosedDeployments();

      const rows = await repository.findForDeployments({ userId: user.id, dseqs: [lease.dseq, otherLeaseOfSameUser.dseq] });

      expect(rows.map(row => row.dseq)).toEqual([otherLeaseOfSameUser.dseq]);
    });

    it("keeps rows of a deployment the console holds no settings for", async () => {
      const { repository, user, lease } = await setup();

      await repository.upsertMany([{ ...lease, service: "web", gpus: [h100()], source: "nvidia-smi" }]);

      await repository.deleteForClosedDeployments();

      await expect(repository.findForDeployments({ userId: user.id, dseqs: [lease.dseq] })).resolves.toHaveLength(1);
    });
  });

  async function setup() {
    const repository = container.resolve(LeaseGpuRepository);
    const abilityService = container.resolve(AbilityService);
    const user = await seedUser({ userId: faker.string.uuid() });
    const otherUser = await seedUser({ userId: faker.string.uuid() });

    function leaseOf(userId: string) {
      return { userId, dseq: createDseq(), gseq: 1, oseq: 1, provider: createAkashAddress() };
    }

    function abilityFor(owner: UserOutput) {
      return abilityService.getAbilityFor("REGULAR_USER", owner);
    }

    return {
      repository,
      abilityFor,
      user,
      otherUser,
      lease: leaseOf(user.id),
      otherLeaseOfSameUser: leaseOf(user.id),
      otherUserLease: leaseOf(otherUser.id)
    };
  }
});
