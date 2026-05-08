import { describe, expect, it } from "vitest";

import type { SelfAttribute, SignedAttribute } from "@src/types/chain-provider";
import { reduceAttributes } from "./reduce-attributes";

describe(reduceAttributes.name, () => {
  it("returns empty arrays when no attributes are provided", () => {
    const result = setup({ selfAttributes: [], signedAttributes: [] });

    expect(result).toEqual({
      selfAttributes: [],
      signedAttributes: [],
      auditedBy: []
    });
  });

  it("passes through self-declared attributes", () => {
    const result = setup({
      selfAttributes: [
        { key: "region", value: "us-west" },
        { key: "tier", value: "premium" }
      ],
      signedAttributes: []
    });

    expect(result.selfAttributes).toEqual([
      { key: "region", value: "us-west" },
      { key: "tier", value: "premium" }
    ]);
    expect(result.auditedBy).toEqual([]);
  });

  it("computes audited_by union from multiple auditors", () => {
    const result = setup({
      selfAttributes: [],
      signedAttributes: [
        { key: "region", value: "us-west", auditor: "auditor-a" },
        { key: "tier", value: "premium", auditor: "auditor-b" },
        { key: "region", value: "us-west", auditor: "auditor-c" }
      ]
    });

    expect(result.auditedBy).toEqual(["auditor-a", "auditor-b", "auditor-c"]);
  });

  it("deduplicates auditors in audited_by", () => {
    const result = setup({
      selfAttributes: [],
      signedAttributes: [
        { key: "region", value: "us-west", auditor: "auditor-a" },
        { key: "tier", value: "premium", auditor: "auditor-a" },
        { key: "host", value: "example.com", auditor: "auditor-b" }
      ]
    });

    expect(result.auditedBy).toEqual(["auditor-a", "auditor-b"]);
  });

  it("preserves signed attributes when self-declared attributes are missing", () => {
    const result = setup({
      selfAttributes: [],
      signedAttributes: [{ key: "region", value: "eu-central", auditor: "auditor-x" }]
    });

    expect(result.selfAttributes).toEqual([]);
    expect(result.signedAttributes).toEqual([{ key: "region", value: "eu-central", auditor: "auditor-x" }]);
    expect(result.auditedBy).toEqual(["auditor-x"]);
  });

  it("preserves self-declared attributes when signed attributes are missing", () => {
    const result = setup({
      selfAttributes: [{ key: "region", value: "us-west" }],
      signedAttributes: []
    });

    expect(result.selfAttributes).toEqual([{ key: "region", value: "us-west" }]);
    expect(result.signedAttributes).toEqual([]);
    expect(result.auditedBy).toEqual([]);
  });

  it("preserves both self-declared and signed for the same key with disagreeing values", () => {
    const result = setup({
      selfAttributes: [{ key: "region", value: "us-west" }],
      signedAttributes: [{ key: "region", value: "us-east", auditor: "auditor-a" }]
    });

    expect(result.selfAttributes).toEqual([{ key: "region", value: "us-west" }]);
    expect(result.signedAttributes).toEqual([{ key: "region", value: "us-east", auditor: "auditor-a" }]);
  });

  it("preserves multiple values per key from different auditors", () => {
    const result = setup({
      selfAttributes: [],
      signedAttributes: [
        { key: "region", value: "us-west", auditor: "auditor-a" },
        { key: "region", value: "eu-central", auditor: "auditor-b" }
      ]
    });

    expect(result.signedAttributes).toEqual([
      { key: "region", value: "us-west", auditor: "auditor-a" },
      { key: "region", value: "eu-central", auditor: "auditor-b" }
    ]);
    expect(result.auditedBy).toEqual(["auditor-a", "auditor-b"]);
  });

  function setup(input: { selfAttributes: SelfAttribute[]; signedAttributes: SignedAttribute[] }) {
    return reduceAttributes(input.selfAttributes, input.signedAttributes);
  }
});
