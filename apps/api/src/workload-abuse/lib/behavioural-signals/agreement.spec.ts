import { describe, expect, it } from "vitest";

import { type AgreementRow, findBehaviouralAgreement } from "./agreement";
import type { BehaviouralFinding } from "./types";

const NOW = new Date("2026-09-20T12:00:00.000Z");

const BOTH_SIGNALS: BehaviouralFinding[] = [
  { signal: "accel_without_artifacts", detail: {} },
  { signal: "network_isolated", detail: {} }
];

describe("findBehaviouralAgreement", () => {
  it("agrees once enough consecutive probes see the same shape over a long enough window", () => {
    const { rows, params } = setup({ minutesAgo: [10, 130, 250] });

    expect(findBehaviouralAgreement(rows, params)).toEqual({ agreed: true, service: "web", streak: 3, spanMinutes: 250 });
  });

  it("holds off while the streak is one probe short", () => {
    const { rows, params } = setup({ minutesAgo: [10, 130] });

    expect(findBehaviouralAgreement(rows, params)).toMatchObject({ agreed: false, streak: 2 });
  });

  it("holds off while the streak is younger than the minimum window", () => {
    const { rows, params } = setup({ minutesAgo: [1, 3, 5] });

    expect(findBehaviouralAgreement(rows, params)).toMatchObject({ agreed: false, streak: 3, spanMinutes: 5 });
  });

  it("breaks the streak on the first probe that saw a different shape", () => {
    const { rows, params } = setup({ minutesAgo: [10, 130, 250], findingsByIndex: { 1: [{ signal: "network_isolated", detail: {} }] } });

    expect(findBehaviouralAgreement(rows, params)).toMatchObject({ agreed: false, streak: 1 });
  });

  it("steps over a probe that collected nothing without breaking the streak", () => {
    const { rows, params } = setup({ minutesAgo: [10, 130, 250, 320], statusByIndex: { 1: "shell_unavailable" } });

    expect(findBehaviouralAgreement(rows, params)).toMatchObject({ agreed: true, streak: 3, spanMinutes: 320 });
  });

  it("agrees on the service that holds the streak rather than on the deployment as a whole", () => {
    const { rows, params } = setup({ minutesAgo: [10, 130, 250] });
    const sidecar = rows.map(row => ({ ...row, service: "sidecar", behaviouralFindings: null }));

    expect(findBehaviouralAgreement([...rows, ...sidecar], params)).toMatchObject({ agreed: true, service: "web", streak: 3 });
  });

  it("finds no agreement in an empty history", () => {
    const { params } = setup({ minutesAgo: [] });

    expect(findBehaviouralAgreement([], params)).toEqual({ agreed: false, service: null, streak: 0, spanMinutes: 0 });
  });

  function setup(input: {
    minutesAgo: number[];
    agreementProbes?: number;
    minWindowMinutes?: number;
    findingsByIndex?: Record<number, BehaviouralFinding[]>;
    statusByIndex?: Record<number, string>;
  }) {
    const rows: AgreementRow[] = input.minutesAgo.map((minutes, index) => ({
      service: "web",
      createdAt: new Date(NOW.getTime() - minutes * 60_000),
      shellStatus: input.statusByIndex?.[index] ?? "completed",
      behaviouralFindings: input.findingsByIndex?.[index] ?? BOTH_SIGNALS
    }));

    return {
      rows,
      params: { agreementProbes: input.agreementProbes ?? 3, minWindowMinutes: input.minWindowMinutes ?? 120, now: NOW }
    };
  }
});
