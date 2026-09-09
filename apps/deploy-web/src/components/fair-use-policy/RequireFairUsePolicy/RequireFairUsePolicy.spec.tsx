import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CustomUserProfile } from "@src/types/user";
import type { DEPENDENCIES } from "./RequireFairUsePolicy";
import { RequireFairUsePolicy } from "./RequireFairUsePolicy";

import { fireEvent, render, screen } from "@testing-library/react";

const ACCEPTED_AT = "2026-09-06T00:00:00.000Z";

describe(RequireFairUsePolicy.name, () => {
  it("shows the modal inside the app shell instead of the page for a trialing user who has not accepted", () => {
    setup({ userId: "u1", fairUsePolicyAcceptedAt: null });

    expect(screen.queryByText("child")).not.toBeInTheDocument();
    expect(screen.getByTestId("layout")).toContainElement(screen.getByTestId("fair-use-policy-modal"));
  });

  it("demands acceptance before the trial wallet exists", () => {
    setup({ userId: "u1", fairUsePolicyAcceptedAt: null, isTrialing: false, hasWallet: false });

    expect(screen.queryByText("child")).not.toBeInTheDocument();
    expect(screen.getByTestId("fair-use-policy-modal")).toBeInTheDocument();
  });

  it("keeps the page and skips the prompt when the wallet lookup has failed", () => {
    setup({ userId: "u1", fairUsePolicyAcceptedAt: null, isTrialing: false, hasWallet: false, isWalletLookupFailed: true });

    expect(screen.getByText("child")).toBeInTheDocument();
    expect(screen.queryByTestId("fair-use-policy-modal")).not.toBeInTheDocument();
  });

  it("renders only the page once the user has accepted", () => {
    setup({ userId: "u1", fairUsePolicyAcceptedAt: ACCEPTED_AT });

    expect(screen.getByText("child")).toBeInTheDocument();
    expect(screen.queryByTestId("fair-use-policy-modal")).not.toBeInTheDocument();
    expect(screen.queryByTestId("layout")).not.toBeInTheDocument();
  });

  it("stops demanding acceptance once it is confirmed, even while the profile still lacks the timestamp", () => {
    setup({ userId: "u1", fairUsePolicyAcceptedAt: null, hasAccepted: true });

    expect(screen.queryByTestId("fair-use-policy-modal")).not.toBeInTheDocument();
  });

  it("never demands acceptance while the gate flag is off", () => {
    setup({ userId: "u1", fairUsePolicyAcceptedAt: null, isGateEnabled: false });

    expect(screen.queryByTestId("fair-use-policy-modal")).not.toBeInTheDocument();
  });

  it("never demands acceptance from a paying wallet", () => {
    setup({ userId: "u1", fairUsePolicyAcceptedAt: null, isTrialing: false });

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

  function setup(input: {
    userId?: string;
    fairUsePolicyAcceptedAt?: string | null;
    isPublic?: boolean;
    loggedOut?: boolean;
    isTrialing?: boolean;
    hasWallet?: boolean;
    isWalletLookupFailed?: boolean;
    isGateEnabled?: boolean;
    hasAccepted?: boolean;
  }) {
    const accept = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useUser: (() =>
        mock<ReturnType<typeof DEPENDENCIES.useUser>>({
          user: input.loggedOut
            ? undefined
            : mock<CustomUserProfile>({ userId: input.userId ?? "u1", fairUsePolicyAcceptedAt: input.fairUsePolicyAcceptedAt ?? null }),
          isLoading: false
        })) as typeof DEPENDENCIES.useUser,
      useWallet: () =>
        mock<ReturnType<typeof DEPENDENCIES.useWallet>>({
          isTrialing: input.isTrialing ?? true,
          hasWallet: input.hasWallet ?? true,
          isWalletLookupFailed: input.isWalletLookupFailed ?? false
        }),
      useFlag: flag => flag === "fair_use_policy_gate" && (input.isGateEnabled ?? true),
      useAcceptFairUsePolicy: () => ({ accept, isAccepting: false, hasAccepted: input.hasAccepted ?? false }),
      Layout: ({ children }) => <div data-testid="layout">{children}</div>,
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
