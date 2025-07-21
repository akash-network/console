import "@testing-library/jest-dom";

import React from "react";
import { act } from "react-dom/test-utils";

import { UrlService } from "@src/utils/urlUtils";
import { OnboardingContainer, OnboardingStepIndex } from "./OnboardingContainer";

import { render } from "@testing-library/react";

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
      onComplete: expect.any(Function)
    });
  });

  it("should track analytics when step changes", async () => {
    const { child, mockAnalyticsService } = setup();

    const { onStepChange } = child.mock.calls[0][0];
    await act(async () => {
      onStepChange(OnboardingStepIndex.EMAIL_VERIFICATION);
    });

    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_step_started", {
      category: "onboarding",
      step: "email_verification",
      step_index: OnboardingStepIndex.EMAIL_VERIFICATION
    });
  });

  it("should track analytics when step completes", async () => {
    const { child, mockAnalyticsService } = setup();

    const { onStepComplete } = child.mock.calls[0][0];
    await act(async () => {
      onStepComplete(OnboardingStepIndex.FREE_TRIAL);
    });

    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_step_completed", {
      category: "onboarding",
      step: "free_trial",
      step_index: OnboardingStepIndex.FREE_TRIAL
    });
  });

  it("should track analytics and redirect when starting trial", async () => {
    const { child, mockAnalyticsService, mockUrlService } = setup();

    (mockUrlService.onboarding as jest.Mock).mockReturnValue("/onboarding");
    (mockUrlService.signup as jest.Mock).mockReturnValue("/signup");

    const { onStartTrial } = child.mock.calls[0][0];
    await act(async () => {
      onStartTrial();
    });

    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_free_trial_started", {
      category: "onboarding"
    });
    expect(mockUrlService.onboarding).toHaveBeenCalledWith(true);
    expect(mockUrlService.signup).toHaveBeenCalled();
  });

  it("should track analytics when payment method is completed", async () => {
    const { child, mockAnalyticsService } = setup({
      paymentMethods: [{ id: "1", type: "card" }]
    });

    const { onPaymentMethodComplete } = child.mock.calls[0][0];
    await act(async () => {
      onPaymentMethodComplete();
    });

    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_payment_method_added", {
      category: "onboarding"
    });
  });

  it("should redirect to home when onboarding is completed", () => {
    const { child, mockRouter } = setup();

    const { onComplete } = child.mock.calls[0][0];
    onComplete();

    expect(mockRouter.push).toHaveBeenCalledWith("/");
  });

  it("should handle fromSignup URL parameter", async () => {
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

    const { child, mockAnalyticsService } = setup();

    // Wait for the useEffect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_account_created", {
      category: "onboarding"
    });

    // The component should be on the EMAIL_VERIFICATION step after handling fromSignup
    expect(child.mock.calls[child.mock.calls.length - 1][0].currentStep).toBe(OnboardingStepIndex.EMAIL_VERIFICATION);
  });

  function setup(input: { paymentMethods?: any[]; user?: any } = {}) {
    jest.clearAllMocks();

    // Create mock objects
    const mockAnalyticsService = {
      track: jest.fn()
    };
    const mockRouter = {
      push: jest.fn()
    };

    // Create a mock UrlService with all required methods
    const mockUrlService = {
      ...UrlService,
      onboarding: jest.fn(),
      signup: jest.fn()
    } as unknown as typeof UrlService;

    const mockUseUser = jest.fn().mockReturnValue(input.user || { emailVerified: false });
    const mockUsePaymentMethodsQuery = jest.fn().mockReturnValue({ data: input.paymentMethods || [] });
    const mockUseServices = jest.fn().mockReturnValue({ analyticsService: mockAnalyticsService });
    const mockUseRouter = jest.fn().mockReturnValue(mockRouter);

    // Create dependencies object
    const dependencies = {
      useUser: mockUseUser,
      usePaymentMethodsQuery: mockUsePaymentMethodsQuery,
      useServices: mockUseServices,
      useRouter: mockUseRouter,
      UrlService: mockUrlService
    };

    const mockChildren = jest.fn().mockReturnValue(<div>Test</div>);

    render(<OnboardingContainer dependencies={dependencies}>{mockChildren}</OnboardingContainer>);

    return {
      child: mockChildren,
      mockAnalyticsService,
      mockRouter,
      mockUrlService,
      mockUseUser,
      mockUsePaymentMethodsQuery,
      mockUseServices,
      mockUseRouter
    };
  }
});
