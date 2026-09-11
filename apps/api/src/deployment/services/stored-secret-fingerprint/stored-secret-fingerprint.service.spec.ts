import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentSettingRepository, SealedSecret } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { StoredSecretFingerprintService } from "./stored-secret-fingerprint.service";

const WRITTEN_AT = "2026-09-01T10:00:00.123456";
const RUN_OPENED_AT = "2026-09-01T10:02:00.000000";
const REWRITTEN_AT = "2026-09-01T10:05:00.654321";

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
      expect(reconciliation).toMatchObject({ ownerRewritten: 0, created: 0, removed: 0, unexplained: [] });
    });

    it("counts a token rewritten with its updated_at as the owner's own write", async () => {
      const before = [storedSecret({ id: "a" }), storedSecret({ id: "b" })];
      const after = [storedSecret({ id: "a", updatedAtMarker: REWRITTEN_AT }), before[1]];
      const { service } = setup({ sweeps: [before, after] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ ownerRewritten: 1, unexplained: [] });
      expect(reconciliation.after.digest).not.toBe(reconciliation.before.digest);
    });

    it("reports a token rewritten without its updated_at moving as a re-seal", async () => {
      const before = [storedSecret({ id: "a" }), storedSecret({ id: "b" })];
      const after = [storedSecret({ id: "a" }), before[1]];
      const { service } = setup({ sweeps: [before, after] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ ownerRewritten: 0, unexplained: ["a"] });
    });

    it("reports tokens swapped between two deployments, though the set of tokens did not change", async () => {
      const before = [storedSecret({ id: "a" }), storedSecret({ id: "b" })];
      const after = [
        { ...before[0], sealedSecrets: before[1].sealedSecrets },
        { ...before[1], sealedSecrets: before[0].sealedSecrets }
      ];
      const { service } = setup({ sweeps: [before, after] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation.unexplained).toEqual(["a", "b"]);
      expect(reconciliation.after.digest).not.toBe(reconciliation.before.digest);
      expect(reconciliation.after.byteTotal).toBe(reconciliation.before.byteTotal);
    });

    it("counts a token stored during the run as created", async () => {
      const before = [storedSecret({ id: "a" })];
      const appeared = storedSecret({ id: "b", updatedAtMarker: REWRITTEN_AT });
      const { service } = setup({ sweeps: [before, [...before, appeared]] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ created: 1, ownerRewritten: 0, removed: 0, unexplained: [] });
    });

    it("reports a token that appeared under a stamp older than the run as a re-seal", async () => {
      const before = [storedSecret({ id: "a" })];
      const appeared = storedSecret({ id: "b", updatedAtMarker: WRITTEN_AT });
      const { service } = setup({ sweeps: [before, [...before, appeared]] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ created: 0, unexplained: ["b"] });
    });

    it("reports a token that appeared on a row carrying no stamp at all as a re-seal", async () => {
      const before = [storedSecret({ id: "a" })];
      const appeared = storedSecret({ id: "b", updatedAtMarker: null });
      const { service } = setup({ sweeps: [before, [...before, appeared]] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ created: 0, unexplained: ["b"] });
    });

    it("counts a row deleted during the run as removed", async () => {
      const before = [storedSecret({ id: "a" }), storedSecret({ id: "b" })];
      const { service } = setup({ sweeps: [before, [before[0]]] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ removed: 1, ownerRewritten: 0, created: 0, unexplained: [] });
    });

    it("counts a token cleared by a write as removed", async () => {
      const before = [storedSecret({ id: "a" }), storedSecret({ id: "b" })];
      const { service } = setup({ sweeps: [before, [before[0]]], markersAfterRun: { b: REWRITTEN_AT } });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ removed: 1, unexplained: [] });
    });

    it("reports a token cleared from a row nothing wrote as a re-seal", async () => {
      const before = [storedSecret({ id: "a" }), storedSecret({ id: "b" })];
      const { service } = setup({ sweeps: [before, [before[0]]], markersAfterRun: { b: WRITTEN_AT } });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ removed: 0, unexplained: ["b"] });
    });

    it("asks for the stamps of every vanished row, a batch at a time", async () => {
      const before = [storedSecret({ id: "a" }), storedSecret({ id: "b" }), storedSecret({ id: "c" })];
      const { service, deploymentSettingRepository } = setup({ sweeps: [before, []], markersAfterRun: { a: WRITTEN_AT, b: WRITTEN_AT, c: WRITTEN_AT } });

      const reconciliation = await service.reconcile(await service.take(), { batchSize: 2 });

      expect(deploymentSettingRepository.findUpdatedAtMarkers.mock.calls).toEqual([[["a", "b"]], [["c"]]]);
      expect(reconciliation.unexplained).toEqual(["a", "b", "c"]);
    });

    it("reports a token that changed while its updated_at stayed unset as a re-seal", async () => {
      const before = [storedSecret({ id: "a", updatedAtMarker: null })];
      const after = [storedSecret({ id: "a", updatedAtMarker: null })];
      const { service } = setup({ sweeps: [before, after] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ ownerRewritten: 0, unexplained: ["a"] });
    });

    it("counts a first-ever updated_at as the owner's own write", async () => {
      const before = [storedSecret({ id: "a", updatedAtMarker: null })];
      const after = [storedSecret({ id: "a", updatedAtMarker: REWRITTEN_AT })];
      const { service } = setup({ sweeps: [before, after] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ ownerRewritten: 1, unexplained: [] });
    });

    it("counts a token rewritten within the same millisecond as its previous write as the owner's own write", async () => {
      const before = [storedSecret({ id: "a", updatedAtMarker: "2026-09-01T10:00:00.123456" })];
      const after = [storedSecret({ id: "a", updatedAtMarker: "2026-09-01T10:00:00.123999" })];
      const { service } = setup({ sweeps: [before, after] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ ownerRewritten: 1, unexplained: [] });
    });

    it("reports a token that changed while its updated_at read exactly as before as a re-seal", async () => {
      const before = [storedSecret({ id: "a", updatedAtMarker: REWRITTEN_AT })];
      const after = [storedSecret({ id: "a", updatedAtMarker: REWRITTEN_AT })];
      const { service } = setup({ sweeps: [before, after] });

      const reconciliation = await service.reconcile(await service.take());

      expect(reconciliation).toMatchObject({ ownerRewritten: 0, unexplained: ["a"] });
    });
  });

  function setup(input: { sweeps: SealedSecret[][]; pageSize?: number; markersAfterRun?: Record<string, string | null> }) {
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const remaining = [...input.sweeps];
    const markersAfterRun = input.markersAfterRun ?? {};

    deploymentSettingRepository.readCurrentUpdatedAtMarker.mockResolvedValue(RUN_OPENED_AT);
    deploymentSettingRepository.findUpdatedAtMarkers.mockImplementation(async ids =>
      ids.reduce((markers, id) => (id in markersAfterRun ? markers.set(id, markersAfterRun[id]) : markers), new Map<string, string | null>())
    );
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
