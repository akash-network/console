import type { PropsWithChildren } from "react";
import type { Resolver } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { ImageCard } from "./ImageCard";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ImageCard.name, () => {
  it("edits the docker image and lowercases input", async () => {
    const { getValues } = setup({});

    await userEvent.type(screen.getByLabelText("Docker image"), "MyImage:1.0");

    expect(getValues().services[0].image).toBe("myimage:1.0");
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

  function setup(input: { hasCredentials?: boolean; resolver?: Resolver<SdlBuilderFormValuesType>; locked?: boolean }) {
    const values = defaultServiceWithPlacement({
      image: "",
      hasCredentials: input.hasCredentials ?? false,
      credentials: input.hasCredentials ? { host: "docker.io", username: "", password: "" } : undefined
    });

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
        <ImageCard serviceIndex={0} locked={input.locked} />
      </Wrapper>
    );

    return { getValues: () => getValues() };
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
