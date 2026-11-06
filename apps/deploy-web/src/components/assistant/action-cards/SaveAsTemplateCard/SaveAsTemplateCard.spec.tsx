import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./SaveAsTemplateCard";
import { SaveAsTemplateCard } from "./SaveAsTemplateCard";

import { render, screen } from "@testing-library/react";

const SDL = "version: '2.0'\nservices:\n  web:\n    image: nginx";

describe(SaveAsTemplateCard.name, () => {
  it("shows the template it saves, private to the user", () => {
    const { chromeProps, decision } = setup({ description: "nginx site" });

    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Save as a template",
        scope: "dseq 42",
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

  function setup(input: { description?: string | null; definition?: DeploymentDefinition }) {
    const saveTemplate = vi.fn(async (_template: unknown): Promise<unknown> => ({ data: "t-1" }));
    const useDeploymentDefinition = vi.fn((_dseq: string) => input.definition ?? { sdl: SDL, name: "site", source: "api" as const });
    const ActionCardChrome = vi.fn((props: ActionCardChromeProps) => <>{props.children}</>);
    const decision = mock<ActionCardDecision>({ status: "pending" });

    render(
      <SaveAsTemplateCard
        action={{ type: "save_as_template", tier: "confirm", dseq: "42", title: "Site", description: input.description ?? null }}
        decision={decision}
        dependencies={{
          useDeploymentDefinition: useDeploymentDefinition as unknown as typeof DEPENDENCIES.useDeploymentDefinition,
          useSaveUserTemplate: () =>
            mock<ReturnType<typeof DEPENDENCIES.useSaveUserTemplate>>({
              mutateAsync: saveTemplate as ReturnType<typeof DEPENDENCIES.useSaveUserTemplate>["mutateAsync"]
            }),
          ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome
        }}
      />
    );

    return { chromeProps: () => ActionCardChrome.mock.lastCall![0], saveTemplate, useDeploymentDefinition, decision };
  }
});
