import type { TemplateOutput } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TemplateDocumentsProps } from "@src/components/templates/TemplateDocuments/TemplateDocuments";
import { DEPENDENCIES, DeploymentTemplateGuide } from "./DeploymentTemplateGuide";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(DeploymentTemplateGuide.name, () => {
  it("shows the template's README and guide, leaving its SDL to the deployment's own", () => {
    const { TemplateDocuments, template } = setup();

    expect(TemplateDocuments).toHaveBeenCalledWith(expect.objectContaining({ template }), {});
    expect(TemplateDocuments.mock.calls[0][0]).not.toHaveProperty("showsSdl");
  });

  it("names the template and links to its page in the gallery", () => {
    setup();

    expect(screen.getByRole("region", { name: "ComfyUI" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View template" })).toHaveAttribute("href", "/templates/akash-network-awesome-akash-comfyui");
  });

  it("shows the template's defaults as defaults, pointing to the deployment's own configuration", () => {
    const { TemplateDeploysAs } = setup();

    expect(TemplateDeploysAs).toHaveBeenCalledWith(
      { sdl: "version: '2.0'", title: "Template defaults", note: "This deployment's own configuration is on the Details tab." },
      {}
    );
  });

  function setup() {
    const template = mock<TemplateOutput>({
      id: "akash-network-awesome-akash-comfyui",
      name: "ComfyUI",
      logoUrl: "https://example.com/comfyui.png",
      deploy: "version: '2.0'"
    });
    const TemplateDocuments = vi.fn((_props: TemplateDocumentsProps) => null);
    const TemplateDeploysAs = vi.fn(() => null);

    render(<DeploymentTemplateGuide template={template} dependencies={MockComponents(DEPENDENCIES, { TemplateDocuments, TemplateDeploysAs })} />);

    return { template, TemplateDocuments, TemplateDeploysAs };
  }
});
