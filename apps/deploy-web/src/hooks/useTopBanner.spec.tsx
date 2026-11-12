import { createStore, Provider as JotaiProvider } from "jotai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput } from "@src/types/organization";
import type { AccountStatus } from "@src/types/user";
import { type DEPENDENCIES, isSafeLink, useGenericBannerVisibility, useTopBanner } from "./useTopBanner";

import { act, renderHook } from "@testing-library/react";

const DISMISSED_KEY_PREFIX = "generic_banner_dismissed:";
const NO_BANNER = {
  hasBanner: false,
  hasTrialRefusedBanner: false,
  hasAccountStatusBanner: false,
  isBlockchainDown: false,
  hasTeamPaymentMethodBanner: false,
  hasFundingBanner: false,
  isMaintenanceBannerOpen: false,
  isGenericBannerOpen: false
};

describe("useGenericBannerVisibility", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("opens the banner when the flag is enabled and not dismissed", async () => {
    const { result } = await setup({ isFlagEnabled: true, dismissId: "console-air" });
    expect(result.current[0]).toBe(true);
  });

  it("does not open the banner when the flag is disabled", async () => {
    const { result } = await setup({ isFlagEnabled: false, dismissId: "console-air" });
    expect(result.current[0]).toBe(false);
  });

  it("keeps the banner closed when the dismissId is already persisted", async () => {
    window.localStorage.setItem(DISMISSED_KEY_PREFIX + "console-air", "true");
    const { result } = await setup({ isFlagEnabled: true, dismissId: "console-air" });
    expect(result.current[0]).toBe(false);
  });

  it("persists dismiss to localStorage when closed with a dismissId", async () => {
    const { result } = await setup({ isFlagEnabled: true, dismissId: "console-air" });
    expect(result.current[0]).toBe(true);

    await act(async () => {
      result.current[1](false);
    });

    expect(result.current[0]).toBe(false);
    expect(window.localStorage.getItem(DISMISSED_KEY_PREFIX + "console-air")).toBe("true");
  });

  it("does not write to localStorage when dismissed without a dismissId", async () => {
    const { result } = await setup({ isFlagEnabled: true, dismissId: undefined });

    await act(async () => {
      result.current[1](false);
    });

    expect(result.current[0]).toBe(false);
    expect(window.localStorage.length).toBe(0);
  });

  it("re-opens the banner when the dismissId changes (new announcement)", async () => {
    window.localStorage.setItem(DISMISSED_KEY_PREFIX + "old", "true");
    const { result, rerender } = await setup({ isFlagEnabled: true, dismissId: "old" });
    expect(result.current[0]).toBe(false);

    await act(async () => {
      rerender({ isFlagEnabled: true, dismissId: "new" });
    });

    expect(result.current[0]).toBe(true);
  });

  async function setup(initialProps: { isFlagEnabled: boolean; dismissId: string | undefined }) {
    const store = createStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => <JotaiProvider store={store}>{children}</JotaiProvider>;

    const result = renderHook((props: { isFlagEnabled: boolean; dismissId: string | undefined }) => useGenericBannerVisibility(props), {
      wrapper,
      initialProps
    });
    await act(async () => {});
    return result;
  }
});

describe(useTopBanner.name, () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("has no banner when nothing calls for one", async () => {
    const { result } = await setup({});

    expect(result.current).toMatchObject(NO_BANNER);
  });

  it.each([
    ["a refused free trial", { hasTrialRefusedBanner: true }, "hasTrialRefusedBanner"],
    ["an account that is not active", { accountStatus: "suspended" }, "hasAccountStatusBanner"],
    ["a chain that is down", { isBlockchainDown: true }, "isBlockchainDown"],
    ["a team without a payment method", { hasTeamWithoutPaymentMethod: true }, "hasTeamPaymentMethodBanner"],
    ["an account that needs funds", { hasFundingBanner: true }, "hasFundingBanner"],
    ["scheduled maintenance", { isMaintenanceFlagEnabled: true }, "isMaintenanceBannerOpen"],
    ["an announcement", { isAnnouncementFlagEnabled: true }, "isGenericBannerOpen"]
  ] as const)("has only the banner for %s", async (_, input, banner) => {
    const { result } = await setup(input);

    expect(result.current).toMatchObject({ ...NO_BANNER, hasBanner: true, [banner]: true });
  });

  it("has no banner for an announcement the user already dismissed", async () => {
    window.localStorage.setItem(DISMISSED_KEY_PREFIX + "dismissed-announcement", "true");

    const { result } = await setup({ isAnnouncementFlagEnabled: true, announcementDismissId: "dismissed-announcement" });

    expect(result.current).toMatchObject(NO_BANNER);
  });

  async function setup(input: {
    hasTrialRefusedBanner?: boolean;
    accountStatus?: AccountStatus;
    isBlockchainDown?: boolean;
    hasTeamWithoutPaymentMethod?: boolean;
    hasFundingBanner?: boolean;
    isMaintenanceFlagEnabled?: boolean;
    isAnnouncementFlagEnabled?: boolean;
    announcementDismissId?: string;
  }) {
    const enabledFlags: Record<string, boolean> = {
      maintenance_banner: !!input.isMaintenanceFlagEnabled,
      generic_banner: !!input.isAnnouncementFlagEnabled
    };
    const dependencies: typeof DEPENDENCIES = {
      useVariant: flagName => mock<ReturnType<typeof DEPENDENCIES.useVariant>>({ enabled: enabledFlags[flagName] }),
      useBlockchainStatus: () => mock<ReturnType<typeof DEPENDENCIES.useBlockchainStatus>>({ isBlockchainDown: !!input.isBlockchainDown }),
      useTeamWithoutPaymentMethod: () => (input.hasTeamWithoutPaymentMethod ? mock<OrganizationOutput>() : undefined),
      useHasFundingBanner: () => !!input.hasFundingBanner,
      useAccountStatus: () => mock<ReturnType<typeof DEPENDENCIES.useAccountStatus>>({ status: input.accountStatus ?? "active" }),
      useHasTrialRefusedBanner: () => !!input.hasTrialRefusedBanner,
      useGenericBannerDetails: () => ({ message: "", dismissId: input.announcementDismissId })
    };
    const store = createStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => <JotaiProvider store={store}>{children}</JotaiProvider>;

    const rendered = renderHook(() => useTopBanner(dependencies), { wrapper });
    await act(async () => {});
    return rendered;
  }
});

describe(isSafeLink.name, () => {
  it.each([
    ["https://akash.network", true],
    ["http://akash.network", true],
    ["javascript:alert(1)", false],
    ["data:text/html,<script>alert(1)</script>", false],
    ["file:///etc/passwd", false],
    ["not a url", false],
    ["", false]
  ])("returns %s for href %s", (href, expected) => {
    expect(isSafeLink({ label: "Learn more", href })).toBe(expected);
  });

  it("rejects entries with non-string label or href", () => {
    expect(isSafeLink({ label: 1, href: "https://akash.network" })).toBe(false);
    expect(isSafeLink({ label: "Learn more", href: 1 })).toBe(false);
    expect(isSafeLink(null)).toBe(false);
    expect(isSafeLink(undefined)).toBe(false);
    expect(isSafeLink("https://akash.network")).toBe(false);
  });
});
