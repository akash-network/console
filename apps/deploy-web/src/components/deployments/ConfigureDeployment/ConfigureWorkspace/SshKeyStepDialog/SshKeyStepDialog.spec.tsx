import type { ComponentProps, PropsWithChildren } from "react";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SshPublicKeyField } from "@src/components/deployments/ConfigureDeployment/ConfigurationPane/SshPublicKeyField/SshPublicKeyField";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement, SSH_VM_IMAGES } from "@src/utils/sdl/data";
import type { DEPENDENCIES, SshKeyStepSource } from "./SshKeyStepDialog";
import { SshKeyStepDialog } from "./SshKeyStepDialog";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(SshKeyStepDialog.name, () => {
  it("tracks that the step opened and where from", () => {
    const { analyticsService } = setup({ source: "choose_provider" });

    expect(analyticsService.track).toHaveBeenCalledWith("configure_ssh_key_step_opened", { category: "deployments", source: "choose_provider" });
  });

  it("explains on a new VM setup that the key is how the user signs in", () => {
    setup({ source: "setup" });

    expect(screen.getByRole("dialog", { name: "Add an SSH key" })).toHaveAccessibleDescription(/^You sign in to your VM with an SSH key\./);
  });

  it("explains from Choose provider that the key comes before a provider", () => {
    setup({ source: "choose_provider" });

    expect(screen.getByRole("dialog", { name: "Add an SSH key" })).toHaveAccessibleDescription(/^Your VM needs an SSH key before you can choose a provider\./);
  });

  it("asks for the key of the service missing one", () => {
    const { dependencies } = setup({ source: "setup" });

    expect(dependencies.SshPublicKeyField).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 0 }), expect.anything());
  });

  it("holds Continue until a key is entered", () => {
    setup({ source: "choose_provider" });

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("holds Continue for a service whose key was never set", () => {
    setup({ source: "setup", sshPubKey: undefined });

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("holds Continue while the key is only whitespace", async () => {
    setup({ source: "choose_provider" });

    await userEvent.type(screen.getByRole("textbox", { name: "SSH public key" }), "   ");

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("continues with a pasted key and tracks it", async () => {
    const { analyticsService, onContinue } = setup({ source: "choose_provider" });

    await userEvent.type(screen.getByRole("textbox", { name: "SSH public key" }), "ssh-ed25519 AAAA");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(analyticsService.track).toHaveBeenCalledWith("configure_ssh_key_step_completed", {
      category: "deployments",
      source: "choose_provider",
      method: "pasted"
    });
  });

  it("continues when Enter is pressed in the key field", async () => {
    const { onContinue } = setup({ source: "setup" });

    await userEvent.type(screen.getByRole("textbox", { name: "SSH public key" }), "ssh-ed25519 AAAA{Enter}");

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("ignores a submit without a key", () => {
    const { onContinue, analyticsService } = setup({ source: "setup" });

    const isDefaultAllowed = fireEvent.submit(screen.getByRole("textbox", { name: "SSH public key" }));

    expect(isDefaultAllowed).toBe(false);
    expect(onContinue).not.toHaveBeenCalled();
    expect(analyticsService.track).not.toHaveBeenCalledWith("configure_ssh_key_step_completed", expect.anything());
  });

  it("continues as soon as a key pair is generated and tracks it", async () => {
    const { analyticsService, onContinue } = setup({ source: "setup" });

    await userEvent.click(screen.getByRole("button", { name: "Generate new key" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(analyticsService.track).toHaveBeenCalledWith("configure_ssh_key_step_completed", { category: "deployments", source: "setup", method: "generated" });
  });

  it("lets the user skip the step and tracks it", async () => {
    const { analyticsService, onContinue, onDismiss } = setup({ source: "setup" });

    await userEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
    expect(analyticsService.track).toHaveBeenCalledWith("configure_ssh_key_step_dismissed", { category: "deployments", source: "setup" });
  });

  it("skips the step when it is closed with Escape", async () => {
    const { onDismiss, onContinue } = setup({ source: "choose_provider" });

    await userEvent.keyboard("{Escape}");

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });

  function setup(input: { source: SshKeyStepSource; sshPubKey?: string }) {
    const analyticsService = mock<AnalyticsService>();
    const onContinue = vi.fn();
    const onDismiss = vi.fn();
    const values = defaultServiceWithPlacement({ image: SSH_VM_IMAGES["Ubuntu 24.04"], sshPubKey: "sshPubKey" in input ? input.sshPubKey : "" });
    const dependencies = {
      SshPublicKeyField: vi.fn(SshPublicKeyFieldStub),
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService })
    } satisfies typeof DEPENDENCIES;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(<SshKeyStepDialog source={input.source} serviceIndex={0} onContinue={onContinue} onDismiss={onDismiss} dependencies={dependencies} />, {
      wrapper: Wrapper
    });

    return { analyticsService, onContinue, onDismiss, dependencies };
  }

  function SshPublicKeyFieldStub({ serviceIndex, onKeyGenerated }: ComponentProps<typeof SshPublicKeyField>) {
    const { register } = useFormContext<SdlBuilderFormValuesType>();

    return (
      <>
        <input aria-label="SSH public key" {...register(`services.${serviceIndex}.sshPubKey`)} />
        <button type="button" onClick={onKeyGenerated}>
          Generate new key
        </button>
      </>
    );
  }
});
