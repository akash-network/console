import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import Layout, { DEPENDENCIES, Loading } from "./Layout";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

/** viewBox of the animated akash mark, which must stay exclusive to the boot-loading curtain. */
const AKASH_MARK_VIEW_BOX = "0 0 481 420";

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

  it("renders the top navigation", () => {
    const { dependencies } = setup({});

    expect(dependencies.TopNav).toHaveBeenCalledWith(expect.objectContaining({ minimal: false }), expect.anything());
  });

  function setup(input: { isLoading?: boolean; children?: ReactNode }) {
    const dependencies = MockComponents(DEPENDENCIES, {
      useOnboardingChrome: () => mock<ReturnType<typeof DEPENDENCIES.useOnboardingChrome>>({ isStripped: false }),
      useSettings: () => mock<ReturnType<typeof DEPENDENCIES.useSettings>>({ isSettingsInit: true }),
      useTopBanner: () => mock<ReturnType<typeof DEPENDENCIES.useTopBanner>>({ hasBanner: false })
    });

    render(
      <Layout isLoading={input.isLoading} dependencies={dependencies}>
        {input.children}
      </Layout>
    );

    return { dependencies };
  }
});

describe(Loading.name, () => {
  it("renders the shared spinner", () => {
    setup({});

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("does not render the animated akash mark, which is reserved for boot loading", () => {
    const { container } = setup({});

    expect(container.querySelector(`svg[viewBox="${AKASH_MARK_VIEW_BOX}"]`)).toBeNull();
  });

  it("renders the given text", () => {
    setup({ text: "Loading settings..." });

    expect(screen.getByText("Loading settings...")).toBeInTheDocument();
  });

  it("exposes the given test id", () => {
    setup({ testId: "loading-blocker" });

    expect(screen.getByTestId("loading-blocker")).toBeInTheDocument();
  });

  function setup(input: { text?: string; testId?: string }) {
    return render(<Loading text={input.text} testId={input.testId} />);
  }
});
