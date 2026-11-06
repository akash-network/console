import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import type { SdlSecretsSealContext } from "@src/utils/sdl/sealSdlSecrets";
import type { SecureSecretInputState } from "./SecureSecretInput";
import { DEPENDENCIES, SecureSecretInput, useSecureSecretInput } from "./SecureSecretInput";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type Container = ReturnType<typeof DEPENDENCIES.useServices>;

const SEAL_CONTEXT: SdlSecretsSealContext = { kid: "k-1", sub: "user-1", jwk: { kty: "RSA", n: "n", e: "AQAB" } };

describe(SecureSecretInput.name, () => {
  it("masks the value and explains where it goes", () => {
    setup();

    expect(screen.getByLabelText("Value")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Value")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByText(/The assistant never sees it/)).toBeInTheDocument();
  });

  it("tells the card when a value was typed", async () => {
    const { secret } = setup();
    expect(secret().hasValue).toBe(false);

    await userEvent.type(screen.getByLabelText("Value"), "hf_123");

    expect(secret().hasValue).toBe(true);
  });

  it("seals the typed value under its name with the seal context, then clears it", async () => {
    const { secret, sealSdlSecrets, getSDLSecretsContext } = setup();
    await userEvent.type(screen.getByLabelText("Value"), "hf_123");

    let sealed = "";
    await act(async () => {
      sealed = await secret().sealAndClear("HF_TOKEN");
    });

    expect(sealed).toBe("sealed-jwe");
    expect(getSDLSecretsContext).toHaveBeenCalled();
    expect(sealSdlSecrets).toHaveBeenCalledWith({ context: SEAL_CONTEXT, secrets: { HF_TOKEN: "hf_123" } });
    expect(screen.getByLabelText("Value")).toHaveValue("");
    expect(secret().hasValue).toBe(false);
  });

  it("seals values the card passes alongside into the same seal", async () => {
    const { secret, sealSdlSecrets } = setup();
    await userEvent.type(screen.getByLabelText("Value"), "hunter2");

    await act(async () => {
      await secret().sealAndClear("REGISTRY_PASSWORD", { REGISTRY_USERNAME: "acme-bot" });
    });

    expect(sealSdlSecrets).toHaveBeenCalledWith({ context: SEAL_CONTEXT, secrets: { REGISTRY_USERNAME: "acme-bot", REGISTRY_PASSWORD: "hunter2" } });
  });

  it("clears the value even when sealing fails", async () => {
    const { secret, sealSdlSecrets } = setup();
    sealSdlSecrets.mockRejectedValue(new Error("bad key"));
    await userEvent.type(screen.getByLabelText("Value"), "hf_123");

    await act(() => expect(secret().sealAndClear("HF_TOKEN")).rejects.toThrow("bad key"));

    expect(screen.getByLabelText("Value")).toHaveValue("");
  });

  it("clears the value on request", async () => {
    const { secret } = setup();
    await userEvent.type(screen.getByLabelText("Value"), "hf_123");

    act(() => secret().clear());

    expect(screen.getByLabelText("Value")).toHaveValue("");
  });

  it("can be disabled while the card runs", () => {
    setup({ disabled: true });

    expect(screen.getByLabelText("Value")).toBeDisabled();
  });

  function setup(input: { disabled?: boolean } = {}) {
    const getSDLSecretsContext = vi.fn(async () => ({ data: SEAL_CONTEXT }));
    const api = createProxy({ v1: { getSDLSecretsContext } }) as unknown as Container["api"];
    const sealSdlSecrets = vi.fn<typeof DEPENDENCIES.sealSdlSecrets>(async () => "sealed-jwe");
    let state: SecureSecretInputState | undefined;

    function Harness() {
      state = useSecureSecretInput({ ...DEPENDENCIES, sealSdlSecrets });
      return <SecureSecretInput label="Value" secret={state} disabled={input.disabled} />;
    }

    render(
      <TestContainerProvider services={{ api: () => api }}>
        <Harness />
      </TestContainerProvider>
    );

    return { secret: () => state!, sealSdlSecrets, getSDLSecretsContext };
  }
});
