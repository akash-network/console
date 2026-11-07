import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssistantActionOf } from "@src/types/assistant";
import type { ConfigureFormHandle } from "../../configureFormRegistry/configureFormRegistry";
import { ConfigureFormRegistry } from "../../configureFormRegistry/configureFormRegistry";
import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./EditConfigureFormCard";
import { EditConfigureFormCard } from "./EditConfigureFormCard";

import { render, screen } from "@testing-library/react";

type Action = AssistantActionOf<"edit_configure_form">;

describe(EditConfigureFormCard.name, () => {
  it("lists why and each field the edit changes as a confirm card", () => {
    const { chromeProps, decision } = setup({
      action: action({
        services: [
          {
            service: "web",
            changes: {
              image: "nginx:1.27",
              cpu: 0.5,
              memory: "512Mi",
              ephemeralStorage: "2Gi",
              count: 2,
              gpu: { units: 1, models: ["nvidia/rtx4090", "nvidia/a100"] },
              persistentStorage: { name: "data", class: "beta2", size: "10Gi", mount: "/data", readOnly: true }
            }
          }
        ],
        placements: [{ placement: "dcloud", changes: { attributes: [{ key: "region", value: "us-west" }], regions: [] } }]
      })
    });

    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Change the deployment settings",
        tier: "confirm",
        decision,
        confirmLabel: "Apply to the form",
        successMessage: "Applied. The providers pane updates in a moment.",
        costNote: "Only the form changes. Nothing is deployed until you deploy it.",
        isConfirmDisabled: false
      })
    );
    expect(chromeProps().rows).toEqual([
      { label: "Why", value: "14 providers can bid with SSD" },
      { label: "web: image", value: "nginx:1.27" },
      { label: "web: CPU", value: "0.5 vCPU" },
      { label: "web: memory", value: "512Mi" },
      { label: "web: storage", value: "2Gi" },
      { label: "web: replicas", value: "2" },
      { label: "web: GPU", value: "1 x nvidia/rtx4090 or nvidia/a100" },
      { label: "web: persistent storage", value: "data, SSD, 10Gi, at /data, read only" },
      { label: "dcloud: attributes", value: "region=us-west" },
      { label: "dcloud: regions", value: "any region" }
    ]);
  });

  it.each([
    [{ gpu: { units: 0 } }, "web: GPU", "off"],
    [{ gpu: { units: 2 } }, "web: GPU", "2"],
    [{ persistentStorage: { remove: true } }, "web: persistent storage", "off"],
    [{ persistentStorage: { name: "cache", remove: true } }, "web: persistent storage", "remove cache"],
    [{ persistentStorage: { class: "beta1" as const, readOnly: false } }, "web: persistent storage", "HDD, writable"],
    [{ count: 1, cpu: 0.1 }, "web: replicas", "1"]
  ])("describes %j", (changes, label, value) => {
    const { chromeProps } = setup({ action: action({ services: [{ service: "web", changes }] }) });

    expect(chromeProps().rows).toContainEqual({ label, value });
  });

  it("says when a placement keeps no attributes", () => {
    const { chromeProps } = setup({ action: action({ placements: [{ placement: "dcloud", changes: { attributes: [] } }] }) });

    expect(chromeProps().rows).toEqual([
      { label: "Why", value: "14 providers can bid with SSD" },
      { label: "dcloud: attributes", value: "none" }
    ]);
  });

  it("applies the edit to the open form", async () => {
    const { chromeProps, registry } = setup({ action: action({ services: [{ service: "web", changes: { memory: "1Gi" } }] }) });
    const form = mock<ConfigureFormHandle>();
    registry.publish(form);

    await chromeProps().onConfirm!("");

    expect(form.applyEdit).toHaveBeenCalledWith({ services: [{ service: "web", changes: { memory: "1Gi" } }], placements: [] });
  });

  it("refuses to apply once the form is gone and asks to open the configure page", async () => {
    const { chromeProps } = setup({ action: action({}), isFormOpen: false });

    expect(chromeProps().isConfirmDisabled).toBe(true);
    expect(screen.getByText("Open the configure page to apply this change.")).toBeInTheDocument();
    await expect(chromeProps().onConfirm!("")).rejects.toThrow("Open the configure page to apply this change.");
  });

  it("stops asking to open the configure page once the card is settled", () => {
    setup({ action: action({}), isFormOpen: false, status: "succeeded" });

    expect(screen.queryByText("Open the configure page to apply this change.")).not.toBeInTheDocument();
  });

  function action(input: Partial<Action>): Action {
    return { type: "edit_configure_form", tier: "confirm", reason: "14 providers can bid with SSD", services: [], placements: [], ...input };
  }

  function setup(input: { action: Action; isFormOpen?: boolean; status?: ActionCardDecision["status"] }) {
    const registry = new ConfigureFormRegistry();
    const ActionCardChrome = vi.fn((props: ActionCardChromeProps) => <>{props.children}</>);
    const decision = mock<ActionCardDecision>({ status: input.status ?? "pending" });

    render(
      <EditConfigureFormCard
        action={input.action}
        decision={decision}
        dependencies={{
          useConfigureFormRegistry: () => registry,
          useIsConfigureFormOpen: () => input.isFormOpen ?? true,
          ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome
        }}
      />
    );

    return { chromeProps: () => ActionCardChrome.mock.lastCall![0], registry, decision };
  }
});
