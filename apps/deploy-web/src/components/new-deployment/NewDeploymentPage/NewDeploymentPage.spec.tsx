import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./NewDeploymentPage";
import { NewDeploymentPage } from "./NewDeploymentPage";

import { render, screen } from "@testing-library/react";

describe(NewDeploymentPage.name, () => {
  it("renders the picker inside the retired-builder redirect", () => {
    const { LegacyBuilderRedirect, TemplateList } = setup({});

    expect(LegacyBuilderRedirect).toHaveBeenCalled();
    expect(TemplateList).toHaveBeenCalled();
    expect(screen.getByTestId("picker")).toBeInTheDocument();
  });

  it("shows the layout loading while the templates load", () => {
    const { Layout } = setup({ isLoadingTemplates: true });

    expect(Layout).toHaveBeenCalledWith(expect.objectContaining({ isLoading: true }), expect.anything());
  });

  function setup(input: { isLoadingTemplates?: boolean }) {
    const Layout = vi.fn(({ children }: PropsWithChildren) => <div>{children}</div>);
    const TemplateList = vi.fn(() => <div data-testid="picker" />);
    const LegacyBuilderRedirect = vi.fn(({ children }: PropsWithChildren) => <>{children}</>);
    const dependencies: typeof DEPENDENCIES = {
      Layout: Layout as never,
      TemplateList,
      LegacyBuilderRedirect,
      useTemplates: () => mock<ReturnType<typeof DEPENDENCIES.useTemplates>>({ isLoading: input.isLoadingTemplates ?? false })
    };
    render(<NewDeploymentPage dependencies={dependencies} />);
    return { Layout, TemplateList, LegacyBuilderRedirect };
  }
});
