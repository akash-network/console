import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GpuRequestOffer } from "../gpuOfferComparison/gpuOfferComparison";
import type { GpuRequestViewer } from "../gpuRequestAccess/gpuRequestAccess";
import { DEPENDENCIES, GpuRequestOffers } from "./GpuRequestOffers";

import { render, screen } from "@testing-library/react";
import { buildGpuRequestOffer, buildHardwareRequest } from "@tests/seeders/hardwareRequest";
import { MockComponents } from "@tests/unit/mocks";

describe(GpuRequestOffers.name, () => {
  it("compares the request's offers", () => {
    const request = buildHardwareRequest({ id: "request-1", status: "offers" });
    const offers = [buildGpuRequestOffer()];
    const { GpuOffersTable, useHardwareRequestOffersQuery } = setup({ request, offers });

    expect(useHardwareRequestOffersQuery).toHaveBeenCalledWith("request-1");
    expect(GpuOffersTable).toHaveBeenCalledWith(expect.objectContaining({ spec: request.spec, offers, now: expect.any(Date) }), expect.anything());
  });

  it("offers each viewer the decisions their role allows", () => {
    const request = buildHardwareRequest({ id: "request-1", status: "offers", userId: "someone" });
    const offer = buildGpuRequestOffer();
    const { GpuOffersTable, GpuOfferActions } = setup({ request, offers: [offer], viewer: { userId: "me", role: "admin" } });

    render(<>{GpuOffersTable.mock.lastCall![0].renderActions!(offer, "Offer 1")}</>);

    expect(GpuOfferActions).toHaveBeenCalledWith(
      { requestId: "request-1", offer, label: "Offer 1", decisions: { canAccept: true, canDecline: true, canAskForApproval: false } },
      expect.anything()
    );
  });

  it.each([
    { status: "accepted", viewer: { userId: "me", role: "owner" } },
    { status: "fulfilled", viewer: { userId: "me", role: "admin" } },
    { status: "offers", viewer: { userId: "me", role: undefined } }
  ] as const)("leaves out the actions column when a $status request gives a $viewer.role viewer no decision", ({ status, viewer }) => {
    const request = buildHardwareRequest({ status, userId: "someone" });
    const { GpuOffersTable } = setup({ request, offers: [buildGpuRequestOffer()], viewer });

    expect(GpuOffersTable).toHaveBeenCalledWith(expect.objectContaining({ renderActions: undefined }), expect.anything());
  });

  it("keeps the actions column when the viewer can decide one of several offers", () => {
    const request = buildHardwareRequest({ status: "offers", userId: "someone" });
    const offers = [buildGpuRequestOffer({ status: "declined" }), buildGpuRequestOffer({ status: "published" })];
    const { GpuOffersTable } = setup({ request, offers, viewer: { userId: "me", role: "member" } });

    expect(GpuOffersTable).toHaveBeenCalledWith(expect.objectContaining({ renderActions: expect.any(Function) }), expect.anything());
  });

  it("keeps the actions column when the requester can only decline an expired offer", () => {
    const request = buildHardwareRequest({ status: "offers", userId: "me" });
    const { GpuOffersTable } = setup({ request, offers: [buildGpuRequestOffer({ expired: true })], viewer: { userId: "me", role: "member" } });

    expect(GpuOffersTable).toHaveBeenCalledWith(expect.objectContaining({ renderActions: expect.any(Function) }), expect.anything());
  });

  it("shows that the offers are loading", () => {
    const { GpuOffersTable } = setup({ isLoading: true });

    expect(screen.getByText("Loading offers…")).toBeInTheDocument();
    expect(GpuOffersTable).not.toHaveBeenCalled();
  });

  it("says when the offers could not be loaded", () => {
    setup({ isError: true });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the offers. Try again in a moment.");
  });

  it("shows nothing before the team publishes an offer", () => {
    const { GpuOffersTable } = setup({ offers: [] });

    expect(GpuOffersTable).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows nothing when no offers came back", () => {
    const { GpuOffersTable } = setup({ offers: undefined });

    expect(GpuOffersTable).not.toHaveBeenCalled();
  });

  function setup(input: {
    request?: ReturnType<typeof buildHardwareRequest>;
    offers?: GpuRequestOffer[];
    isLoading?: boolean;
    isError?: boolean;
    viewer?: GpuRequestViewer;
  }) {
    const useHardwareRequestOffersQuery = vi.fn(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useHardwareRequestOffersQuery>>(), {
        data: input.offers,
        isLoading: input.isLoading ?? false,
        isError: input.isError ?? false
      })
    );
    const dependencies = MockComponents(DEPENDENCIES, { useHardwareRequestOffersQuery });

    render(
      <GpuRequestOffers
        request={input.request ?? buildHardwareRequest()}
        viewer={input.viewer ?? { userId: "me", role: "member" }}
        dependencies={dependencies}
      />
    );

    return { GpuOffersTable: dependencies.GpuOffersTable, GpuOfferActions: dependencies.GpuOfferActions, useHardwareRequestOffersQuery };
  }
});
