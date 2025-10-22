import "@testing-library/jest-dom";

import React from "react";
import { act } from "react-dom/test-utils";
import { mock } from "jest-mock-extended";
import type { Router } from "next/router";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { AuthService } from "@src/services/auth/auth/auth.service";
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
    const { child, mockAnalyticsService, mockUrlService, authService } = setup();

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
    expect(authService.signup).toHaveBeenCalledWith({ returnTo: expect.stringContaining("/onboarding") });
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

  it("should redirect to home and connect managed wallet when onboarding is completed", () => {
    const { child, mockRouter, mockConnectManagedWallet } = setup();

    const { onComplete } = child.mock.calls[0][0];
    onComplete();

    expect(mockRouter.push).toHaveBeenCalledWith("/");
    expect(mockConnectManagedWallet).toHaveBeenCalled();
  });

  it("should redirect to home when user has managed wallet and no saved step", async () => {
    const { mockRouter } = setup({
      wallet: { hasManagedWallet: true, isWalletLoading: false }
    });

    // Wait for the useEffect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  it("should not redirect when user has managed wallet but has saved step", async () => {
    const { mockRouter } = setup({
      wallet: { hasManagedWallet: true, isWalletLoading: false },
      savedStep: "2"
    });

    // Wait for the useEffect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("should handle fromSignup URL parameter", async () => {
    const { child, mockAnalyticsService, cleanup } = setup({
      windowLocation: {
        search: "?fromSignup=true",
        href: "http://localhost/onboarding?fromSignup=true",
        origin: "http://localhost"
      },
      windowHistory: {
        replaceState: jest.fn()
      }
    });

    // Wait for the useEffect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_account_created", {
      category: "onboarding"
    });

    // The component should be on the EMAIL_VERIFICATION step after handling fromSignup
    expect(child.mock.calls[child.mock.calls.length - 1][0].currentStep).toBe(OnboardingStepIndex.EMAIL_VERIFICATION);

    // Clean up window object modifications
    cleanup();
  });

  function setup(
    input: {
      paymentMethods?: Array<{ id: string; type: string }>;
      user?: { emailVerified?: boolean; userId?: string };
      wallet?: { hasManagedWallet?: boolean; isWalletLoading?: boolean };
      windowLocation?: Partial<Location>;
      windowHistory?: Partial<History>;
      savedStep?: string;
    } = {}
  ) {
    jest.clearAllMocks();

    // Mock localStorage using jest-mock-extended
    const mockLocalStorage = mock<Storage>({
      getItem: jest.fn().mockReturnValue(input.savedStep || null)
    });

    // Store original window objects
    const originalLocation = window.location;
    const originalHistory = window.history;

    // Mock window.location and history based on input
    if (input.windowLocation) {
      Object.defineProperty(window, "location", {
        value: { ...originalLocation, ...input.windowLocation },
        writable: true
      });
    } else if (!window.location.search) {
      // Set default values if window.location is not already mocked
      Object.defineProperty(window, "location", {
        value: {
          href: "http://localhost/onboarding",
          origin: "http://localhost",
          search: ""
        },
        writable: true
      });
    }

    if (input.windowHistory) {
      Object.defineProperty(window, "history", {
        value: { ...originalHistory, ...input.windowHistory },
        writable: true
      });
    }

    const mockAnalyticsService = mock<AnalyticsService>();
    const mockRouter = mock<Router>();
    const authService = mock<AuthService>();
    const mockConnectManagedWallet = jest.fn();

    const mockUrlService = {
      ...UrlService,
      onboarding: jest.fn(() => "/onboarding"),
      signup: jest.fn(() => "/signup")
    };

    const mockUseUser = jest.fn().mockReturnValue(input.user || { emailVerified: false });
    const mockUsePaymentMethodsQuery = jest.fn().mockReturnValue({ data: input.paymentMethods || [] });
    const mockUseServices = jest.fn().mockReturnValue({
      analyticsService: mockAnalyticsService,
      urlService: mockUrlService,
      authService
    });
    const mockUseRouter = jest.fn().mockReturnValue(mockRouter);
    const mockUseWallet = jest.fn().mockReturnValue({
      hasManagedWallet: input.wallet?.hasManagedWallet || false,
      isWalletLoading: input.wallet?.isWalletLoading || false,
      connectManagedWallet: mockConnectManagedWallet
    });

    // Create dependencies object
    const dependencies = {
      useUser: mockUseUser,
      usePaymentMethodsQuery: mockUsePaymentMethodsQuery,
      useServices: mockUseServices,
      useRouter: mockUseRouter,
      useWallet: mockUseWallet,
      localStorage: mockLocalStorage
    };

    const mockChildren = jest.fn().mockReturnValue(<div>Test</div>);

    render(<OnboardingContainer dependencies={dependencies}>{mockChildren}</OnboardingContainer>);

    // Return cleanup function to restore original window objects
    const cleanup = () => {
      Object.defineProperty(window, "location", {
        value: originalLocation,
        writable: true
      });
      Object.defineProperty(window, "history", {
        value: originalHistory,
        writable: true
      });
    };

    return {
      child: mockChildren,
      mockAnalyticsService,
      mockRouter,
      mockUrlService,
      authService,
      mockUseUser,
      mockUsePaymentMethodsQuery,
      mockUseServices,
      mockUseRouter,
      mockConnectManagedWallet,
      mockLocalStorage,
      cleanup
    };
  }
});
