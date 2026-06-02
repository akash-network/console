import { describe, expect, it } from "vitest";

import { ProviderAuthFallback } from "./ProviderAuthGate";

import { render, screen } from "@testing-library/react";

const ERROR_TITLE = "Could not authorize with the provider";

describe(ProviderAuthFallback.name, () => {
  it("renders nothing when access is granted and no error is present", () => {
    const { container } = setup({ hasAccess: true, error: null });

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the skeleton while access is pending and no error is present", () => {
    const { container } = setup({ hasAccess: false, error: null });

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.queryByText(ERROR_TITLE)).not.toBeInTheDocument();
  });

  it("renders the error alert when credentials report an error", () => {
    setup({ hasAccess: false, error: new Error("boom") });

    expect(screen.queryByText(ERROR_TITLE)).toBeInTheDocument();
  });

  it("renders the error alert even when access was previously granted", () => {
    setup({ hasAccess: true, error: new Error("boom") });

    expect(screen.queryByText(ERROR_TITLE)).toBeInTheDocument();
  });

  function setup(input: { hasAccess: boolean; error: Error | null }) {
    return render(<ProviderAuthFallback hasAccess={input.hasAccess} error={input.error} />);
  }
});
