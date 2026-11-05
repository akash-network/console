import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssistantAction } from "@src/types/assistant";
import type { ActionCardRegistry } from "../actionCardTypes";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import { ActionCard, DEPENDENCIES } from "./ActionCard";

import { render, screen } from "@testing-library/react";

describe(ActionCard.name, () => {
  it("renders the card registered for the action type with its decision", () => {
    const { registered, useActionCardDecision, decision, GenericActionCard } = setup({ action: { type: "send_manifest_again", tier: "confirm", dseq: "42" } });

    expect(screen.getByText("registered card")).toBeInTheDocument();
    expect(registered).toHaveBeenCalledWith({ action: { type: "send_manifest_again", tier: "confirm", dseq: "42" }, decision }, expect.anything());
    expect(useActionCardDecision).toHaveBeenCalledWith({ conversationId: "c-1", proposalId: "p-1", actionType: "send_manifest_again" });
    expect(GenericActionCard).not.toHaveBeenCalled();
  });

  it("falls back to the generic card for an action without one", () => {
    const action: AssistantAction = { type: "favorite_provider", tier: "confirm", provider: "akash1provider" };
    const { GenericActionCard, decision } = setup({ action });

    expect(screen.getByText("generic card")).toBeInTheDocument();
    expect(GenericActionCard).toHaveBeenCalledWith({ action, decision }, expect.anything());
  });

  function setup(input: { action: AssistantAction }) {
    const decision = mock<ActionCardDecision>({ status: "pending" });
    const useActionCardDecision = vi.fn(() => decision);
    const GenericActionCard = vi.fn(() => <p>generic card</p>);
    const registered = vi.fn(() => <p>registered card</p>);
    const registry: ActionCardRegistry = { send_manifest_again: registered };

    render(
      <ActionCard
        conversationId="c-1"
        proposalId="p-1"
        action={input.action}
        registry={registry}
        dependencies={{ ...DEPENDENCIES, useActionCardDecision, GenericActionCard }}
      />
    );

    return { decision, useActionCardDecision, GenericActionCard, registered };
  }
});
