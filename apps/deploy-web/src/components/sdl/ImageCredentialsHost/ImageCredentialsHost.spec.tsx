import { FormProvider, useForm } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";
import { CUSTOM_HOST_ID } from "@src/types";
import { ImageCredentialsHost } from "./ImageCredentialsHost";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildSDLService } from "@tests/seeders/sdlService";

describe(ImageCredentialsHost.name, () => {
  it("renders all supported hosts in the dropdown", async () => {
    const { user } = await setup();

    const selectTrigger = screen.getByLabelText("Host");
    await user.click(selectTrigger);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Docker Hub - docker.io" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "GitHub Container Registry - ghcr.io" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Google Artifact Registry - pkg.dev" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "AWS Elastic Container Registry - amazonaws.com" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Azure Container Registry - azurecr.io" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "GitLab Container Registry - registry.gitlab.com" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Custom Registry" })).toBeInTheDocument();
    });
  });

  it("updates form value when a host is selected", async () => {
    const { user, form } = await setup();

    const selectTrigger = screen.getByLabelText("Host");
    await user.click(selectTrigger);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /AWS Elastic/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("option", { name: /AWS Elastic/ }));

    await waitFor(() => {
      expect(form.getValues("services.0.credentials.host")).toBe("amazonaws.com");
    });
  });

  it("shows custom registry input when custom host is selected", async () => {
    const { user } = await setup();

    const selectTrigger = screen.getByLabelText("Host");
    await user.click(selectTrigger);

    await waitFor(() => {
      expect(screen.queryByText("Custom Registry")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Custom Registry"));

    await waitFor(() => {
      expect(screen.queryByText("Custom Registry URL")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("e.g., myregistry.example.com")).toBeInTheDocument();
    });
  });

  it("hides custom registry input when non-custom host is selected", async () => {
    const { user, form } = await setup({
      defaultHost: CUSTOM_HOST_ID
    });

    expect(screen.queryByText("Custom Registry URL")).toBeInTheDocument();

    const selectTrigger = screen.getByLabelText("Host");
    await user.click(selectTrigger);

    await waitFor(() => {
      expect(screen.queryByText("Docker Hub - docker.io")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Docker Hub - docker.io"));

    await waitFor(() => {
      expect(screen.queryByText("Custom Registry URL")).not.toBeInTheDocument();
      expect(form.getValues("services.0.credentials.host")).toBe("docker.io");
    });
  });

  it("updates form value when custom registry URL is entered", async () => {
    const { user, form } = await setup({
      defaultHost: CUSTOM_HOST_ID
    });

    const customInput = screen.getByPlaceholderText("e.g., myregistry.example.com");
    await user.type(customInput, "myregistry.example.com");

    await waitFor(() => {
      expect(form.getValues("services.0.credentials.host")).toBe("myregistry.example.com");
    });
  });

  it("shows custom input when host value is not in supported hosts list", async () => {
    await setup({
      defaultHost: "unknown-registry.com"
    });

    expect(screen.queryByText("Custom Registry URL")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("e.g., myregistry.example.com")).toBeInTheDocument();
  });

  it("clears custom input value when switching from custom host to predefined host", async () => {
    const { user, form } = await setup({
      defaultHost: "myregistry.example.com"
    });

    expect(screen.queryByText("Custom Registry URL")).toBeInTheDocument();
    const customInput = screen.getByPlaceholderText("e.g., myregistry.example.com") as HTMLInputElement;
    expect(customInput.value).toBe("myregistry.example.com");

    const selectTrigger = screen.getByLabelText("Host");
    await user.click(selectTrigger);

    await waitFor(() => {
      expect(screen.queryByText("Docker Hub - docker.io")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Docker Hub - docker.io"));

    await waitFor(() => {
      expect(form.getValues("services.0.credentials.host")).toBe("docker.io");
      expect(screen.queryByText("Custom Registry URL")).not.toBeInTheDocument();
    });
  });

  it("displays validation error message when field has error", async () => {
    let maybeForm: ReturnType<typeof useForm<SdlBuilderFormValuesType>>;

    const TestWrapper = () => {
      const methods = useForm<SdlBuilderFormValuesType>({
        defaultValues: {
          services: [
            buildSDLService({
              credentials: {
                host: "",
                username: "",
                password: ""
              }
            })
          ],
          imageList: [],
          hasSSHKey: false
        }
      });
      maybeForm = methods;

      return (
        <FormProvider {...methods}>
          <ImageCredentialsHost serviceIndex={0} control={methods.control} />
        </FormProvider>
      );
    };

    const { rerender } = render(<TestWrapper />);
    const form = await waitFor(() => maybeForm);

    await act(async () => {
      form.setError("services.0.credentials.host", {
        type: "required",
        message: "Host is required."
      });
    });

    rerender(
      <FormProvider {...form}>
        <ImageCredentialsHost serviceIndex={0} control={form.control} />
      </FormProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText("Host is required.")).toBeInTheDocument();
    });
  });

  it("handles undefined host value", async () => {
    await setup({
      defaultHost: undefined
    });

    expect(screen.getByLabelText("Host")).toBeInTheDocument();
  });

  it("preserves custom host value when typing in custom input", async () => {
    const { user, form } = await setup({
      defaultHost: CUSTOM_HOST_ID
    });

    const customInput = screen.getByPlaceholderText("e.g., myregistry.example.com");
    await user.clear(customInput);
    await user.type(customInput, "registry.example.com");

    await waitFor(() => {
      expect(form.getValues("services.0.credentials.host")).toBe("registry.example.com");
    });
  });

  async function setup(input: { defaultHost?: string | undefined } = {}) {
    const defaultHost = input.defaultHost ?? "docker.io";

    let maybeForm: ReturnType<typeof useForm<SdlBuilderFormValuesType>>;

    const TestWrapper = () => {
      const methods = useForm<SdlBuilderFormValuesType>({
        defaultValues: {
          services: [
            buildSDLService({
              credentials: {
                host: defaultHost,
                username: "",
                password: ""
              }
            })
          ],
          imageList: [],
          hasSSHKey: false
        }
      });
      maybeForm = methods;

      return (
        <FormProvider {...methods}>
          <ImageCredentialsHost serviceIndex={0} control={methods.control} />
        </FormProvider>
      );
    };

    const user = userEvent.setup();
    const result = render(<TestWrapper />);

    return {
      ...result,
      user,
      form: await waitFor(() => maybeForm)
    };
  }
});
