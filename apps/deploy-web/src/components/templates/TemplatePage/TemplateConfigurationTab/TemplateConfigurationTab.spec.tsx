import { describe, expect, it } from "vitest";

import type { TemplateAskedValue } from "@src/types/marketplace-template";
import { DEPENDENCIES, TemplateConfigurationTab } from "./TemplateConfigurationTab";

import { render, screen } from "@testing-library/react";
import { buildTemplateVersion } from "@tests/seeders/userTemplate";
import { MockComponents } from "@tests/unit/mocks";

const SDL = 'version: "2.0"\nservices:\n  webui:\n    image: ghcr.io/open-webui/open-webui:0.4.8\n';
const ADMIN_EMAIL: TemplateAskedValue = {
  key: "ADMIN_EMAIL",
  label: "Admin email",
  required: true,
  bindings: [{ service: "webui", env: "ADMIN_EMAIL" }],
  type: "text"
};

describe(TemplateConfigurationTab.name, () => {
  it("shows the asked values, the read-only SDL and what it deploys as", () => {
    const { AskedValuesList, SDLEditor, TemplateDeploysAs } = setup();

    expect(AskedValuesList).toHaveBeenCalledWith({ askedValues: [ADMIN_EMAIL] }, expect.anything());
    expect(SDLEditor).toHaveBeenCalledWith(expect.objectContaining({ value: SDL, readonly: true }), expect.anything());
    expect(TemplateDeploysAs).toHaveBeenCalledWith({ sdl: SDL }, expect.anything());
    expect(screen.getByRole("region", { name: "deploy.yaml" })).toBeInTheDocument();
  });

  function setup() {
    const dependencies = MockComponents(DEPENDENCIES);
    const version = buildTemplateVersion({ sdl: SDL, askedValues: [structuredClone(ADMIN_EMAIL)] });

    render(<TemplateConfigurationTab version={version} dependencies={dependencies} />);

    return dependencies;
  }
});
