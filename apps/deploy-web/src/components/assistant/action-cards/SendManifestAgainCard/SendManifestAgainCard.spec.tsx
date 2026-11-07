import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import { DeploymentLink } from "../DeploymentLink/DeploymentLink";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./SendManifestAgainCard";
import { SendManifestAgainCard } from "./SendManifestAgainCard";

import { render } from "@testing-library/react";

type Container = ReturnType<typeof DEPENDENCIES.useServices>;

describe("SendManifestAgainCard", () => {
  it("describes the resend as a confirm card", () => {
    const { chromeProps, decision } = setup();

    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Send the deployment again",
        tier: "confirm",
        decision,
        rows: [{ label: "Deployment", value: expect.objectContaining({ type: DeploymentLink, props: { dseq: "42", name: "blog" } }) }],
        confirmLabel: "Send again"
      })
    );
    expect(chromeProps().costNote).toContain("It doesn't restart containers, and Console has no restart action.");
  });

  it("sends the deployment's leases again through the same request as the deployment page", async () => {
    const { chromeProps, requestAgain, listLeases } = setup();

    await chromeProps().onConfirm!("");

    expect(listLeases).toHaveBeenCalledWith({ dseq: "42" });
    expect(requestAgain).toHaveBeenCalledWith({ dseq: "42", leases: [{ gseq: 1, oseq: 2, provider: "akash1provider", state: "active" }] });
  });

  it("lets a refusal reach the card", async () => {
    const { chromeProps, requestAgain } = setup();
    requestAgain.mockRejectedValue(new Error("Refused"));

    await expect(chromeProps().onConfirm!("")).rejects.toThrow("Refused");
  });

  function setup() {
    const useDeploymentName = vi.fn((_dseq: string | null | undefined, _knownName?: string | null): string | null => "blog");
    const listLeases = vi.fn(async () => ({
      data: [{ id: { owner: "akash1owner", dseq: "42", gseq: 1, oseq: 2, provider: "akash1provider", bseq: 1 }, state: "active" }]
    }));
    const api = createProxy({ v1: { listLeases } }) as unknown as Container["api"];
    const requestAgain = vi.fn(async () => {});
    const ActionCardChrome = vi.fn((_props: ActionCardChromeProps) => null);
    const decision = mock<ActionCardDecision>({ status: "pending" });

    render(
      <SendManifestAgainCard
        action={{ type: "send_manifest_again", tier: "confirm", dseq: "42" }}
        decision={decision}
        dependencies={{
          useDeploymentName,
          useServices: () => Object.assign(mock<Container>(), { api }),
          useSendDeploymentAgain: () => mock<ReturnType<typeof DEPENDENCIES.useSendDeploymentAgain>>({ requestAgain }),
          ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome
        }}
      />
    );

    return { useDeploymentName, chromeProps: () => ActionCardChrome.mock.lastCall![0], requestAgain, listLeases, decision };
  }
});
