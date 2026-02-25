import type { ComponentProps } from "react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { VerifyEmailPage } from "./VerifyEmailPage";

import { render, screen } from "@testing-library/react";

describe(VerifyEmailPage.name, () => {
  it("shows redirect loading text", () => {
    setup();

    expect(screen.queryByText("Redirecting to email verification...")).toBeInTheDocument();
  });

  it("sets onboarding step to EMAIL_VERIFICATION in localStorage", () => {
    const { mockLocalStorage } = setup();

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith("onboardingStep", "2");
  });

  it("redirects to onboarding page", () => {
    const { mockLocationAssign } = setup();

    expect(mockLocationAssign).toBe("/signup?return-to=%2F");
  });

  function setup() {
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
        onboarding: vi.fn(() => "/signup?return-to=%2F")
      }
    } as unknown as ComponentProps<typeof VerifyEmailPage>["dependencies"];

    render(<VerifyEmailPage dependencies={dependencies} />);

    return { mockLocalStorage, mockLocationAssign: capturedHref };
  }
});
