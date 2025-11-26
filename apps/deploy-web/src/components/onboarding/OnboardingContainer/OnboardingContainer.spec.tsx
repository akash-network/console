import "@testing-library/jest-dom";

import React from "react";
import { act } from "react-dom/test-utils";
import { mock } from "jest-mock-extended";
import type { Router } from "next/router";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { AuthService } from "@src/services/auth/auth/auth.service";
import type { TransactionMessageData } from "@src/utils/TransactionMessageData";
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
    const { child, mockAnalyticsService } = setup({
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
    const mockConnectManagedWallet = jest.fn();
    const mockSignAndBroadcastTx = jest.fn().mockResolvedValue({ transactionHash: "mock-hash" });
    const mockGenNewCertificateIfLocalIsInvalid = jest.fn().mockResolvedValue(null);
    const mockUpdateSelectedCertificate = jest.fn().mockResolvedValue(undefined);

    const mockUrlService = {
      ...UrlService,
      onboarding: jest.fn(() => "/onboarding"),
      signup: jest.fn(() => "/signup"),
      newDeployment: jest.fn(() => "/deployments/new")
    };

    const mockChainApiHttpClient = {
      get: jest.fn()
    };

    const mockDeploymentLocalStorage = {
      update: jest.fn()
    };

    const mockAppConfig = {
      NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT: "5000000"
    };

    const mockUseUser = jest.fn().mockReturnValue(input.user || { emailVerified: false });
    const mockUsePaymentMethodsQuery = jest.fn().mockReturnValue({ data: input.paymentMethods || [] });
    const mockUseDepositParams = jest.fn().mockReturnValue({ data: undefined });
    const mockErrorHandler = {
      reportError: jest.fn()
    };

    const mockUseServices = jest.fn().mockReturnValue({
      analyticsService: mockAnalyticsService,
      urlService: mockUrlService,
      authService,
      chainApiHttpClient: mockChainApiHttpClient,
      deploymentLocalStorage: mockDeploymentLocalStorage,
      appConfig: mockAppConfig,
      errorHandler: mockErrorHandler,
      windowLocation,
      windowHistory
    });
    const mockUseRouter = jest.fn().mockReturnValue(mockRouter);
    const mockUseWallet = jest.fn().mockReturnValue({
      hasManagedWallet: input.wallet?.hasManagedWallet || false,
      isWalletLoading: input.wallet?.isWalletLoading || false,
      connectManagedWallet: mockConnectManagedWallet,
      address: "akash1test",
      signAndBroadcastTx: mockSignAndBroadcastTx
    });
    const mockUseTemplates = jest.fn().mockReturnValue({ templates: [] });
    const mockUseCertificate = jest.fn().mockReturnValue({
      genNewCertificateIfLocalIsInvalid: mockGenNewCertificateIfLocalIsInvalid,
      updateSelectedCertificate: mockUpdateSelectedCertificate
    });
    const mockUseSnackbar = jest.fn().mockReturnValue({
      enqueueSnackbar: jest.fn()
    });

    const mockNewDeploymentData = jest.fn().mockResolvedValue({
      deploymentId: { dseq: "123" },
      hash: "mock-hash"
    });

    const mockDeploymentData = {
      NewDeploymentData: mockNewDeploymentData,
      getManifest: jest.fn(),
      getManifestVersion: jest.fn(),
      appendTrialAttribute: jest.fn(),
      appendAuditorRequirement: jest.fn(sdl => sdl),
      ENDPOINT_NAME_VALIDATION_REGEX: /^[a-z]+[-_\da-z]+$/,
      TRIAL_ATTRIBUTE: "console/trials" as const,
      TRIAL_REGISTERED_ATTRIBUTE: "console/trials-registered" as const,
      AUDITOR: "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63" as const,
      MANAGED_WALLET_ALLOWED_AUDITORS: ["akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63" as const]
    };

    const mockValidateDeploymentData = jest.fn();
    const mockAppendAuditorRequirement = jest.fn(sdl => sdl);
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
      getRevokeCertificateMsg: jest.fn(),
      getCreateCertificateMsg: jest.fn(),
      getCreateLeaseMsg: jest.fn(),
      getCreateDeploymentMsg: jest.fn(),
      getUpdateDeploymentMsg: jest.fn(),
      getDepositDeploymentMsg: jest.fn(),
      getCloseDeploymentMsg: jest.fn(),
      getSendTokensMsg: jest.fn(),
      getGrantMsg: jest.fn(),
      getRevokeDepositMsg: jest.fn(),
      getGrantBasicAllowanceMsg: jest.fn(),
      getRevokeAllowanceMsg: jest.fn(),
      getUpdateProviderMsg: jest.fn()
    };

    // Create dependencies object
    const dependencies = {
      useUser: mockUseUser,
      usePaymentMethodsQuery: mockUsePaymentMethodsQuery,
      useDepositParams: mockUseDepositParams,
      useServices: mockUseServices,
      useRouter: mockUseRouter,
      useWallet: mockUseWallet,
      useTemplates: mockUseTemplates,
      useCertificate: mockUseCertificate,
      useSnackbar: mockUseSnackbar,
      localStorage: mockLocalStorage,
      deploymentData: mockDeploymentData,
      validateDeploymentData: mockValidateDeploymentData,
      appendAuditorRequirement: mockAppendAuditorRequirement,
      helloWorldTemplate: mockHelloWorldTemplate,
      TransactionMessageData: mockTransactionMessageData as unknown as typeof TransactionMessageData,
      UrlService
    };

    const mockChildren = jest.fn().mockReturnValue(<div>Test</div>);

    render(<OnboardingContainer dependencies={dependencies}>{mockChildren}</OnboardingContainer>);

    return {
      child: mockChildren,
      mockAnalyticsService,
      mockRouter,
      mockUrlService,
      authService,
      mockUseUser,
      mockUsePaymentMethodsQuery,
      mockUseDepositParams,
      mockUseServices,
      mockUseRouter,
      mockConnectManagedWallet,
      mockLocalStorage,
      mockSignAndBroadcastTx,
      mockGenNewCertificateIfLocalIsInvalid,
      mockUpdateSelectedCertificate,
      mockChainApiHttpClient,
      mockDeploymentLocalStorage,
      mockNewDeploymentData,
      mockValidateDeploymentData,
      mockAppendAuditorRequirement,
      mockTransactionMessageData
    };
  }
});
