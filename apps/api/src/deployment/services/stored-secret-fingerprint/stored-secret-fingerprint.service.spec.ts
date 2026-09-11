import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentSettingRepository, SealedSecret } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { StoredSecretFingerprintService } from "./stored-secret-fingerprint.service";

const WRITTEN_AT = "2026-09-01 10:00:00.123456+00";
const REWRITTEN_AT = "2026-09-01 10:05:00.654321+00";

function newSealedToken() {
  return Array.from({ length: 5 }, () => randomBytes(24).toString("base64url")).join(".");
}

function storedSecret(input: Partial<SealedSecret> & { id: string }): SealedSecret {
  return { sealedSecrets: newSealedToken(), updatedAtMarker: WRITTEN_AT, ...input };
}

describe(StoredSecretFingerprintService.name, () => {
  it("measures every stored token, and only the rows the sweep yields", async () => {
    const rows = [storedSecret({ id: "a" }), storedSecret({ id: "b" })];
    const { service } = setup({ sweeps: [rows] });

    const { fingerprint } = await service.take();

    expect(fingerprint).toEqual({
      digest: expect.stringMatching(/^[0-9a-f]{64}$/),
      rowCount: 2,
      byteTotal: rows[0].sealedSecrets.length + rows[1].sealedSecrets.length
    });
  });

  it("digests a sweep identically however many pages it arrives in", async () => {
    const rows = [storedSecret({ id: "a" }), storedSecret({ id: "b" }), storedSecret({ id: "c" })];
    const { service: whole } = setup({ sweeps: [rows] });
    const { service: paged } = setup({ sweeps: [rows], pageSize: 1 });

    expect((await paged.take({ batchSize: 1 })).fingerprint).toEqual((await whole.take()).fingerprint);
  });

  describe("reconcile", () => {
    it("reports an unchanged table as identical on digest, row count and byte total", async () => {
      const rows = [storedSecret({ id: "a" }), storedSecret({ id: "b" })];
      const { service } = setup({ sweeps: [rows, rows] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation.after).toEqual(reconciliation.before);
      expect(reconciliation).toMatchObject({ ownerRewritten: 0, created: 0, removed: 0, reSealed: [] });
    });

    it("counts a token rewritten with its updated_at as the owner's own write", async () => {
      const before = [storedSecret({ id: "a" }), storedSecret({ id: "b" })];
      const after = [storedSecret({ id: "a", updatedAtMarker: REWRITTEN_AT }), before[1]];
      const { service } = setup({ sweeps: [before, after] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ ownerRewritten: 1, reSealed: [] });
      expect(reconciliation.after.digest).not.toBe(reconciliation.before.digest);
    });

    it("reports a token rewritten without its updated_at moving as a re-seal", async () => {
      const before = [storedSecret({ id: "a" }), storedSecret({ id: "b" })];
      const after = [storedSecret({ id: "a" }), before[1]];
      const { service } = setup({ sweeps: [before, after] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ ownerRewritten: 0, reSealed: ["a"] });
    });

    it("reports tokens swapped between two deployments, though the set of tokens did not change", async () => {
      const before = [storedSecret({ id: "a" }), storedSecret({ id: "b" })];
      const after = [
        { ...before[0], sealedSecrets: before[1].sealedSecrets },
        { ...before[1], sealedSecrets: before[0].sealedSecrets }
      ];
      const { service } = setup({ sweeps: [before, after] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation.reSealed).toEqual(["a", "b"]);
      expect(reconciliation.after.digest).not.toBe(reconciliation.before.digest);
      expect(reconciliation.after.byteTotal).toBe(reconciliation.before.byteTotal);
    });

    it("counts a row that appeared during the run as created", async () => {
      const before = [storedSecret({ id: "a" })];
      const { service } = setup({ sweeps: [before, [...before, storedSecret({ id: "b" })]] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ created: 1, ownerRewritten: 0, removed: 0, reSealed: [] });
    });

    it("counts a row that disappeared during the run as removed", async () => {
      const before = [storedSecret({ id: "a" }), storedSecret({ id: "b" })];
      const { service } = setup({ sweeps: [before, [before[0]]] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ removed: 1, ownerRewritten: 0, created: 0, reSealed: [] });
    });

    it("reports a token that changed while its updated_at stayed unset as a re-seal", async () => {
      const before = [storedSecret({ id: "a", updatedAtMarker: null })];
      const after = [storedSecret({ id: "a", updatedAtMarker: null })];
      const { service } = setup({ sweeps: [before, after] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ ownerRewritten: 0, reSealed: ["a"] });
    });

    it("counts a first-ever updated_at as the owner's own write", async () => {
      const before = [storedSecret({ id: "a", updatedAtMarker: null })];
      const after = [storedSecret({ id: "a", updatedAtMarker: REWRITTEN_AT })];
      const { service } = setup({ sweeps: [before, after] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ ownerRewritten: 1, reSealed: [] });
    });

    it("counts a token rewritten within the same millisecond as its previous write as the owner's own write", async () => {
      const before = [storedSecret({ id: "a", updatedAtMarker: "2026-09-01 10:00:00.123456+00" })];
      const after = [storedSecret({ id: "a", updatedAtMarker: "2026-09-01 10:00:00.123999+00" })];
      const { service } = setup({ sweeps: [before, after] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ ownerRewritten: 1, reSealed: [] });
    });

    it("reports a token that changed while its updated_at read exactly as before as a re-seal", async () => {
      const before = [storedSecret({ id: "a", updatedAtMarker: REWRITTEN_AT })];
      const after = [storedSecret({ id: "a", updatedAtMarker: REWRITTEN_AT })];
      const { service } = setup({ sweeps: [before, after] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ ownerRewritten: 0, reSealed: ["a"] });
    });
  });

  function setup(input: { sweeps: SealedSecret[][]; pageSize?: number }) {
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const remaining = [...input.sweeps];

    deploymentSettingRepository.findSealedSecretsIteratively.mockImplementation(async function* yieldNextSweep() {
      const rows = remaining.shift() ?? [];
      const pageSize = input.pageSize ?? Math.max(rows.length, 1);

      for (let start = 0; start < rows.length; start += pageSize) {
        yield rows.slice(start, start + pageSize);
      }
    });

    return { service: new StoredSecretFingerprintService(deploymentSettingRepository), deploymentSettingRepository };
  }
});
