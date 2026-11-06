import { describe, expect, it, vi } from "vitest";

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

  function setup(input: { requestLabel?: string; dseq?: string | null } = {}) {
    const onRequestCompute = vi.fn();
    const AskAssistantButton = vi.fn(() => null);
    render(
      <NoBidsNotice
        requestLabel={input.requestLabel}
        dseq={input.dseq ?? null}
        onRequestCompute={onRequestCompute}
        dependencies={{ ...DEPENDENCIES, AskAssistantButton }}
      />
    );
    return { onRequestCompute, AskAssistantButton };
  }
});
