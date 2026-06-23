import type { PropsWithChildren } from "react";
import type { Resolver } from "react-hook-form";
import { FormProvider, useForm, useFormState } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SnackbarProvider } from "notistack";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { defaultService, defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, ImageRuntimeCard } from "./ImageRuntimeCard";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ImageRuntimeCard.name, () => {
  it("edits the docker image and lowercases input", async () => {
    const { getValues } = setup({});

    await userEvent.type(screen.getByLabelText("Docker image"), "MyImage:1.0");

    expect(getValues().services[0].image).toBe("myimage:1.0");
  });

  it("reveals credentials fields and seeds defaults when private registry is checked", async () => {
    const { getValues } = setup({});

    expect(screen.queryByLabelText("Registry username")).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Private registry"));

    expect(screen.getByLabelText("Registry username")).toBeInTheDocument();
    expect(getValues().services[0].hasCredentials).toBe(true);
    expect(getValues().services[0].credentials).toMatchObject({ host: "docker.io", username: "", password: "" });
  });

  it("clears credentials when private registry is unchecked", async () => {
    const { getValues } = setup({ hasCredentials: true });

    await userEvent.click(screen.getByLabelText("Private registry"));

    expect(screen.queryByLabelText("Registry username")).not.toBeInTheDocument();
    expect(getValues().services[0].hasCredentials).toBe(false);
    expect(getValues().services[0].credentials).toBeUndefined();
  });

  it("edits the registry username", async () => {
    const { getValues } = setup({ hasCredentials: true });

    await userEvent.type(screen.getByLabelText("Registry username"), "alice");

    expect(getValues().services[0].credentials?.username).toBe("alice");
  });

  it("shows a custom registry URL field for a custom host", async () => {
    setup({ hasCredentials: true });

    await userEvent.click(screen.getByRole("combobox", { name: "Registry host" }));
    await userEvent.click(screen.getByRole("option", { name: "Custom Registry" }));

    expect(screen.getByLabelText("Custom registry URL")).toBeInTheDocument();
  });

  it("does not show a password error before the user edits the credentials", async () => {
    setup({ resolver: zodResolver(SdlBuilderFormValuesSchema) });

    await userEvent.click(screen.getByLabelText("Private registry"));

    expect(screen.queryByText(/at least 6 characters/i)).not.toBeInTheDocument();
  });

  it("does not show the password error before submitting", async () => {
    setup({ resolver: zodResolver(SdlBuilderFormValuesSchema) });

    await userEvent.click(screen.getByLabelText("Private registry"));
    await userEvent.type(screen.getByLabelText("Registry password"), "abc");

    expect(screen.queryByText(/at least 6 characters/i)).not.toBeInTheDocument();
  });

  it("shows the password error after submitting", async () => {
    setup({ resolver: zodResolver(SdlBuilderFormValuesSchema) });

    await userEvent.click(screen.getByLabelText("Private registry"));
    await userEvent.type(screen.getByLabelText("Registry password"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Request quotes" }));

    await waitFor(() => expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument());
  });

  it("stores an empty host, not the custom sentinel, when Custom Registry is selected", async () => {
    const { getValues } = setup({ hasCredentials: true });

    await userEvent.click(screen.getByRole("combobox", { name: "Registry host" }));
    await userEvent.click(screen.getByRole("option", { name: "Custom Registry" }));

    expect(getValues().services[0].credentials?.host).toBe("");
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

  it("edits the ssh public key", async () => {
    const { getValues } = setup({ hasSSHKey: true });

    await userEvent.type(screen.getByLabelText("SSH public key"), "ssh-rsa AAAA");

    expect(getValues().services[0].sshPubKey).toBe("ssh-rsa AAAA");
  });

  it("mirrors the ssh public key into a managed SSH_PUBKEY env var", async () => {
    const { getValues } = setup({ hasSSHKey: true });

    await userEvent.type(screen.getByLabelText("SSH public key"), "ssh-rsa AAAA");

    const sshEnv = getValues().services[0].env?.filter(e => e.key === "SSH_PUBKEY");
    expect(sshEnv).toEqual([expect.objectContaining({ key: "SSH_PUBKEY", value: "ssh-rsa AAAA", isSecret: false })]);
  });

  it("removes the SSH_PUBKEY env var when Expose SSH is unchecked", async () => {
    const { getValues } = setup({ hasSSHKey: true, sshPubKey: "ssh-rsa EXISTING", env: [{ key: "SSH_PUBKEY", value: "ssh-rsa EXISTING" }] });

    await userEvent.click(screen.getByLabelText("Expose SSH"));

    expect(getValues().services[0].env?.some(e => e.key === "SSH_PUBKEY")).toBe(false);
  });

  it("does not duplicate the SSH_PUBKEY env var on repeated edits", async () => {
    const { getValues } = setup({ hasSSHKey: true });

    await userEvent.type(screen.getByLabelText("SSH public key"), "ab");

    expect(getValues().services[0].env?.filter(e => e.key === "SSH_PUBKEY")).toHaveLength(1);
  });

  it("preserves other env vars when syncing SSH_PUBKEY", async () => {
    const { getValues } = setup({ hasSSHKey: true, env: [{ key: "FOO", value: "bar" }] });

    await userEvent.type(screen.getByLabelText("SSH public key"), "x");

    const env = getValues().services[0].env ?? [];
    expect(env.some(e => e.key === "FOO" && e.value === "bar")).toBe(true);
    expect(env.some(e => e.key === "SSH_PUBKEY")).toBe(true);
  });

  it("applies the ssh public key to every service so none is left invalid", async () => {
    const { getValues } = setup({ hasSSHKey: true, extraServices: 1 });

    await userEvent.type(screen.getByLabelText("SSH public key"), "ssh-rsa AAAA");

    expect(getValues().services.map(s => s.sshPubKey)).toEqual(["ssh-rsa AAAA", "ssh-rsa AAAA"]);
  });

  it("mirrors the SSH_PUBKEY env var into every service", async () => {
    const { getValues } = setup({ hasSSHKey: true, extraServices: 1 });

    await userEvent.type(screen.getByLabelText("SSH public key"), "ssh-rsa AAAA");

    for (const service of getValues().services) {
      expect(service.env?.filter(e => e.key === "SSH_PUBKEY")).toEqual([
        expect.objectContaining({ key: "SSH_PUBKEY", value: "ssh-rsa AAAA", isSecret: false })
      ]);
    }
  });

  it("clears the ssh key from every service when Expose SSH is unchecked", async () => {
    const { getValues } = setup({ hasSSHKey: true, sshPubKey: "ssh-rsa EXISTING", extraServices: 1 });

    await userEvent.click(screen.getByLabelText("Expose SSH"));

    expect(getValues().services.map(s => s.sshPubKey)).toEqual(["", ""]);
    expect(getValues().services.every(s => !s.env?.some(e => e.key === "SSH_PUBKEY"))).toBe(true);
  });

  it("populates the ssh public key and env from a generated keypair", async () => {
    const generateSSHKeyPair = vi.fn().mockResolvedValue({ publicKey: "ssh-rsa GENERATED", privatePem: "PRIVATE" });
    const { getValues } = setup({ hasSSHKey: true, dependencies: { generateSSHKeyPair } });

    await userEvent.click(screen.getByRole("button", { name: "Generate new key" }));

    expect(generateSSHKeyPair).toHaveBeenCalled();
    await vi.waitFor(() => expect(getValues().services[0].sshPubKey).toBe("ssh-rsa GENERATED"));
    expect(screen.getByLabelText("SSH public key")).toHaveValue("ssh-rsa GENERATED");
    expect(getValues().services[0].env?.find(e => e.key === "SSH_PUBKEY")?.value).toBe("ssh-rsa GENERATED");
  });

  it("offers the usage instructions tooltip whenever SSH is exposed", () => {
    setup({ hasSSHKey: true });

    expect(screen.getByRole("button", { name: "How to use the SSH key" })).toBeInTheDocument();
  });

  it("shows a host error under the credentials fields when the custom host is not a valid URL", async () => {
    const { trigger } = setupValidated({ credentials: { host: "not a url", username: "alice", password: "secret" } });

    await trigger();

    await waitFor(() => {
      expect(screen.getByText("Host is not a valid registry URL")).toBeInTheDocument();
    });
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
    hasCredentials?: boolean;
    count?: number;
    hasSSHKey?: boolean;
    sshPubKey?: string;
    env?: Array<{ key: string; value?: string }>;
    extraServices?: number;
    resolver?: Resolver<SdlBuilderFormValuesType>;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const base = defaultServiceWithPlacement({
      image: "",
      count: input.count ?? 1,
      hasCredentials: input.hasCredentials ?? false,
      credentials: input.hasCredentials ? { host: "docker.io", username: "", password: "" } : undefined,
      sshPubKey: input.sshPubKey ?? "",
      env: input.env?.map(e => ({ value: "", isSecret: false, ...e })) ?? []
    });

    const placementId = base.placements[0].id;
    const extraServices = Array.from({ length: input.extraServices ?? 0 }, (_, i) => defaultService(placementId, { title: `service-${i + 2}`, image: "" }));

    const values: SdlBuilderFormValuesType = {
      ...base,
      services: [...base.services, ...extraServices],
      hasSSHKey: input.hasSSHKey ?? false
    };

    let getValues: () => SdlBuilderFormValuesType = () => values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({
        defaultValues: values,
        mode: "onSubmit",
        reValidateMode: "onChange",
        resolver: input.resolver
      });
      getValues = form.getValues;
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

    const dependencies: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      saveAs: vi.fn(),
      loadJSZip: vi.fn().mockResolvedValue(
        class {
          file() {}
          async generateAsync() {
            return new Blob();
          }
        }
      ),
      ...input.dependencies
    };

    render(
      <Wrapper>
        <ImageRuntimeCard serviceIndex={0} dependencies={dependencies} />
      </Wrapper>
    );

    return { getValues: () => getValues() };
  }

  /**
   * Renders the card under a real (or supplied) resolver so validation errors
   * flow through to the field state. The CPU/GPU group errors live on
   * `profile.cpu`/`profile.gpu`, which the sibling Compute Resources and GPU cards
   * own, so a small probe surfaces them here to verify the replica-count
   * re-validation wiring without pulling in those cards.
   */
  function setupValidated(input: {
    count?: number;
    credentials?: { host: string; username: string; password: string };
    resolver?: Resolver<SdlBuilderFormValuesType>;
  }) {
    const values = defaultServiceWithPlacement({
      image: "nginx:latest",
      count: input.count ?? 1,
      hasCredentials: !!input.credentials,
      credentials: input.credentials
    });

    let trigger: () => Promise<boolean> = async () => true;
    const ProfileErrorProbe = () => {
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
      trigger = () => form.trigger();
      return (
        <SnackbarProvider>
          <FormProvider {...form}>
            {children}
            <ProfileErrorProbe />
          </FormProvider>
        </SnackbarProvider>
      );
    };

    render(
      <Wrapper>
        <ImageRuntimeCard serviceIndex={0} dependencies={{ ...DEPENDENCIES, saveAs: vi.fn(), loadJSZip: vi.fn() }} />
      </Wrapper>
    );

    return { trigger: () => trigger() };
  }
});
