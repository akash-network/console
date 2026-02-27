import type { ComponentProps } from "react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { VerifyEmailPage } from "./VerifyEmailPage";

import { render, screen } from "@testing-library/react";

describe(VerifyEmailPage.name, () => {
  it("shows redirect loading text", () => {
    const { restore } = setup();

    expect(screen.queryByText("Redirecting to email verification...")).toBeInTheDocument();
    restore();
  });

  it("sets onboarding step to EMAIL_VERIFICATION in localStorage", () => {
    const { mockLocalStorage, restore } = setup();

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith("onboardingStep", "2");
    restore();
  });

  it("redirects to onboarding page", () => {
    const { getLocationHref, restore } = setup();

    expect(getLocationHref()).toBe("/signup?return-to=%2F");
    restore();
  });

  function setup(input: { onboardingUrl?: string } = {}) {
    const originalLocalStorage = window.localStorage;
    const originalLocation = window.location;

    const mockLocalStorage = {
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn()
    };
    Object.defineProperty(window, "localStorage", { value: mockLocalStorage, writable: true, configurable: true });

    let capturedHref = "";
    Object.defineProperty(window, "location", {
      value: {
        get href() {
          return capturedHref;
        },
        set href(val: string) {
          capturedHref = val;
        }
      },
      writable: true,
      configurable: true
    });

    const dependencies = {
      Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Loading: ({ text }: { text: string }) => <div>{text}</div>,
      UrlService: {
        onboarding: vi.fn(() => input.onboardingUrl ?? "/signup?return-to=%2F")
      }
    } as unknown as ComponentProps<typeof VerifyEmailPage>["dependencies"];

    render(<VerifyEmailPage dependencies={dependencies} />);

    return {
      mockLocalStorage,
      getLocationHref: () => capturedHref,
      restore: () => {
        Object.defineProperty(window, "localStorage", { value: originalLocalStorage, writable: true, configurable: true });
        Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
      }
    };
  }
});
