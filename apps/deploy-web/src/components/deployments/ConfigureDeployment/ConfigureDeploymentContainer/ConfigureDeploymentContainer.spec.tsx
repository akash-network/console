import { createStore, Provider as JotaiStoreProvider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import sdlStore from "@src/store/sdlStore";
import type { TemplateCreation } from "@src/types";
import type { DEPENDENCIES } from "./ConfigureDeploymentContainer";
import { ConfigureDeploymentContainer } from "./ConfigureDeploymentContainer";

import { render } from "@testing-library/react";

describe("ConfigureDeploymentContainer", () => {
  it("seeds the panes with the carried-in template SDL", () => {
    const { ConfigureDeploymentPanes } = setup({
      deploySdl: mock<TemplateCreation>({ content: 'version: "2.0"' })
    });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ sdl: 'version: "2.0"' }), expect.anything());
  });

  it("passes an empty SDL when no template was carried in", () => {
    const { ConfigureDeploymentPanes } = setup({ deploySdl: null });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ sdl: "" }), expect.anything());
  });

  function setup(input: { deploySdl: TemplateCreation | null }) {
    const ConfigureDeploymentPanes = vi.fn(() => <div data-testid="panes-mock" />);
    const dependencies: typeof DEPENDENCIES = {
      Layout: vi.fn(({ children }) => <div data-testid="layout-mock">{children}</div>) as never,
      NextSeo: vi.fn(() => null) as never,
      ConfigureDeploymentHeader: vi.fn(() => <div data-testid="header-mock" />),
      ConfigureDeploymentPanes: ConfigureDeploymentPanes as never
    };
    const store = createStore();
    store.set(sdlStore.deploySdl, input.deploySdl);

    render(
      <JotaiStoreProvider store={store}>
        <ConfigureDeploymentContainer dependencies={dependencies} />
      </JotaiStoreProvider>
    );

    return { ConfigureDeploymentPanes };
  }
});
