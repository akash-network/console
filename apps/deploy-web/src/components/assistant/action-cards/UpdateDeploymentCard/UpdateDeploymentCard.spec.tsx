import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssistantActionOf } from "@src/types/assistant";
import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./UpdateDeploymentCard";
import { UpdateDeploymentCard } from "./UpdateDeploymentCard";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type Action = AssistantActionOf<"update_deployment">;

const BEFORE: Action["services"][number]["before"] = {
  image: "ghcr.io/acme/sdxl-api:1.4.1",
  command: null,
  args: null,
  envKeys: ["MODEL_ID", "LOG_LEVEL"],
  expose: [{ port: 80, as: 80, accept: [], global: true }],
  storage: []
};

describe("UpdateDeploymentCard", () => {
  it("shows the before and after of each change, and that resources and lease stay the same", () => {
    const { chromeProps, decision } = setup();

    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Update sdxl-image-api",
        scope: "service: web",
        tier: "confirm",
        decision,
        diff: {
          removed: ["image: ghcr.io/acme/sdxl-api:1.4.1", "LOG_LEVEL (current value)"],
          added: ["image: ghcr.io/acme/sdxl-api:1.4.2", "LOG_LEVEL=debug"],
          unchanged: "MODEL_ID unchanged"
        },
        rows: [
          { label: "Resources, provider, lease", value: "unchanged" },
          { label: "Downtime", value: "container restarts once" }
        ],
        costNote: undefined,
        confirmLabel: "Apply update"
      })
    );
  });

  it("leaves out downtime when only routing changes, and says which DNS record a new domain needs", () => {
    const { chromeProps } = setup({ action: { services: [{ service: "web", before: BEFORE, patch: { expose: { "80": { accept: ["api.example.com"] } } } }] } });

    expect(chromeProps().rows).toEqual([{ label: "Resources, provider, lease", value: "unchanged" }]);
    expect(chromeProps().costNote).toBe("Add a CNAME record for api.example.com that points to this service's current URI.");
  });

  it("names the deployment by dseq and counts services when several change", () => {
    const { chromeProps } = setup({
      action: {
        name: null,
        services: [
          { service: "web", before: BEFORE, patch: { image: "web:2" } },
          { service: "worker", before: BEFORE, patch: { image: "worker:2" } }
        ]
      }
    });

    expect(chromeProps().title).toBe("Update deployment 42");
    expect(chromeProps().scope).toBe("2 services");
  });

  it("applies the patch through the update tab's request, guarded on the version the card was built from", async () => {
    const { chromeProps, patch } = setup();

    await chromeProps().onConfirm!("");

    expect(patch).toHaveBeenCalledWith({
      dseq: "42",
      services: { web: { image: "ghcr.io/acme/sdxl-api:1.4.2", env: { LOG_LEVEL: "debug" } } },
      ifManifestVersion: "v1"
    });
  });

  it("lets other refusals reach the card", async () => {
    const { chromeProps, patch } = setup();
    patch.mockRejectedValue(new Error("Refused"));

    await expect(chromeProps().onConfirm!("")).rejects.toThrow("Refused");
    expect(screen.queryByRole("button", { name: "Redeploy in the editor" })).not.toBeInTheDocument();
  });

  it("offers a redeploy in the editor when the change needs a new deployment", async () => {
    const { chromeProps, patch, redeploy, useDeploymentDefinition } = setup();
    patch.mockRejectedValue(new ApiError(422, { code: "deployment_resources_changed" }, "422"));

    await act(() => expect(chromeProps().onConfirm!("")).rejects.toThrow("This change needs a new deployment. Redeploy in the editor to apply it."));
    await userEvent.click(screen.getByRole("button", { name: "Redeploy in the editor" }));

    expect(useDeploymentDefinition).toHaveBeenLastCalledWith("42", { acceptReferences: true });
    expect(redeploy).toHaveBeenCalledWith({ sdl: "version: 2.0", name: "sdxl-image-api", sourceDseq: "42" });
  });

  it("reads no definition until a redeploy is needed", () => {
    const { useDeploymentDefinition } = setup();

    expect(useDeploymentDefinition).toHaveBeenCalledWith(null, { acceptReferences: true });
  });

  it("keeps the redeploy button disabled until the definition is read", async () => {
    const { chromeProps, patch } = setup({ definitionSdl: undefined });
    patch.mockRejectedValue(new ApiError(422, { code: "deployment_resources_changed" }, "422"));

    await act(() => expect(chromeProps().onConfirm!("")).rejects.toThrow());

    expect(screen.getByRole("button", { name: "Redeploy in the editor" })).toBeDisabled();
  });

  function setup(input: { action?: Partial<Action>; definitionSdl?: string } = {}) {
    const action: Action = {
      type: "update_deployment",
      tier: "confirm",
      dseq: "42",
      name: "sdxl-image-api",
      manifestVersion: "v1",
      services: [{ service: "web", before: BEFORE, patch: { image: "ghcr.io/acme/sdxl-api:1.4.2", env: { LOG_LEVEL: "debug" } } }],
      ...input.action
    };
    const patch = vi.fn<ReturnType<typeof DEPENDENCIES.useAssistantDeploymentPatch>>(async () => undefined);
    const redeploy = vi.fn();
    const sdl = "definitionSdl" in input ? input.definitionSdl : "version: 2.0";
    const useDeploymentDefinition = vi.fn<typeof DEPENDENCIES.useDeploymentDefinition>(() => ({
      sdl,
      name: "sdxl-image-api",
      source: sdl ? "api" : "resolving"
    }));
    const ActionCardChrome = vi.fn((props: ActionCardChromeProps) => <>{props.children}</>);
    const decision = mock<ActionCardDecision>({ status: "pending" });

    render(
      <UpdateDeploymentCard
        action={action}
        decision={decision}
        dependencies={{
          useAssistantDeploymentPatch: () => patch,
          useDeploymentDefinition,
          useRedeploy: () => redeploy,
          ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome
        }}
      />
    );

    return { chromeProps: () => ActionCardChrome.mock.lastCall![0], patch, redeploy, useDeploymentDefinition, decision };
  }
});
