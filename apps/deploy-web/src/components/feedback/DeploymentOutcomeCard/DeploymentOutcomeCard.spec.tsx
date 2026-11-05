import { describe, expect, it, vi } from "vitest";

import { DeploymentOutcomeCard } from "./DeploymentOutcomeCard";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("DeploymentOutcomeCard", () => {
  it("asks how a live deployment went", () => {
    setup({ outcome: "live", deploymentName: "sdxl-image-api" });

    expect(screen.getByRole("region", { name: "How was deploying sdxl-image-api?" })).toBeInTheDocument();
    expect(screen.getByText("Deployment live")).toBeInTheDocument();
    expect(screen.getByText("Your read on this helps us decide what to refine next.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("What stood out, good or bad? (optional)")).toBeInTheDocument();
  });

  it("asks where a failed deployment broke down", () => {
    setup({ outcome: "failed", deploymentName: "sdxl-image-api" });

    expect(screen.getByText("Deployment failed")).toBeInTheDocument();
    expect(screen.getByText("Sorry this one didn't ship. Tell us where it broke down.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("What went wrong, or where did you get stuck? (optional)")).toBeInTheDocument();
  });

  it("asks without a name when the deployment has none", () => {
    setup({ outcome: "live" });

    expect(screen.getByRole("heading", { name: "How was your deploy?" })).toBeInTheDocument();
  });

  it("offers five ratings from Frustrating to Great", () => {
    setup({ outcome: "live" });

    expect(screen.getByRole("radiogroup", { name: "Rating" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map(radio => radio.getAttribute("aria-label"))).toEqual(["Frustrating", "Not great", "Okay", "Good", "Great"]);
  });

  it("links the consent line to the privacy policy", () => {
    setup({ outcome: "live" });

    expect(screen.getByText(/Sent to the Akash team with this deployment's details/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy-policy");
  });

  it("keeps Send feedback disabled until a rating is picked", async () => {
    setup({ outcome: "live" });

    expect(screen.getByRole("button", { name: "Send feedback" })).toBeDisabled();

    await userEvent.click(screen.getByRole("radio", { name: "Good" }));

    expect(screen.getByRole("button", { name: "Send feedback" })).toBeEnabled();
  });

  it("sends the rating with the trimmed message", async () => {
    const { onSend } = setup({ outcome: "failed" });

    await userEvent.click(screen.getByRole("radio", { name: "Frustrating" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Tell us more" }), "  Bids never came  ");
    await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    expect(onSend).toHaveBeenCalledWith({ rating: 1, message: "Bids never came" });
  });

  it("sends no message when the text is blank", async () => {
    const { onSend } = setup({ outcome: "live" });

    await userEvent.click(screen.getByRole("radio", { name: "Great" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Tell us more" }), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    expect(onSend).toHaveBeenCalledWith({ rating: 5, message: undefined });
  });

  it("keeps the rating when the picked face is clicked again", async () => {
    const { onSend } = setup({ outcome: "live" });

    await userEvent.click(screen.getByRole("radio", { name: "Okay" }));
    await userEvent.click(screen.getByRole("radio", { name: "Okay" }));
    await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    expect(onSend).toHaveBeenCalledWith({ rating: 3, message: undefined });
  });

  it("dismisses from Not now and from the close button", async () => {
    const { onDismiss } = setup({ outcome: "live" });

    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it("blocks both actions while sending", () => {
    setup({ outcome: "live", isSending: true });

    expect(screen.getByRole("button", { name: "Not now" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Send feedback/ })).toBeDisabled();
  });

  function setup(input: { outcome: "live" | "failed"; deploymentName?: string; isSending?: boolean }) {
    const onSend = vi.fn();
    const onDismiss = vi.fn();
    render(
      <DeploymentOutcomeCard
        outcome={input.outcome}
        deploymentName={input.deploymentName}
        isSending={input.isSending ?? false}
        onSend={onSend}
        onDismiss={onDismiss}
      />
    );

    return { onSend, onDismiss };
  }
});
