import { describe, expect, it } from "vitest";

import { StoredSecretsFingerprint } from "./stored-secrets-fingerprint";

const FIRST = { id: "11111111-1111-4111-8111-111111111111", sealedSecrets: "aGVhZGVy.a2V5.aXY.Zmlyc3Q.dGFn" };
const SECOND = { id: "22222222-2222-4222-8222-222222222222", sealedSecrets: "aGVhZGVy.a2V5.aXY.c2Vjb25k.dGFn" };
const THIRD = { id: "33333333-3333-4333-8333-333333333333", sealedSecrets: "aGVhZGVy.a2V5.aXY.dGhpcmQ.dGFn" };

describe(StoredSecretsFingerprint.name, () => {
  it("digests the same rows to the same value whatever order they arrive in", () => {
    const inOrder = setup({ rows: [FIRST, SECOND, THIRD] });
    const permuted = setup({ rows: [THIRD, FIRST, SECOND] });

    expect(permuted.summary).toEqual(inOrder.summary);
  });

  it("digests a row whose token changed to a different value", () => {
    const before = setup({ rows: [FIRST, SECOND] });
    const after = setup({ rows: [FIRST, { ...SECOND, sealedSecrets: THIRD.sealedSecrets }] });

    expect(after.summary.digest).not.toBe(before.summary.digest);
  });

  it("digests two rows that swapped tokens with each other to a different value", () => {
    const before = setup({ rows: [FIRST, SECOND] });
    const swapped = setup({
      rows: [
        { id: FIRST.id, sealedSecrets: SECOND.sealedSecrets },
        { id: SECOND.id, sealedSecrets: FIRST.sealedSecrets }
      ]
    });

    expect(swapped.summary.digest).not.toBe(before.summary.digest);
    expect(swapped.summary.rowCount).toBe(before.summary.rowCount);
    expect(swapped.summary.byteCount).toBe(before.summary.byteCount);
  });

  it("digests a token that moved to a row of another id to a different value", () => {
    const original = setup({ rows: [FIRST, SECOND] });
    const reassigned = setup({ rows: [FIRST, { id: THIRD.id, sealedSecrets: SECOND.sealedSecrets }] });

    expect(reassigned.summary.rowCount).toBe(original.summary.rowCount);
    expect(reassigned.summary.byteCount).toBe(original.summary.byteCount);
    expect(reassigned.summary.digest).not.toBe(original.summary.digest);
  });

  it("digests a token moved across the boundary with its row's id to a different value", () => {
    const asOneId = setup({ rows: [{ id: "ab", sealedSecrets: "cd" }] });
    const asAnother = setup({ rows: [{ id: "a", sealedSecrets: "bcd" }] });

    expect(asAnother.summary.digest).not.toBe(asOneId.summary.digest);
  });

  it("digests a row that was removed to a different value", () => {
    const both = setup({ rows: [FIRST, SECOND] });
    const one = setup({ rows: [FIRST] });

    expect(one.summary.digest).not.toBe(both.summary.digest);
  });

  it("reports how many rows hold a token and how many bytes they hold", () => {
    const { summary } = setup({ rows: [FIRST, SECOND] });

    expect(summary).toMatchObject({
      rowCount: 2,
      byteCount: FIRST.sealedSecrets.length + SECOND.sealedSecrets.length
    });
  });

  it("counts a token's bytes rather than its characters", () => {
    const { summary } = setup({ rows: [{ id: FIRST.id, sealedSecrets: "é" }] });

    expect(summary.byteCount).toBe(2);
  });

  it("summarizes an empty fleet without a token as a digest of its own", () => {
    const { summary } = setup({ rows: [] });

    expect(summary).toMatchObject({ rowCount: 0, byteCount: 0 });
    expect(summary.digest).toEqual(expect.any(String));
    expect(summary.digest).not.toBe(setup({ rows: [FIRST] }).summary.digest);
  });

  describe("countDifferencesFrom", () => {
    it("counts no difference against an identical fleet", () => {
      const { fingerprint } = setup({ rows: [FIRST, SECOND] });

      expect(fingerprint.countDifferencesFrom(setup({ rows: [SECOND, FIRST] }).fingerprint)).toBe(0);
    });

    it("counts each row whose token changed", () => {
      const { fingerprint } = setup({ rows: [FIRST, SECOND, THIRD] });
      const { fingerprint: changed } = setup({ rows: [FIRST, { ...SECOND, sealedSecrets: "changed" }, { ...THIRD, sealedSecrets: "also-changed" }] });

      expect(fingerprint.countDifferencesFrom(changed)).toBe(2);
    });

    it("counts a row that arrived and a row that disappeared", () => {
      const { fingerprint } = setup({ rows: [FIRST, SECOND] });
      const { fingerprint: moved } = setup({ rows: [FIRST, THIRD] });

      expect(fingerprint.countDifferencesFrom(moved)).toBe(2);
    });

    it("counts a swap as both rows having moved", () => {
      const { fingerprint } = setup({ rows: [FIRST, SECOND] });
      const { fingerprint: swapped } = setup({
        rows: [
          { id: FIRST.id, sealedSecrets: SECOND.sealedSecrets },
          { id: SECOND.id, sealedSecrets: FIRST.sealedSecrets }
        ]
      });

      expect(fingerprint.countDifferencesFrom(swapped)).toBe(2);
    });
  });

  it("summarizes the same fleet the same way across separate runs", () => {
    expect(setup({ rows: [FIRST, SECOND] }).summary).toEqual(setup({ rows: [FIRST, SECOND] }).summary);
  });

  function setup(input: { rows: Array<{ id: string; sealedSecrets: string }> }) {
    const fingerprint = new StoredSecretsFingerprint();

    for (const row of input.rows) {
      fingerprint.add(row);
    }

    return { fingerprint, summary: fingerprint.summarize() };
  }
});
