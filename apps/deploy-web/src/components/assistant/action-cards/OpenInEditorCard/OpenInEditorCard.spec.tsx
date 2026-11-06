import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { AssistantActionOf } from "@src/types/assistant";
import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./OpenInEditorCard";
import { OpenInEditorCard } from "./OpenInEditorCard";

import { render, screen } from "@testing-library/react";

type Action = AssistantActionOf<"open_in_editor">;

const STORED_SDL = [
  'version: "2.0"',
  "services:",
  "  web:",
  "    image: nginx",
  "profiles:",
  "  compute:",
  "    web:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          size: 1Gi",
  "  placement:",
  "    dcloud:",
  "      pricing:",
  "        web:",
  "          denom: uact",
  "          amount: 1000",
  "deployment:",
  "  web:",
  "    dcloud:",
  "      profile: web",
  "      count: 1",
  ""
].join("\n");
const SERVICELESS_SDL = 'version: "2.0"\nservices: {}\n';

describe("OpenInEditorCard", () => {
  it("describes a deployment-based draft and shows its SDL", () => {
    const { chromeProps } = setup({ action: { dseq: "42", templateId: "akash-network-awesome-akash-vllm", sdl: STORED_SDL } });

    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Open in the editor",
        tier: "deep_link",
        rows: [
          { label: "Based on deployment", value: "42" },
          { label: "Template", value: "akash-network-awesome-akash-vllm" },
          { label: "Secrets", value: "carried over" }
        ],
        costNote: "Nothing is deployed until you review it and click Deploy in the editor.",
        confirmLabel: "Open in editor",
        isConfirmDisabled: false
      })
    );
    expect(screen.getByText("SDL")).toBeInTheDocument();
  });

  it("opens a new SDL as a draft", async () => {
    const { chromeProps, redeploy, useDeploymentDefinition } = setup({ action: { sdl: STORED_SDL } });

    await chromeProps().onConfirm!("");

    expect(useDeploymentDefinition).toHaveBeenCalledWith(null, { acceptReferences: true });
    expect(redeploy).toHaveBeenCalledWith({ sdl: STORED_SDL, templateId: undefined });
    expect(screen.queryByText("Based on deployment")).not.toBeInTheDocument();
  });

  it("opens a template on its own", async () => {
    const { chromeProps, router } = setup({ action: { templateId: "akash-network-awesome-akash-vllm" } });

    await chromeProps().onConfirm!("");

    expect(router.push).toHaveBeenCalledWith("/new-deployment/configure?templateId=akash-network-awesome-akash-vllm");
    expect(screen.queryByText("SDL")).not.toBeInTheDocument();
  });

  it("opens a blank editor without anything to start from", async () => {
    const { chromeProps, router } = setup();

    await chromeProps().onConfirm!("");

    expect(router.push).toHaveBeenCalledWith("/new-deployment/configure");
  });

  it("redeploys a deployment from its current configuration with its secrets", async () => {
    const { chromeProps, redeploy } = setup({ action: { dseq: "42" } });

    await chromeProps().onConfirm!("");

    expect(redeploy).toHaveBeenCalledWith({ sdl: STORED_SDL, name: "web-app", sourceDseq: "42", templateId: undefined });
  });

  it("opens a changed SDL against a deployment so it inherits its secrets", async () => {
    const changed = STORED_SDL.replace("image: nginx", "image: nginx:2");
    const { chromeProps, redeploy } = setup({ action: { dseq: "42", sdl: changed } });

    await chromeProps().onConfirm!("");

    expect(redeploy).toHaveBeenCalledWith({ sdl: changed, name: "web-app", sourceDseq: "42", templateId: undefined });
  });

  it("doesn't carry secrets over to an SDL that would send them to another image", async () => {
    const withSecret = STORED_SDL.replace("    image: nginx\n", "    image: nginx\n    env:\n      - HF_TOKEN=ac-secret://HF_TOKEN\n");
    const { chromeProps, redeploy } = setup({
      action: { dseq: "42", sdl: withSecret.replace("image: nginx", "image: someone/else") },
      definition: { sdl: withSecret }
    });

    expect(chromeProps().rows).toContainEqual({ label: "Secrets", value: "re-enter them in the editor" });
    await chromeProps().onConfirm!("");

    expect(redeploy).toHaveBeenCalledWith({ sdl: withSecret.replace("image: nginx", "image: someone/else"), name: "web-app", templateId: undefined });
  });

  it("refuses an SDL that would change the deployment's pricing", async () => {
    const { chromeProps, redeploy } = setup({ action: { dseq: "42", sdl: STORED_SDL.replace("amount: 1000", "amount: 9000") } });

    await expect(chromeProps().onConfirm!("")).rejects.toThrow(
      "This change would touch pricing, which the assistant can't change. Edit pricing in the editor yourself."
    );
    expect(redeploy).not.toHaveBeenCalled();
  });

  it("refuses a new SDL the editor can't import instead of opening a blank deployment", async () => {
    const { chromeProps, redeploy } = setup({ action: { sdl: SERVICELESS_SDL } });

    await expect(chromeProps().onConfirm!("")).rejects.toThrow("The editor can't open this SDL. This SDL doesn't define any services to configure.");
    expect(redeploy).not.toHaveBeenCalled();
  });

  it("refuses a deployment whose configuration the editor can't import", async () => {
    const { chromeProps, redeploy } = setup({ action: { dseq: "42" }, definition: { sdl: SERVICELESS_SDL } });

    await expect(chromeProps().onConfirm!("")).rejects.toThrow("The editor can't open this SDL. This SDL doesn't define any services to configure.");
    expect(redeploy).not.toHaveBeenCalled();
  });

  it("waits for the deployment's configuration and refuses when there is none", async () => {
    const resolving = setup({ action: { dseq: "42" }, definition: { sdl: undefined, source: "resolving" } });
    expect(resolving.chromeProps().isConfirmDisabled).toBe(true);

    const absent = setup({ action: { dseq: "42" }, definition: { sdl: undefined, source: "absent" } });
    await expect(absent.chromeProps().onConfirm!("")).rejects.toThrow(
      "This deployment's configuration isn't available here. Redeploy it from its page instead."
    );
  });

  function setup(input: { action?: Partial<Action>; definition?: Partial<DeploymentDefinition> } = {}) {
    const action: Action = { type: "open_in_editor", tier: "deep_link", dseq: null, templateId: null, sdl: null, ...input.action };
    const definition: DeploymentDefinition = { sdl: STORED_SDL, name: "web-app", source: "api", ...input.definition };
    const useDeploymentDefinition = vi.fn<typeof DEPENDENCIES.useDeploymentDefinition>(() => definition);
    const redeploy = vi.fn<ReturnType<typeof DEPENDENCIES.useRedeploy>>();
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();
    const ActionCardChrome = vi.fn((props: ActionCardChromeProps) => <>{props.children}</>);
    const decision = mock<ActionCardDecision>({ status: "pending" });

    render(
      <OpenInEditorCard
        action={action}
        decision={decision}
        dependencies={{
          useDeploymentDefinition,
          useRedeploy: () => redeploy,
          useRouter: () => router,
          ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome
        }}
      />
    );

    return { chromeProps: () => ActionCardChrome.mock.lastCall![0], redeploy, router, useDeploymentDefinition };
  }
});
