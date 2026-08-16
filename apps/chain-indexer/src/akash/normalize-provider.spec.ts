import { describe, expect, it } from "vitest";

import { normalizeProviderMessage } from "@src/akash/normalize-provider";

describe("normalizeProviderMessage", () => {
  it("normalizes a legacy v1beta1 create with info and attributes", () => {
    const change = normalizeProviderMessage("/akash.provider.v1beta1.MsgCreateProvider", {
      owner: "akash1owner",
      hostUri: "https://provider.example.com:8443",
      attributes: [{ key: "region", value: "us-west" }],
      info: { email: "ops@example.com", website: "https://example.com" }
    });

    expect(change).toEqual({
      kind: "providerCreated",
      owner: "akash1owner",
      hostUri: "https://provider.example.com:8443",
      email: "ops@example.com",
      website: "https://example.com",
      attributes: [{ key: "region", value: "us-west" }]
    });
  });

  it("normalizes a current v1beta4 update identically to the legacy eras", () => {
    const change = normalizeProviderMessage("/akash.provider.v1beta4.MsgUpdateProvider", {
      owner: "akash1owner",
      hostUri: "https://new.example.com:8443",
      attributes: [],
      info: { email: "", website: "" }
    });

    expect(change).toEqual({
      kind: "providerUpdated",
      owner: "akash1owner",
      hostUri: "https://new.example.com:8443",
      email: null,
      website: null,
      attributes: []
    });
  });

  it("normalizes a create without info or attributes", () => {
    const change = normalizeProviderMessage("/akash.provider.v1beta3.MsgCreateProvider", {
      owner: "akash1owner",
      hostUri: "https://provider.example.com:8443"
    });

    expect(change).toEqual({
      kind: "providerCreated",
      owner: "akash1owner",
      hostUri: "https://provider.example.com:8443",
      email: null,
      website: null,
      attributes: []
    });
  });

  it("normalizes a delete", () => {
    const change = normalizeProviderMessage("/akash.provider.v1beta2.MsgDeleteProvider", { owner: "akash1owner" });

    expect(change).toEqual({ kind: "providerDeleted", owner: "akash1owner" });
  });

  it("returns null when the owner or host uri is missing", () => {
    expect(normalizeProviderMessage("/akash.provider.v1beta4.MsgCreateProvider", { hostUri: "https://x" })).toBeNull();
    expect(normalizeProviderMessage("/akash.provider.v1beta4.MsgUpdateProvider", { owner: "akash1owner" })).toBeNull();
    expect(normalizeProviderMessage("/akash.provider.v1beta4.MsgDeleteProvider", {})).toBeNull();
  });

  it("returns null for unrelated type urls", () => {
    expect(normalizeProviderMessage("/akash.provider.v1beta5.MsgCreateProvider", { owner: "akash1owner", hostUri: "https://x" })).toBeNull();
    expect(normalizeProviderMessage("/akash.deployment.v1beta4.MsgCreateDeployment", {})).toBeNull();
  });
});
