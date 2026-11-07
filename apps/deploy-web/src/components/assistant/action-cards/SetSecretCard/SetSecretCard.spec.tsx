import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { AssistantConversationClient } from "@src/services/assistant-conversation/assistant-conversation-client";
import type { AssistantActionOf } from "@src/types/assistant";
import type { SdlSecretsSealContext } from "@src/utils/sdl/sealSdlSecrets";
import type { DEPENDENCIES as SECURE_INPUT_DEPENDENCIES } from "../../SecureSecretInput/SecureSecretInput";
import { SecureSecretInput, useSecureSecretInput } from "../../SecureSecretInput/SecureSecretInput";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { DEPENDENCIES as DECISION_DEPENDENCIES } from "../useActionCardDecision/useActionCardDecision";
import { useActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./SetSecretCard";
import { SetSecretCard } from "./SetSecretCard";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type Container = ReturnType<typeof DEPENDENCIES.useServices>;

const SECRET_VALUE = "hf_live_9c1f2e7d4b";
const SEAL_CONTEXT: SdlSecretsSealContext = { kid: "k-1", sub: "user-1", jwk: { kty: "RSA", n: "n", e: "AQAB" } };
const STORED_SDL = "services:\n  web:\n    env:\n      - OTHER=ac-secret://HF_TOKEN\n";

describe("SetSecretCard", () => {
  it("asks for the value in a secure input and keeps Save off until one is typed", async () => {
    setup();

    expect(screen.getByRole("region", { name: "Add a secret to blog" })).toHaveTextContent("HF_TOKEN");
    expect(screen.getByLabelText("Value")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Save secret" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Value"), SECRET_VALUE);

    expect(screen.getByRole("button", { name: "Save secret" })).toBeEnabled();
  });

  it("says when it replaces a secret the service already has", () => {
    setup({ replacesExisting: true });

    expect(screen.getByRole("region", { name: "Replace a secret in blog" })).toBeInTheDocument();
  });

  it("seals the value under a name the deployment doesn't use yet and references it from the variable", async () => {
    const { patch, sealSdlSecrets } = setup();

    await saveSecret();

    expect(sealSdlSecrets).toHaveBeenCalledWith({ context: SEAL_CONTEXT, secrets: { HF_TOKEN_2: SECRET_VALUE } });
    expect(patch).toHaveBeenCalledWith({
      dseq: "42",
      services: { web: { env: { HF_TOKEN: "ac-secret://HF_TOKEN_2" } } },
      sealedSecrets: "sealed-jwe"
    });
    expect(await screen.findByText("Secret saved. Follow the rollout in Activities.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
  });

  it("never lets the value reach the assistant, the recorded decision, analytics or the patch in the clear", async () => {
    const { patch, recordResult, assistantConversation, analyticsService } = setup();

    await saveSecret();
    await waitFor(() => expect(recordResult).toHaveBeenCalled());

    expect(recordResult).toHaveBeenCalledWith({
      id: "conversation-1",
      data: { proposalId: "proposal-1", actionType: "set_secret", decision: "confirmed", outcome: "succeeded" }
    });
    expect(JSON.stringify(recordResult.mock.calls)).not.toContain(SECRET_VALUE);
    expect(JSON.stringify(patch.mock.calls)).not.toContain(SECRET_VALUE);
    expect(assistantConversation.sendMessage).not.toHaveBeenCalled();
    expect(assistantConversation.submitClientToolResults).not.toHaveBeenCalled();
    expect(JSON.stringify(analyticsService.track.mock.calls)).not.toContain(SECRET_VALUE);
  });

  it("keeps the value out of the recorded failure too", async () => {
    const { patch, recordResult } = setup();
    patch.mockRejectedValue(new Error("Refused"));

    await saveSecret();
    await waitFor(() => expect(recordResult).toHaveBeenCalled());

    expect(recordResult).toHaveBeenCalledWith({
      id: "conversation-1",
      data: { proposalId: "proposal-1", actionType: "set_secret", decision: "confirmed", outcome: "failed", error: "Refused" }
    });
    expect(JSON.stringify(recordResult.mock.calls)).not.toContain(SECRET_VALUE);
    expect(screen.getByLabelText("Value")).toHaveValue("");
  });

  it("forgets the typed value when the card is cancelled", async () => {
    const { sealSdlSecrets } = setup();
    await userEvent.type(screen.getByLabelText("Value"), SECRET_VALUE);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
    expect(sealSdlSecrets).not.toHaveBeenCalled();
  });

  async function saveSecret() {
    await userEvent.type(screen.getByLabelText("Value"), SECRET_VALUE);
    await userEvent.click(screen.getByRole("button", { name: "Save secret" }));
  }

  function setup(input: { replacesExisting?: boolean } = {}) {
    const useDeploymentName = vi.fn((_dseq: string | null | undefined, _knownName?: string | null): string | null => "blog");
    const action: AssistantActionOf<"set_secret"> = {
      type: "set_secret",
      tier: "confirm",
      dseq: "42",
      service: "web",
      name: "HF_TOKEN",
      replacesExisting: input.replacesExisting ?? false
    };
    const getDeployment = vi.fn(async () => ({ data: { consoleSettings: { sdl: STORED_SDL } } }));
    const getSDLSecretsContext = vi.fn(async () => ({ data: SEAL_CONTEXT }));
    const api = createProxy({ v1: { getDeployment, getSDLSecretsContext } }) as unknown as Container["api"];
    const assistantConversation = mock<AssistantConversationClient>();
    const analyticsService = mock<AnalyticsService>();
    const services = Object.assign(mock<Container>(), { api, assistantConversation, analyticsService });
    const sealSdlSecrets = vi.fn<typeof SECURE_INPUT_DEPENDENCIES.sealSdlSecrets>(async () => "sealed-jwe");
    const patch = vi.fn<ReturnType<typeof DEPENDENCIES.useAssistantDeploymentPatch>>(async () => undefined);
    const recordResult = vi.fn(async () => ({ data: { recorded: true } }));

    function Harness() {
      const decision = useActionCardDecision(
        { conversationId: "conversation-1", proposalId: "proposal-1", actionType: "set_secret" },
        {
          useRecordAssistantActionResultMutation: () =>
            mock<ReturnType<typeof DECISION_DEPENDENCIES.useRecordAssistantActionResultMutation>>({ mutateAsync: recordResult })
        }
      );

      return (
        <SetSecretCard
          action={action}
          decision={decision}
          dependencies={{
            useDeploymentName,
            useServices: () => services,
            useSecureSecretInput: () => useSecureSecretInput({ useServices: () => services, sealSdlSecrets }),
            useAssistantDeploymentPatch: () => patch,
            ActionCardChrome,
            SecureSecretInput
          }}
        />
      );
    }

    render(
      <TestContainerProvider services={{ api: () => api }}>
        <Harness />
      </TestContainerProvider>
    );

    return { useDeploymentName, patch, sealSdlSecrets, recordResult, assistantConversation, analyticsService, getDeployment };
  }
});
