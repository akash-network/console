import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import Layout, { DEPENDENCIES } from "./Layout";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe("Layout", () => {
  it("reserves the loading indicator space when no isLoading prop is provided", () => {
    const { dependencies } = setup({});

    expect(dependencies.LinearLoadingSkeleton).toHaveBeenCalledWith(expect.objectContaining({ isLoading: false }), expect.anything());
  });

  it("shows the loading indicator when isLoading is true", () => {
    const { dependencies } = setup({ isLoading: true });

    expect(dependencies.LinearLoadingSkeleton).toHaveBeenCalledWith(expect.objectContaining({ isLoading: true }), expect.anything());
  });

  it("renders children", () => {
    setup({ children: <div>page content</div> });

    expect(screen.getByText("page content")).toBeInTheDocument();
  });

  function setup(input: { isLoading?: boolean; children?: ReactNode }) {
    const dependencies = MockComponents(DEPENDENCIES, {
      useFlag: () => false,
      useOnboardingChrome: () => mock<ReturnType<typeof DEPENDENCIES.useOnboardingChrome>>({ isStripped: false }),
      useSettings: () => mock<ReturnType<typeof DEPENDENCIES.useSettings>>({ isSettingsInit: true }),
      useTopBanner: () => mock<ReturnType<typeof DEPENDENCIES.useTopBanner>>({ hasBanner: false }),
      useWallet: () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isWalletLoaded: true })
    });

    render(
      <Layout isLoading={input.isLoading} dependencies={dependencies}>
        {input.children}
      </Layout>
    );

    return { dependencies };
  }
});
