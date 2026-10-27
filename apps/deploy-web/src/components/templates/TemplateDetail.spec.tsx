import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiTemplate } from "@src/types";
import { DEPENDENCIES, TemplateDetail } from "./TemplateDetail";

import { fireEvent, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(TemplateDetail.name, () => {
  it("shows the template's name without repeating the summary its README already opens with", () => {
    setup({});

    expect(screen.getByRole("heading", { level: 1, name: "ComfyUI" })).toBeInTheDocument();
    expect(screen.queryByText("The most powerful and modular stable diffusion GUI.")).not.toBeInTheDocument();
  });

  it("deploys the template through Configure", () => {
    setup({});

    expect(screen.getByRole("link", { name: "Deploy template" })).toHaveAttribute(
      "href",
      "/new-deployment/configure?templateId=akash-network-awesome-akash-comfyui"
    );
  });

  it("goes back to the previous page when the user arrived from within Console", () => {
    const { router, clickAndReportPrevented } = setup({ hasInAppHistory: true });

    const wasPrevented = clickAndReportPrevented(screen.getByRole("link", { name: "Back to templates" }));

    expect(wasPrevented).toBe(true);
    expect(router.back).toHaveBeenCalled();
  });

  it.each(["metaKey", "ctrlKey", "shiftKey", "altKey"] as const)("leaves a click with %s to the browser, to open the gallery elsewhere", modifier => {
    const { router, clickAndReportPrevented } = setup({ hasInAppHistory: true });

    const wasPrevented = clickAndReportPrevented(screen.getByRole("link", { name: "Back to templates" }), { [modifier]: true });

    expect(wasPrevented).toBe(false);
    expect(router.back).not.toHaveBeenCalled();
  });

  it("follows the link to the gallery when the user landed on the template directly", () => {
    const { router, clickAndReportPrevented } = setup({ hasInAppHistory: false });
    const backLink = screen.getByRole("link", { name: "Back to templates" });

    const wasPrevented = clickAndReportPrevented(backLink);

    expect(wasPrevented).toBe(false);
    expect(backLink).toHaveAttribute("href", "/templates");
    expect(router.back).not.toHaveBeenCalled();
  });

  it("shows the template's documents, its SDL among them", () => {
    const { TemplateDocuments } = setup({});

    expect(TemplateDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ template: expect.objectContaining({ id: "akash-network-awesome-akash-comfyui" }), showsSdl: true }),
      {}
    );
  });

  it("describes what the template deploys as from its SDL", () => {
    const { TemplateDeploysAs } = setup({});

    expect(TemplateDeploysAs).toHaveBeenCalledWith({ sdl: "version: '2.0'" }, {});
  });

  it("explains what happens before deploying", () => {
    setup({});

    expect(screen.getByRole("region", { name: "Before you deploy" })).toBeInTheDocument();
  });

  function setup(input: { template?: Partial<ApiTemplate>; hasInAppHistory?: boolean }) {
    const template: ApiTemplate = {
      id: "akash-network-awesome-akash-comfyui",
      name: "ComfyUI",
      summary: "The most powerful and modular stable diffusion GUI.",
      readme: "# ComfyUI readme",
      deploy: "version: '2.0'",
      guide: "",
      githubUrl: "https://github.com/akash-network/awesome-akash/blob/9f6f799/comfyui",
      logoUrl: "https://example.com/comfyui.png",
      ...input.template
    };
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();
    const TemplateDocuments = vi.fn(() => null);
    const TemplateDeploysAs = vi.fn(() => null);

    const dependencies = MockComponents(DEPENDENCIES, {
      useRouter: () => router,
      useHasInAppHistory: () => input.hasInAppHistory ?? false,
      TemplateDocuments,
      TemplateDeploysAs
    });

    const { container } = render(<TemplateDetail template={template} dependencies={dependencies} />);

    const clickAndReportPrevented = (element: HTMLElement, init?: MouseEventInit) => {
      let wasPrevented = false;
      const recordAndStopNavigation = (event: Event) => {
        wasPrevented = event.defaultPrevented;
        event.preventDefault();
      };
      container.addEventListener("click", recordAndStopNavigation);
      fireEvent.click(element, init);
      container.removeEventListener("click", recordAndStopNavigation);
      return wasPrevented;
    };

    return { container, router, TemplateDocuments, TemplateDeploysAs, clickAndReportPrevented };
  }
});
