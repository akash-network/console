import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssistantAction } from "@src/types/assistant";
import type { ActionCardComponent } from "../actionCardTypes";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import { withPricingGuard } from "./PricingRefusalCard";

import { render, screen } from "@testing-library/react";

describe(withPricingGuard.name, () => {
  it("renders the card for an action that leaves pricing alone", () => {
    const { Card } = setup({ type: "update_deployment", tier: "confirm", dseq: "42", name: null, manifestVersion: "v1", services: [] });

    expect(screen.getByText("the real card")).toBeInTheDocument();
    expect(Card).toHaveBeenCalled();
  });

  it("refuses an action carrying pricing without rendering the card, leaving only Cancel", () => {
    const { Card } = setup({
      type: "update_deployment",
      tier: "confirm",
      dseq: "42",
      name: null,
      manifestVersion: "v1",
      services: [{ service: "web", before: {}, patch: { pricing: { denom: "uakt" } } }]
    });

    expect(Card).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "This change can't be applied" })).toHaveTextContent(
      "This change would touch pricing, which the assistant can't change. Edit pricing in the editor yourself."
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("names the guarded card for debugging", () => {
    const Named: ActionCardComponent<"update_deployment"> = () => null;
    Named.displayName = "UpdateCard";

    expect(withPricingGuard(Named).displayName).toBe("withPricingGuard(UpdateCard)");
    expect(
      withPricingGuard(function Plain() {
        return null;
      }).displayName
    ).toBe("withPricingGuard(Plain)");
  });

  function setup(action: Record<string, unknown>) {
    const Card = vi.fn(() => <p>the real card</p>);
    const Guarded = withPricingGuard(Card as unknown as ActionCardComponent<"update_deployment">);
    const decision = mock<ActionCardDecision>({ status: "pending" });

    render(<Guarded action={action as unknown as Extract<AssistantAction, { type: "update_deployment" }>} decision={decision} />);

    return { Card };
  }
});
