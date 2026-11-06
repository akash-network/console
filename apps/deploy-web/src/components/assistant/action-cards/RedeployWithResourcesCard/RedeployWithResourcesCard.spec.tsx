import yaml from "js-yaml";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { AssistantActionOf } from "@src/types/assistant";
import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import type { ServiceResources } from "../serviceResourcesFormat/serviceResourcesFormat";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./RedeployWithResourcesCard";
import { RedeployWithResourcesCard } from "./RedeployWithResourcesCard";

import { render } from "@testing-library/react";

type Action = AssistantActionOf<"redeploy_with_resources">;

const SDL = `
services:
  web:
    image: vllm/vllm-openai:v0.6.3
    env:
      - HF_TOKEN=ac-secret://HF_TOKEN
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 8
        memory:
          size: 16Gi
        storage:
          size: 100Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uact
          amount: 10000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

const BEFORE: ServiceResources = { cpu: 8, memory: "16Gi", storage: ["100Gi"], gpu: null, count: 1 };

describe("RedeployWithResourcesCard", () => {
  it("shows the resource change, why, and what happens to the old deployment", () => {
    const { chromeProps, decision } = setup();

    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Redeploy llama with new resources",
        tier: "deep_link",
        decision,
        diff: {
          removed: ["CPU / memory / storage: 8 CPU / 16Gi / 100Gi"],
          added: ["CPU / memory / storage: 8 CPU / 32Gi / 100Gi"],
          unchanged: "Image, env, ports and pricing unchanged"
        },
        rows: [{ label: "Why", value: "The container ran out of memory." }],
        costNote: "Opens a new deployment in the editor with your current secrets. The old one keeps running, and billing, until you close it.",
        confirmLabel: "Open in editor",
        isConfirmDisabled: false
      })
    );
  });

  it("lists GPU and replica changes per service when several change", () => {
    const { chromeProps } = setup({
      services: [
        { service: "web", before: BEFORE, after: { ...BEFORE, gpu: { units: 1, models: ["nvidia/h100"] } } },
        { service: "worker", before: BEFORE, after: { ...BEFORE, count: 3 } }
      ]
    });

    expect(chromeProps().diff).toEqual({
      removed: ["web: GPU: none", "worker: replicas: 1"],
      added: ["web: GPU: 1× H100", "worker: replicas: 3"],
      unchanged: "Image, env, ports and pricing unchanged"
    });
  });

  it("counts an unset replica count as one", () => {
    const { chromeProps } = setup({ services: [{ service: "web", before: { ...BEFORE, count: null }, after: { ...BEFORE, count: 2 } }] });

    expect(chromeProps().diff?.removed).toEqual(["replicas: 1"]);
  });

  it("opens a draft with only the new resources that inherits the deployment's secrets", async () => {
    const { chromeProps, redeploy, useDeploymentDefinition } = setup();

    await chromeProps().onConfirm!("");

    expect(useDeploymentDefinition).toHaveBeenCalledWith("42", { acceptReferences: true });
    const { sdl, ...rest } = redeploy.mock.calls[0][0];
    expect(rest).toEqual({ name: "llama", sourceDseq: "42" });
    const document = yaml.load(sdl!) as { profiles: { compute: { web: { resources: { memory: unknown } } } } };
    expect(document.profiles.compute.web.resources.memory).toEqual({ size: "32Gi" });
  });

  it("starts from the values this browser restored when there are some", async () => {
    const { chromeProps, redeploy } = setup({ definition: { restoredSdl: SDL.replace("vllm-openai:v0.6.3", "vllm-openai:restored") } });

    await chromeProps().onConfirm!("");

    expect(redeploy.mock.calls[0][0].sdl).toContain("vllm-openai:restored");
  });

  it("waits for the deployment's configuration and refuses when there is none", async () => {
    const resolving = setup({ definition: { sdl: undefined, name: undefined, source: "resolving" } });
    expect(resolving.chromeProps().isConfirmDisabled).toBe(true);
    expect(resolving.chromeProps().title).toBe("Redeploy deployment 42 with new resources");

    const absent = setup({ definition: { sdl: undefined, name: undefined, source: "absent" } });
    await expect(absent.chromeProps().onConfirm!("")).rejects.toThrow(
      "This deployment's configuration isn't available here. Redeploy it from its page instead."
    );
    expect(absent.redeploy).not.toHaveBeenCalled();
  });

  it("refuses a rewrite that would move the pricing", async () => {
    const pricingAliasingThePlacement = SDL.replace(
      "        web:\n          denom: uact\n          amount: 10000\n",
      "        web: &placement\n          profile: web\n          count: 1\n"
    ).replace("    dcloud:\n      profile: web\n      count: 1\n", "    dcloud: *placement\n");
    const { chromeProps, redeploy } = setup({
      definition: { sdl: pricingAliasingThePlacement },
      services: [{ service: "web", before: BEFORE, after: { ...BEFORE, count: 2 } }]
    });

    await expect(chromeProps().onConfirm!("")).rejects.toThrow(
      "This change would touch pricing, which the assistant can't change. Edit pricing in the editor yourself."
    );
    expect(redeploy).not.toHaveBeenCalled();
  });

  function setup(input: { services?: Action["services"]; definition?: Partial<DeploymentDefinition> } = {}) {
    const action: Action = {
      type: "redeploy_with_resources",
      tier: "deep_link",
      dseq: "42",
      reason: "The container ran out of memory.",
      services: input.services ?? [{ service: "web", before: BEFORE, after: { ...BEFORE, memory: "32Gi" } }]
    };
    const definition: DeploymentDefinition = { sdl: SDL, name: "llama", source: "api", ...input.definition };
    const useDeploymentDefinition = vi.fn<typeof DEPENDENCIES.useDeploymentDefinition>(() => definition);
    const redeploy = vi.fn<ReturnType<typeof DEPENDENCIES.useRedeploy>>();
    const ActionCardChrome = vi.fn((_props: ActionCardChromeProps) => null);
    const decision = mock<ActionCardDecision>({ status: "pending" });

    render(
      <RedeployWithResourcesCard
        action={action}
        decision={decision}
        dependencies={{
          useDeploymentDefinition,
          useRedeploy: () => redeploy,
          ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome
        }}
      />
    );

    return { chromeProps: () => ActionCardChrome.mock.lastCall![0], redeploy, useDeploymentDefinition, decision };
  }
});
