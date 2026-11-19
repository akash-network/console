import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { NotifiableGpuSetup } from "../../AvailabilityPane/gpuAvailability/gpuAvailability";
import { DEPENDENCIES, NoBidsNotice, WHY_NO_BIDS_QUESTION } from "./NoBidsNotice";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(NoBidsNotice.name, () => {
  it("explains why a matching provider may not bid, without claiming any matched", () => {
    setup();

    expect(screen.getByRole("status")).toHaveTextContent("No provider has bid yet");
    expect(screen.getByRole("status")).not.toHaveTextContent("matched your configuration");
    expect(screen.getByRole("status")).toHaveTextContent(
      "A provider that matches your configuration doesn't always bid: some only take deployments from accounts on their allowlist, run custom setups, or reserve their capacity for private contracts."
    );
  });

  it("asks for compute when the user requests it", async () => {
    const { onRequestCompute } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Request compute" }));

    expect(onRequestCompute).toHaveBeenCalledTimes(1);
  });

  it("asks for the hardware under the label it is given", async () => {
    const { onRequestCompute } = setup({ requestLabel: "Request this hardware" });

    await userEvent.click(screen.getByRole("button", { name: "Request this hardware" }));

    expect(onRequestCompute).toHaveBeenCalledTimes(1);
  });

  it("says a late bid still shows up and points to Close and Edit as the other way out", () => {
    setup();

    expect(screen.getByText("A late bid still shows up here. To change your configuration, use Close and Edit.")).toBeInTheDocument();
  });

  it("offers to ask the assistant why the deployment got no bids", () => {
    const { AskAssistantButton } = setup({ dseq: "42" });

    expect(AskAssistantButton).toHaveBeenCalledWith({ dseq: "42", question: WHY_NO_BIDS_QUESTION, label: "Why no bids?" }, expect.anything());
  });

  it("has nothing to ask about before the deployment exists", () => {
    const { AskAssistantButton } = setup({ dseq: null });

    expect(AskAssistantButton).not.toHaveBeenCalled();
  });

  describe("when gpu alerts are on", () => {
    const gpu: NotifiableGpuSetup = { vendor: "nvidia", model: "h100", memory: "80Gi", gpuCount: 4 };

    it("offers notify me after a deployment got no bids", async () => {
      const { notify } = setup({ gpu, isAlertsEnabled: true });

      expect(screen.queryByRole("button", { name: "Request compute" })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Notify me when available" }));

      expect(notify).toHaveBeenCalledWith(gpu, "no_bids");
    });

    it("keeps reserve capacity as the secondary action", async () => {
      const { onRequestCompute } = setup({ gpu, isAlertsEnabled: true });

      await userEvent.click(screen.getByRole("button", { name: "Need it guaranteed? Reserve capacity" }));

      expect(onRequestCompute).toHaveBeenCalledTimes(1);
    });

    it("shows the place in line once already waiting", () => {
      setup({ gpu, isAlertsEnabled: true, waitingPlace: 2 });

      expect(screen.getByText("Waiting · #2 in line")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Notify me when available" })).not.toBeInTheDocument();
    });

    it("keeps today's request button when the deployment asks for no notifiable gpu", () => {
      setup({ gpu: null, isAlertsEnabled: true });

      expect(screen.getByRole("button", { name: "Request compute" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Notify me when available" })).not.toBeInTheDocument();
    });
  });

  it("keeps today's request button when gpu alerts are off", () => {
    setup({ gpu: { vendor: "nvidia", model: "h100", gpuCount: 1 } });

    expect(screen.getByRole("button", { name: "Request compute" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notify me when available" })).not.toBeInTheDocument();
  });

  function setup(
    input: { requestLabel?: string; dseq?: string | null; gpu?: NotifiableGpuSetup | null; isAlertsEnabled?: boolean; waitingPlace?: number } = {}
  ) {
    const onRequestCompute = vi.fn();
    const AskAssistantButton = vi.fn(() => null);
    const notify = vi.fn();
    const useNotifyMeStub: typeof DEPENDENCIES.useNotifyMe = () =>
      mock<ReturnType<typeof DEPENDENCIES.useNotifyMe>>({
        isEnabled: !!input.isAlertsEnabled,
        notify,
        findEntry: () => (input.waitingPlace ? ({ placeInLine: input.waitingPlace } as never) : undefined),
        isPending: false
      });
    render(
      <NoBidsNotice
        requestLabel={input.requestLabel}
        dseq={input.dseq ?? null}
        gpu={input.gpu}
        onRequestCompute={onRequestCompute}
        dependencies={{ ...DEPENDENCIES, AskAssistantButton, useNotifyMe: useNotifyMeStub }}
      />
    );
    return { onRequestCompute, AskAssistantButton, notify };
  }
});
