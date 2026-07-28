import type { NextRouter } from "next/router";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ACCOUNT_CREATED_COOKIE } from "@src/lib/analytics/account-created-cookie";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { DEPENDENCIES } from "./AccountCreatedTracker";
import { AccountCreatedTracker } from "./AccountCreatedTracker";

import { render } from "@testing-library/react";

describe(AccountCreatedTracker.name, () => {
  it("tracks and flushes account_created when the cookie is present, then clears it", () => {
    const { analyticsService } = setup({ hasCookie: true });

    expect(analyticsService.track).toHaveBeenCalledWith("account_created", { category: "user" });
    expect(analyticsService.flush).toHaveBeenCalled();
    expect(document.cookie).not.toContain(`${ACCOUNT_CREATED_COOKIE}=1`);
  });

  it("does nothing when the cookie is absent", () => {
    const { analyticsService } = setup();

    expect(analyticsService.track).not.toHaveBeenCalled();
    expect(analyticsService.flush).not.toHaveBeenCalled();
  });

  it("tracks account_created on a client-side route change when the cookie appears after mount", () => {
    const routeChangeHandlers: Array<() => void> = [];
    const events = mock<NextRouter["events"]>({
      on: vi.fn((event, handler) => {
        if (event === "routeChangeComplete") routeChangeHandlers.push(handler as () => void);
      })
    });
    const { analyticsService } = setup({ router: mock<NextRouter>({ events }) });

    document.cookie = `${ACCOUNT_CREATED_COOKIE}=1`;
    routeChangeHandlers.forEach(handler => handler());

    expect(analyticsService.track).toHaveBeenCalledWith("account_created", { category: "user" });
    expect(analyticsService.flush).toHaveBeenCalled();
  });

  function setup(input: { hasCookie?: boolean; router?: NextRouter } = {}) {
    document.cookie = `${ACCOUNT_CREATED_COOKIE}=; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    if (input.hasCookie) document.cookie = `${ACCOUNT_CREATED_COOKIE}=1`;

    const analyticsService = mock<AnalyticsService>();
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService });
    const router = input.router ?? mock<NextRouter>({ events: mock<NextRouter["events"]>() });
    const useRouter: typeof DEPENDENCIES.useRouter = () => router;

    render(<AccountCreatedTracker dependencies={{ useServices, useRouter }} />);

    return { analyticsService, router };
  }
});
