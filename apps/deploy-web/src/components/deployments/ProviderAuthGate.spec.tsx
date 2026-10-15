import type { JwtTokenAccessScope } from "@akashnetwork/chain-sdk/web";
import { describe, expect, it } from "vitest";

import type { ProviderTokenMode } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import { ORGANIZATION_UNAVAILABLE_MESSAGE, ProviderAuthFallback } from "./ProviderAuthGate";

import { render, screen } from "@testing-library/react";

const ERROR_TITLE = "Could not authorize with the provider";

const VIEW_ONLY_MESSAGE = "Logs aren't available for view-only access yet.";

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

  it("tells view-only access why there is nothing to show instead of an error or a skeleton", () => {
    setup({ hasAccess: false, error: new Error("boom"), tokenMode: "view-only" });

    expect(screen.getByText(VIEW_ONLY_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(ERROR_TITLE)).not.toBeInTheDocument();
  });

  it("asks for a reload when the organization could not be loaded", () => {
    setup({ hasAccess: false, error: null, tokenMode: "organization-unavailable" });

    expect(screen.getByText(ORGANIZATION_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(VIEW_ONLY_MESSAGE)).not.toBeInTheDocument();
  });

  it.each(["shared", "per-deployment", "read-only", "pending"] as const)("keeps the usual fallback for logs while tokens are %s", tokenMode => {
    setup({ hasAccess: false, error: new Error("boom"), tokenMode });

    expect(screen.getByText(ERROR_TITLE)).toBeInTheDocument();
    expect(screen.queryByText(VIEW_ONLY_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByText(ORGANIZATION_UNAVAILABLE_MESSAGE)).not.toBeInTheDocument();
  });

  it("tells access that only reads leases why there is no shell", () => {
    setup({ hasAccess: true, error: null, tokenMode: "read-only", scope: ["shell"] });

    expect(screen.getByText(VIEW_ONLY_MESSAGE)).toBeInTheDocument();
  });

  function setup(input: { hasAccess: boolean; error: Error | null; tokenMode?: ProviderTokenMode; scope?: JwtTokenAccessScope[] }) {
    return render(
      <ProviderAuthFallback
        hasAccess={input.hasAccess}
        error={input.error}
        tokenMode={input.tokenMode ?? "shared"}
        scope={input.scope ?? ["logs", "events"]}
        viewOnlyMessage={VIEW_ONLY_MESSAGE}
      />
    );
  }
});
