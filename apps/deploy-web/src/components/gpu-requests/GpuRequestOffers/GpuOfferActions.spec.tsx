import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OfferDecisions } from "../gpuRequestAccess/gpuRequestAccess";
import type { DEPENDENCIES } from "./GpuOfferActions";
import { GpuOfferActions } from "./GpuOfferActions";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildGpuRequestOffer } from "@tests/seeders/hardwareRequest";

const OWNER: OfferDecisions = { canAccept: true, canDecline: true, canAskForApproval: false };
const MEMBER: OfferDecisions = { canAccept: false, canDecline: false, canAskForApproval: true };

describe(GpuOfferActions.name, () => {
  it("confirms an accept before sending it", async () => {
    const { GpuOfferDecisionDialog, offer } = setup({ decisions: OWNER });

    await userEvent.click(screen.getByRole("button", { name: "Accept Offer 2" }));

    expect(GpuOfferDecisionDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({ decision: "accept", requestId: "request-1", offer, label: "Offer 2" }),
      expect.anything()
    );
    act(() => GpuOfferDecisionDialog.mock.lastCall![0].onClose());
    expect(screen.queryByText("Decision dialog")).not.toBeInTheDocument();
  });

  it("confirms a decline before sending it", async () => {
    const { GpuOfferDecisionDialog } = setup({ decisions: OWNER });

    await userEvent.click(screen.getByRole("button", { name: "Decline Offer 2" }));

    expect(screen.getByText("Decision dialog")).toBeInTheDocument();
    expect(GpuOfferDecisionDialog).toHaveBeenLastCalledWith(expect.objectContaining({ decision: "decline" }), expect.anything());
    expect(screen.queryByRole("button", { name: "Ask an admin to accept Offer 2" })).not.toBeInTheDocument();
  });

  it("lets a member ask an admin to accept instead", async () => {
    const { askForApproval, enqueueSnackbar, offer } = setup({ decisions: MEMBER });
    askForApproval.mockImplementation((input, options) => options?.onSuccess?.(mock(), input, undefined));

    expect(screen.queryByRole("button", { name: "Accept Offer 2" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Decline Offer 2" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ask an admin to accept Offer 2" }));

    expect(askForApproval).toHaveBeenCalledWith({ id: "request-1", offerId: offer.id }, expect.anything());
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ title: "Approval requested", subTitle: "We emailed your organization's owners and admins." })
      }),
      { variant: "success" }
    );
  });

  it("reports an approval request that failed", async () => {
    const { askForApproval, enqueueSnackbar } = setup({ decisions: MEMBER });
    askForApproval.mockImplementation((input, options) => options?.onError?.(new Error("expired"), input, undefined));

    await userEvent.click(screen.getByRole("button", { name: "Ask an admin to accept Offer 2" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't ask for approval" }) }), {
      variant: "error"
    });
  });

  it("waits for an approval request to finish before another", () => {
    setup({ decisions: MEMBER, isAsking: true });

    expect(screen.getByRole("button", { name: "Ask an admin to accept Offer 2" })).toBeDisabled();
  });

  it("shows nothing when no decision is open to the viewer", () => {
    setup({ decisions: { canAccept: false, canDecline: false, canAskForApproval: false } });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  function setup(input: { decisions: OfferDecisions; isAsking?: boolean }) {
    const askForApproval = vi.fn<ReturnType<typeof DEPENDENCIES.useRequestHardwareRequestOfferApprovalMutation>["mutate"]>();
    const enqueueSnackbar = vi.fn();
    const GpuOfferDecisionDialog = vi.fn<typeof DEPENDENCIES.GpuOfferDecisionDialog>(() => <div>Decision dialog</div>);
    const dependencies: typeof DEPENDENCIES = {
      useRequestHardwareRequestOfferApprovalMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useRequestHardwareRequestOfferApprovalMutation>>({ mutate: askForApproval, isPending: input.isAsking ?? false }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      GpuOfferDecisionDialog
    };
    const offer = buildGpuRequestOffer();

    render(<GpuOfferActions requestId="request-1" offer={offer} label="Offer 2" decisions={input.decisions} dependencies={dependencies} />);

    return { askForApproval, enqueueSnackbar, GpuOfferDecisionDialog, offer };
  }
});
