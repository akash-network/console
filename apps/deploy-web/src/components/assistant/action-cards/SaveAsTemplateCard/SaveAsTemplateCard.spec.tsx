import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { DeploymentLocation } from "@src/types/project";
import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import { DeploymentLink } from "../DeploymentLink/DeploymentLink";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./SaveAsTemplateCard";
import { SaveAsTemplateCard } from "./SaveAsTemplateCard";

import { render, screen } from "@testing-library/react";

const SDL = "version: '2.0'\nservices:\n  web:\n    image: nginx";

describe(SaveAsTemplateCard.name, () => {
  it("shows the template it saves, private to the user", () => {
    const { chromeProps, useDeploymentName, decision } = setup({ description: "nginx site" });

    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Save as a template",
        scope: expect.objectContaining({ type: DeploymentLink, props: { dseq: "42", name: "blog" } }),
        tier: "confirm",
        decision,
        rows: [
          { label: "Title", value: "Site" },
          { label: "Description", value: "nginx site" },
          { label: "Visibility", value: "Private, only you" }
        ],
        confirmLabel: "Save template",
        isConfirmDisabled: false
      })
    );
    expect(useDeploymentName).toHaveBeenCalledWith("42", "site");
  });

  it("leaves out a description the assistant did not give", () => {
    const { chromeProps } = setup({ description: null });

    expect(chromeProps().rows).toEqual([
      { label: "Title", value: "Site" },
      { label: "Visibility", value: "Private, only you" }
    ]);
  });

  it("saves the deployment's SDL as a private template through the existing template endpoint", async () => {
    const { chromeProps, saveTemplate, useDeploymentDefinition } = setup({ description: "nginx site" });

    await chromeProps().onConfirm!("");

    expect(useDeploymentDefinition).toHaveBeenCalledWith("42");
    expect(saveTemplate).toHaveBeenCalledWith({ sdl: SDL, title: "Site", description: "nginx site", isPublic: false });
  });

  it("shows the template it opens in template mode, private to the user's project", () => {
    const { chromeProps } = setup({ description: "nginx site", isTemplateMarketplaceEnabled: true });

    expect(chromeProps()).toEqual(
      expect.objectContaining({
        rows: [
          { label: "Title", value: "Site" },
          { label: "Description", value: "nginx site" },
          { label: "Visibility", value: "Private, your project" }
        ],
        costNote: "Opens this deployment's SDL as Console holds it in template mode. Nothing is saved until you save it there.",
        confirmLabel: "Open in template mode",
        successMessage: "Opened in template mode.",
        isConfirmDisabled: false
      })
    );
  });

  it("opens template mode from the assistant card with the suggested title", async () => {
    const { chromeProps, saveAsTemplate, saveTemplate, useDeploymentLocationQuery } = setup({
      description: "nginx site",
      isTemplateMarketplaceEnabled: true,
      filedProjectId: "project-blog"
    });

    await chromeProps().onConfirm!("");

    expect(useDeploymentLocationQuery).toHaveBeenCalledWith("42", { enabled: true });
    expect(saveAsTemplate).toHaveBeenCalledWith({
      sdl: SDL,
      name: "blog",
      suggestedTitle: "Site",
      suggestedSummary: "nginx site",
      projectId: "project-blog",
      dseq: "42"
    });
    expect(saveTemplate).not.toHaveBeenCalled();
  });

  it("opens template mode without a summary or project the card cannot give", async () => {
    const { chromeProps, saveAsTemplate } = setup({ description: null, deploymentName: null, isTemplateMarketplaceEnabled: true });

    await chromeProps().onConfirm!("");

    expect(saveAsTemplate).toHaveBeenCalledWith({
      sdl: SDL,
      name: undefined,
      suggestedTitle: "Site",
      suggestedSummary: undefined,
      projectId: undefined,
      dseq: "42"
    });
  });

  it("reads no deployment location without template_marketplace", () => {
    const { useDeploymentLocationQuery } = setup({ description: "nginx site" });

    expect(useDeploymentLocationQuery).toHaveBeenCalledWith("42", { enabled: false });
  });

  it("still saves directly from the assistant card without template_marketplace", async () => {
    const { chromeProps, saveAsTemplate, saveTemplate } = setup({ description: "nginx site" });

    await chromeProps().onConfirm!("");

    expect(saveTemplate).toHaveBeenCalledTimes(1);
    expect(saveAsTemplate).not.toHaveBeenCalled();
  });

  it("opens no template mode for a deployment Console holds no usable SDL for", async () => {
    const { chromeProps, saveAsTemplate } = setup({ isTemplateMarketplaceEnabled: true, definition: { sdl: SDL, name: undefined, source: "absent" } });

    await chromeProps().onConfirm!("");

    expect(saveAsTemplate).not.toHaveBeenCalled();
  });

  it("waits while the deployment's SDL is read", () => {
    const { chromeProps } = setup({ definition: { sdl: undefined, name: undefined, source: "resolving" } });

    expect(chromeProps().isConfirmDisabled).toBe(true);
    expect(screen.getByText("Reading the deployment…")).toBeInTheDocument();
  });

  it("explains it can't save a deployment Console holds no usable SDL for", async () => {
    const { chromeProps, saveTemplate } = setup({ definition: { sdl: SDL, name: undefined, source: "absent" } });

    expect(chromeProps().isConfirmDisabled).toBe(true);
    expect(screen.getByText("Console holds no usable copy of this deployment's SDL, so it can't be saved as a template.")).toBeInTheDocument();
    await chromeProps().onConfirm!("");
    expect(saveTemplate).not.toHaveBeenCalled();
  });

  function setup(input: {
    description?: string | null;
    definition?: DeploymentDefinition;
    isTemplateMarketplaceEnabled?: boolean;
    filedProjectId?: string;
    deploymentName?: string | null;
  }) {
    const useDeploymentName = vi.fn((_dseq: string | null | undefined, _knownName?: string | null): string | null =>
      input.deploymentName === undefined ? "blog" : input.deploymentName
    );
    const useDeploymentLocationQuery = vi.fn<typeof DEPENDENCIES.useDeploymentLocationQuery>(() =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentLocationQuery>>({
        data: input.filedProjectId ? mock<DeploymentLocation>({ projectId: input.filedProjectId }) : null
      })
    );
    const saveTemplate = vi.fn(async (_template: unknown): Promise<unknown> => ({ data: "t-1" }));
    const saveAsTemplate = vi.fn();
    const useDeploymentDefinition = vi.fn((_dseq: string) => input.definition ?? { sdl: SDL, name: "site", source: "api" as const });
    const ActionCardChrome = vi.fn((props: ActionCardChromeProps) => <>{props.children}</>);
    const decision = mock<ActionCardDecision>({ status: "pending" });

    render(
      <SaveAsTemplateCard
        action={{ type: "save_as_template", tier: "confirm", dseq: "42", title: "Site", description: input.description ?? null }}
        decision={decision}
        dependencies={{
          useDeploymentName,
          useDeploymentDefinition: useDeploymentDefinition as unknown as typeof DEPENDENCIES.useDeploymentDefinition,
          useSaveUserTemplate: () =>
            mock<ReturnType<typeof DEPENDENCIES.useSaveUserTemplate>>({
              mutateAsync: saveTemplate as ReturnType<typeof DEPENDENCIES.useSaveUserTemplate>["mutateAsync"]
            }),
          useSaveAsTemplate: () => saveAsTemplate,
          useFlag: flag => flag === "template_marketplace" && !!input.isTemplateMarketplaceEnabled,
          useDeploymentLocationQuery,
          ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome
        }}
      />
    );

    return {
      chromeProps: () => ActionCardChrome.mock.lastCall![0],
      useDeploymentName,
      saveTemplate,
      saveAsTemplate,
      useDeploymentDefinition,
      useDeploymentLocationQuery,
      decision
    };
  }
});
