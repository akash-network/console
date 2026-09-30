import type { PropsWithChildren } from "react";
import type { FieldError, FieldPath, Resolver } from "react-hook-form";
import { FormProvider, useForm, useFormState } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, ReplicasCard } from "./ReplicasCard";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ReplicasCard.name, () => {
  it("renders collapsed by default", () => {
    setup({ expanded: false });

    expect(screen.queryByRole("spinbutton", { name: "Quantity" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand Replicas" })).toBeInTheDocument();
  });

  it("disables the quantity stepper while locked", () => {
    setup({ locked: true });

    expect(screen.getByRole("spinbutton", { name: "Quantity" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Increase Quantity" })).toBeDisabled();
  });

  it("increments the replica count", async () => {
    const { getValues } = setup({ count: 1 });

    await userEvent.click(screen.getByRole("button", { name: "Increase Quantity" }));

    expect(getValues().services[0].count).toBe(2);
    expect(screen.getByRole("spinbutton", { name: "Quantity" })).toHaveValue(2);
  });

  it("does not decrement the replica count below one", () => {
    const { getValues } = setup({ count: 1 });

    expect(screen.getByRole("button", { name: "Decrease Quantity" })).toBeDisabled();
    expect(getValues().services[0].count).toBe(1);
  });

  it("marks the collapsed card when a submit is rejected on the replica count", async () => {
    const resolver: Resolver<SdlBuilderFormValuesType> = async () => ({
      values: {},
      errors: { services: { 0: { count: { type: "max", message: "Too many replicas" } } } }
    });
    setup({ resolver, expanded: false });

    await userEvent.click(screen.getByRole("button", { name: "Request quotes" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Expand Replicas" }).closest(".border-destructive")).not.toBeNull());
  });

  it("leaves the card unmarked when a submit is rejected on another field of the service", async () => {
    const { fieldError } = setup({ image: "", resolver: zodResolver(SdlBuilderFormValuesSchema), expanded: false });

    await userEvent.click(screen.getByRole("button", { name: "Request quotes" }));

    await waitFor(() => expect(fieldError("services.0.image")).toBeDefined());
    expect(screen.getByRole("button", { name: "Expand Replicas" }).closest(".border-destructive")).toBeNull();
  });

  it("leaves the card unmarked when a submit is rejected on another service", async () => {
    const resolver: Resolver<SdlBuilderFormValuesType> = async () => ({
      values: {},
      errors: { services: { 1: { count: { type: "max", message: "Too many replicas" } } } }
    });
    const { fieldError } = setup({ resolver, expanded: false });

    await userEvent.click(screen.getByRole("button", { name: "Request quotes" }));

    await waitFor(() => expect(fieldError("services.1.count")?.message).toBe("Too many replicas"));
    expect(screen.getByRole("button", { name: "Expand Replicas" }).closest(".border-destructive")).toBeNull();
  });

  it("describes the stepper by the count error once there is one", async () => {
    const resolver: Resolver<SdlBuilderFormValuesType> = async () => ({
      values: {},
      errors: { services: { 0: { count: { type: "max", message: "Too many replicas" } } } }
    });
    setup({ resolver });

    expect(screen.getByRole("spinbutton", { name: "Quantity" })).not.toHaveAttribute("aria-describedby");

    await userEvent.click(screen.getByRole("button", { name: "Request quotes" }));

    await waitFor(() => expect(screen.getByRole("spinbutton", { name: "Quantity" })).toHaveAccessibleDescription("Too many replicas"));
  });

  it("re-validates the CPU group limit when the replica count changes", async () => {
    const resolver: Resolver<SdlBuilderFormValuesType> = async values => {
      const errors = values.services[0].count > 1 ? { services: { 0: { profile: { cpu: { type: "max", message: "CPU group limit exceeded" } } } } } : {};
      return { values, errors };
    };
    setupValidated({ count: 1, resolver });

    expect(screen.queryByText("CPU group limit exceeded")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Increase Quantity" }));

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

    await userEvent.click(screen.getByRole("button", { name: "Increase Quantity" }));

    await waitFor(() => {
      expect(screen.getByText("GPU group limit exceeded")).toBeInTheDocument();
    });
  });

  it("re-validates the RAM group limit when the replica count changes", async () => {
    const resolver: Resolver<SdlBuilderFormValuesType> = async values => {
      const errors = values.services[0].count > 1 ? { services: { 0: { profile: { ram: { type: "max", message: "RAM group limit exceeded" } } } } } : {};
      return { values, errors };
    };
    setupValidated({ count: 1, resolver });

    await userEvent.click(screen.getByRole("button", { name: "Increase Quantity" }));

    await waitFor(() => {
      expect(screen.getByText("RAM group limit exceeded")).toBeInTheDocument();
    });
  });

  function setup(input: { count?: number; image?: string; locked?: boolean; expanded?: boolean; resolver?: Resolver<SdlBuilderFormValuesType> }) {
    const values: SdlBuilderFormValuesType = defaultServiceWithPlacement({ image: input.image ?? "nginx:latest", count: input.count ?? 1 });

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
        <ReplicasCard serviceIndex={0} locked={input.locked} dependencies={DEPENDENCIES} />
      </Wrapper>
    );

    if (input.expanded ?? true) {
      fireEvent.click(screen.getByRole("button", { name: "Expand Replicas" }));
    }

    return { getValues: () => getValues(), fieldError: (name: FieldPath<SdlBuilderFormValuesType>) => getFieldError(name) };
  }

  function setupValidated(input: { count?: number; resolver?: Resolver<SdlBuilderFormValuesType> }) {
    const values = defaultServiceWithPlacement({ image: "nginx:latest", count: input.count ?? 1 });

    const GroupLimitProbe = () => {
      const { errors } = useFormState<SdlBuilderFormValuesType>();
      const profile = errors.services?.[0]?.profile;
      const message = profile?.cpu?.message ?? profile?.ram?.message ?? profile?.gpu?.message;
      return message ? <span>{message}</span> : null;
    };

    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({
        defaultValues: values,
        mode: "onChange",
        resolver: input.resolver ?? zodResolver(SdlBuilderFormValuesSchema)
      });
      return (
        <FormProvider {...form}>
          {children}
          <GroupLimitProbe />
        </FormProvider>
      );
    };

    render(
      <Wrapper>
        <ReplicasCard serviceIndex={0} dependencies={DEPENDENCIES} />
      </Wrapper>
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand Replicas" }));
  }
});
