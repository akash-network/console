import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./AddRuntimeHoursCard";
import { AddRuntimeHoursCard } from "./AddRuntimeHoursCard";

import { render, waitFor } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type Container = ReturnType<typeof DEPENDENCIES.useServices>;

function lease(state: string, amount: string) {
  return { id: { owner: "akash1owner", dseq: "42", gseq: 1, oseq: 1, provider: "akash1provider", bseq: 1 }, state, price: { denom: "uact", amount } };
}

describe(AddRuntimeHoursCard.name, () => {
  it("shows the limit before and after and the 48 hour cap per request", () => {
    const { chromeProps, decision } = setup({ leases: [] });

    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Add runtime hours",
        scope: "dseq 42",
        tier: "confirm",
        decision,
        rows: [
          { label: "Current limit", value: "12h" },
          { label: "Adding", value: "24h" },
          { label: "New limit", value: "36h" }
        ],
        confirmLabel: "Add 24 hours",
        successMessage: "The deployment now closes after 36h."
      })
    );
    expect(chromeProps().costNote).toMatch(/One request adds at most 48 hours\.$/);
  });

  it("spells out the credits the extra hours spend at the live leases' rate", async () => {
    const { chromeProps, udenomToUsd, listLeases } = setup({ leases: [lease("active", "0.5"), lease("closed", "9"), lease("active", "1.5")] });

    await waitFor(() => expect(chromeProps().costNote).toBe("Spends about $28.80 of credits to fund them. One request adds at most 48 hours."));
    expect(listLeases).toHaveBeenCalledWith({ dseq: "42" });
    expect(udenomToUsd).toHaveBeenCalledWith(2 * 600 * 24, "uact");
  });

  it("still says it spends credits when no lease is live to price it", async () => {
    const { chromeProps, listLeases } = setup({ leases: [lease("closed", "1")] });

    await waitFor(() => expect(listLeases).toHaveBeenCalled());
    expect(chromeProps().costNote).toBe("Spends credits to fund the extra hours at the deployment's current rate. One request adds at most 48 hours.");
  });

  it("sends the new total limit the way the deployment settings do", async () => {
    const { chromeProps, updateSetting } = setup({ leases: [] });

    await chromeProps().onConfirm!("");

    expect(updateSetting).toHaveBeenCalledWith({ runtimeLimitHours: 36 });
  });

  function setup(input: { leases: ReturnType<typeof lease>[] }) {
    const listLeases = vi.fn(async (_input: unknown) => ({ data: input.leases }));
    const api = createProxy({ v1: { listLeases } }) as unknown as Container["api"];
    const udenomToUsd = vi.fn((amount: string | number) => Number(amount) / 1000);
    const updateSetting = vi.fn(async (_input: unknown): Promise<unknown> => ({}));
    const ActionCardChrome = vi.fn((_props: ActionCardChromeProps) => null);
    const decision = mock<ActionCardDecision>({ status: "pending" });

    render(
      <TestContainerProvider>
        <AddRuntimeHoursCard
          action={{ type: "add_runtime_hours", tier: "confirm", dseq: "42", hours: 24, currentLimitHours: 12, newLimitHours: 36, runtimeEndsAt: null }}
          decision={decision}
          dependencies={{
            useServices: () => Object.assign(mock<Container>(), { api }),
            usePricing: () => mock<ReturnType<typeof DEPENDENCIES.usePricing>>({ udenomToUsd }),
            useUpdateDeploymentSettingMutation: () =>
              mock<ReturnType<typeof DEPENDENCIES.useUpdateDeploymentSettingMutation>>({
                mutateAsync: updateSetting as ReturnType<typeof DEPENDENCIES.useUpdateDeploymentSettingMutation>["mutateAsync"]
              }),
            ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome
          }}
        />
      </TestContainerProvider>
    );

    return { chromeProps: () => ActionCardChrome.mock.lastCall![0], udenomToUsd, updateSetting, listLeases, decision };
  }
});
