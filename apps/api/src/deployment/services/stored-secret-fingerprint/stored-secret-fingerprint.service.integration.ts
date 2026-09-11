import { faker } from "@faker-js/faker";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { UserRepository } from "@src/user/repositories";
import { StoredSecretFingerprintService } from "./stored-secret-fingerprint.service";

const SDL = "version: '2.0'";

function newSealedToken() {
  return Array.from({ length: 5 }, () => randomBytes(24).toString("base64url")).join(".");
}

describe(StoredSecretFingerprintService.name, () => {
  it("measures every stored token and no other row, across more than one page", async () => {
    const { service, storeSecrets, storeNothing } = await setup();
    const tokens = [newSealedToken(), newSealedToken(), newSealedToken()];
    await Promise.all(tokens.map(storeSecrets));
    await storeNothing();

    const { fingerprint } = await service.take({ batchSize: 2 });

    expect(fingerprint).toEqual({
      digest: expect.stringMatching(/^[0-9a-f]{64}$/),
      rowCount: 3,
      byteTotal: tokens.reduce((total, token) => total + token.length, 0)
    });
  });

  it("reports an untouched table as identical on digest, row count and byte total", async () => {
    const { service, storeSecrets } = await setup();
    await Promise.all([newSealedToken(), newSealedToken()].map(storeSecrets));

    const reconciliation = await service.reconcile(await service.take({ batchSize: 1 }), { batchSize: 1 });

    expect(reconciliation.after).toEqual(reconciliation.before);
    expect(reconciliation).toMatchObject({ ownerRewritten: 0, created: 0, removed: 0, reSealed: [] });
  });

  it("counts a user rewriting their own secrets during the run as their own write", async () => {
    const { service, storeSecrets, rewriteAsOwner } = await setup();
    const { dseq } = await storeSecrets(newSealedToken());
    await storeSecrets(newSealedToken());

    const before = await service.take();
    await rewriteAsOwner(dseq, newSealedToken());
    const reconciliation = await service.reconcile(before);

    expect(reconciliation).toMatchObject({ ownerRewritten: 1, created: 0, removed: 0, reSealed: [] });
    expect(reconciliation.after.digest).not.toBe(reconciliation.before.digest);
  });

  it("reports a token rewritten without its updated_at moving as a re-seal", async () => {
    const { service, storeSecrets, rewriteWithoutTouchingUpdatedAt } = await setup();
    const { id } = await storeSecrets(newSealedToken());
    await storeSecrets(newSealedToken());

    const before = await service.take();
    await rewriteWithoutTouchingUpdatedAt(id, newSealedToken());
    const reconciliation = await service.reconcile(before);

    expect(reconciliation).toMatchObject({ ownerRewritten: 0, reSealed: [id] });
  });

  it("counts a deployment that stored secrets during the run as created", async () => {
    const { service, storeSecrets } = await setup();
    await storeSecrets(newSealedToken());

    const before = await service.take();
    await storeSecrets(newSealedToken());
    const reconciliation = await service.reconcile(before);

    expect(reconciliation).toMatchObject({ created: 1, ownerRewritten: 0, removed: 0, reSealed: [] });
    expect(reconciliation.after.rowCount).toBe(reconciliation.before.rowCount + 1);
  });

  it("counts a deployment whose secrets were cleared during the run as removed", async () => {
    const { service, storeSecrets, clearSecrets } = await setup();
    const { dseq } = await storeSecrets(newSealedToken());
    await storeSecrets(newSealedToken());

    const before = await service.take();
    await clearSecrets(dseq);
    const reconciliation = await service.reconcile(before);

    expect(reconciliation).toMatchObject({ removed: 1, ownerRewritten: 0, created: 0, reSealed: [] });
  });

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const deploymentSettingsTable = resolveTable("DeploymentSettings");
    await db.execute(sql`TRUNCATE TABLE ${resolveTable("Users")} CASCADE`);

    const userRepository = container.resolve(UserRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
    const service = container.resolve(StoredSecretFingerprintService);
    const user = await userRepository.create({});

    function newDseq() {
      return faker.number.int({ min: 100000, max: 999999 }).toString();
    }

    async function storeSecrets(sealedSecrets: string) {
      const dseq = newDseq();
      const id = await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BAUG", sealedSecrets });

      return { dseq, id };
    }

    async function storeNothing() {
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq: newDseq(), sdl: SDL, manifestVersion: "BAUG", sealedSecrets: null });
    }

    async function rewriteAsOwner(dseq: string, sealedSecrets: string) {
      await deploymentSettingRepository.replaceDefinitionIfVersionMatches({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BQYH", sealedSecrets });
    }

    async function clearSecrets(dseq: string) {
      await deploymentSettingRepository.replaceDefinitionIfVersionMatches({ userId: user.id, dseq, sdl: SDL, manifestVersion: "BQYH", sealedSecrets: null });
    }

    async function rewriteWithoutTouchingUpdatedAt(id: string, sealedSecrets: string) {
      await db.update(deploymentSettingsTable).set({ sealedSecrets }).where(eq(deploymentSettingsTable.id, id));
    }

    return { service, storeSecrets, storeNothing, rewriteAsOwner, clearSecrets, rewriteWithoutTouchingUpdatedAt };
  }
});
