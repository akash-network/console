import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementOffer } from "@src/queries/usePlacementOffers";
import type { ApiProviderLocation } from "@src/types/provider";
import type { DeploymentFlowPhase } from "../../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES } from "./BidCollecting";
import { BidCollecting } from "./BidCollecting";

import { render, screen } from "@testing-library/react";
import { buildScreenedProvider } from "@tests/seeders/screenedProvider";

describe(BidCollecting.name, () => {
  it("posts the request while the deployment is being created", () => {
    setup({ phase: "creating", clock: { msSinceStart: 500, msSinceQuoting: null } });

    expect(screen.getByRole("status")).toHaveTextContent("Collecting bids");
    expect(screen.getByText("Posting your request to the network")).toBeInTheDocument();
  });

  it("counts the providers it asked across their regions", () => {
    setup({ providers: [offer({ location: "us-east" }), offer({ location: "eu-west" }), offer({ location: "us-east" }), offer({ location: null })] });

    expect(screen.getByText("Sent to 4 providers across 2 regions")).toBeInTheDocument();
  });

  it("names the placement when the providers it asked share one region", () => {
    setup({ providers: [offer({ location: "us-east" }), offer({ location: "us-east" })], placementName: "dcloud" });

    expect(screen.getByText("Sent to 2 providers that can run dcloud")).toBeInTheDocument();
  });

  it("moves on to the next step as time passes", () => {
    setup({ clock: { msSinceStart: 4000, msSinceQuoting: 3500 } });

    expect(screen.getByText("Waiting for the first bid")).toBeInTheDocument();
  });

  it("fills the progress bar along the time a first bid usually takes", () => {
    const { progressFill } = setup({ clock: { msSinceStart: 3000, msSinceQuoting: 3000 } });

    expect(screen.getByRole("progressbar", { name: "Collecting bids" })).toHaveAttribute("aria-valuenow", "60");
    expect(progressFill().style.width).toBe("60.1%");
  });

  it("names the bidder and fills the progress bar once the first bid lands", () => {
    const { progressFill } = setup({ bidder: offer({ organization: "Europlots" }) });

    expect(screen.getByRole("status")).toHaveTextContent("First bid received");
    expect(screen.getByText("From Europlots")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(progressFill().style.width).toBe("100.0%");
  });

  it("runs the clock until the first bid lands", () => {
    const waiting = setup({ phase: "creating" });
    expect(waiting.useBidCollectingClock).toHaveBeenCalledWith("creating", true);

    const received = setup({ phase: "quoting", bidder: offer({}) });
    expect(received.useBidCollectingClock).toHaveBeenCalledWith("quoting", false);
  });

  it("puts the providers it knows the coordinates of on the globe", () => {
    const providers = [offer({ owner: "akash1located" }), offer({ owner: "akash1unparsable" }), offer({ owner: "akash1unknown" })];

    const { BidCollectingGlobe } = setup({
      providers,
      locations: [location({ owner: "akash1located", ipLat: "48.85", ipLon: "-2.35" }), location({ owner: "akash1unparsable", ipLat: "", ipLon: "north" })]
    });

    expect(BidCollectingGlobe).toHaveBeenCalledWith(expect.objectContaining({ providers: [{ id: "akash1located", lat: 48.85, lng: -2.35 }] }), expect.anything());
  });

  it("leaves the globe empty until the provider locations load", () => {
    const { BidCollectingGlobe } = setup({ providers: [offer({})], locations: undefined });

    expect(BidCollectingGlobe).toHaveBeenCalledWith(expect.objectContaining({ providers: [] }), expect.anything());
  });

  it("seeds the globe by placement and points it at the bidder once there is one", () => {
    const waiting = setup({ placementName: "dcloud" });
    expect(waiting.BidCollectingGlobe).toHaveBeenCalledWith(expect.objectContaining({ seed: "dcloud", bidderId: null }), expect.anything());

    const received = setup({ bidder: offer({ owner: "akash1bidder" }) });
    expect(received.BidCollectingGlobe).toHaveBeenCalledWith(expect.objectContaining({ bidderId: "akash1bidder" }), expect.anything());
  });

  function offer(overrides: Partial<PlacementOffer>): PlacementOffer {
    return { ...buildScreenedProvider(), offerState: "searching", ...overrides };
  }

  function location(fields: Pick<ApiProviderLocation, "owner" | "ipLat" | "ipLon">): ApiProviderLocation {
    return Object.assign(mock<ApiProviderLocation>(), fields);
  }

  function setup(input: {
    phase?: DeploymentFlowPhase;
    providers?: PlacementOffer[];
    placementName?: string;
    bidder?: PlacementOffer | null;
    clock?: ReturnType<typeof DEPENDENCIES.useBidCollectingClock>;
    locations?: ApiProviderLocation[];
  }) {
    const useBidCollectingClock = vi.fn(() => input.clock ?? { msSinceStart: 0, msSinceQuoting: 0 });
    const BidCollectingGlobe = vi.fn(() => null);
    const locations = "locations" in input ? input.locations : [];
    const dependencies: typeof DEPENDENCIES = {
      useProviderLocations: () => Object.assign(mock<ReturnType<typeof DEPENDENCIES.useProviderLocations>>(), { data: locations }),
      useBidCollectingClock,
      BidCollectingGlobe
    };
    const rendered = render(
      <BidCollecting
        phase={input.phase ?? "quoting"}
        providers={input.providers ?? [offer({ location: "us-east" })]}
        placementName={input.placementName ?? "placement-1"}
        bidder={input.bidder ?? null}
        dependencies={dependencies}
      />
    );

    return {
      useBidCollectingClock,
      BidCollectingGlobe,
      progressFill: () => rendered.container.querySelector<HTMLElement>("[role=progressbar] > div")!
    };
  }
});
