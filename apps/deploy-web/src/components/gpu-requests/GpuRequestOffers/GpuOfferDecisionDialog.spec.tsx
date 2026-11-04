import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES, OfferDecision } from "./GpuOfferDecisionDialog";
import { GpuOfferDecisionDialog } from "./GpuOfferDecisionDialog";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildGpuRequestOffer, buildGpuRequestOfferTerms } from "@tests/seeders/hardwareRequest";

describe(GpuOfferDecisionDialog.name, () => {
  it("says the term is informational and the team sets up the deployment before accepting", () => {
    setup({ decision: "accept" });

    const dialog = screen.getByRole("dialog", { name: "Accept Offer 2?" });
    expect(dialog).toHaveAccessibleDescription("8× H100 in Oslo, NO at $2.40 per GPU-hour, about $14,016 a month.");
    expect(dialog).toHaveTextContent(
      "Our team sets up the deployment with the provider and emails you when it's ready. The other offers on this request close."
    );
    expect(dialog).toHaveTextContent("The 6 months term is for your information. Console doesn't enforce it.");
  });

  it("accepts the offer and confirms it", async () => {
    const { user, accept, decline, enqueueSnackbar, onClose } = setup({ decision: "accept" });
    accept.mockImplementation((input, options) => options?.onSuccess?.(mock(), input, undefined));

    await user.click(screen.getByRole("button", { name: "Accept offer" }));

    expect(accept).toHaveBeenCalledWith({ id: "request-1", offerId: "offer-1" }, expect.anything());
    expect(decline).not.toHaveBeenCalled();
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Offer accepted", subTitle: "Our team will email you about the setup." }) }),
      { variant: "success" }
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("warns that a declined offer can't be accepted later, then declines it", async () => {
    const { user, accept, decline, enqueueSnackbar } = setup({ decision: "decline" });
    decline.mockImplementation((input, options) => options?.onSuccess?.(mock(), input, undefined));

    expect(screen.getByRole("dialog", { name: "Decline Offer 2?" })).toHaveTextContent("You won't be able to accept this offer afterwards.");
    await user.click(screen.getByRole("button", { name: "Decline offer" }));

    expect(decline).toHaveBeenCalledWith({ id: "request-1", offerId: "offer-1" }, expect.anything());
    expect(accept).not.toHaveBeenCalled();
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Offer declined", subTitle: "The team can see you passed on it." }) }),
      { variant: "success" }
    );
  });

  it("reports a refused decision and closes", async () => {
    const { user, accept, enqueueSnackbar, onClose } = setup({ decision: "accept" });
    accept.mockImplementation((input, options) => options?.onError?.(new Error("expired"), input, undefined));

    await user.click(screen.getByRole("button", { name: "Accept offer" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          title: "Couldn't accept this offer",
          subTitle: "It may have expired or been settled. Check the request and try again."
        })
      }),
      { variant: "error" }
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("stays open on Escape while deciding", async () => {
    const { user, onClose } = setup({ decision: "decline", isPending: true });

    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("closes on Escape otherwise", async () => {
    const { user, onClose } = setup({ decision: "decline" });

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Cancel", async () => {
    const { user, onClose, accept } = setup({ decision: "accept" });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(accept).not.toHaveBeenCalled();
  });

  function setup(input: { decision: OfferDecision; isPending?: boolean }) {
    const accept = vi.fn<ReturnType<typeof DEPENDENCIES.useAcceptHardwareRequestOfferMutation>["mutate"]>();
    const decline = vi.fn<ReturnType<typeof DEPENDENCIES.useDeclineHardwareRequestOfferMutation>["mutate"]>();
    const enqueueSnackbar = vi.fn();
    const onClose = vi.fn();
    const isPending = input.isPending ?? false;
    const dependencies: typeof DEPENDENCIES = {
      useAcceptHardwareRequestOfferMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useAcceptHardwareRequestOfferMutation>>({ mutate: accept, isPending: input.decision === "accept" && isPending }),
      useDeclineHardwareRequestOfferMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useDeclineHardwareRequestOfferMutation>>({ mutate: decline, isPending: input.decision === "decline" && isPending }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };
    const offer = buildGpuRequestOffer({
      id: "offer-1",
      usdPerGpuHour: 2.4,
      estimatedMonthlyUsd: 14016,
      terms: buildGpuRequestOfferTerms({ gpu: { model: "H100", count: 8, interconnect: "server" }, location: "Oslo, NO", term: "6_months" })
    });

    render(
      <GpuOfferDecisionDialog decision={input.decision} requestId="request-1" offer={offer} label="Offer 2" onClose={onClose} dependencies={dependencies} />
    );

    return { user: userEvent.setup(), accept, decline, enqueueSnackbar, onClose };
  }
});
