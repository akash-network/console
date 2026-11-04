import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { ApiKeySetup, DEPENDENCIES } from "./ApiKeySetup";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

type GuideProps = Parameters<typeof DEPENDENCIES.ApiKeyUsageGuide>[0];

const SECRET = "ac.sk.staging.0123456789abcdef";

describe(ApiKeySetup.name, () => {
  it("offers creating a key before one exists", async () => {
    const { user, onCreate } = setup({});

    expect(screen.getByText("Shown once, then filled into the commands below.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create key" }));

    expect(onCreate).toHaveBeenCalled();
    expect(screen.queryByLabelText("API key secret")).not.toBeInTheDocument();
  });

  it("waits for the trial project before the key can be created", () => {
    setup({ isLoadingTrialProject: true });

    expect(screen.getByRole("button", { name: "Create key" })).toBeDisabled();
  });

  it("keeps the create button busy while the key is being created", () => {
    setup({ isCreating: true });

    expect(screen.getByRole("button", { name: /Create key/ })).toBeDisabled();
  });

  it("leaves the key out of the commands before one exists", () => {
    const { ApiKeyUsageGuide } = setup({});

    expect(lastGuideProps(ApiKeyUsageGuide)).toMatchObject({ title: "Pick how you'll use it", apiKey: undefined });
  });

  it("shows the new key once with its name and expiry, and replaces the create button", () => {
    setup({ createdApiKey: createdApiKey({ expiresAt: "2027-11-03T12:00:00.000Z" }) });

    expect(screen.getByLabelText("API key secret")).toHaveTextContent(SECRET);
    expect(screen.getByText("Copy it now. It isn't shown again once you leave this page.")).toBeInTheDocument();
    expect(screen.getByText("“My first key” · Expires Nov 3, 2027")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create key" })).not.toBeInTheDocument();
  });

  it("names a key that never expires without an expiry", () => {
    setup({ createdApiKey: createdApiKey({ expiresAt: null }) });

    expect(screen.getByText("“My first key”")).toBeInTheDocument();
  });

  it("fills the new key into the commands", () => {
    const { ApiKeyUsageGuide } = setup({ createdApiKey: createdApiKey({}) });

    expect(lastGuideProps(ApiKeyUsageGuide).apiKey).toBe(SECRET);
  });

  it("copies the new key", async () => {
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const { user, enqueueSnackbar } = setup({ createdApiKey: createdApiKey({}) });

    await user.click(screen.getByRole("button", { name: "Copy to clipboard" }));

    expect(writeText).toHaveBeenCalledWith(SECRET);
    await vi.waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Key copied to clipboard" }) }), {
        variant: "success",
        autoHideDuration: 1500
      })
    );
  });

  it.each([
    { createdApiKey: createdApiKey({}), hasApiKey: true },
    { createdApiKey: undefined, hasApiKey: false }
  ])("tracks which tab's setup got copied (has key: $hasApiKey)", ({ createdApiKey, hasApiKey }) => {
    const { ApiKeyUsageGuide, analyticsService } = setup({ createdApiKey });

    act(() => lastGuideProps(ApiKeyUsageGuide).onCommandCopied!("akt"));

    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_setup_copied", { category: "onboarding", tab: "akt", hasApiKey });
  });

  function createdApiKey(input: Partial<ApiKeyResponse>): ApiKeyResponse {
    return {
      id: "6f1e4c8a-3a0b-4c55-9d1e-2f7a1b9c0d11",
      name: "My first key",
      expiresAt: "2027-11-03T12:00:00.000Z",
      createdAt: "2026-11-03T12:00:00.000Z",
      updatedAt: "2026-11-03T12:00:00.000Z",
      lastUsedAt: null,
      keyFormat: "ac.sk.staging.012345***abcdef",
      apiKey: SECRET,
      ...input
    };
  }

  function lastGuideProps(ApiKeyUsageGuide: ReturnType<typeof vi.fn>) {
    return ApiKeyUsageGuide.mock.calls.at(-1)![0] as GuideProps;
  }

  function setup(input: { createdApiKey?: ApiKeyResponse; isCreating?: boolean; isLoadingTrialProject?: boolean }) {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const enqueueSnackbar = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const ApiKeyUsageGuide = vi.fn(ComponentMock);
    const dependencies = MockComponents(DEPENDENCIES, {
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      ApiKeyUsageGuide
    });

    render(
      <ApiKeySetup
        createdApiKey={input.createdApiKey}
        isCreating={input.isCreating ?? false}
        isLoadingTrialProject={input.isLoadingTrialProject ?? false}
        onCreate={onCreate}
        dependencies={dependencies}
      />
    );

    return { user, onCreate, enqueueSnackbar, analyticsService, ApiKeyUsageGuide };
  }
});
