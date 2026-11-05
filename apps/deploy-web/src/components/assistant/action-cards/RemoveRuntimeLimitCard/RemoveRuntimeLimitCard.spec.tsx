import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./RemoveRuntimeLimitCard";
import { RemoveRuntimeLimitCard } from "./RemoveRuntimeLimitCard";

import { render } from "@testing-library/react";

describe(RemoveRuntimeLimitCard.name, () => {
  it("shows the switch to always on, what it spends and that it can't be undone", () => {
    const { chromeProps, decision } = setup();

    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Switch to always on",
        scope: "dseq 42",
        tier: "confirm",
        decision,
        diff: { removed: ["Closes after 12h"], added: ["Runs until you close it"] },
        costNote: "The deployment keeps topping up from your credits until you close it.",
        irreversibleNote: "You can't switch back to a fixed runtime.",
        confirmLabel: "Switch to always on"
      })
    );
  });

  it("removes the limit the way the deployment settings do", async () => {
    const { chromeProps, updateSetting } = setup();

    await chromeProps().onConfirm!("");

    expect(updateSetting).toHaveBeenCalledWith({ runtimeLimitHours: null });
  });

  function setup() {
    const updateSetting = vi.fn(async (_input: unknown): Promise<unknown> => ({}));
    const ActionCardChrome = vi.fn((_props: ActionCardChromeProps) => null);
    const decision = mock<ActionCardDecision>({ status: "pending" });

    render(
      <RemoveRuntimeLimitCard
        action={{ type: "remove_runtime_limit", tier: "confirm", dseq: "42", currentLimitHours: 12 }}
        decision={decision}
        dependencies={{
          useUpdateDeploymentSettingMutation: () =>
            mock<ReturnType<typeof DEPENDENCIES.useUpdateDeploymentSettingMutation>>({
              mutateAsync: updateSetting as ReturnType<typeof DEPENDENCIES.useUpdateDeploymentSettingMutation>["mutateAsync"]
            }),
          ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome
        }}
      />
    );

    return { chromeProps: () => ActionCardChrome.mock.lastCall![0], updateSetting, decision };
  }
});
