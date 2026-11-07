import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import { DeploymentLink } from "../DeploymentLink/DeploymentLink";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./RenameDeploymentCard";
import { RenameDeploymentCard } from "./RenameDeploymentCard";

import { render } from "@testing-library/react";

describe(RenameDeploymentCard.name, () => {
  it("shows the name before and after as a confirm card", () => {
    const { chromeProps, useDeploymentName, decision } = setup({ from: "blog" });

    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Rename the deployment",
        scope: expect.objectContaining({ type: DeploymentLink, props: { dseq: "42", name: "blog" } }),
        tier: "confirm",
        decision,
        diff: { removed: ["blog"], added: ["blog-prod"] },
        confirmLabel: "Rename",
        successMessage: "Renamed to blog-prod."
      })
    );
    expect(useDeploymentName).toHaveBeenCalledWith("42", "blog");
  });

  it("shows only the new name for a deployment that had none", () => {
    const { chromeProps } = setup({ from: null });

    expect(chromeProps().diff).toEqual({ removed: [], added: ["blog-prod"] });
  });

  it("renames through the same request as the rename dialog", async () => {
    const { chromeProps, renameDeployment } = setup({ from: "blog" });

    await chromeProps().onConfirm!("");

    expect(renameDeployment).toHaveBeenCalledWith("42", "blog-prod");
  });

  function setup(input: { from: string | null }) {
    const useDeploymentName = vi.fn((_dseq: string | null | undefined, _knownName?: string | null): string | null => "blog");
    const renameDeployment = vi.fn(async () => {});
    const ActionCardChrome = vi.fn((_props: ActionCardChromeProps) => null);
    const decision = mock<ActionCardDecision>({ status: "pending" });

    render(
      <RenameDeploymentCard
        action={{ type: "rename_deployment", tier: "confirm", dseq: "42", from: input.from, to: "blog-prod" }}
        decision={decision}
        dependencies={{
          useDeploymentName,
          useRenameDeployment: () => renameDeployment,
          ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome
        }}
      />
    );

    return { chromeProps: () => ActionCardChrome.mock.lastCall![0], useDeploymentName, renameDeployment, decision };
  }
});
