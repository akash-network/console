import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssistantActionOf } from "@src/types/assistant";
import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./RequestHardwareCard";
import { hardwareRequestDetailsOf, RequestHardwareCard } from "./RequestHardwareCard";

import { render } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type Container = ReturnType<typeof DEPENDENCIES.useServices>;
type Action = AssistantActionOf<"request_hardware">;

const ACTION: Action = { type: "request_hardware", tier: "confirm", gpuModel: "H200", gpuCount: 8, interconnect: "server", notes: "For fine-tuning" };

describe(RequestHardwareCard.name, () => {
  it("shows the GPUs requested with readable labels and the email the team answers", () => {
    const { chromeProps, decision } = setup({});

    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Request hardware",
        tier: "confirm",
        decision,
        rows: [
          { label: "GPU model", value: "H200" },
          { label: "GPU count", value: "8" },
          { label: "GPU interconnect", value: "Between GPUs in one server" },
          { label: "Notes", value: "For fine-tuning" },
          { label: "Reply to", value: "me@example.com" }
        ],
        confirmLabel: "Send request",
        isConfirmDisabled: false
      })
    );
  });

  it("files the request the configure page files, with the configuration asked for", async () => {
    const { chromeProps, createHardwareRequest } = setup({});

    await chromeProps().onConfirm!("");

    expect(createHardwareRequest).toHaveBeenCalledWith({
      data: {
        category: "gpu_model",
        gpuModel: "H200",
        quantity: 8,
        email: "me@example.com",
        details: "For fine-tuning\nInterconnect: Between GPUs in one server"
      }
    });
  });

  it("can't send a request without an email to answer", () => {
    const { chromeProps } = setup({ email: null });

    expect(chromeProps().rows).toContainEqual({ label: "Reply to", value: "No email on your account" });
    expect(chromeProps().isConfirmDisabled).toBe(true);
  });

  it("leaves notes out when there are none", () => {
    const { chromeProps } = setup({ action: { ...ACTION, notes: null } });

    expect(chromeProps().rows!.map(({ label }) => label)).toEqual(["GPU model", "GPU count", "GPU interconnect", "Reply to"]);
  });

  describe(hardwareRequestDetailsOf.name, () => {
    it("adds the interconnect after the notes, and only when one is needed", () => {
      expect(hardwareRequestDetailsOf({ ...ACTION, interconnect: "cluster", notes: null })).toBe("Interconnect: Between servers");
      expect(hardwareRequestDetailsOf({ ...ACTION, interconnect: "none" })).toBe("For fine-tuning");
      expect(hardwareRequestDetailsOf({ ...ACTION, interconnect: "none", notes: null })).toBeUndefined();
    });
  });

  function setup(input: { action?: Action; email?: string | null }) {
    const createHardwareRequest = vi.fn(async (_input: unknown) => ({ data: {} }));
    const api = createProxy({ v1: { createHardwareRequest } }) as unknown as Container["api"];
    const ActionCardChrome = vi.fn((_props: ActionCardChromeProps) => null);
    const decision = mock<ActionCardDecision>({ status: "pending" });
    const email = input.email === undefined ? "me@example.com" : input.email;

    render(
      <TestContainerProvider>
        <RequestHardwareCard
          action={input.action ?? ACTION}
          decision={decision}
          dependencies={{
            useServices: () => Object.assign(mock<Container>(), { api }),
            useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: email ? { email } : undefined }),
            ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome
          }}
        />
      </TestContainerProvider>
    );

    return { chromeProps: () => ActionCardChrome.mock.lastCall![0], createHardwareRequest, decision };
  }
});
