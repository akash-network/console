import type { PropsWithChildren } from "react";
import type { FieldError, FieldPath, Resolver } from "react-hook-form";
import { FormProvider, useForm, useFormState } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SnackbarProvider } from "notistack";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { defaultService, defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, RuntimeCard } from "./RuntimeCard";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(RuntimeCard.name, () => {
  it("renders collapsed by default", () => {
    setup({ expanded: false });

    expect(screen.queryByRole("spinbutton", { name: "Replicas" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand Runtime" })).toBeInTheDocument();
  });

  it("disables the replica and ssh inputs while locked", () => {
    setup({ locked: true, hasSSHKey: true, sshPubKey: "ssh-rsa AAAATESTKEY user@host" });

    expect(screen.getByRole("spinbutton", { name: "Replicas" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Increase Replicas" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Expose SSH" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "SSH public key" })).toBeDisabled();
  });

  it("increments the replica count", async () => {
    const { getValues } = setup({ count: 1 });

    await userEvent.click(screen.getByRole("button", { name: "Increase Replicas" }));

    expect(getValues().services[0].count).toBe(2);
  });

  it("does not decrement the replica count below one", async () => {
    const { getValues } = setup({ count: 1 });

    expect(screen.getByRole("button", { name: "Decrease Replicas" })).toBeDisabled();
    expect(getValues().services[0].count).toBe(1);
  });

  it("hides the ssh key field until Expose SSH is checked", async () => {
    const { getValues } = setup({});

    expect(screen.queryByLabelText("SSH public key")).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Expose SSH"));

    expect(screen.getByLabelText("SSH public key")).toBeInTheDocument();
    expect(getValues().hasSSHKey).toBe(true);
  });

  it("clears the ssh key when Expose SSH is unchecked", async () => {
    const { getValues } = setup({ hasSSHKey: true, sshPubKey: "ssh-rsa EXISTING" });

    await userEvent.click(screen.getByLabelText("Expose SSH"));

    expect(screen.queryByLabelText("SSH public key")).not.toBeInTheDocument();
    expect(getValues().hasSSHKey).toBe(false);
    expect(getValues().services[0].sshPubKey).toBe("");
  });

  it("removes the SSH_PUBKEY env var when Expose SSH is unchecked", async () => {
    const { getValues } = setup({ hasSSHKey: true, sshPubKey: "ssh-rsa EXISTING", env: [{ key: "SSH_PUBKEY", value: "ssh-rsa EXISTING" }] });

    await userEvent.click(screen.getByLabelText("Expose SSH"));

    expect(getValues().services[0].env?.some(e => e.key === "SSH_PUBKEY")).toBe(false);
  });

  it("clears the ssh key from every service when Expose SSH is unchecked", async () => {
    const { getValues } = setup({ hasSSHKey: true, sshPubKey: "ssh-rsa EXISTING", extraServices: 1 });

    await userEvent.click(screen.getByLabelText("Expose SSH"));

    expect(getValues().services.map(s => s.sshPubKey)).toEqual(["", ""]);
    expect(getValues().services.every(s => !s.env?.some(e => e.key === "SSH_PUBKEY"))).toBe(true);
  });

  it("pins the replica stepper at a single disabled instance for a vm service", () => {
    setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2" });

    expect(screen.getByRole("spinbutton", { name: "Replicas" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Increase Replicas" })).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: "Replicas" })).toHaveValue(1);
    expect(screen.getByText("VMs run as a single instance.")).toBeInTheDocument();
  });

  it("leaves the ssh controls to the Operating System card for a vm service", () => {
    setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2", hasSSHKey: true });

    expect(screen.getByRole("spinbutton", { name: "Replicas" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Expose SSH" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "SSH public key" })).not.toBeInTheDocument();
  });

  it("renders collapsed for a vm service", () => {
    setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2", expanded: false });

    expect(screen.getByRole("button", { name: "Expand Runtime" })).toBeInTheDocument();
  });

  it("keeps Expose SSH forced on, with the key field, on a sibling non-vm service's card while the deployment holds a vm", () => {
    setup({ image: "", siblingVmService: true });

    expect(screen.getByRole("checkbox", { name: "Expose SSH" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Expose SSH" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "SSH public key" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Replicas" })).not.toBeDisabled();
  });

  it("leaves the replica stepper editable for a non-vm service without vm siblings", () => {
    setup({ image: "nginx:latest" });

    expect(screen.getByRole("spinbutton", { name: "Replicas" })).not.toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Expose SSH" })).not.toBeDisabled();
    expect(screen.queryByText("VMs run as a single instance.")).not.toBeInTheDocument();
  });

  it("marks the collapsed card when a submit is rejected on its hidden ssh key field", async () => {
    setup({ image: "nginx:latest", hasSSHKey: true, resolver: zodResolver(SdlBuilderFormValuesSchema), expanded: false });

    await userEvent.click(screen.getByRole("button", { name: "Request quotes" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Expand Runtime" }).closest(".border-destructive")).not.toBeNull());
  });

  it("marks the collapsed card when a submit is rejected on the replica count", async () => {
    const resolver: Resolver<SdlBuilderFormValuesType> = async () => ({
      values: {},
      errors: { services: { 0: { count: { type: "max", message: "Too many replicas" } } } }
    });
    setup({ image: "nginx:latest", resolver, expanded: false });

    await userEvent.click(screen.getByRole("button", { name: "Request quotes" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Expand Runtime" }).closest(".border-destructive")).not.toBeNull());
  });

  it("leaves the card unmarked when a vm submit is rejected on the key the Operating System card holds", async () => {
    const { fieldError } = setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2", resolver: zodResolver(SdlBuilderFormValuesSchema), expanded: false });

    await userEvent.click(screen.getByRole("button", { name: "Request quotes" }));

    await waitFor(() => expect(fieldError("services.0.sshPubKey")?.message).toBe("SSH Public key is required."));
    expect(screen.getByRole("button", { name: "Expand Runtime" }).closest(".border-destructive")).toBeNull();
  });

  it("leaves the card unmarked when a submit is rejected on another service", async () => {
    const resolver: Resolver<SdlBuilderFormValuesType> = async () => ({
      values: {},
      errors: { services: { 1: { image: { type: "required", message: "Docker image is required." } } } }
    });
    const { fieldError } = setup({ image: "nginx:latest", resolver, expanded: false });

    await userEvent.click(screen.getByRole("button", { name: "Request quotes" }));

    await waitFor(() => expect(fieldError("services.1.image")?.message).toBe("Docker image is required."));
    expect(screen.getByRole("button", { name: "Expand Runtime" }).closest(".border-destructive")).toBeNull();
  });

  it("re-validates the CPU group limit when the replica count changes", async () => {
    const resolver: Resolver<SdlBuilderFormValuesType> = async values => {
      const errors = values.services[0].count > 1 ? { services: { 0: { profile: { cpu: { type: "max", message: "CPU group limit exceeded" } } } } } : {};
      return { values, errors };
    };
    setupValidated({ count: 1, resolver });

    expect(screen.queryByText("CPU group limit exceeded")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Increase Replicas" }));

    await waitFor(() => {
      expect(screen.getByText("CPU group limit exceeded")).toBeInTheDocument();
    });
  });

  it("re-validates the GPU group limit when the replica count changes", async () => {
    const resolver: Resolver<SdlBuilderFormValuesType> = async values => {
      const errors = values.services[0].count > 1 ? { services: { 0: { profile: { gpu: { type: "max", message: "GPU group limit exceeded" } } } } } : {};
      return { values, errors };
    };
    setupValidated({ count: 1, resolver });

    expect(screen.queryByText("GPU group limit exceeded")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Increase Replicas" }));

    await waitFor(() => {
      expect(screen.getByText("GPU group limit exceeded")).toBeInTheDocument();
    });
  });

  function setup(input: {
    count?: number;
    hasSSHKey?: boolean;
    sshPubKey?: string;
    env?: Array<{ key: string; value?: string }>;
    extraServices?: number;
    image?: string;
    siblingVmService?: boolean;
    locked?: boolean;
    expanded?: boolean;
    resolver?: Resolver<SdlBuilderFormValuesType>;
  }) {
    const base = defaultServiceWithPlacement({
      image: input.image ?? "",
      count: input.count ?? 1,
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
    let getFieldError: (name: FieldPath<SdlBuilderFormValuesType>) => FieldError | undefined = () => undefined;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({
        defaultValues: values,
        mode: "onSubmit",
        reValidateMode: "onChange",
        resolver: input.resolver
      });
      getValues = form.getValues;
      getFieldError = name => form.getFieldState(name).error;
      return (
        <SnackbarProvider>
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(() => undefined)}>
              {children}
              <button type="submit">Request quotes</button>
            </form>
          </FormProvider>
        </SnackbarProvider>
      );
    };

    render(
      <Wrapper>
        <RuntimeCard serviceIndex={0} locked={input.locked} dependencies={DEPENDENCIES} />
      </Wrapper>
    );

    if (input.expanded ?? true) {
      const expandTrigger = screen.queryByRole("button", { name: "Expand Runtime" });
      if (expandTrigger) {
        fireEvent.click(expandTrigger);
      }
    }

    return { getValues: () => getValues(), fieldError: (name: FieldPath<SdlBuilderFormValuesType>) => getFieldError(name) };
  }

  /**
   * Renders the card under a supplied resolver so validation errors flow through to the field state.
   * The CPU/GPU group errors live on `profile.cpu`/`profile.gpu`, which the sibling Compute
   * and GPU cards own, so a small probe surfaces them here to verify the replica-count re-validation
   * wiring in isolation.
   */
  function setupValidated(input: { count?: number; resolver?: Resolver<SdlBuilderFormValuesType> }) {
    const values = defaultServiceWithPlacement({ image: "nginx:latest", count: input.count ?? 1 });

    const GroupLimitProbe = () => {
      const { errors } = useFormState<SdlBuilderFormValuesType>();
      const profile = errors.services?.[0]?.profile;
      const message = profile?.cpu?.message ?? profile?.gpu?.message;
      return message ? <span>{message}</span> : null;
    };

    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({
        defaultValues: values,
        mode: "onChange",
        resolver: input.resolver ?? zodResolver(SdlBuilderFormValuesSchema)
      });
      return (
        <SnackbarProvider>
          <FormProvider {...form}>
            {children}
            <GroupLimitProbe />
          </FormProvider>
        </SnackbarProvider>
      );
    };

    render(
      <Wrapper>
        <RuntimeCard serviceIndex={0} dependencies={DEPENDENCIES} />
      </Wrapper>
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand Runtime" }));
  }
});
