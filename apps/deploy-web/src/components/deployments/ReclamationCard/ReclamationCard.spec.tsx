import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CloseOutcome } from "@src/hooks/useCloseDeployment/useCloseDeployment";
import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { LeaseDto } from "@src/types/deployment";
import { DEPENDENCIES, ReclamationCard } from "./ReclamationCard";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("ReclamationCard", () => {
  it("shows the provider close reason as the title", () => {
    setup({ reason: "lease_closed_reason_unstable" });
    expect(screen.getByText("Closed by provider (workloads unstable)")).toBeInTheDocument();
  });

  it("offers Close + Redeploy and no restart control", () => {
    setup({ definition: { sdl: "version: 2.0" } });

    expect(screen.getByRole("button", { name: "Close & refund" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redeploy" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /restart/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resume/i })).not.toBeInTheDocument();
  });

  it("redeploys with the resolved sdl and name when Redeploy is clicked", async () => {
    const { redeploy } = setup({ definition: { sdl: "version: 2.0", name: "my-app" } });

    await userEvent.click(screen.getByRole("button", { name: "Redeploy" }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: "version: 2.0", name: "my-app", sourceDseq: expect.any(String) });
  });

  it("redeploys the values this browser gave back when it holds the running copy", async () => {
    const { redeploy } = setup({ definition: { sdl: "version: 2.0 # withheld", restoredSdl: "version: 2.0 # restored", name: "my-app", source: "api" } });

    await userEvent.click(screen.getByRole("button", { name: "Redeploy" }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: "version: 2.0 # restored", name: "my-app", sourceDseq: expect.any(String) });
  });

  it("redeploys from the api definition on a device holding no local copy", async () => {
    const { redeploy } = setup({ definition: { sdl: "version: 2.0 # from-the-api", name: undefined, source: "api" } });

    await userEvent.click(screen.getByRole("button", { name: "Redeploy" }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: "version: 2.0 # from-the-api", name: undefined, sourceDseq: expect.any(String) });
  });

  it("falls back to a 'new SDL' link when neither source holds a definition", () => {
    setup({ definition: { sdl: undefined, source: "absent" } });

    expect(screen.getByRole("link", { name: "Start a new deployment" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redeploy" })).not.toBeInTheDocument();
  });

  it("falls back to a 'new SDL' link when the definition is absent despite an inspection-only api sdl", () => {
    setup({ definition: { sdl: "version: 2.0 # not-self-contained", source: "absent" } });

    expect(screen.getByRole("link", { name: "Start a new deployment" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redeploy" })).not.toBeInTheDocument();
  });

  it("offers Redeploy disabled rather than the link while the definition is resolving", () => {
    setup({ definition: { sdl: undefined, source: "resolving" } });

    expect(screen.getByRole("button", { name: "Redeploy" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Start a new deployment" })).not.toBeInTheDocument();
  });

  it("closes the deployment when confirmed and refreshes once the close has landed", async () => {
    const onClosed = vi.fn();
    const { closeDeployment, confirm } = setup({ isConfirmed: true, outcome: "closed", onClosed });

    await userEvent.click(screen.getByRole("button", { name: "Close & refund" }));

    await waitFor(() => expect(onClosed).toHaveBeenCalled());
    expect(confirm.closeDeploymentConfirm).toHaveBeenCalledWith(["123"]);
    expect(closeDeployment).toHaveBeenCalledWith("123");
  });

  it("leaves the refresh to the activity host while the close runs in the background", async () => {
    const onClosed = vi.fn();
    const { closeDeployment } = setup({ isConfirmed: true, outcome: "closing", onClosed });

    await userEvent.click(screen.getByRole("button", { name: "Close & refund" }));

    await waitFor(() => expect(closeDeployment).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Close & refund" })).toBeEnabled());
    expect(onClosed).not.toHaveBeenCalled();
  });

  it("survives a close that lands with nothing to refresh", async () => {
    const { closeDeployment } = setup({ isConfirmed: true, outcome: "closed" });

    await userEvent.click(screen.getByRole("button", { name: "Close & refund" }));

    await waitFor(() => expect(closeDeployment).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Close & refund" })).toBeEnabled());
  });

  it("keeps close disabled while the request to close is on its way", async () => {
    setup({ isConfirmed: true, closeNeverAnswers: true });

    await userEvent.click(screen.getByRole("button", { name: "Close & refund" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled());
  });

  it("does not close when the confirmation is declined", async () => {
    const { closeDeployment, confirm } = setup({ isConfirmed: false });

    await userEvent.click(screen.getByRole("button", { name: "Close & refund" }));

    await waitFor(() => expect(confirm.closeDeploymentConfirm).toHaveBeenCalled());
    expect(closeDeployment).not.toHaveBeenCalled();
  });

  it("shows the close as under way and keeps it disabled while it runs in the background", () => {
    setup({ closingDseqs: ["123"] });

    expect(screen.getByRole("button", { name: "Closing…" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Close & refund" })).not.toBeInTheDocument();
  });

  it("keeps close available while only other deployments are closing", () => {
    setup({ closingDseqs: ["42"] });

    expect(screen.getByRole("button", { name: "Close & refund" })).toBeEnabled();
  });

  function setup(
    input: {
      reason?: string;
      definition?: Partial<DeploymentDefinition>;
      isConfirmed?: boolean;
      outcome?: CloseOutcome;
      closeNeverAnswers?: boolean;
      closingDseqs?: string[];
      onClosed?: () => void;
    } = {}
  ) {
    const closeDeployment = input.closeNeverAnswers
      ? vi.fn(() => new Promise<CloseOutcome>(() => undefined))
      : vi.fn(async () => input.outcome ?? ("closing" as const));

    const confirm = mock<ReturnType<typeof DEPENDENCIES.useManagedDeploymentConfirm>>();
    confirm.closeDeploymentConfirm.mockResolvedValue(input.isConfirmed ?? true);

    const definition: DeploymentDefinition = { sdl: "version: 2.0", name: undefined, source: "local", ...input.definition };
    const redeploy = vi.fn();

    const useCloseDeployment: typeof DEPENDENCIES.useCloseDeployment = () => closeDeployment;
    const useClosingDeployments: typeof DEPENDENCIES.useClosingDeployments = () => new Set(input.closingDseqs ?? []);
    const useManagedDeploymentConfirm: typeof DEPENDENCIES.useManagedDeploymentConfirm = () => confirm;
    const useDeploymentDefinition: typeof DEPENDENCIES.useDeploymentDefinition = () => definition;
    const useRedeploy: typeof DEPENDENCIES.useRedeploy = () => redeploy;
    const useNewDeploymentUrl: typeof DEPENDENCIES.useNewDeploymentUrl = () => () => "/new-deployment";

    const lease = mock<LeaseDto>({
      id: "1",
      owner: "akash1owner",
      provider: "provider1",
      dseq: "123",
      gseq: 1,
      oseq: 1,
      state: "closed",
      price: { denom: "uakt", amount: "100" },
      reason: input.reason ?? "lease_closed_reason_unstable"
    });

    render(
      <ReclamationCard
        lease={lease}
        dseq="123"
        onClosed={input.onClosed}
        dependencies={MockComponents(DEPENDENCIES, {
          useCloseDeployment,
          useClosingDeployments,
          useManagedDeploymentConfirm,
          useDeploymentDefinition,
          useRedeploy,
          useNewDeploymentUrl
        })}
      />
    );

    return { closeDeployment, confirm, redeploy };
  }
});
