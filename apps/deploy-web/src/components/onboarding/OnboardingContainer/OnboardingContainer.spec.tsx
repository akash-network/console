import "@testing-library/jest-dom";

import React from "react";

import { OnboardingContainer, OnboardingStepIndex } from "./OnboardingContainer";

import { render } from "@testing-library/react";

// Mock dependencies
const mockUseUser = jest.fn();
const mockUsePaymentMethodsQuery = jest.fn();
const mockUseServices = jest.fn();
const mockUrlService = {
  onboarding: jest.fn(),
  signup: jest.fn()
};
const mockRouter = {
  push: jest.fn()
};
const mockAnalyticsService = {
  track: jest.fn()
};

jest.mock("@src/hooks/useUser", () => ({
  useUser: () => mockUseUser()
}));

jest.mock("@src/queries/usePaymentQueries", () => ({
  usePaymentMethodsQuery: () => mockUsePaymentMethodsQuery()
}));

jest.mock("@src/context/ServicesProvider", () => ({
  useServices: () => mockUseServices()
}));

jest.mock("@src/utils/urlUtils", () => ({
  UrlService: mockUrlService
}));

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter
}));

describe("OnboardingContainer", () => {
  it("should initialize with default state", () => {
    const { child } = setup();

    expect(child.mock.calls[0][0]).toEqual({
      currentStep: OnboardingStepIndex.FREE_TRIAL,
      steps: expect.arrayContaining([
        expect.objectContaining({ id: "free-trial", title: "Free Trial" }),
        expect.objectContaining({ id: "signup", title: "Create Account" }),
        expect.objectContaining({ id: "email-verification", title: "Verify Email" }),
        expect.objectContaining({ id: "payment-method", title: "Payment Method" }),
        expect.objectContaining({ id: "welcome", title: "Welcome" })
      ]),
      onStepChange: expect.any(Function),
      onStepComplete: expect.any(Function),
      onStartTrial: expect.any(Function),
      onPaymentMethodComplete: expect.any(Function),
      onComplete: expect.any(Function),
      isLoading: false
    });
  });

  it("should track analytics when step changes", () => {
    const { child } = setup();

    const { onStepChange } = child.mock.calls[0][0];
    onStepChange(OnboardingStepIndex.EMAIL_VERIFICATION);

    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_step_started", {
      category: "onboarding",
      step: "email_verification",
      step_index: OnboardingStepIndex.EMAIL_VERIFICATION
    });
  });

  it("should track analytics when step completes", () => {
    const { child } = setup();

    const { onStepComplete } = child.mock.calls[0][0];
    onStepComplete(OnboardingStepIndex.FREE_TRIAL);

    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_step_completed", {
      category: "onboarding",
      step: "free_trial",
      step_index: OnboardingStepIndex.FREE_TRIAL
    });
  });

  it("should track analytics and redirect when starting trial", () => {
    const { child } = setup();

    mockUrlService.onboarding.mockReturnValue("/onboarding");
    mockUrlService.signup.mockReturnValue("/signup");

    const { onStartTrial } = child.mock.calls[0][0];
    onStartTrial();

    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_free_trial_started", {
      category: "onboarding"
    });
    expect(mockUrlService.onboarding).toHaveBeenCalledWith(true);
    expect(mockUrlService.signup).toHaveBeenCalled();
  });

  it("should track analytics when payment method is completed", () => {
    const { child } = setup({
      paymentMethods: [{ id: "1", type: "card" }]
    });

    const { onPaymentMethodComplete } = child.mock.calls[0][0];
    onPaymentMethodComplete();

    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_payment_method_added", {
      category: "onboarding"
    });
  });

  it("should redirect to home when onboarding is completed", () => {
    const { child } = setup();

    const { onComplete } = child.mock.calls[0][0];
    onComplete();

    expect(mockRouter.push).toHaveBeenCalledWith("/");
  });

  it("should handle fromSignup URL parameter", () => {
    // Mock window.location.search
    Object.defineProperty(window, "location", {
      value: {
        search: "?fromSignup=true",
        href: "http://localhost/onboarding?fromSignup=true",
        origin: "http://localhost"
      },
      writable: true
    });

    // Mock window.history.replaceState
    Object.defineProperty(window, "history", {
      value: {
        replaceState: jest.fn()
      },
      writable: true
    });

    const { child } = setup();

    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_account_created", {
      category: "onboarding"
    });

    expect(child.mock.calls[0][0].currentStep).toBe(OnboardingStepIndex.EMAIL_VERIFICATION);
  });

  function setup(input: { paymentMethods?: any[]; user?: any } = {}) {
    // Reset mocks
    jest.clearAllMocks();

    // Setup default mocks
    mockUseUser.mockReturnValue(input.user || { emailVerified: false });
    mockUsePaymentMethodsQuery.mockReturnValue({ data: input.paymentMethods || [] });
    mockUseServices.mockReturnValue({ analyticsService: mockAnalyticsService });

    const mockChildren = jest.fn().mockReturnValue(<div>Test</div>);

    render(<OnboardingContainer>{mockChildren}</OnboardingContainer>);

    return { child: mockChildren };
  }
});
