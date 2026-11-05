import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssistantActionOf } from "@src/types/assistant";
import type { SdlSecretsSealContext } from "@src/utils/sdl/sealSdlSecrets";
import type { DEPENDENCIES as SECURE_INPUT_DEPENDENCIES } from "../../SecureSecretInput/SecureSecretInput";
import { SecureSecretInput, useSecureSecretInput } from "../../SecureSecretInput/SecureSecretInput";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { DEPENDENCIES as DECISION_DEPENDENCIES } from "../useActionCardDecision/useActionCardDecision";
import { useActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./SetRegistryCredentialsCard";
import { SetRegistryCredentialsCard } from "./SetRegistryCredentialsCard";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type Container = ReturnType<typeof DEPENDENCIES.useServices>;

const PASSWORD = "ghp_registry_token_77";
const SEAL_CONTEXT: SdlSecretsSealContext = { kid: "k-1", sub: "user-1", jwk: { kty: "RSA", n: "n", e: "AQAB" } };

describe("SetRegistryCredentialsCard", () => {
  it("shows the registry and image, prefills the username and keeps Save off until a password is typed", async () => {
    setup();

    const card = screen.getByRole("region", { name: "Add registry credentials to deployment 42" });
    expect(card).toHaveTextContent("ghcr.io");
    expect(card).toHaveTextContent("ghcr.io/acme/private:1.0");
    expect(screen.getByLabelText("Username")).toHaveValue("acme-bot");
    expect(screen.getByLabelText("Password or token")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Save credentials" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Password or token"), PASSWORD);

    expect(screen.getByRole("button", { name: "Save credentials" })).toBeEnabled();
  });

  it("needs a username too", async () => {
    setup({ usernameHint: null, image: null });

    expect(screen.queryByText("Image")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Password or token"), PASSWORD);
    expect(screen.getByRole("button", { name: "Save credentials" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Username"), "  bot  ");
    expect(screen.getByRole("button", { name: "Save credentials" })).toBeEnabled();
  });

  it("seals the username and password together and sends only their references, like the update tab", async () => {
    const { patch, sealSdlSecrets, recordResult } = setup();
    await userEvent.clear(screen.getByLabelText("Username"));
    await userEvent.type(screen.getByLabelText("Username"), " acme-ci ");
    await userEvent.type(screen.getByLabelText("Password or token"), PASSWORD);

    await userEvent.click(screen.getByRole("button", { name: "Save credentials" }));
    await waitFor(() => expect(recordResult).toHaveBeenCalled());

    expect(sealSdlSecrets).toHaveBeenCalledWith({ context: SEAL_CONTEXT, secrets: { REGISTRY_USERNAME: "acme-ci", REGISTRY_PASSWORD_2: PASSWORD } });
    expect(patch).toHaveBeenCalledWith({
      dseq: "42",
      services: { web: { credentials: { host: "ghcr.io", username: "ac-secret://REGISTRY_USERNAME", password: "ac-secret://REGISTRY_PASSWORD_2" } } },
      sealedSecrets: "sealed-jwe"
    });
    expect(JSON.stringify([patch.mock.calls, recordResult.mock.calls])).not.toContain(PASSWORD);
    expect(JSON.stringify([patch.mock.calls, recordResult.mock.calls])).not.toContain("acme-ci");
    expect(screen.queryByLabelText("Password or token")).not.toBeInTheDocument();
  });

  it("drops the inputs once cancelled", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Password or token")).not.toBeInTheDocument();
  });

  function setup(input: { usernameHint?: string | null; image?: string | null } = {}) {
    const action: AssistantActionOf<"set_registry_credentials"> = {
      type: "set_registry_credentials",
      tier: "confirm",
      dseq: "42",
      service: "web",
      image: "image" in input ? input.image! : "ghcr.io/acme/private:1.0",
      host: "ghcr.io",
      usernameHint: "usernameHint" in input ? input.usernameHint! : "acme-bot"
    };
    const getDeployment = vi.fn(async () => ({
      data: { consoleSettings: { sdl: "services:\n  web:\n    credentials:\n      password: ac-secret://REGISTRY_PASSWORD\n" } }
    }));
    const getSDLSecretsContext = vi.fn(async () => ({ data: SEAL_CONTEXT }));
    const api = createProxy({ v1: { getDeployment, getSDLSecretsContext } }) as unknown as Container["api"];
    const services = Object.assign(mock<Container>(), { api });
    const sealSdlSecrets = vi.fn<typeof SECURE_INPUT_DEPENDENCIES.sealSdlSecrets>(async () => "sealed-jwe");
    const patch = vi.fn<ReturnType<typeof DEPENDENCIES.useAssistantDeploymentPatch>>(async () => undefined);
    const recordResult = vi.fn(async () => ({ data: { recorded: true } }));

    function Harness() {
      const decision = useActionCardDecision(
        { conversationId: "conversation-1", proposalId: "proposal-1", actionType: "set_registry_credentials" },
        {
          useRecordAssistantActionResultMutation: () =>
            mock<ReturnType<typeof DECISION_DEPENDENCIES.useRecordAssistantActionResultMutation>>({ mutateAsync: recordResult })
        }
      );

      return (
        <SetRegistryCredentialsCard
          action={action}
          decision={decision}
          dependencies={{
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

    return { patch, sealSdlSecrets, recordResult };
  }
});
