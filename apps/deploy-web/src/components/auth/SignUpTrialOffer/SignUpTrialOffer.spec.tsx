import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { useServices } from "@src/context/ServicesProvider";
import { DEPENDENCIES, ReferralWelcome, TrialCreditsNotice, useSignUpTrialOffer } from "./SignUpTrialOffer";

import { render, renderHook, screen } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type Container = ReturnType<typeof useServices>;
type ReferralCodeQuery = ReturnType<typeof DEPENDENCIES.useReferralCodeQuery>;

describe(useSignUpTrialOffer.name, () => {
  it("offers the referral trial credits for a valid code", () => {
    const { result, useReferralCodeQuery } = setup({ referralCode: "friendcode", data: { valid: true, trialCreditsUsd: 5 } });

    expect(useReferralCodeQuery).toHaveBeenCalledWith("friendcode");
    expect(result.current).toEqual({ isReferred: true, trialCreditsUsd: 5 });
  });

  it("offers the standard trial credits for an invalid code", () => {
    const { result } = setup({ referralCode: "friendcode", data: { valid: false } });

    expect(result.current).toEqual({ isReferred: false, trialCreditsUsd: 1 });
  });

  it("offers the standard trial credits while the code is being checked or when the check failed", () => {
    const { result } = setup({ referralCode: "friendcode", data: undefined });

    expect(result.current).toEqual({ isReferred: false, trialCreditsUsd: 1 });
  });

  it("offers the standard trial credits when a valid answer carries no amount", () => {
    const { result } = setup({ referralCode: "friendcode", data: { valid: true } });

    expect(result.current).toEqual({ isReferred: false, trialCreditsUsd: 1 });
  });

  function setup(input: { referralCode?: string; data: ReferralCodeQuery["data"] }) {
    const useReferralCodeQuery = vi.fn<typeof DEPENDENCIES.useReferralCodeQuery>(() => Object.assign(mock<ReferralCodeQuery>(), { data: input.data }));
    const publicConfig = Object.assign(mock<Container["publicConfig"]>(), { NEXT_PUBLIC_TRIAL_CREDITS_AMOUNT: 1 });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TestContainerProvider services={{ publicConfig: () => publicConfig }}>{children}</TestContainerProvider>
    );

    const { result } = renderHook(() => useSignUpTrialOffer(input.referralCode, { ...DEPENDENCIES, useReferralCodeQuery }), { wrapper });

    return { result, useReferralCodeQuery };
  }
});

describe(ReferralWelcome.name, () => {
  it("welcomes a referred visitor with the referral trial credits", () => {
    render(<ReferralWelcome offer={{ isReferred: true, trialCreditsUsd: 5 }} />);

    expect(screen.getByText("You were referred to Akash Console")).toBeInTheDocument();
    expect(screen.getByText("Create your account to start with $5 in free credits.")).toBeInTheDocument();
  });

  it("renders nothing for a visitor who was not referred", () => {
    const { container } = render(<ReferralWelcome offer={{ isReferred: false, trialCreditsUsd: 1 }} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe(TrialCreditsNotice.name, () => {
  it("states the referral trial credits for a referred visitor", () => {
    render(<TrialCreditsNotice offer={{ isReferred: true, trialCreditsUsd: 5 }} />);

    expect(screen.getByText("$5 in credits to deploy your first containers. No card required.")).toBeInTheDocument();
  });

  it("states the standard trial credits for a visitor who was not referred", () => {
    render(<TrialCreditsNotice offer={{ isReferred: false, trialCreditsUsd: 1 }} />);

    expect(screen.getByText("$1 credit to deploy your first container. No card required.")).toBeInTheDocument();
  });
});
