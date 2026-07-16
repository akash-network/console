import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { LoadingButton } from "./loading-button";

import { render, screen } from "@testing-library/react";

describe(LoadingButton.name, () => {
  it("renders its label", () => {
    setup({ children: "Redeem coupon" });

    expect(screen.getByRole("button", { name: /redeem coupon/i })).toBeInTheDocument();
  });

  it("shows an accessible loading indicator while loading", () => {
    setup({ loading: true });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows no loading indicator when not loading", () => {
    setup({ loading: false });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders a provided loadingIndicator instead of the default spinner", () => {
    setup({ loading: true, loadingIndicator: <span>custom-indicator</span> });

    expect(screen.getByText("custom-indicator")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("disables the button while loading even without an explicit disabled prop", () => {
    setup({ loading: true });

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("stays disabled while loading even when disabled is explicitly false", () => {
    // Guards against the spread clobbering the combined disabled: a caller that moves its
    // in-flight flag into `loading` (leaving disabled false) must still block clicks.
    setup({ loading: true, disabled: false });

    expect(screen.getByRole("button")).toBeDisabled();
  });

  function setup(input: { children?: ReactNode; loading?: boolean; loadingIndicator?: ReactNode; disabled?: boolean } = {}) {
    const { children = "Submit", ...buttonProps } = input;
    render(<LoadingButton {...buttonProps}>{children}</LoadingButton>);
    return input;
  }
});
