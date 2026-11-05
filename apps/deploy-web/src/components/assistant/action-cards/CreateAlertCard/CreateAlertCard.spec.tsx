import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./CreateAlertCard";
import { CreateAlertCard } from "./CreateAlertCard";

import { render, screen, waitFor } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type Container = ReturnType<typeof DEPENDENCIES.useServices>;

const PRIMARY = { id: "11111111-1111-4111-8111-111111111111", name: "Primary", type: "email", config: { addresses: ["me@example.com"] } };
const TEAM = { id: "22222222-2222-4222-8222-222222222222", name: "Team", type: "email", config: { addresses: ["ops@example.com", "cto@example.com"] } };

describe(CreateAlertCard.name, () => {
  it("creates a new email alert on the first channel, like the deployment settings default", async () => {
    const { chromeProps, decision } = setup({ channels: [PRIMARY, TEAM] });

    await waitFor(() => expect(chromeProps().isConfirmDisabled).toBe(false));
    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Email me when this deployment closes",
        scope: "dseq 42",
        tier: "confirm",
        decision,
        rows: [
          { label: "Sends to", value: "me@example.com" },
          { label: "Alert", value: "New" }
        ],
        confirmLabel: "Create alert"
      })
    );
  });

  it("updates the existing alert on its own channel instead of adding another", async () => {
    const { chromeProps, upsertDeploymentAlert, queryClient } = setup({
      channels: [PRIMARY, TEAM],
      existing: { notificationChannelId: TEAM.id, enabled: false, id: "a-1", status: "OK" }
    });

    await waitFor(() => expect(chromeProps().isConfirmDisabled).toBe(false));
    expect(chromeProps().rows).toEqual([
      { label: "Sends to", value: "ops@example.com, cto@example.com" },
      { label: "Alert", value: "Turns your existing alert back on" }
    ]);
    expect(chromeProps().confirmLabel).toBe("Update alert");

    await chromeProps().onConfirm!("");

    expect(upsertDeploymentAlert).toHaveBeenCalledWith({
      dseq: "42",
      data: { alerts: { deploymentClosed: { notificationChannelId: TEAM.id, enabled: true } } }
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "listDeploymentAlerts", { dseq: "42" }] });
  });

  it("keeps an alert that is already on", async () => {
    const { chromeProps } = setup({ channels: [PRIMARY], existing: { notificationChannelId: PRIMARY.id, enabled: true, id: "a-1", status: "OK" } });

    await waitFor(() => expect(chromeProps().rows).toContainEqual({ label: "Alert", value: "Already on, kept as is" }));
  });

  it("points to the alerts page when no email is set up yet", async () => {
    const { chromeProps } = setup({ channels: [] });

    await waitFor(() => expect(chromeProps().rows).toContainEqual({ label: "Sends to", value: "No email set up" }));
    expect(chromeProps().isConfirmDisabled).toBe(true);
    expect(screen.getByRole("link", { name: "Alerts page" })).toHaveAttribute("href", "/alerts");
  });

  it("waits for the channels before it can be confirmed", () => {
    const { chromeProps } = setup({ channels: [PRIMARY] });

    expect(chromeProps().rows).toContainEqual({ label: "Sends to", value: "Loading…" });
    expect(chromeProps().isConfirmDisabled).toBe(true);
  });

  it("offers nothing on an account without deployment closed alerts", async () => {
    const { chromeProps, listNotificationChannels } = setup({ channels: [PRIMARY], isAvailable: false });

    await waitFor(() => expect(listNotificationChannels).toHaveBeenCalled());
    expect(chromeProps().isConfirmDisabled).toBe(true);
    expect(screen.getByText("Deployment closed alerts aren't available on your account yet.")).toBeInTheDocument();
  });

  function setup(input: {
    channels: (typeof PRIMARY)[];
    existing?: { notificationChannelId: string; enabled: boolean; id: string; status: string };
    isAvailable?: boolean;
  }) {
    const listNotificationChannels = vi.fn(async (_input: unknown) => ({
      data: input.channels,
      pagination: { page: 1, limit: 10, total: input.channels.length, totalPages: 1 }
    }));
    const listDeploymentAlerts = vi.fn(async (_input: unknown) => ({ data: { dseq: "42", alerts: { deploymentClosed: input.existing } } }));
    const upsertDeploymentAlert = vi.fn(async (_input: unknown) => ({ data: {} }));
    const api = createProxy({ v1: { listNotificationChannels, listDeploymentAlerts, upsertDeploymentAlert } }) as unknown as Container["api"];
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(queryClient, "invalidateQueries");
    const ActionCardChrome = vi.fn((props: ActionCardChromeProps) => <>{props.children}</>);
    const decision = mock<ActionCardDecision>({ status: "pending" });

    render(
      <TestContainerProvider services={{ queryClient: () => queryClient }}>
        <CreateAlertCard
          action={{ type: "create_alert", tier: "confirm", alert: "deployment_closed", dseq: "42", channel: "email" }}
          decision={decision}
          dependencies={{
            useServices: () => Object.assign(mock<Container>(), { api }),
            useQueryClient: () => queryClient,
            useFlag: () => input.isAvailable ?? true,
            ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome
          }}
        />
      </TestContainerProvider>
    );

    return { chromeProps: () => ActionCardChrome.mock.lastCall![0], upsertDeploymentAlert, listNotificationChannels, queryClient, decision };
  }
});
