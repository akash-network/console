import React, { useState } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import type { Router } from "next/router";
import { describe, expect, it, type Mock, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { AuthService } from "@src/services/auth/auth/auth.service";
import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import type { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { UrlService } from "@src/utils/urlUtils";
import { OnboardingContainer, OnboardingStepIndex } from "./OnboardingContainer";

import { act, render } from "@testing-library/react";

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
    const { child, mockAnalyticsService, mockRouter, mockUrlService } = setup();
    (mockUrlService.newSignup as Mock).mockReturnValue("/login?tab=signup");

    const { onStartTrial } = child.mock.calls[0][0];
    await act(async () => {
      onStartTrial();
    });

    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_free_trial_started", {
      category: "onboarding"
    });
    expect(mockUrlService.newSignup).toHaveBeenCalledWith({ fromSignup: "true" });
    expect(mockRouter.push).toHaveBeenCalledWith("/login?tab=signup");
  });

  it("should track analytics when payment method is completed", async () => {
    const { child, mockAnalyticsService } = setup({
      paymentMethods: [{ id: "1", type: "card" }]
    });

    const { onPaymentMethodComplete } = child.mock.calls[0][0];
    const initialStep = child.mock.calls[0][0].currentStep;

    await act(async () => {
      onPaymentMethodComplete();
    });

    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_payment_method_added", {
      category: "onboarding"
    });

    const currentStep = child.mock.calls[child.mock.calls.length - 1][0].currentStep;
    expect(currentStep).toBe(initialStep);
  });

  it("should redirect to deployment and connect managed wallet when onboarding is completed", async () => {
    const { child, mockRouter, mockConnectManagedWallet } = setup();

    const { onComplete } = child.mock.calls[0][0];
    await act(async () => {
      await onComplete("hello-akash");
    });

    expect(mockRouter.push).toHaveBeenCalled();
    expect(mockConnectManagedWallet).toHaveBeenCalled();
  });

  it("should redirect to home when user has managed wallet and no saved step", async () => {
    const { mockNavigateBack } = setup({
      wallet: { hasManagedWallet: true, isWalletLoading: false }
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(mockNavigateBack).toHaveBeenCalled();
  });

  it("should not redirect when user has managed wallet but has saved step", async () => {
    const { mockRouter } = setup({
      wallet: { hasManagedWallet: true, isWalletLoading: false },
      savedStep: "2"
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("should handle fromSignup URL parameter", async () => {
    const { child, mockAnalyticsService } = setup({
      windowLocation: {
        search: "?fromSignup=true",
        href: "http://localhost/onboarding?fromSignup=true",
        origin: "http://localhost"
      },
      windowHistory: {
        replaceState: vi.fn()
      }
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_account_created", {
      category: "onboarding"
    });

    // The component should be on the EMAIL_VERIFICATION step after handling fromSignup
    expect(child.mock.calls[child.mock.calls.length - 1][0].currentStep).toBe(OnboardingStepIndex.EMAIL_VERIFICATION);
  });

  it("replaces uakt with managed denom when completing onboarding", async () => {
    const { child, mockUseManagedWalletDenom, mockNewDeploymentData } = setup();

    mockUseManagedWalletDenom.mockReturnValue("ibc/usdc");

    const { onComplete } = child.mock.calls[0][0];
    await act(async () => {
      await onComplete("hello-akash");
    });

    const sdlArgument = mockNewDeploymentData.mock.calls[0][1];
    expect(sdlArgument).not.toContain("uakt");
    expect(mockUseManagedWalletDenom).toHaveBeenCalled();
  });

  it("does not replace uakt when managed denom is uakt", async () => {
    const { child, mockUseManagedWalletDenom, mockNewDeploymentData } = setup();

    mockUseManagedWalletDenom.mockReturnValue("uakt");

    const { onComplete } = child.mock.calls[0][0];
    await act(async () => {
      await onComplete("hello-akash");
    });

    const sdlArgument = mockNewDeploymentData.mock.calls[0][1];
    expect(sdlArgument).toBe("mock-sdl-content");
    expect(mockUseManagedWalletDenom).toHaveBeenCalled();
  });

  it("does not corrupt SDL when managed denom is undefined", async () => {
    const { child, mockUseManagedWalletDenom, mockNewDeploymentData } = setup();

    mockUseManagedWalletDenom.mockReturnValue(undefined);

    const { onComplete } = child.mock.calls[0][0];
    await act(async () => {
      await onComplete("hello-akash");
    });

    const sdlArgument = mockNewDeploymentData.mock.calls[0][1];
    expect(sdlArgument).toBe("mock-sdl-content");
    expect(sdlArgument).not.toContain("undefined");
    expect(mockUseManagedWalletDenom).toHaveBeenCalled();
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
    vi.clearAllMocks();

    // Mock localStorage using jest-mock-extended
    const mockLocalStorage = mock<Storage>({
      getItem: vi.fn().mockReturnValue(input.savedStep || null)
    });

    // Store original window objects
    let windowLocation = window.location;
    let windowHistory = window.history;

    // Mock window.location and history based on input
    if (input.windowLocation) {
      windowLocation = { ...windowLocation, ...input.windowLocation };
    } else if (!window.location.search) {
      // Set default values if window.location is not already mocked
      windowLocation = {
        ...windowLocation,
        href: "http://localhost/onboarding",
        origin: "http://localhost",
        search: ""
      };
    }

    if (input.windowHistory) {
      windowHistory = { ...windowHistory, ...input.windowHistory };
    }

    const mockAnalyticsService = mock<AnalyticsService>();
    const mockRouter = mock<Router>();
    const authService = mock<AuthService>();
    const mockConnectManagedWallet = vi.fn();
    const mockSignAndBroadcastTx = vi.fn().mockResolvedValue({ transactionHash: "mock-hash" });
    const mockGenNewCertificateIfLocalIsInvalid = vi.fn().mockResolvedValue(null);
    const mockUpdateSelectedCertificate = vi.fn().mockResolvedValue(undefined);

    const mockUrlService = {
      ...UrlService,
      onboarding: vi.fn(() => "/onboarding"),
      signup: vi.fn(() => "/signup"),
      newSignup: vi.fn(() => "/login?tab=signup"),
      newDeployment: vi.fn(() => "/deployments/new")
    };

    const mockChainApiHttpClient = {
      get: vi.fn()
    };

    const mockDeploymentLocalStorage = {
      update: vi.fn()
    };

    const mockAppConfig = {
      NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT: "5000000"
    };

    const mockUseUser = vi.fn().mockReturnValue(input.user || { emailVerified: false });
    const mockUsePaymentMethodsQuery = vi.fn().mockReturnValue({ data: input.paymentMethods || [] });
    const mockUseChainParam = vi.fn().mockReturnValue({ minDeposit: { akt: 0.5, usdc: 5 } });
    const mockDenomToUdenom = vi.fn().mockImplementation((amount: number) => amount * 1_000_000);
    const mockErrorHandler = mock<ErrorHandlerService>();
    const mockTemplateService = {
      findById: vi.fn().mockResolvedValue({ deploy: "mock-template-sdl" })
    };

    const mockUseServices = vi.fn().mockReturnValue({
      analyticsService: mockAnalyticsService,
      urlService: mockUrlService,
      authService,
      chainApiHttpClient: mockChainApiHttpClient,
      deploymentLocalStorage: mockDeploymentLocalStorage,
      publicConfig: mockAppConfig,
      errorHandler: mockErrorHandler,
      windowLocation,
      windowHistory,
      template: mockTemplateService
    });
    const mockUseRouter = vi.fn().mockReturnValue(mockRouter);
    const mockUseWallet = vi.fn().mockReturnValue({
      hasManagedWallet: input.wallet?.hasManagedWallet || false,
      isWalletLoading: input.wallet?.isWalletLoading || false,
      connectManagedWallet: mockConnectManagedWallet,
      address: "akash1test",
      signAndBroadcastTx: mockSignAndBroadcastTx
    });
    const mockUseCertificate = vi.fn().mockReturnValue({
      genNewCertificateIfLocalIsInvalid: mockGenNewCertificateIfLocalIsInvalid,
      updateSelectedCertificate: mockUpdateSelectedCertificate
    });
    const mockUseSnackbar = vi.fn().mockReturnValue({
      enqueueSnackbar: vi.fn()
    });
    const mockNotificator = { success: vi.fn(), error: vi.fn() };
    const mockUseNotificator = vi.fn().mockReturnValue(mockNotificator);
    const mockUseManagedWalletDenom = vi.fn().mockReturnValue("uakt");

    const mockNavigateBack = vi.fn();
    const mockNavigateWithReturnTo = vi.fn();
    const mockUseReturnTo = vi.fn().mockReturnValue({
      returnTo: "/",
      navigateWithReturnTo: mockNavigateWithReturnTo,
      navigateBack: mockNavigateBack,
      hasReturnTo: true,
      isDeploymentReturnTo: false
    });

    const params = new URLSearchParams();
    if (input.windowLocation?.search) {
      const searchParams = new URLSearchParams(input.windowLocation.search.replace("?", ""));
      searchParams.forEach((value, key) => {
        params.set(key, value);
      });
    }
    const useSearchParams = () => {
      const [pageParams] = useState(params);
      return pageParams as ReadonlyURLSearchParams;
    };

    const mockNewDeploymentData = vi.fn().mockResolvedValue({
      deploymentId: { dseq: "123" },
      hash: "mock-hash"
    });

    const mockDeploymentData = {
      NewDeploymentData: mockNewDeploymentData,
      getManifest: vi.fn(),
      getManifestVersion: vi.fn(),
      appendTrialAttribute: vi.fn(),
      appendAuditorRequirement: vi.fn(sdl => sdl),
      ENDPOINT_NAME_VALIDATION_REGEX: /^[a-z]+[-_\da-z]+$/,
      TRIAL_ATTRIBUTE: "console/trials" as const,
      TRIAL_REGISTERED_ATTRIBUTE: "console/trials-registered" as const,
      AUDITOR: "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63" as const,
      MANAGED_WALLET_ALLOWED_AUDITORS: ["akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63" as const]
    };

    const mockValidateDeploymentData = vi.fn();
    const mockAppendAuditorRequirement = vi.fn(sdl => sdl);
    const mockHelloWorldTemplate = {
      title: "Hello World",
      name: "Hello World",
      code: "hello-world",
      category: "General",
      description: "Simple next.js web application showing hello world.",
      githubUrl: "https://github.com/akash-network/hello-akash-world",
      valuesToChange: [],
      content: "mock-sdl-content"
    };
    const mockTransactionMessageData = {
      prototype: {},
      getRevokeCertificateMsg: vi.fn(),
      getCreateCertificateMsg: vi.fn(),
      getCreateLeaseMsg: vi.fn(),
      getCreateDeploymentMsg: vi.fn(),
      getUpdateDeploymentMsg: vi.fn(),
      getDepositDeploymentMsg: vi.fn(),
      getCloseDeploymentMsg: vi.fn(),
      getSendTokensMsg: vi.fn(),
      getGrantMsg: vi.fn(),
      getRevokeDepositMsg: vi.fn(),
      getGrantBasicAllowanceMsg: vi.fn(),
      getRevokeAllowanceMsg: vi.fn(),
      getUpdateProviderMsg: vi.fn()
    };

    // Create dependencies object
    const dependencies = {
      useUser: mockUseUser,
      usePaymentMethodsQuery: mockUsePaymentMethodsQuery,
      useChainParam: mockUseChainParam,
      useServices: mockUseServices,
      useRouter: mockUseRouter,
      useWallet: mockUseWallet,
      useCertificate: mockUseCertificate,
      useSnackbar: mockUseSnackbar,
      useNotificator: mockUseNotificator,
      useManagedWalletDenom: mockUseManagedWalletDenom,
      useReturnTo: mockUseReturnTo,
      localStorage: mockLocalStorage,
      deploymentData: mockDeploymentData,
      validateDeploymentData: mockValidateDeploymentData,
      appendAuditorRequirement: mockAppendAuditorRequirement,
      helloWorldTemplate: mockHelloWorldTemplate,
      TransactionMessageData: mockTransactionMessageData as unknown as typeof TransactionMessageData,
      useSearchParams,
      denomToUdenom: mockDenomToUdenom
    };

    const mockChildren = vi.fn().mockReturnValue(<div>Test</div>);

    render(<OnboardingContainer dependencies={dependencies}>{mockChildren}</OnboardingContainer>);

    return {
      child: mockChildren,
      mockAnalyticsService,
      mockRouter,
      mockUrlService,
      authService,
      mockUseUser,
      mockUsePaymentMethodsQuery,
      mockUseChainParam,
      mockDenomToUdenom,
      mockUseServices,
      mockUseRouter,
      mockConnectManagedWallet,
      mockNavigateBack,
      mockNavigateWithReturnTo,
      mockLocalStorage,
      mockSignAndBroadcastTx,
      mockGenNewCertificateIfLocalIsInvalid,
      mockUpdateSelectedCertificate,
      mockChainApiHttpClient,
      mockDeploymentLocalStorage,
      mockNewDeploymentData,
      mockValidateDeploymentData,
      mockAppendAuditorRequirement,
      mockTransactionMessageData,
      mockUseManagedWalletDenom
    };
  }
});
