import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CustomUserProfile } from "@src/types/user";
import type { DEPENDENCIES } from "./RequireFairUsePolicy";
import { RequireFairUsePolicy } from "./RequireFairUsePolicy";

import { fireEvent, render, screen } from "@testing-library/react";

const ACCEPTED_AT = "2026-09-06T00:00:00.000Z";

describe(RequireFairUsePolicy.name, () => {
  it("shows the modal over the page for a signed-in user who has not accepted", () => {
    setup({ userId: "u1", fairUsePolicyAcceptedAt: null });

    expect(screen.getByText("child")).toBeInTheDocument();
    expect(screen.getByTestId("fair-use-policy-modal")).toBeInTheDocument();
  });

  it("renders only the page once the user has accepted", () => {
    setup({ userId: "u1", fairUsePolicyAcceptedAt: ACCEPTED_AT });

    expect(screen.getByText("child")).toBeInTheDocument();
    expect(screen.queryByTestId("fair-use-policy-modal")).not.toBeInTheDocument();
  });

  it("never demands acceptance on a public page", () => {
    setup({ userId: "u1", fairUsePolicyAcceptedAt: null, isPublic: true });

    expect(screen.queryByTestId("fair-use-policy-modal")).not.toBeInTheDocument();
  });

  it("never demands acceptance from a logged-out visitor", () => {
    setup({ loggedOut: true });

    expect(screen.queryByTestId("fair-use-policy-modal")).not.toBeInTheDocument();
  });

  it("accepts the policy when the modal action is used", () => {
    const { accept } = setup({ userId: "u1", fairUsePolicyAcceptedAt: null });

    fireEvent.click(screen.getByTestId("fair-use-policy-accept-button"));

    expect(accept).toHaveBeenCalledTimes(1);
  });

  function setup(input: { userId?: string; fairUsePolicyAcceptedAt?: string | null; isPublic?: boolean; loggedOut?: boolean }) {
    const accept = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useUser: (() =>
        mock<ReturnType<typeof DEPENDENCIES.useUser>>({
          user: input.loggedOut
            ? undefined
            : mock<CustomUserProfile>({ userId: input.userId ?? "u1", fairUsePolicyAcceptedAt: input.fairUsePolicyAcceptedAt ?? null }),
          isLoading: false
        })) as typeof DEPENDENCIES.useUser,
      useAcceptFairUsePolicy: () => ({ accept, isAccepting: false }),
      FairUsePolicyModal: ({ onAccept }) => (
        <div data-testid="fair-use-policy-modal">
          <button data-testid="fair-use-policy-accept-button" onClick={onAccept}>
            agree
          </button>
        </div>
      )
    };

    render(
      <RequireFairUsePolicy isPublic={input.isPublic} dependencies={dependencies}>
        <div>child</div>
      </RequireFairUsePolicy>
    );

    return { accept };
  }
});
