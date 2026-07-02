import type { PropsWithChildren } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormProvider, useForm, useFormContext, useFormState } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";

import type { ExposeType, SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types/sdlBuilder/sdlBuilder";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import {
  DEPENDENCIES,
  ExposePortsCard,
  hostnamesToInput,
  inputToHostnames,
  INTERNAL_ROUTING,
  PUBLIC_ROUTING,
  routingToModel,
  routingValueOf,
  validateEndpointName
} from "./ExposePortsCard";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ExposePortsCard.name, () => {
  it("opens the modal when the card is clicked", async () => {
    const { openCard } = setup({});

    await openCard();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Exposed ports")).toBeInTheDocument();
  });

  it("opens for viewing but disables the inputs and Save while locked", async () => {
    const { openCard } = setup({ expose: [{ port: 8080, as: 443 }], locked: true });

    await openCard();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Port 1 container port")).toBeDisabled();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("highlights the card after submit when an exposed port is invalid", async () => {
    const { submit } = setup({ expose: [{ port: 0 }] });

    await submit();

    await waitFor(() => expect(screen.getByRole("button", { name: /Expose Ports/ })).toHaveClass("border-destructive"));
  });

  it("does not highlight the card before the form is submitted", async () => {
    const { trigger } = setup({ expose: [{ port: 0 }] });

    await trigger();

    expect(screen.getByRole("button", { name: /Expose Ports/ })).not.toHaveClass("border-destructive");
  });

  it("does not surface errors when the modal is closed before submitting", async () => {
    const { openCard, getErrors } = setup({ expose: [{ port: 0 }] });

    await openCard();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: /Expose Ports/ })).not.toHaveClass("border-destructive");
    expect(getErrors().services).toBeUndefined();
  });

  it("shows the existing port mapping in the modal", async () => {
    const { openCard } = setup({ expose: [{ port: 8080, as: 443, proto: "tcp" }] });

    await openCard();

    expect(screen.getByLabelText("Port 1 container port")).toHaveValue(8080);
    expect(screen.getByLabelText("Port 1 exposed as")).toHaveValue(443);
  });

  it("shows the port count in the card header summary", () => {
    setup({
      expose: [
        { port: 80, as: 80 },
        { port: 443, as: 443 }
      ]
    });

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("appends a new port row when Add another port is clicked", async () => {
    const { openCard } = setup({ expose: [{ port: 80, as: 80 }] });

    await openCard();
    await userEvent.click(screen.getByRole("button", { name: "Add another port" }));

    expect(screen.getByLabelText("Port 2 container port")).toBeInTheDocument();
  });

  it("updates the footer port count live as rows are added and removed, before saving", async () => {
    const { openCard } = setup({ expose: [{ port: 80, as: 80 }] });

    await openCard();
    expect(screen.getByText("1 port")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add another port" }));
    expect(screen.getByText("2 ports")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove port 2" }));
    expect(screen.getByText("1 port")).toBeInTheDocument();
  });

  it("does not render a remove control when only one port is in the list", async () => {
    const { openCard } = setup({ expose: [{ port: 80, as: 80 }] });

    await openCard();

    expect(screen.queryByRole("button", { name: "Remove port 1" })).not.toBeInTheDocument();
  });

  it("commits changes and closes the modal on Save", async () => {
    const { getValues, openCard } = setup({ expose: [{ port: 80, as: 80 }] });

    await openCard();
    setPort("Port 1 container port", "3000");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getValues().services[0].expose[0].port).toBe(3000);
  });

  it("reverts changes and closes the modal on Cancel", async () => {
    const { getValues, openCard } = setup({ expose: [{ port: 80, as: 80 }] });

    await openCard();
    setPort("Port 1 container port", "3000");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getValues().services[0].expose[0].port).toBe(80);
  });

  it("removes a port when its remove control is clicked and saved", async () => {
    const { getValues, openCard } = setup({
      expose: [
        { port: 80, as: 80 },
        { port: 443, as: 443 }
      ]
    });

    await openCard();
    await userEvent.click(screen.getByRole("button", { name: "Remove port 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(getValues().services[0].expose).toEqual([expect.objectContaining({ port: 443, as: 443 })]);
  });

  it("hides the accept hostnames input when the port is internal", async () => {
    const { openCard } = setup({ expose: [{ port: 80, as: 80, global: false }] });

    await openCard();

    expect(screen.queryByLabelText("Port 1 accept hostnames")).not.toBeInTheDocument();
  });

  it("shows the accept hostnames input when the port is externally reachable", async () => {
    const { openCard } = setup({ expose: [{ port: 80, as: 80, global: true }] });

    await openCard();

    expect(screen.getByLabelText("Port 1 accept hostnames")).toBeInTheDocument();
  });

  it("treats a port bound to an IP endpoint as externally reachable and round-trips the binding", async () => {
    const { getValues, openCard } = setup({
      expose: [{ port: 80, as: 80, global: true, ipName: "endpoint-1" }],
      endpoints: [{ id: "ep-1", name: "endpoint-1" }]
    });

    await openCard();
    expect(screen.getByLabelText("Port 1 accept hostnames")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(getValues().services[0].expose[0].ipName).toBe("endpoint-1");
    expect(getValues().services[0].expose[0].global).toBe(true);
  });

  it("seeds the accept hostnames input from the existing accept list", async () => {
    const { openCard } = setup({ expose: [{ port: 80, as: 80, global: true, accept: [{ value: "example.com" }, { value: "api.example.com" }] }] });

    await openCard();

    expect(screen.getByLabelText("Port 1 accept hostnames")).toHaveValue("example.com, api.example.com");
  });

  it("stores comma-separated hostnames as the accept list", async () => {
    const { getValues, openCard } = setup({ expose: [{ port: 80, as: 80, global: true }] });

    await openCard();
    await userEvent.type(screen.getByLabelText("Port 1 accept hostnames"), "example.com, api.example.com");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(getValues().services[0].expose[0].accept).toEqual([
      expect.objectContaining({ value: "example.com" }),
      expect.objectContaining({ value: "api.example.com" })
    ]);
  });

  it("surfaces an inline error when a port is out of range", async () => {
    const { openCard } = setup({ expose: [{ port: 80, as: 80 }] });

    await openCard();
    setPort("Port 1 container port", "70000");

    expect(await screen.findByText("Port number must be at most 65535.")).toBeInTheDocument();
  });

  it("keeps validation errors on the rest of the form when saving", async () => {
    const { trigger, openCard } = setup({ expose: [{ port: 80, as: 80 }], image: "" });
    await trigger();
    await waitFor(() => expect(screen.getByTestId("image-error")).not.toBeEmptyDOMElement());

    await openCard();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("image-error")).not.toBeEmptyDOMElement();
  });

  describe("To targets", () => {
    it("does not show the To section when there are no other services", async () => {
      const { openCard } = setup({ expose: [{ port: 80, as: 80 }] });

      await openCard();

      expect(screen.queryByLabelText("Port 1 to targets")).not.toBeInTheDocument();
    });

    it("shows other services as To targets whenever other services exist, independent of log forwarding", async () => {
      const { openCard } = setup({ expose: [{ port: 80, as: 80 }], extraServiceTitles: ["service-2"] });

      await openCard();

      expect(screen.getByLabelText("Port 1 to targets")).toBeInTheDocument();
      expect(screen.getByLabelText("service-2")).toBeInTheDocument();
    });

    it("does not list the current service as a target", async () => {
      const { openCard } = setup({ expose: [{ port: 80, as: 80 }], extraServiceTitles: ["service-2"] });

      await openCard();

      expect(screen.queryByLabelText("service-1")).not.toBeInTheDocument();
    });

    it("stores a checked target in the expose to list on Save", async () => {
      const { getValues, openCard } = setup({ expose: [{ port: 80, as: 80 }], extraServiceTitles: ["service-2"] });

      await openCard();
      await userEvent.click(screen.getByLabelText("service-2"));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(getValues().services[0].expose[0].to).toEqual([expect.objectContaining({ value: "service-2" })]);
    });
  });

  describe("HTTP options", () => {
    it("hides the HTTP options fields until custom options are enabled", async () => {
      const { openCard } = setup({ expose: [{ port: 80, as: 80 }] });

      await openCard();

      expect(screen.queryByLabelText("Max body size")).not.toBeInTheDocument();
    });

    it("leaves httpOptions absent and the port valid when custom options stay off across Save", async () => {
      const { getValues, trigger, openCard } = setup({ expose: [{ port: 80, as: 80 }] });

      await openCard();
      await userEvent.click(screen.getByRole("button", { name: "Add another port" }));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      await trigger();

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.getByTestId("expose-error")).toBeEmptyDOMElement();
      expect(getValues().services[0].expose[0].httpOptions).toBeUndefined();
    });

    it("seeds the full httpOptions default object when custom options are enabled", async () => {
      const { getValues, openCard } = setup({ expose: [{ port: 80, as: 80 }] });

      await openCard();
      await userEvent.click(screen.getByLabelText("Custom HTTP options"));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      const httpOptions = getValues().services[0].expose[0].httpOptions;
      expect(httpOptions).toEqual({
        maxBodySize: 1048576,
        readTimeout: 60000,
        sendTimeout: 60000,
        nextTries: 3,
        nextTimeout: 60000,
        nextCases: ["error", "timeout"]
      });
    });

    it("reveals and seeds the HTTP options fields when custom options are enabled", async () => {
      const { openCard } = setup({ expose: [{ port: 80, as: 80 }] });

      await openCard();
      await userEvent.click(screen.getByLabelText("Custom HTTP options"));

      expect(screen.getByLabelText("Max body size")).toHaveValue(1048576);
      expect(screen.getByLabelText("Read timeout")).toHaveValue(60000);
    });

    it("persists custom HTTP options on Save", async () => {
      const { getValues, openCard } = setup({ expose: [{ port: 80, as: 80 }] });

      await openCard();
      await userEvent.click(screen.getByLabelText("Custom HTTP options"));
      fireEvent.change(screen.getByLabelText("Max body size"), { target: { value: "2000" } });
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(getValues().services[0].expose[0].hasCustomHttpOptions).toBe(true);
      expect(getValues().services[0].expose[0].httpOptions?.maxBodySize).toBe(2000);
    });

    it("toggles a next case on Save", async () => {
      const { getValues, openCard } = setup({ expose: [{ port: 80, as: 80 }] });

      await openCard();
      await userEvent.click(screen.getByLabelText("Custom HTTP options"));
      await userEvent.click(screen.getByLabelText("503"));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(getValues().services[0].expose[0].httpOptions?.nextCases).toContain("503");
    });

    it("clears httpOptions when custom options are enabled and then turned back off", async () => {
      const { getValues, openCard } = setup({ expose: [{ port: 80, as: 80 }] });

      await openCard();
      await userEvent.click(screen.getByLabelText("Custom HTTP options"));
      await userEvent.click(screen.getByLabelText("Custom HTTP options"));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(getValues().services[0].expose[0].hasCustomHttpOptions).toBe(false);
      expect(getValues().services[0].expose[0].httpOptions).toBeUndefined();
    });

    it("hides the accept hostnames and custom HTTP options for a TCP port", async () => {
      const { openCard } = setup({ expose: [{ port: 80, as: 80, proto: "tcp" }] });

      await openCard();

      expect(screen.queryByLabelText("Port 1 accept hostnames")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Custom HTTP options")).not.toBeInTheDocument();
    });

    it("clears accept hostnames and httpOptions when a configured HTTP port switches to TCP", async () => {
      const { getValues, openCard } = setup({ expose: [{ port: 80, as: 80, proto: "http" }] });

      await openCard();
      fireEvent.change(screen.getByLabelText("Port 1 accept hostnames"), { target: { value: "example.com" } });
      await userEvent.click(screen.getByLabelText("Custom HTTP options"));
      await userEvent.click(screen.getByLabelText("tcp"));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      const saved = getValues().services[0].expose[0];
      expect(saved.proto).toBe("tcp");
      expect(saved.accept).toEqual([]);
      expect(saved.hasCustomHttpOptions).toBe(false);
      expect(saved.httpOptions).toBeUndefined();
    });
  });

  describe("routingValueOf", () => {
    it("returns public for a global port with no IP name", () => {
      expect(routingValueOf({ global: true, ipName: "" })).toBe(PUBLIC_ROUTING);
    });

    it("returns internal for a non-global port", () => {
      expect(routingValueOf({ global: false, ipName: "" })).toBe(INTERNAL_ROUTING);
    });

    it("returns the IP endpoint name when one is bound", () => {
      expect(routingValueOf({ global: true, ipName: "endpoint-1" })).toBe("endpoint-1");
    });
  });

  describe("routingToModel", () => {
    it("maps public to a global port with no IP name", () => {
      expect(routingToModel(PUBLIC_ROUTING)).toEqual({ global: true, ipName: "" });
    });

    it("maps internal to a non-global port with no IP name", () => {
      expect(routingToModel(INTERNAL_ROUTING)).toEqual({ global: false, ipName: "" });
    });

    it("binds any other value to that named IP endpoint", () => {
      expect(routingToModel("endpoint-1")).toEqual({ global: true, ipName: "endpoint-1" });
    });
  });

  describe("validateEndpointName", () => {
    it("returns null for a valid, unique name", () => {
      expect(validateEndpointName("endpoint-2", ["endpoint-1"])).toBeNull();
    });

    it("returns the schema message for an invalid name", () => {
      expect(validateEndpointName("Bad_Name!", [])).toBe("Invalid endpoint name. It must only be lower case letters, numbers and dashes.");
    });

    it("returns a required message for a blank name", () => {
      expect(validateEndpointName("", [])).toBe("Endpoint name is required.");
    });

    it("returns a uniqueness message for a duplicate name", () => {
      expect(validateEndpointName("endpoint-1", ["endpoint-1"])).toBe("Endpoint name must be unique.");
    });
  });

  describe("hostnamesToInput", () => {
    it("joins the accept list into a comma-separated string", () => {
      expect(hostnamesToInput([{ value: "example.com" }, { value: "api.example.com" }])).toBe("example.com, api.example.com");
    });

    it("returns an empty string for an empty or missing accept list", () => {
      expect(hostnamesToInput([])).toBe("");
      expect(hostnamesToInput(undefined)).toBe("");
    });
  });

  describe("inputToHostnames", () => {
    it("splits on commas and drops blank entries", () => {
      expect(inputToHostnames("example.com, , api.example.com,")).toEqual([
        expect.objectContaining({ value: "example.com" }),
        expect.objectContaining({ value: "api.example.com" })
      ]);
    });

    it("returns an empty list for a blank string", () => {
      expect(inputToHostnames("   ")).toEqual([]);
    });
  });

  function setup(
    input: {
      expose?: Array<Partial<ExposeType>>;
      image?: string;
      extraServiceTitles?: string[];
      withLogForwarding?: boolean;
      endpoints?: Array<{ id: string; name: string }>;
      locked?: boolean;
    } = {}
  ) {
    const values = defaultServiceWithPlacement(input.image !== undefined ? { image: input.image } : undefined);
    if (input.expose) {
      values.services[0].expose = input.expose.map(e => ({ port: 80, as: 80, proto: "http", global: true, to: [], accept: [], ipName: "", ...e }));
    }

    if (input.endpoints) {
      values.endpoints = input.endpoints;
    }

    const parent = values.services[0];
    (input.extraServiceTitles ?? []).forEach((title, index) => {
      values.services.push({ ...parent, id: `service-${index + 2}`, title, expose: [] });
    });

    if (input.withLogForwarding) {
      values.services.push({
        ...parent,
        id: `${parent.id}-log-collector`,
        title: `${parent.title}-log-collector`,
        image: "ghcr.io/akash-network/log-collector:2.25.0",
        expose: [],
        env: [{ key: "PROVIDER", value: "DATADOG" }]
      });
    }

    let form: UseFormReturn<SdlBuilderFormValuesType> | undefined;
    const Wrapper = ({ children }: PropsWithChildren) => {
      form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onChange", resolver: zodResolver(SdlBuilderFormValuesSchema) });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <ExposePortsCard serviceIndex={0} locked={input.locked} dependencies={{ ...DEPENDENCIES }} />
        <ImageErrorProbe serviceIndex={0} />
        <ExposeErrorProbe serviceIndex={0} />
      </Wrapper>
    );

    return {
      getValues: () => (form as UseFormReturn<SdlBuilderFormValuesType>).getValues(),
      getErrors: () => (form as UseFormReturn<SdlBuilderFormValuesType>).formState.errors,
      trigger: () => (form as UseFormReturn<SdlBuilderFormValuesType>).trigger(),
      submit: () => (form as UseFormReturn<SdlBuilderFormValuesType>).handleSubmit(() => undefined)(),
      openCard: () => userEvent.click(screen.getByText(/^Expose Ports/))
    };
  }
});

/**
 * Sets a number input's value. `userEvent` can't reliably overwrite a controlled
 * `type="number"` input in jsdom (clear/select-all/backspace all leave stale
 * digits), so the change is fired directly with the full replacement value.
 */
function setPort(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** Surfaces a service's image validation error in the DOM so tests can assert it survives expose edits. */
function ImageErrorProbe({ serviceIndex }: { serviceIndex: number }) {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const { errors } = useFormState({ control, name: `services.${serviceIndex}.image` });
  const message = errors.services?.[serviceIndex]?.image?.message;
  return <div data-testid="image-error">{message ?? ""}</div>;
}

/** Surfaces whether a service's expose array has any validation errors, so tests can assert the form stays valid. */
function ExposeErrorProbe({ serviceIndex }: { serviceIndex: number }) {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const { errors } = useFormState({ control, name: `services.${serviceIndex}.expose` });
  const exposeErrors = errors.services?.[serviceIndex]?.expose;
  return <div data-testid="expose-error">{exposeErrors ? JSON.stringify(exposeErrors) : ""}</div>;
}
