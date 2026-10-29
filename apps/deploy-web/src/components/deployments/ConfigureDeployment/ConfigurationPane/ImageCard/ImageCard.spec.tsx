import type { PropsWithChildren } from "react";
import type { FieldError, FieldPath, Resolver } from "react-hook-form";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { defaultHttpExpose, defaultService, defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { withServiceSshKey } from "@src/utils/sdl/sshKey";
import { HELLO_WORLD_IMAGE } from "@src/utils/templates";
import { ImageCard } from "./ImageCard";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ImageCard.name, () => {
  it("edits the docker image and lowercases input", async () => {
    const { getValues } = setup({});

    await userEvent.type(screen.getByLabelText("Docker image"), "MyImage:1.0");

    expect(getValues().services[0].image).toBe("myimage:1.0");
  });

  it("marks the example image as one the user can replace", () => {
    setup({ image: HELLO_WORLD_IMAGE, ports: [{ port: 3000, as: 80 }] });

    expect(screen.getByLabelText("Docker image")).toHaveAccessibleDescription("You can deploy this example as is or replace it with your own image.");
  });

  it("marks the example image when the service exposes other ports next to the example's", () => {
    setup({
      image: HELLO_WORLD_IMAGE,
      ports: [
        { port: 3000, as: 80 },
        { port: 8080, as: 8080 }
      ]
    });

    expect(screen.getByLabelText("Docker image")).toHaveAccessibleDescription("You can deploy this example as is or replace it with your own image.");
  });

  it("drops the example hint once the user moves the example's port away from it", () => {
    const { editExposedPort } = setup({ image: HELLO_WORLD_IMAGE, ports: [{ port: 3000, as: 80 }] });

    editExposedPort(0, 8080);

    expect(screen.getByLabelText("Docker image")).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText(/deploy this example as is/)).not.toBeInTheDocument();
  });

  it("shows no example hint when the example image is not exposed on its own port", () => {
    setup({ image: HELLO_WORLD_IMAGE, ports: [{ port: 80, as: 80 }] });

    expect(screen.getByLabelText("Docker image")).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText(/deploy this example as is/)).not.toBeInTheDocument();
  });

  it("drops the example hint once the user types their own image", async () => {
    const { getValues } = setup({ image: HELLO_WORLD_IMAGE, ports: [{ port: 3000, as: 80 }] });

    await userEvent.clear(screen.getByLabelText("Docker image"));
    await userEvent.type(screen.getByLabelText("Docker image"), "MyImage:1.0");

    expect(getValues().services[0].image).toBe("myimage:1.0");
    expect(screen.getByLabelText("Docker image")).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText(/deploy this example as is/)).not.toBeInTheDocument();
  });

  it("shows no example hint for an image the user brought", () => {
    setup({ image: "nginx:latest" });

    expect(screen.getByLabelText("Docker image")).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText(/deploy this example as is/)).not.toBeInTheDocument();
  });

  it("moves the example's port back to the default when the user replaces the example image", async () => {
    const { getValues } = setup({ image: HELLO_WORLD_IMAGE, ports: [{ port: 3000, as: 80 }] });

    await userEvent.clear(screen.getByLabelText("Docker image"));
    await userEvent.type(screen.getByLabelText("Docker image"), "nginx:latest");

    expect(getValues().services[0].image).toBe("nginx:latest");
    expect(portsOf(getValues())).toEqual([{ port: 80, as: 80 }]);
  });

  it("moves only the example's port mapping when the service exposes several ports", async () => {
    const { getValues } = setup({
      image: HELLO_WORLD_IMAGE,
      ports: [
        { port: 5432, as: 5432 },
        { port: 3000, as: 80 }
      ]
    });

    await userEvent.clear(screen.getByLabelText("Docker image"));

    expect(portsOf(getValues())).toEqual([
      { port: 5432, as: 5432 },
      { port: 80, as: 80 }
    ]);
  });

  it.each([
    { edited: "container port", port: 8080, as: 80 },
    { edited: "exposed port", port: 3000, as: 8000 }
  ])("keeps the $edited the user edited when the example image is replaced", async ({ port, as }) => {
    const { getValues } = setup({ image: HELLO_WORLD_IMAGE, ports: [{ port, as }] });

    await userEvent.clear(screen.getByLabelText("Docker image"));
    await userEvent.type(screen.getByLabelText("Docker image"), "nginx:latest");

    expect(portsOf(getValues())).toEqual([{ port, as }]);
  });

  it("leaves the ports alone when the user types the example image back", async () => {
    const { getValues } = setup({ image: HELLO_WORLD_IMAGE, ports: [{ port: 3000, as: 80 }] });
    await userEvent.clear(screen.getByLabelText("Docker image"));
    await userEvent.type(screen.getByLabelText("Docker image"), "nginx:latest");

    await userEvent.clear(screen.getByLabelText("Docker image"));
    await userEvent.type(screen.getByLabelText("Docker image"), HELLO_WORLD_IMAGE);

    expect(getValues().services[0].image).toBe(HELLO_WORLD_IMAGE);
    expect(portsOf(getValues())).toEqual([{ port: 80, as: 80 }]);
    expect(screen.queryByText(/deploy this example as is/)).not.toBeInTheDocument();
  });

  it("leaves the ports alone when the user edits an image that is not the example", async () => {
    const { getValues } = setup({ image: "node-app:1.0", ports: [{ port: 3000, as: 80 }] });

    await userEvent.type(screen.getByLabelText("Docker image"), "1");

    expect(getValues().services[0].image).toBe("node-app:1.01");
    expect(portsOf(getValues())).toEqual([{ port: 3000, as: 80 }]);
  });

  it("keeps the example's port when an edit still leaves the example image in place", () => {
    const { getValues } = setup({ image: HELLO_WORLD_IMAGE, ports: [{ port: 3000, as: 80 }] });

    fireEvent.change(screen.getByLabelText("Docker image"), { target: { value: HELLO_WORLD_IMAGE.toUpperCase() } });

    expect(getValues().services[0].image).toBe(HELLO_WORLD_IMAGE);
    expect(portsOf(getValues())).toEqual([{ port: 3000, as: 80 }]);
  });

  it("disables the image and credentials fields while locked", () => {
    setup({ hasCredentials: true, locked: true });

    expect(screen.getByLabelText("Docker image")).toBeDisabled();
    expect(screen.getByLabelText("Registry username")).toBeDisabled();
  });

  it("reveals credentials fields and seeds defaults when private registry is checked", async () => {
    const { getValues } = setup({});

    expect(screen.queryByLabelText("Registry username")).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Private registry"));

    expect(screen.getByLabelText("Registry username")).toBeInTheDocument();
    expect(getValues().services[0].hasCredentials).toBe(true);
    expect(getValues().services[0].credentials).toMatchObject({ host: "docker.io", username: "", password: "" });
  });

  it("marks the registry credentials as required once private registry is checked", async () => {
    setup({});

    await userEvent.click(screen.getByLabelText("Private registry"));

    expect(screen.getByLabelText("Registry username")).toBeRequired();
    expect(screen.getByLabelText("Registry password")).toBeRequired();
    expect(screen.getByText("Host")).toHaveTextContent("Host *");
    expect(screen.getByText("Username")).toHaveTextContent("Username *");
    expect(screen.getByText("Password")).toHaveTextContent("Password *");
  });

  it("focuses the registry username from its visible label", async () => {
    setup({ hasCredentials: true });

    await userEvent.click(screen.getByText("Username"));

    expect(screen.getByLabelText("Registry username")).toHaveFocus();
  });

  it("focuses the registry password from its visible label", async () => {
    setup({ hasCredentials: true });

    await userEvent.click(screen.getByText("Password"));

    expect(screen.getByLabelText("Registry password")).toHaveFocus();
  });

  it("marks the custom registry URL as required", async () => {
    setup({ hasCredentials: true });

    await userEvent.click(screen.getByRole("combobox", { name: "Registry host" }));
    await userEvent.click(screen.getByRole("option", { name: "Custom Registry" }));

    expect(screen.getByLabelText("Custom registry URL")).toBeRequired();
  });

  it("shows the username error after submitting a private registry without one", async () => {
    setup({ resolver: zodResolver(SdlBuilderFormValuesSchema) });

    await userEvent.click(screen.getByLabelText("Private registry"));
    await userEvent.type(screen.getByLabelText("Registry password"), "hunter22");
    await userEvent.click(screen.getByRole("button", { name: "Request quotes" }));

    await waitFor(() => expect(screen.getByText("Registry username is required.")).toBeInTheDocument());
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

  it("shows a kept registry credential as a placeholder rather than its reference, so the reference never reads as the value", () => {
    setup({ image: "nginx:latest", credentials: { host: "ghcr.io", username: "ac-secret://REGISTRY_USERNAME", password: "ac-secret://REGISTRY_PASSWORD" } });

    expect(screen.getByLabelText("Registry username")).toHaveValue("");
    expect(screen.getByLabelText("Registry username")).toHaveAttribute("placeholder", "Kept from your deployment. Type to replace.");
    expect(screen.getByLabelText("Registry password")).toHaveValue("");
    expect(screen.getByLabelText("Registry password")).toHaveAttribute("placeholder", "Kept from your deployment. Type to replace.");
  });

  it("replaces a kept credential with what the user types", async () => {
    const { getValues } = setup({ image: "nginx:latest", credentials: { host: "ghcr.io", username: "ac-secret://REGISTRY_USERNAME", password: "hunter22" } });

    await userEvent.type(screen.getByLabelText("Registry username"), "bob");

    expect(getValues().services[0].credentials?.username).toBe("bob");
  });

  it("keeps a registry credential the deployment holds when the user clears the box again", async () => {
    const { getValues } = setup({
      image: "nginx:latest",
      credentials: { host: "ghcr.io", username: "ac-secret://REGISTRY_USERNAME", password: "ac-secret://REGISTRY_PASSWORD" }
    });

    await userEvent.type(screen.getByLabelText("Registry username"), "bob");
    await userEvent.clear(screen.getByLabelText("Registry username"));

    expect(getValues().services[0].credentials?.username).toBe("ac-secret://REGISTRY_USERNAME");
    expect(screen.getByLabelText("Registry username")).toHaveAttribute("placeholder", "Kept from your deployment. Type to replace.");
  });

  it("keeps a registry password the deployment holds when the user clears the box again", async () => {
    const { getValues } = setup({
      image: "nginx:latest",
      credentials: { host: "ghcr.io", username: "ac-secret://REGISTRY_USERNAME", password: "ac-secret://REGISTRY_PASSWORD" }
    });

    await userEvent.type(screen.getByLabelText("Registry password"), "hunter22");
    await userEvent.clear(screen.getByLabelText("Registry password"));

    expect(getValues().services[0].credentials?.password).toBe("ac-secret://REGISTRY_PASSWORD");
  });

  it("does not resurrect the previous deployment's credential after an import replaces it", async () => {
    const { getValues, importValues } = setup({
      image: "nginx:latest",
      credentials: { host: "ghcr.io", username: "ac-secret://REGISTRY_USERNAME", password: "ac-secret://REGISTRY_PASSWORD" }
    });

    importValues(
      defaultServiceWithPlacement({ image: "redis:7", hasCredentials: true, credentials: { host: "ghcr.io", username: "alice", password: "hunter22" } })
    );
    await userEvent.clear(screen.getByLabelText("Registry username"));

    expect(getValues().services[0].credentials?.username).toBe("");
  });

  it("does not take the removed service's kept credential after an earlier service is dropped", async () => {
    const { getValues } = setupServices();

    await userEvent.click(screen.getByRole("button", { name: "drop first service" }));
    await userEvent.type(screen.getByLabelText("Registry username"), "bob");
    await userEvent.clear(screen.getByLabelText("Registry username"));

    expect(getValues().services[0].credentials?.username).toBe("");
  });

  it("clears a typed registry username the user never kept", async () => {
    const { getValues } = setup({ image: "nginx:latest", credentials: { host: "ghcr.io", username: "alice", password: "hunter22" } });

    await userEvent.clear(screen.getByLabelText("Registry username"));

    expect(getValues().services[0].credentials?.username).toBe("");
  });

  it("shows a typed registry username as typed", () => {
    setup({ image: "nginx:latest", credentials: { host: "ghcr.io", username: "alice", password: "hunter22" } });

    expect(screen.getByLabelText("Registry username")).toHaveValue("alice");
    expect(screen.getByLabelText("Registry username")).not.toHaveAttribute("placeholder");
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

  it("does not flag the required image before it is touched", () => {
    setupTouched();

    expect(screen.getByRole("textbox", { name: "Docker image" })).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(/Docker image name is required/i)).not.toBeInTheDocument();
  });

  it("flags the required image once the field is touched (blurred) while empty", async () => {
    setupTouched();

    await userEvent.click(screen.getByRole("textbox", { name: "Docker image" }));
    await userEvent.tab();

    await waitFor(() => expect(screen.getByText(/Docker image name is required/i)).toBeInTheDocument());
  });

  it("shows a host error under the credentials fields when the custom host is not a valid URL", async () => {
    const { trigger } = setupValidated({ credentials: { host: "not a url", username: "alice", password: "secret" } });

    await trigger();

    await waitFor(() => {
      expect(screen.getByText("Host is not a valid registry URL")).toBeInTheDocument();
    });
  });

  it("renders as an Operating System card with a Distribution select for a vm image", () => {
    setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2" });

    expect(screen.getByText("Operating System")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Distribution" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Docker image")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Private registry")).not.toBeInTheDocument();
  });

  it("stores the real image ref when a distro is picked", async () => {
    const { getValues } = setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2" });

    await userEvent.click(screen.getByRole("combobox", { name: "Distribution" }));
    await userEvent.click(screen.getByRole("option", { name: "Debian 11" }));

    expect(getValues().services[0].image).toBe("ghcr.io/akash-network/debian-11-ssh:2");
  });

  it("offers Debian 13 as a distro", async () => {
    const { getValues } = setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2" });

    await userEvent.click(screen.getByRole("combobox", { name: "Distribution" }));
    await userEvent.click(screen.getByRole("option", { name: "Debian 13" }));

    expect(getValues().services[0].image).toBe("ghcr.io/akash-network/debian-13-ssh:1");
  });

  it("clears private-registry credentials when the service runs a vm image", async () => {
    const { getValues } = setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2", hasCredentials: true });

    await waitFor(() => {
      expect(getValues().services[0].hasCredentials).toBe(false);
      expect(getValues().services[0].credentials).toBeUndefined();
    });
  });

  it("keeps the Docker card for a non-vm image", () => {
    setup({ image: "nginx:latest" });

    expect(screen.getByText("Docker")).toBeInTheDocument();
    expect(screen.getByLabelText("Docker image")).toBeInTheDocument();
    expect(screen.queryByText("Operating System")).not.toBeInTheDocument();
  });

  it("puts the ssh public key field in the Operating System card for a vm image", () => {
    setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2" });

    expect(screen.getByRole("textbox", { name: "SSH public key" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate new key" })).toBeInTheDocument();
  });

  it("disables the ssh public key field while a vm card is locked", () => {
    setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2", locked: true });

    expect(screen.getByRole("textbox", { name: "SSH public key" })).toBeDisabled();
  });

  it("offers no ssh controls in the Docker card of a deployment without a key", () => {
    setup({ image: "nginx:latest" });

    expect(screen.queryByRole("checkbox", { name: "Expose SSH" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "SSH public key" })).not.toBeInTheDocument();
  });

  it("shows the key in the Docker card of a service loaded with one, so an imported placeholder can be replaced", () => {
    setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:1", hasSSHKey: true, sshPubKey: "YOUR_KEY_HERE" });

    expect(screen.getByRole("textbox", { name: "SSH public key" })).toHaveValue("YOUR_KEY_HERE");
    expect(screen.queryByRole("checkbox", { name: "Expose SSH" })).not.toBeInTheDocument();
  });

  it("offers no key field on a container loaded without one, even when a sibling carries one", () => {
    setup({ image: "nginx:latest", hasSSHKey: true, otherService: { image: "ghcr.io/akash-network/ubuntu-2404-ssh:1", sshPubKey: "ssh-ed25519 SIBLING" } });

    expect(screen.queryByRole("textbox", { name: "SSH public key" })).not.toBeInTheDocument();
  });

  it("shows the key on the card of the container that carries it, whatever its position", () => {
    setup({
      image: "nginx:latest",
      hasSSHKey: true,
      otherService: { image: "ghcr.io/akash-network/ubuntu-2404-ssh:1", sshPubKey: "ssh-ed25519 SIBLING" },
      serviceIndex: 1
    });

    expect(screen.getByRole("textbox", { name: "SSH public key" })).toHaveValue("ssh-ed25519 SIBLING");
  });

  it("leaves the key to the Operating System card when the deployment also runs a vm", () => {
    setup({
      image: "ghcr.io/akash-network/ubuntu-2404-ssh:1",
      hasSSHKey: true,
      sshPubKey: "ssh-ed25519 SHARED",
      otherService: { image: "ghcr.io/akash-network/ubuntu-2404-ssh:2", sshPubKey: "ssh-ed25519 SHARED" }
    });

    expect(screen.queryByRole("textbox", { name: "SSH public key" })).not.toBeInTheDocument();
  });

  it("changes only its own service's key, and keeps the field once the key is cleared", async () => {
    const { getValues } = setup({
      image: "ghcr.io/akash-network/ubuntu-2404-ssh:1",
      hasSSHKey: true,
      sshPubKey: "YOUR_KEY_HERE",
      otherService: { image: "ghcr.io/akash-network/ubuntu-2404-ssh:1", sshPubKey: "ssh-ed25519 SIBLING" }
    });

    await userEvent.clear(screen.getByRole("textbox", { name: "SSH public key" }));
    await userEvent.type(screen.getByRole("textbox", { name: "SSH public key" }), "ssh-ed25519 NEW");

    const [own, sibling] = getValues().services;
    expect(own.env?.find(variable => variable.key === "SSH_PUBKEY")?.value).toBe("ssh-ed25519 NEW");
    expect(sibling.env?.find(variable => variable.key === "SSH_PUBKEY")?.value).toBe("ssh-ed25519 SIBLING");
  });

  it("leaves Expose SSH out of the Operating System card, whose key is always required", () => {
    setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2" });

    expect(screen.queryByRole("checkbox", { name: "Expose SSH" })).not.toBeInTheDocument();
  });

  it("marks the Operating System card when a submit is rejected on its missing ssh key", async () => {
    setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2", resolver: zodResolver(SdlBuilderFormValuesSchema) });

    await userEvent.click(screen.getByRole("button", { name: "Request quotes" }));

    expect(await screen.findByText("SSH Public key is required.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse Operating System" }).closest(".border-destructive")).not.toBeNull();
  });

  it("leaves the Docker card unmarked when a submit is rejected on another field", async () => {
    const { fieldError } = setup({ image: "", resolver: zodResolver(SdlBuilderFormValuesSchema) });

    await userEvent.click(screen.getByRole("button", { name: "Request quotes" }));

    await waitFor(() => expect(fieldError("services.0.image")).toBeDefined());
    expect(screen.getByRole("button", { name: "Collapse Docker" }).closest(".border-destructive")).toBeNull();
  });

  it("leaves the Operating System card unmarked when a submit is rejected on another service", async () => {
    const resolver: Resolver<SdlBuilderFormValuesType> = async () => ({
      values: {},
      errors: { services: { 1: { image: { type: "required", message: "Docker image is required." } } } }
    });
    const { fieldError } = setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2", resolver });

    await userEvent.click(screen.getByRole("button", { name: "Request quotes" }));

    await waitFor(() => expect(fieldError("services.1.image")?.message).toBe("Docker image is required."));
    expect(screen.getByRole("button", { name: "Collapse Operating System" }).closest(".border-destructive")).toBeNull();
  });

  function portsOf(values: SdlBuilderFormValuesType) {
    return values.services[0].expose.map(({ port, as }) => ({ port, as }));
  }

  function setup(input: {
    image?: string;
    ports?: { port: number; as: number }[];
    hasSSHKey?: boolean;
    sshPubKey?: string;
    otherService?: { image: string; sshPubKey?: string };
    serviceIndex?: number;
    hasCredentials?: boolean;
    credentials?: { host: string; username: string; password: string };
    resolver?: Resolver<SdlBuilderFormValuesType>;
    locked?: boolean;
  }) {
    const hasCredentials = input.hasCredentials ?? !!input.credentials;
    const seeded = defaultServiceWithPlacement({
      image: input.image ?? "",
      hasCredentials,
      credentials: hasCredentials ? input.credentials ?? { host: "docker.io", username: "", password: "" } : undefined
    });
    const withKey = (service: ServiceType, sshPubKey: string | undefined) => (sshPubKey ? withServiceSshKey(service, sshPubKey) : service);
    const otherServices = input.otherService
      ? [withKey(defaultService(seeded.placements[0].id, { title: "service-2", image: input.otherService.image }), input.otherService.sshPubKey)]
      : [];
    const seededService = input.ports ? { ...seeded.services[0], expose: input.ports.map(port => defaultHttpExpose(port)) } : seeded.services[0];
    const values: SdlBuilderFormValuesType = {
      ...seeded,
      services: [withKey(seededService, input.sshPubKey), ...otherServices],
      hasSSHKey: input.hasSSHKey ?? false
    };

    let getValues: () => SdlBuilderFormValuesType = () => values;
    let reset: (imported: SdlBuilderFormValuesType) => void = () => undefined;
    let setExposedPort: (exposeIndex: number, port: number) => void = () => undefined;
    let getFieldError: (name: FieldPath<SdlBuilderFormValuesType>) => FieldError | undefined = () => undefined;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({
        defaultValues: values,
        mode: "onSubmit",
        reValidateMode: "onChange",
        resolver: input.resolver
      });
      getValues = form.getValues;
      reset = form.reset;
      setExposedPort = (exposeIndex, port) => form.setValue(`services.${input.serviceIndex ?? 0}.expose.${exposeIndex}.port`, port);
      getFieldError = name => form.getFieldState(name).error;
      return (
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(() => undefined)}>
            {children}
            <button type="submit">Request quotes</button>
          </form>
        </FormProvider>
      );
    };

    render(
      <Wrapper>
        <ImageCard serviceIndex={input.serviceIndex ?? 0} locked={input.locked} />
      </Wrapper>
    );

    return {
      getValues: () => getValues(),
      importValues: (imported: SdlBuilderFormValuesType) => act(() => reset(imported)),
      editExposedPort: (exposeIndex: number, port: number) => act(() => setExposedPort(exposeIndex, port)),
      fieldError: (name: FieldPath<SdlBuilderFormValuesType>) => getFieldError(name)
    };
  }

  /** Renders the card in the app's `onTouched` mode with the real resolver so touched-field validation can be asserted. */
  function setupTouched() {
    const values = defaultServiceWithPlacement({ image: "" });

    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onTouched", resolver: zodResolver(SdlBuilderFormValuesSchema) });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <ImageCard serviceIndex={0} />
      </Wrapper>
    );
  }

  /** Seeds two services and lets the test drop the first, because react-hook-form leaves its default values in the original order. */
  function setupServices() {
    const seeded = defaultServiceWithPlacement({
      image: "nginx",
      hasCredentials: true,
      credentials: { host: "ghcr.io", username: "ac-secret://REGISTRY_USERNAME", password: "ac-secret://REGISTRY_PASSWORD" }
    });
    const survivor = {
      ...seeded.services[0],
      id: "survivor",
      image: "redis",
      credentials: { host: "ghcr.io", username: "alice", password: "hunter22" }
    };
    const values = { ...seeded, services: [seeded.services[0], survivor] };

    let getValues: () => SdlBuilderFormValuesType = () => values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onSubmit" });
      const { remove } = useFieldArray({ control: form.control, name: "services" });
      getValues = form.getValues;
      return (
        <FormProvider {...form}>
          <button type="button" onClick={() => remove(0)}>
            drop first service
          </button>
          {children}
        </FormProvider>
      );
    };

    render(
      <Wrapper>
        <ImageCard serviceIndex={0} />
      </Wrapper>
    );

    return { getValues: () => getValues() };
  }

  /** Renders the card under the real resolver so the custom-host URL validation flows to the field state. */
  function setupValidated(input: { credentials: { host: string; username: string; password: string } }) {
    const values = defaultServiceWithPlacement({ image: "nginx:latest", hasCredentials: true, credentials: input.credentials });

    let trigger: () => Promise<boolean> = async () => true;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onChange", resolver: zodResolver(SdlBuilderFormValuesSchema) });
      trigger = () => form.trigger();
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <ImageCard serviceIndex={0} />
      </Wrapper>
    );

    return { trigger: () => trigger() };
  }
});
