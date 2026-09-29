import type { PropsWithChildren } from "react";
import type { FieldPath, UseFormGetFieldState } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SnackbarProvider } from "notistack";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { defaultService, defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, SshPublicKeyField } from "./SshPublicKeyField";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(SshPublicKeyField.name, () => {
  it("edits the ssh public key", async () => {
    const { getValues } = setup({});

    await userEvent.type(screen.getByRole("textbox", { name: "SSH public key" }), "ssh-rsa AAAA");

    expect(getValues().services[0].sshPubKey).toBe("ssh-rsa AAAA");
  });

  it("mirrors the ssh public key into a managed SSH_PUBKEY env var", async () => {
    const { getValues } = setup({});

    await userEvent.type(screen.getByRole("textbox", { name: "SSH public key" }), "ssh-rsa AAAA");

    const sshEnv = getValues().services[0].env?.filter(e => e.key === "SSH_PUBKEY");
    expect(sshEnv).toEqual([expect.objectContaining({ key: "SSH_PUBKEY", value: "ssh-rsa AAAA", isSecret: false })]);
  });

  it("does not duplicate the SSH_PUBKEY env var on repeated edits", async () => {
    const { getValues } = setup({});

    await userEvent.type(screen.getByRole("textbox", { name: "SSH public key" }), "ab");

    expect(getValues().services[0].env?.filter(e => e.key === "SSH_PUBKEY")).toHaveLength(1);
  });

  it("preserves other env vars when syncing SSH_PUBKEY", async () => {
    const { getValues } = setup({ env: [{ key: "FOO", value: "bar" }] });

    await userEvent.type(screen.getByRole("textbox", { name: "SSH public key" }), "x");

    const env = getValues().services[0].env ?? [];
    expect(env.some(e => e.key === "FOO" && e.value === "bar")).toBe(true);
    expect(env.some(e => e.key === "SSH_PUBKEY")).toBe(true);
  });

  it("applies the ssh public key and its env var to every service so none is left invalid", async () => {
    const { getValues } = setup({ extraServices: 1 });

    await userEvent.type(screen.getByRole("textbox", { name: "SSH public key" }), "ssh-rsa AAAA");

    expect(getValues().services.map(s => s.sshPubKey)).toEqual(["ssh-rsa AAAA", "ssh-rsa AAAA"]);
    for (const service of getValues().services) {
      expect(service.env?.filter(e => e.key === "SSH_PUBKEY")).toEqual([
        expect.objectContaining({ key: "SSH_PUBKEY", value: "ssh-rsa AAAA", isSecret: false })
      ]);
    }
  });

  it("clears the ssh public key when the input is emptied", async () => {
    const { getValues } = setup({ sshPubKey: "ssh-rsa EXISTING" });

    await userEvent.clear(screen.getByRole("textbox", { name: "SSH public key" }));

    expect(getValues().services[0].sshPubKey).toBe("");
  });

  it("populates the ssh public key and env from a generated keypair", async () => {
    const generateSSHKeyPair = vi.fn().mockResolvedValue({ publicKey: "ssh-rsa GENERATED", privatePem: "PRIVATE" });
    const { getValues } = setup({ dependencies: { generateSSHKeyPair } });

    await userEvent.click(screen.getByRole("button", { name: "Generate new key" }));

    await vi.waitFor(() => expect(getValues().services[0].sshPubKey).toBe("ssh-rsa GENERATED"));
    expect(screen.getByRole("textbox", { name: "SSH public key" })).toHaveValue("ssh-rsa GENERATED");
    expect(getValues().services[0].env?.find(e => e.key === "SSH_PUBKEY")?.value).toBe("ssh-rsa GENERATED");
  });

  it("downloads the generated keypair as a zip", async () => {
    const zipFile = vi.fn();
    const blob = new Blob(["zip"]);
    const saveAs = vi.fn();
    setup({
      dependencies: {
        generateSSHKeyPair: vi.fn().mockResolvedValue({ publicKey: "ssh-rsa GENERATED", privatePem: "PRIVATE" }),
        saveAs,
        loadJSZip: vi.fn().mockResolvedValue(
          class {
            file = zipFile;
            async generateAsync(opts: { type: string }) {
              return opts.type === "blob" ? blob : new Blob();
            }
          }
        )
      }
    });

    await userEvent.click(screen.getByRole("button", { name: "Generate new key" }));

    await vi.waitFor(() => expect(saveAs).toHaveBeenCalledWith(blob, "keypair.zip"));
    expect(zipFile).toHaveBeenCalledWith("id_rsa.pub", "ssh-rsa GENERATED");
    expect(zipFile).toHaveBeenCalledWith("id_rsa", "PRIVATE");
  });

  it("reports a keypair that fails to generate as an error", async () => {
    const enqueueSnackbar = vi.fn();
    const { getValues } = setup({
      dependencies: { generateSSHKeyPair: vi.fn().mockRejectedValue(new Error("boom")), useSnackbar: () => mock({ enqueueSnackbar }) }
    });

    await userEvent.click(screen.getByRole("button", { name: "Generate new key" }));

    await vi.waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ subTitle: "Failed to generate or download the SSH keypair." }) }),
        { variant: "error" }
      )
    );
    expect(getValues().services[0].sshPubKey).toBe("");
  });

  it("refuses to generate a keypair without the WebCrypto API", async () => {
    const generateSSHKeyPair = vi.fn();
    const enqueueSnackbar = vi.fn();
    setup({ dependencies: { generateSSHKeyPair, useSnackbar: () => mock({ enqueueSnackbar }) } });
    vi.stubGlobal("crypto", undefined);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });

    await userEvent.click(screen.getByRole("button", { name: "Generate new key" }));

    await vi.waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ subTitle: "Your browser doesn't support the WebCrypto API." }) }),
        { variant: "error" }
      )
    );
    expect(generateSSHKeyPair).not.toHaveBeenCalled();
  });

  it("shows the missing-key error inline when a submit is rejected", async () => {
    setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2", validate: true });

    await userEvent.click(screen.getByRole("button", { name: "Request quotes" }));

    expect(await screen.findByText("SSH Public key is required.")).toBeInTheDocument();
  });

  it("clears the missing-key error once a key is entered", async () => {
    setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2", validate: true });
    await userEvent.click(screen.getByRole("button", { name: "Request quotes" }));
    await screen.findByText("SSH Public key is required.");

    await userEvent.type(screen.getByRole("textbox", { name: "SSH public key" }), "ssh-rsa AAAA");

    await waitFor(() => expect(screen.queryByText("SSH Public key is required.")).not.toBeInTheDocument());
  });

  it("marks the key and its env var as edited", async () => {
    const { fieldState } = setup({});

    await userEvent.type(screen.getByRole("textbox", { name: "SSH public key" }), "ssh-rsa AAAA");

    expect(fieldState("services.0.sshPubKey").isDirty).toBe(true);
    expect(fieldState("services.0.env").isDirty).toBe(true);
  });

  it("offers the usage instructions tooltip", () => {
    setup({});

    expect(screen.getByRole("button", { name: "How to use the SSH key" })).toBeInTheDocument();
  });

  function setup(input: {
    image?: string;
    sshPubKey?: string;
    env?: Array<{ key: string; value?: string }>;
    extraServices?: number;
    validate?: boolean;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const base = defaultServiceWithPlacement({
      image: input.image ?? "",
      sshPubKey: input.sshPubKey ?? "",
      env: input.env?.map(e => ({ value: "", isSecret: false, ...e })) ?? []
    });
    const placementId = base.placements[0].id;
    const extraServices = Array.from({ length: input.extraServices ?? 0 }, (_, i) => defaultService(placementId, { title: `service-${i + 2}`, image: "" }));
    const values: SdlBuilderFormValuesType = { ...base, services: [...base.services, ...extraServices], hasSSHKey: true };

    let getValues: () => SdlBuilderFormValuesType = () => values;
    let getFieldState: UseFormGetFieldState<SdlBuilderFormValuesType> = () => ({ invalid: false, isDirty: false, isTouched: false, isValidating: false });
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({
        defaultValues: values,
        mode: "onSubmit",
        reValidateMode: "onChange",
        resolver: input.validate ? zodResolver(SdlBuilderFormValuesSchema) : undefined
      });
      getValues = form.getValues;
      getFieldState = form.getFieldState;
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
        <SshPublicKeyField serviceIndex={0} dependencies={dependencies} />
      </Wrapper>
    );

    return { getValues: () => getValues(), fieldState: (name: FieldPath<SdlBuilderFormValuesType>) => getFieldState(name) };
  }
});
