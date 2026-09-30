import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { SnackbarProvider } from "notistack";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultService, defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, ExposeSshField } from "./ExposeSshField";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ExposeSshField.name, () => {
  it("hides the ssh key field until Expose SSH is checked", async () => {
    const { getValues } = setup({});

    expect(screen.queryByRole("textbox", { name: "SSH public key" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Expose SSH" }));

    expect(screen.getByRole("textbox", { name: "SSH public key" })).toBeInTheDocument();
    expect(getValues().hasSSHKey).toBe(true);
  });

  it("clears the ssh key when Expose SSH is unchecked", async () => {
    const { getValues } = setup({ hasSSHKey: true, sshPubKey: "ssh-rsa EXISTING" });

    await userEvent.click(screen.getByRole("checkbox", { name: "Expose SSH" }));

    expect(screen.queryByRole("textbox", { name: "SSH public key" })).not.toBeInTheDocument();
    expect(getValues().hasSSHKey).toBe(false);
    expect(getValues().services[0].sshPubKey).toBe("");
  });

  it("removes the SSH_PUBKEY env var when Expose SSH is unchecked", async () => {
    const { getValues } = setup({ hasSSHKey: true, sshPubKey: "ssh-rsa EXISTING", env: [{ key: "SSH_PUBKEY", value: "ssh-rsa EXISTING" }] });

    await userEvent.click(screen.getByRole("checkbox", { name: "Expose SSH" }));

    expect(getValues().services[0].env?.some(e => e.key === "SSH_PUBKEY")).toBe(false);
  });

  it("clears the ssh key from every service when Expose SSH is unchecked", async () => {
    const { getValues } = setup({ hasSSHKey: true, sshPubKey: "ssh-rsa EXISTING", extraServices: 1 });

    await userEvent.click(screen.getByRole("checkbox", { name: "Expose SSH" }));

    expect(getValues().services.map(s => s.sshPubKey)).toEqual(["", ""]);
    expect(getValues().services.every(s => !s.env?.some(e => e.key === "SSH_PUBKEY"))).toBe(true);
  });

  it("keeps the ssh key when Expose SSH is checked again", async () => {
    const { getValues } = setup({ sshPubKey: "ssh-rsa EXISTING" });

    await userEvent.click(screen.getByRole("checkbox", { name: "Expose SSH" }));

    expect(getValues().services[0].sshPubKey).toBe("ssh-rsa EXISTING");
  });

  it("keeps Expose SSH forced on, with the key field, while the deployment holds a vm", () => {
    setup({ siblingVmService: true });

    expect(screen.getByRole("checkbox", { name: "Expose SSH" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Expose SSH" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "SSH public key" })).toBeInTheDocument();
  });

  it("leaves Expose SSH editable while the deployment holds no vm", () => {
    setup({});

    expect(screen.getByRole("checkbox", { name: "Expose SSH" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Expose SSH" })).not.toBeDisabled();
  });

  function setup(input: {
    hasSSHKey?: boolean;
    sshPubKey?: string;
    env?: Array<{ key: string; value?: string }>;
    extraServices?: number;
    siblingVmService?: boolean;
  }) {
    const base = defaultServiceWithPlacement({
      image: "nginx:latest",
      sshPubKey: input.sshPubKey ?? "",
      env: input.env?.map(e => ({ value: "", isSecret: false, ...e })) ?? []
    });

    const placementId = base.placements[0].id;
    const extraServices = Array.from({ length: input.extraServices ?? 0 }, (_, i) => defaultService(placementId, { title: `service-${i + 2}`, image: "" }));
    if (input.siblingVmService) {
      extraServices.push(defaultService(placementId, { title: "vm-service", image: "ghcr.io/akash-network/ubuntu-2404-ssh:2" }));
    }

    const values: SdlBuilderFormValuesType = {
      ...base,
      services: [...base.services, ...extraServices],
      hasSSHKey: input.hasSSHKey ?? false
    };

    let getValues: () => SdlBuilderFormValuesType = () => values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      getValues = form.getValues;
      return (
        <SnackbarProvider>
          <FormProvider {...form}>{children}</FormProvider>
        </SnackbarProvider>
      );
    };

    render(
      <Wrapper>
        <ExposeSshField serviceIndex={0} dependencies={DEPENDENCIES} />
      </Wrapper>
    );

    return { getValues: () => getValues() };
  }
});
