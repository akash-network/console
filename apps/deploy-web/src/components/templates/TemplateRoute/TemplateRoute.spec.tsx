import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ITemplate } from "@src/types";
import { DEPENDENCIES, TemplateRoute } from "./TemplateRoute";

import { render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

const TEMPLATE_ID = "tpl-webui";

describe(TemplateRoute.name, () => {
  it("renders the legacy page for a legacy template", () => {
    const legacyTemplate = mock<ITemplate>({ id: TEMPLATE_ID, title: "Open WebUI + vLLM" });

    const { UserTemplate, TemplatePage } = setup({ id: TEMPLATE_ID, template: legacyTemplate });

    expect(UserTemplate).toHaveBeenCalledWith({ id: TEMPLATE_ID, template: legacyTemplate }, expect.anything());
    expect(TemplatePage).not.toHaveBeenCalled();
  });

  it("renders the template page when the marketplace is on", () => {
    const { UserTemplate, TemplatePage } = setup({ id: TEMPLATE_ID, isMarketplace: true });

    expect(TemplatePage).toHaveBeenCalledWith({ id: TEMPLATE_ID, removedTemplate: undefined }, expect.anything());
    expect(UserTemplate).not.toHaveBeenCalled();
  });

  it("tells the template page what the server already learned about a removed template", () => {
    const { TemplatePage } = setup({ id: TEMPLATE_ID, isMarketplace: true, visitorAccess: { featureToggles: [] }, removedTemplate: { title: "Open WebUI" } });

    expect(TemplatePage).toHaveBeenCalledWith({ id: TEMPLATE_ID, removedTemplate: { title: "Open WebUI" } }, expect.anything());
  });

  it("starts the template page afresh when the route moves to another template", () => {
    const mountPage = vi.fn();
    const TemplatePage = vi.fn<typeof DEPENDENCIES.TemplatePage>(({ id }) => {
      useEffect(() => mountPage(id), []);
      return null;
    });
    const { rerender } = setup({ id: "tpl-a", isMarketplace: true }, { TemplatePage });

    rerender({ id: "tpl-b", isMarketplace: true });

    expect(mountPage.mock.calls).toEqual([["tpl-a"], ["tpl-b"]]);
  });

  function setup(props: Parameters<typeof TemplateRoute>[0], overrides?: Partial<typeof DEPENDENCIES>) {
    const dependencies = MockComponents(DEPENDENCIES, overrides);

    const { rerender } = render(<TemplateRoute {...props} dependencies={dependencies} />);

    return {
      ...dependencies,
      rerender: (nextProps: Parameters<typeof TemplateRoute>[0]) => rerender(<TemplateRoute {...nextProps} dependencies={dependencies} />)
    };
  }
});
