import { VerificationTier } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderVerificationExclusion, ScreenedProvider } from "@src/queries/useScreenedProviders";
import type { ApiProviderList } from "@src/types/provider";
import type { DEPENDENCIES } from "./usePlacementOffers";
import { usePlacementOffers } from "./usePlacementOffers";

import { renderHook } from "@testing-library/react";

describe(usePlacementOffers.name, () => {
  it("returns screened providers with no bid annotation while configuring", () => {
    const { result } = setup({ phase: "configuring", screened: [polaris()] });
    expect(result.current.offers[0]).toEqual(expect.objectContaining({ owner: "akash1aaa", offerState: "searching", bidId: undefined, price: undefined }));
  });

  it("shows an open bid as a submitted offer while quoting", () => {
    const { result } = setup({
      phase: "quoting",
      dseq: "100",
      screened: [polaris()],
      bids: [{ bid: { state: "open", price: { amount: "1900", denom: "uakt" }, id: { provider: "akash1aaa", dseq: "100", gseq: 1, oseq: 1 } } }]
    });
    expect(result.current.offers).toEqual([
      expect.objectContaining({ owner: "akash1aaa", offerState: "submitted", price: { amount: "1900", denom: "uakt" }, bidId: "akash1aaa/100/1/1" })
    ]);
  });

  it("keeps showing the screened candidates while quoting until the first bid arrives", () => {
    const { result } = setup({ phase: "quoting", dseq: "100", screened: [polaris()], bids: [] });
    expect(result.current.offers).toEqual([expect.objectContaining({ owner: "akash1aaa", offerState: "searching", bidId: undefined, price: undefined })]);
  });

  it("fills a bid offer's name, region and audited flag from the provider list", () => {
    const { result } = setup({
      phase: "quoting",
      dseq: "100",
      screened: [],
      providerList: [{ owner: "akash1aaa", organization: "Polaris", hostUri: "https://a.example:8443", locationRegion: "us-west", isAudited: true }],
      bids: [{ bid: { state: "open", price: { amount: "1900", denom: "uakt" }, id: { provider: "akash1aaa", dseq: "100", gseq: 1, oseq: 1 } } }]
    });
    expect(result.current.offers).toEqual([
      expect.objectContaining({
        owner: "akash1aaa",
        organization: "Polaris",
        hostUri: "https://a.example:8443",
        location: "us-west",
        isAudited: true,
        offerState: "submitted"
      })
    ]);
  });

  it("leaves a bid offer's screened fields empty when the provider is absent from the provider list", () => {
    const { result } = setup({
      phase: "quoting",
      dseq: "100",
      screened: [],
      providerList: [],
      bids: [{ bid: { state: "open", price: { amount: "1900", denom: "uakt" }, id: { provider: "akash1zzz", dseq: "100", gseq: 1, oseq: 1 } } }]
    });
    expect(result.current.offers).toEqual([
      expect.objectContaining({ owner: "akash1zzz", organization: null, hostUri: "", location: null, offerState: "submitted" })
    ]);
  });

  it("does not fetch the provider list while screening", () => {
    const { useProviderList } = setup({ phase: "configuring", screened: [polaris()] });
    expect(useProviderList).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("fetches the provider list once not screening", () => {
    const { useProviderList } = setup({ phase: "quoting", dseq: "100", screened: [polaris()], bids: [] });
    expect(useProviderList).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  it("keeps a non-bidding screened candidate as an unavailable offer once bids arrive", () => {
    const { result } = setup({
      phase: "quoting",
      dseq: "100",
      screened: [polaris(), mock<ScreenedProvider>({ owner: "akash1bbb", organization: "Beta", location: "eu-west" })],
      bids: [{ bid: { state: "open", price: { amount: "1900", denom: "uakt" }, id: { provider: "akash1aaa", dseq: "100", gseq: 1, oseq: 1 } } }]
    });
    expect(result.current.offers).toEqual([
      expect.objectContaining({ owner: "akash1aaa", offerState: "submitted" }),
      expect.objectContaining({ owner: "akash1bbb", offerState: "unavailable", bidId: undefined, price: undefined })
    ]);
  });

  it("marks a provider whose only bid is closed as a closed offer that keeps its last price", () => {
    const { result } = setup({
      phase: "quoting",
      dseq: "100",
      screened: [polaris()],
      bids: [{ bid: { state: "closed", price: { amount: "1900", denom: "uakt" }, id: { provider: "akash1aaa", dseq: "100", gseq: 1, oseq: 1 } } }]
    });
    expect(result.current.offers).toEqual([
      expect.objectContaining({ owner: "akash1aaa", offerState: "closed", bidId: undefined, price: { amount: "1900", denom: "uakt" } })
    ]);
  });

  it("deduplicates a provider that appears twice in the screened list", () => {
    const { result } = setup({
      phase: "quoting",
      dseq: "100",
      screened: [polaris(), polaris()],
      bids: [{ bid: { state: "open", price: { amount: "1900", denom: "uakt" }, id: { provider: "akash1aaa", dseq: "100", gseq: 1, oseq: 1 } } }]
    });
    expect(result.current.offers).toEqual([expect.objectContaining({ owner: "akash1aaa", offerState: "submitted" })]);
  });

  it("prefers the open bid when a provider has both an open and a closed bid", () => {
    const { result } = setup({
      phase: "quoting",
      dseq: "100",
      screened: [polaris()],
      bids: [
        { bid: { state: "closed", price: { amount: "10", denom: "uakt" }, id: { provider: "akash1aaa", dseq: "100", gseq: 1, oseq: 1 } } },
        { bid: { state: "open", price: { amount: "20", denom: "uakt" }, id: { provider: "akash1aaa", dseq: "100", gseq: 1, oseq: 2 } } }
      ]
    });
    expect(result.current.offers).toEqual([
      expect.objectContaining({ owner: "akash1aaa", offerState: "submitted", price: { amount: "20", denom: "uakt" }, bidId: "akash1aaa/100/1/2" })
    ]);
  });

  it("prefers the open bid regardless of the order bids are returned in", () => {
    const { result } = setup({
      phase: "quoting",
      dseq: "100",
      screened: [polaris()],
      bids: [
        { bid: { state: "open", price: { amount: "20", denom: "uakt" }, id: { provider: "akash1aaa", dseq: "100", gseq: 1, oseq: 2 } } },
        { bid: { state: "closed", price: { amount: "10", denom: "uakt" }, id: { provider: "akash1aaa", dseq: "100", gseq: 1, oseq: 1 } } }
      ]
    });
    expect(result.current.offers).toEqual([
      expect.objectContaining({ owner: "akash1aaa", offerState: "submitted", price: { amount: "20", denom: "uakt" }, bidId: "akash1aaa/100/1/2" })
    ]);
  });

  it("includes a provider that bid without being screened", () => {
    const { result } = setup({
      phase: "quoting",
      dseq: "100",
      screened: [polaris()],
      providerList: [{ owner: "akash1new", organization: "Newcomer", hostUri: "https://new.example:8443", locationRegion: "ap-south", isAudited: false }],
      bids: [
        { bid: { state: "open", price: { amount: "1900", denom: "uakt" }, id: { provider: "akash1aaa", dseq: "100", gseq: 1, oseq: 1 } } },
        { bid: { state: "open", price: { amount: "2500", denom: "uakt" }, id: { provider: "akash1new", dseq: "100", gseq: 1, oseq: 1 } } }
      ]
    });
    expect(result.current.offers).toEqual([
      expect.objectContaining({ owner: "akash1aaa", offerState: "submitted" }),
      expect.objectContaining({ owner: "akash1new", organization: "Newcomer", location: "ap-south", offerState: "submitted" })
    ]);
  });

  it("keeps an accepted chain bid when verification preflight did not include the provider", () => {
    const eligible = verifiedProvider({ owner: "akash1eligible", tier: VerificationTier.verification_tier_verified });
    const { result } = setup({
      phase: "quoting",
      dseq: "100",
      verificationEnabled: true,
      screened: [eligible],
      bids: [
        { bid: { state: "open", price: { amount: "1900", denom: "uakt" }, id: { provider: "akash1eligible", dseq: "100", gseq: 1, oseq: 1 } } },
        { bid: { state: "open", price: { amount: "100", denom: "uakt" }, id: { provider: "akash1excluded", dseq: "100", gseq: 1, oseq: 1 } } }
      ]
    });

    expect(result.current.offers.map(offer => offer.owner)).toEqual(["akash1eligible", "akash1excluded"]);
  });

  it("suppresses a stale preflight exclusion after the provider has an accepted chain bid", () => {
    const exclusion = mock<ProviderVerificationExclusion>({ owner: "akash1bidder" });
    const { result } = setup({
      phase: "quoting",
      dseq: "100",
      verificationEnabled: true,
      screened: [],
      screenedExclusions: [exclusion],
      bids: [{ bid: { state: "open", price: { amount: "100", denom: "uakt" }, id: { provider: "akash1bidder", dseq: "100", gseq: 1, oseq: 1 } } }]
    });

    expect(result.current.offers.map(offer => offer.owner)).toEqual(["akash1bidder"]);
    expect(result.current.exclusions).toEqual([]);
  });

  it("keeps incomplete verification facts eligible and marks them not evaluated", () => {
    const provider = verifiedProvider({ owner: "akash1unknown", tier: VerificationTier.verification_tier_unspecified });
    provider.verification = {
      outcome: "not_evaluated",
      incompleteFacts: ["snapshot"],
      summary: provider.verification!.summary
    };
    const { result } = setup({ phase: "configuring", verificationEnabled: true, screened: [provider] });

    expect(result.current.offers).toEqual([
      expect.objectContaining({ owner: "akash1unknown", verification: expect.objectContaining({ outcome: "not_evaluated" }) })
    ]);
  });

  it("ranks verification-eligible providers by tier before price", () => {
    const { result } = setup({
      phase: "quoting",
      dseq: "100",
      verificationEnabled: true,
      screened: [
        verifiedProvider({ owner: "akash1l2", tier: VerificationTier.verification_tier_verified }),
        verifiedProvider({ owner: "akash1l3", tier: VerificationTier.verification_tier_established })
      ],
      bids: [
        { bid: { state: "open", price: { amount: "100", denom: "uakt" }, id: { provider: "akash1l2", dseq: "100", gseq: 1, oseq: 1 } } },
        { bid: { state: "open", price: { amount: "5000", denom: "uakt" }, id: { provider: "akash1l3", dseq: "100", gseq: 1, oseq: 1 } } }
      ]
    });

    expect(result.current.offers.map(offer => offer.owner)).toEqual(["akash1l3", "akash1l2"]);
  });

  it("uses auditor count, uptime, price, then name to break verification ranking ties", () => {
    const recentDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(Date.now());
    const base = { tier: VerificationTier.verification_tier_verified, auditors: ["akash1a"] };
    const screened = [
      verifiedProvider({ owner: "akash1pricey", organization: "Zulu", ...base }),
      verifiedProvider({ owner: "akash1cheap", organization: "Beta", ...base }),
      verifiedProvider({ owner: "akash1aardvark", organization: "Aardvark", ...base }),
      verifiedProvider({
        owner: "akash1down",
        organization: "Alpha",
        ...base,
        incidents: [{ date: recentDay, hasOpenIncident: false, incidentCount: 1, downtimeSeconds: 3600 }]
      }),
      verifiedProvider({ owner: "akash1auditors", organization: "Omega", tier: base.tier, auditors: ["akash1a", "akash1b"] })
    ];
    const bids = screened.map(provider => ({
      bid: {
        state: "open",
        price: { amount: provider.owner === "akash1pricey" ? "500" : "100", denom: "uakt" },
        id: { provider: provider.owner, dseq: "100", gseq: 1, oseq: 1 }
      }
    }));
    const { result } = setup({ phase: "quoting", dseq: "100", verificationEnabled: true, screened, bids });

    expect(result.current.offers.map(offer => offer.owner)).toEqual(["akash1auditors", "akash1aardvark", "akash1cheap", "akash1pricey", "akash1down"]);
  });

  it("preserves server order when the placement has no verification result", () => {
    const { result } = setup({ phase: "configuring", verificationEnabled: true, screened: [polaris(), mock<ScreenedProvider>({ owner: "akash1first" })] });

    expect(result.current.offers.map(offer => offer.owner)).toEqual(["akash1aaa", "akash1first"]);
  });

  it("reuses screened metadata for a bidder instead of the provider list", () => {
    const { result } = setup({
      phase: "quoting",
      dseq: "100",
      screened: [polaris()],
      providerList: [
        { owner: "akash1aaa", organization: "Stale Name", locationRegion: "wrong-region", hostUri: "https://stale.example:8443", isAudited: false }
      ],
      bids: [{ bid: { state: "open", price: { amount: "1900", denom: "uakt" }, id: { provider: "akash1aaa", dseq: "100", gseq: 1, oseq: 1 } } }]
    });
    expect(result.current.offers).toEqual([
      expect.objectContaining({ owner: "akash1aaa", organization: "Polaris", location: "us-east", offerState: "submitted" })
    ]);
  });

  it("surfaces a listBids failure while quoting", () => {
    const { result } = setup({ phase: "quoting", dseq: "100", screened: [], bidsError: true });
    expect(result.current.isError).toBe(true);
  });

  it("reports loading while quoting when bids are still loading and there is nothing to show yet", () => {
    const { result } = setup({ phase: "quoting", dseq: "100", screened: [], bidsLoading: true });
    expect(result.current.isLoading).toBe(true);
  });

  it("keeps the screened fallback visible (not loading) while bids load", () => {
    const { result } = setup({ phase: "quoting", dseq: "100", screened: [polaris()], bidsLoading: true });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.offers).toHaveLength(1);
  });

  it("screens providers while configuring", () => {
    const { useScreenedProviders } = setup({ phase: "configuring", screened: [polaris()] });
    expect(useScreenedProviders).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  it("stops screening providers once the deployment is locked", () => {
    const { useScreenedProviders } = setup({ phase: "quoting", dseq: "100", screened: [polaris()], bids: [] });
    expect(useScreenedProviders).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("ignores an open bid that belongs to a different placement group", () => {
    const { result } = setup({
      phase: "quoting",
      dseq: "100",
      placementGseq: 1,
      screened: [polaris()],
      bids: [{ bid: { state: "open", price: { amount: "1900", denom: "uakt" }, id: { provider: "akash1aaa", dseq: "100", gseq: 2, oseq: 1 } } }]
    });
    expect(result.current.offers).toEqual([expect.objectContaining({ owner: "akash1aaa", offerState: "searching", bidId: undefined })]);
  });

  it("matches the bid whose gseq belongs to the placement when a provider bids on several groups", () => {
    const { result } = setup({
      phase: "quoting",
      dseq: "100",
      placementGseq: 2,
      screened: [polaris()],
      bids: [
        { bid: { state: "open", price: { amount: "10", denom: "uakt" }, id: { provider: "akash1aaa", dseq: "100", gseq: 1, oseq: 1 } } },
        { bid: { state: "open", price: { amount: "20", denom: "uakt" }, id: { provider: "akash1aaa", dseq: "100", gseq: 2, oseq: 1 } } }
      ]
    });
    expect(result.current.offers).toEqual([
      expect.objectContaining({ offerState: "submitted", price: { amount: "20", denom: "uakt" }, bidId: "akash1aaa/100/2/1" })
    ]);
  });

  it("reports the spec invalid while configuring when screening can't build a request", () => {
    const { result } = setup({ phase: "configuring", screened: [], screenedInvalid: true });
    expect(result.current.isInvalid).toBe(true);
  });

  it("never reports invalid once the deployment is locked", () => {
    const { result } = setup({ phase: "quoting", dseq: "100", screened: [], bids: [], screenedInvalid: true });
    expect(result.current.isInvalid).toBe(false);
  });

  function polaris() {
    return mock<ScreenedProvider>({ owner: "akash1aaa", organization: "Polaris", location: "us-east" });
  }

  function verifiedProvider(input: {
    owner: string;
    tier: VerificationTier;
    auditors?: string[];
    organization?: string;
    incidents?: ScreenedProvider["incidents"];
  }): ScreenedProvider {
    return mock<ScreenedProvider>({
      owner: input.owner,
      organization: input.organization ?? input.owner,
      location: "us-east",
      incidents: input.incidents ?? [],
      verification: {
        outcome: "pass",
        summary: {
          bestStatusValidTier: input.tier,
          tierGateTier: input.tier,
          capabilities: [],
          validAttestationCount: input.auditors?.length ?? 1,
          validAuditors: input.auditors ?? ["akash1auditor"],
          snapshotState: "current",
          observedHeight: "123"
        }
      }
    });
  }

  function setup(input: {
    phase: "configuring" | "quoting";
    dseq?: string;
    screened: ScreenedProvider[];
    screenedInvalid?: boolean;
    screenedExclusions?: ProviderVerificationExclusion[];
    verificationEnabled?: boolean;
    placementGseq?: number;
    providerList?: Array<Partial<ApiProviderList> & { owner: string }>;
    bidsLoading?: boolean;
    bidsError?: boolean;
    bids?: Array<{ bid: { state: string; price: { amount: string; denom: string }; id: { provider: string; dseq: string; gseq: number; oseq: number } } }>;
  }) {
    const useScreenedProviders = vi.fn(() => ({
      providers: input.screened,
      exclusions: input.screenedExclusions ?? [],
      isLoading: false,
      isError: false,
      isInvalid: input.screenedInvalid ?? false
    }));
    const useProviderList = vi.fn(() => ({ data: input.providerList ?? [], isLoading: false, isError: false }));
    const dependencies: typeof DEPENDENCIES = {
      useScreenedProviders: useScreenedProviders as never,
      useListBids: (() => ({ data: { data: input.bids ?? [] }, isLoading: input.bidsLoading ?? false, isError: input.bidsError ?? false })) as never,
      useProviderList: useProviderList as never,
      getPlacementGseq: (() => input.placementGseq) as never
    };
    const view = renderHook(() =>
      usePlacementOffers(
        {
          phase: input.phase,
          dseq: input.dseq,
          sdl: "sdl",
          placementName: "placement-1",
          region: "us-east",
          verificationEnabled: input.verificationEnabled
        },
        dependencies
      )
    );
    return { ...view, useScreenedProviders, useProviderList };
  }
});
