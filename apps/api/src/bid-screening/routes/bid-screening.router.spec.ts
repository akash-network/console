import { AuditorSelectionMode, CapabilityFlag, VerificationTier } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { describe, expect, it, vi } from "vitest";

import { BidScreeningRequestSchema } from "../http-schemas/bid-screening.schema";
import { applyManagedWalletPolicy, forwardBidScreeningRequest } from "./bid-screening.router";

describe(forwardBidScreeningRequest.name, () => {
  it("forwards the validated verification request and injects configured auditors without duplicates", async () => {
    const request = BidScreeningRequestSchema.parse(createRequest());
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ providers: [] }));
    const controller = new AbortController();

    const response = await forwardBidScreeningRequest(request, controller.signal, {
      providerInventoryApiUrl: "https://inventory.example.com/base",
      managedWalletAllowedAuditors: ["akash1managed", "akash1existing", "akash1managed2"],
      fetch: fetchMock as typeof fetch
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("https://inventory.example.com/v1/bid-screening");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal
    });

    const forwarded = JSON.parse(init.body as string);
    expect(forwarded.requirements).toEqual({
      signedBy: {
        allOf: ["akash1legacy"],
        anyOf: ["akash1existing", "akash1managed", "akash1managed2"]
      },
      attributes: [{ key: "region", value: "us-west" }],
      verification: {
        minTier: VerificationTier.verification_tier_verified,
        requiredCapabilities: [CapabilityFlag.capability_persistent_storage],
        requiredAuditors: ["akash1verificationauditor"],
        auditorMode: AuditorSelectionMode.auditor_selection_mode_all,
        minAuditorCount: 2
      }
    });
    expect(forwarded.resources[0].resource.cpu.units.val).toBe("1000");
  });

  it("leaves the validated request unchanged when no managed auditors are configured", async () => {
    const request = BidScreeningRequestSchema.parse(createRequest());
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ providers: [] }));

    expect(applyManagedWalletPolicy(request, [])).toBe(request);

    await forwardBidScreeningRequest(request, new AbortController().signal, {
      providerInventoryApiUrl: "https://inventory.example.com",
      managedWalletAllowedAuditors: [],
      fetch: fetchMock as typeof fetch
    });

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(init.body as string).requirements.signedBy).toEqual({
      allOf: ["akash1legacy"],
      anyOf: ["akash1existing"]
    });
  });

  it("passes upstream HTTP errors through unchanged", async () => {
    const request = BidScreeningRequestSchema.parse(createRequest());
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: "invalid_requirements", message: "Provider requirements are invalid" },
          { status: 422, headers: { "Content-Type": "application/problem+json" } }
        )
      );

    const response = await forwardBidScreeningRequest(request, new AbortController().signal, {
      providerInventoryApiUrl: "https://inventory.example.com",
      managedWalletAllowedAuditors: [],
      fetch: fetchMock as typeof fetch
    });

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    await expect(response.json()).resolves.toEqual({ error: "invalid_requirements", message: "Provider requirements are invalid" });
  });

  it("maps upstream connection failures to 503", async () => {
    const request = BidScreeningRequestSchema.parse(createRequest());
    const fetchMock = vi.fn().mockRejectedValue(new Error("connection refused"));

    await expect(
      forwardBidScreeningRequest(request, new AbortController().signal, {
        providerInventoryApiUrl: "https://inventory.example.com",
        managedWalletAllowedAuditors: [],
        fetch: fetchMock as typeof fetch
      })
    ).rejects.toMatchObject({ status: 503, message: "Failed to screen providers." });
  });

  it("preserves the existing 499 mapping for aborted upstream requests", async () => {
    const request = BidScreeningRequestSchema.parse(createRequest());
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    const fetchMock = vi.fn().mockRejectedValue(abortError);

    await expect(
      forwardBidScreeningRequest(request, new AbortController().signal, {
        providerInventoryApiUrl: "https://inventory.example.com",
        managedWalletAllowedAuditors: [],
        fetch: fetchMock as typeof fetch
      })
    ).rejects.toMatchObject({ status: 499, message: "Failed to screen providers." });
  });
});

function createRequest() {
  return {
    requirements: {
      signedBy: { allOf: ["akash1legacy"], anyOf: ["akash1existing"] },
      attributes: [{ key: "region", value: "us-west" }],
      verification: {
        minTier: VerificationTier.verification_tier_verified,
        requiredCapabilities: [CapabilityFlag.capability_persistent_storage],
        requiredAuditors: ["akash1verificationauditor"],
        auditorMode: AuditorSelectionMode.auditor_selection_mode_all,
        minAuditorCount: 2
      }
    },
    resources: [
      {
        resource: {
          id: 1,
          cpu: { units: { val: "1000" } },
          memory: { quantity: { val: "1048576" } },
          gpu: { units: { val: "0" } },
          storage: [{ name: "default", quantity: { val: "1073741824" } }],
          endpoints: [{ kind: "SHARED_HTTP" as const, sequenceNumber: 1 }]
        },
        count: 1,
        price: { denom: "uakt", amount: "1000" }
      }
    ],
    timezone: "UTC"
  };
}
