import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssistantActionOf } from "@src/types/assistant";
import type { SdlSecretsSealContext } from "@src/utils/sdl/sealSdlSecrets";
import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./CreateDeploymentCard";
import { CreateDeploymentCard } from "./CreateDeploymentCard";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type Action = AssistantActionOf<"create_deployment">;
type Container = ReturnType<typeof DEPENDENCIES.useServices>;

const SEAL_CONTEXT: SdlSecretsSealContext = { kid: "k-1", sub: "user-1", jwk: { kty: "RSA", n: "n", e: "AQAB" } };
const SDL = "services:\n  web:\n    image: vllm/vllm-openai:v0.6.3\n    expose:\n      - port: 8000\n        as: 80\n";
const WEB: Action["services"][number] = {
  service: "web",
  image: "vllm/vllm-openai:v0.6.3",
  resources: { cpu: 8, memory: "32Gi", storage: ["100Gi"], gpu: { units: 1, models: ["nvidia/rtx4090"] }, count: 1 }
};

describe("CreateDeploymentCard", () => {
  it("shows what will be deployed, how many providers can bid now and the runtime limit", () => {
    const { chromeProps, decision } = setup();

    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Deploy llama-8b-vllm",
        scope: "from template",
        tier: "confirm",
        decision,
        rows: [
          { label: "Image", value: "vllm/vllm-openai:v0.6.3" },
          { label: "GPU", value: "1× RTX4090" },
          { label: "CPU / memory / storage", value: "8 CPU / 32Gi / 100Gi" },
          { label: "Port", value: "8000 to 80 (HTTP)" },
          { label: "Providers able to bid now", value: "11" },
          { label: "Runtime limit", value: "4 hours" }
        ],
        costNote: "A provider is picked automatically. Billing starts when the lease starts.",
        confirmLabel: "Deploy"
      })
    );
  });

  it("labels each service's rows and leaves out what the action doesn't carry", () => {
    const worker: Action["services"][number] = { service: "worker", image: null, resources: { cpu: 1, memory: "1Gi", storage: [], gpu: null, count: 3 } };
    const { chromeProps } = setup({ action: { name: null, templateId: null, providersAbleToBid: null, runtimeLimitHours: null, services: [WEB, worker] } });

    expect(chromeProps().title).toBe("Deploy web + worker");
    expect(chromeProps().scope).toBeUndefined();
    expect(chromeProps().rows).toEqual([
      { label: "web image", value: "vllm/vllm-openai:v0.6.3" },
      { label: "web gpu", value: "1× RTX4090" },
      { label: "web cpu / memory / storage", value: "8 CPU / 32Gi / 100Gi" },
      { label: "web port", value: "8000 to 80 (HTTP)" },
      { label: "worker image", value: "none" },
      { label: "worker cpu / memory / storage", value: "1 CPU / 1Gi / no storage" },
      { label: "worker replicas", value: "3" }
    ]);
  });

  it("shows the generated SDL on request", async () => {
    setup();

    await userEvent.click(screen.getByText("Generated SDL"));

    expect(screen.getByText(/vllm\/vllm-openai:v0\.6\.3/, { selector: "pre" })).toBeVisible();
  });

  it("deploys the way one-click deploy does, sealed and leased in the background", async () => {
    const { chromeProps, createDeployment, sealSdlSecrets, recordOneClickDeploy, queryClient } = setup();

    await act(() => chromeProps().onConfirm!(""));

    expect(sealSdlSecrets).toHaveBeenCalledWith({ context: SEAL_CONTEXT, secrets: {}, sdl: SDL });
    expect(createDeployment).toHaveBeenCalledWith({
      async: "true",
      autoLease: "true",
      data: { sdl: SDL, sealedSecrets: "empty-seal", name: "llama-8b-vllm", templateId: "akash-network-awesome-akash-vllm", runtimeLimitHours: 4 }
    });
    expect(recordOneClickDeploy).toHaveBeenCalledWith("1234", "akash-network-awesome-akash-vllm");
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "listActivities"] });
    expect(chromeProps().successMessage).toBe("Deploying 1234. Console picks a provider and starts the lease. Follow it in Activities.");
  });

  it("leaves the optional fields out of the create when the action has none", async () => {
    const { chromeProps, createDeployment, recordOneClickDeploy } = setup({ action: { name: null, templateId: null, runtimeLimitHours: null } });

    await act(() => chromeProps().onConfirm!(""));

    expect(createDeployment).toHaveBeenCalledWith(expect.objectContaining({ data: { sdl: SDL, sealedSecrets: "empty-seal" } }));
    expect(recordOneClickDeploy).toHaveBeenCalledWith("1234", undefined);
  });

  it("points to choosing a provider when Console doesn't lease it in the background", async () => {
    const { chromeProps, createDeployment, recordOneClickDeploy } = setup({ decisionStatus: "succeeded" });
    createDeployment.mockResolvedValue({ data: { dseq: "1234", manifest: "m", activityId: "activity-1" } });

    await act(() => chromeProps().onConfirm!(""));

    expect(recordOneClickDeploy).not.toHaveBeenCalled();
    expect(chromeProps().successMessage).toBe("Created deployment 1234. Choose a provider to start it.");
    expect(screen.getByRole("link", { name: "Choose a provider" })).toHaveAttribute("href", "/new-deployment/configure/1234");
  });

  it("explains a project budget refusal", async () => {
    const { chromeProps, createDeployment } = setup();
    createDeployment.mockRejectedValue(new ApiError(403, { code: "project_budget_exceeded", message: "over budget" }, "403"));

    await expect(chromeProps().onConfirm!("")).rejects.toThrow(
      "Starting this deployment would take the project past its monthly budget. An owner or admin can raise the budget."
    );
  });

  it("lets other refusals reach the card", async () => {
    const { chromeProps, createDeployment } = setup();
    const refusal = new ApiError(400, { message: "invalid SDL" }, "400");
    createDeployment.mockRejectedValue(refusal);

    await expect(chromeProps().onConfirm!("")).rejects.toBe(refusal);
  });

  it("opens the SDL in the editor as a draft", async () => {
    const { decision, createConfigureDraft, router } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Open in editor" }));

    expect(createConfigureDraft).toHaveBeenCalledWith(SDL, { name: "llama-8b-vllm" });
    expect(decision.markOpened).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/new-deployment/configure?templateId=akash-network-awesome-akash-vllm&draftId=draft-1");
  });

  it("opens an unnamed SDL in the editor without a name", async () => {
    const { createConfigureDraft } = setup({ action: { name: null } });

    await userEvent.click(screen.getByRole("button", { name: "Open in editor" }));

    expect(createConfigureDraft).toHaveBeenCalledWith(SDL, {});
  });

  it("stops offering the editor once deploying", () => {
    setup({ decisionStatus: "running" });

    expect(screen.queryByRole("button", { name: "Open in editor" })).not.toBeInTheDocument();
  });

  function setup(input: { action?: Partial<Action>; decisionStatus?: ActionCardDecision["status"] } = {}) {
    const action: Action = {
      type: "create_deployment",
      tier: "confirm",
      templateId: "akash-network-awesome-akash-vllm",
      sdl: SDL,
      name: "llama-8b-vllm",
      runtimeLimitHours: 4,
      services: [WEB],
      providersAbleToBid: 11,
      ...input.action
    };
    const createDeployment = vi.fn<(input: unknown) => Promise<{ data: Record<string, unknown> }>>(async () => ({
      data: { dseq: "1234", manifest: "m", activityId: "activity-1", autoLease: true }
    }));
    const getSDLSecretsContext = vi.fn(async () => ({ data: SEAL_CONTEXT }));
    const api = createProxy({ v1: { createDeployment, getSDLSecretsContext, listActivities: vi.fn() } }) as unknown as Container["api"];
    const queryClient = mock<QueryClient>({ invalidateQueries: vi.fn(async () => undefined) });
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();
    const recordOneClickDeploy = vi.fn();
    const sealSdlSecrets = vi.fn<typeof DEPENDENCIES.sealSdlSecrets>(async () => "empty-seal");
    const createConfigureDraft = vi.fn<typeof DEPENDENCIES.createConfigureDraft>(() => "draft-1");
    const ActionCardChrome = vi.fn((props: ActionCardChromeProps) => <>{props.children}</>);
    const decision = mock<ActionCardDecision>({ status: input.decisionStatus ?? "pending" });

    render(
      <TestContainerProvider>
        <CreateDeploymentCard
          action={action}
          decision={decision}
          dependencies={{
            useServices: () => Object.assign(mock<Container>(), { api }),
            useQueryClient: () => queryClient,
            useRouter: () => router,
            useRecordOneClickDeploy: () => recordOneClickDeploy,
            ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome,
            sealSdlSecrets,
            createConfigureDraft
          }}
        />
      </TestContainerProvider>
    );

    return {
      chromeProps: () => ActionCardChrome.mock.lastCall![0],
      createDeployment,
      sealSdlSecrets,
      recordOneClickDeploy,
      queryClient,
      router,
      createConfigureDraft,
      decision
    };
  }
});
