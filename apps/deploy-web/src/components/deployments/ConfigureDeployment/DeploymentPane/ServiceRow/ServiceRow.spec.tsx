import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, ServiceRow } from "./ServiceRow";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("ServiceRow", () => {
  it("selects the service when its select button is activated", async () => {
    const { onSelect } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Select service-1" }));

    expect(onSelect).toHaveBeenCalled();
  });

  it("marks the select button pressed when selected", () => {
    setup({ isSelected: true });

    expect(screen.getByRole("button", { name: "Select service-1" })).toHaveAttribute("aria-pressed", "true");
  });

  it("selects the service when the name input is clicked", async () => {
    const { onSelect } = setup({});

    await userEvent.click(screen.getByRole("textbox", { name: "Service name" }));

    expect(onSelect).toHaveBeenCalled();
  });

  it("disables the service name while locked", () => {
    setup({ locked: true });

    expect(screen.getByRole("textbox", { name: "Service name" })).toBeDisabled();
  });

  it("keeps the service name editable while unlocked", () => {
    setup({});

    expect(screen.getByRole("textbox", { name: "Service name" })).toBeEnabled();
  });

  it("does not select the service when the remove button is clicked", async () => {
    const { onSelect, onRemove } = setup({ canRemove: true });

    await userEvent.click(screen.getByRole("button", { name: "Remove service-1" }));

    expect(onRemove).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows the incomplete status for a service failing validation", () => {
    setup({});

    expect(screen.getByRole("img", { name: "Incomplete" })).toBeInTheDocument();
  });

  it("shows the complete status for a valid service", () => {
    setup({ image: "nginx:latest" });

    expect(screen.getByRole("img", { name: "Complete" })).toBeInTheDocument();
  });

  it("removes the service", async () => {
    const { onRemove } = setup({ canRemove: true });

    await userEvent.click(screen.getByRole("button", { name: "Remove service-1" }));

    expect(onRemove).toHaveBeenCalled();
  });

  it("hides removal when the service is the last one", () => {
    setup({ canRemove: false });

    expect(screen.queryByRole("button", { name: "Remove service-1" })).not.toBeInTheDocument();
  });

  it("renders the validation error message below the row", () => {
    setup({ error: "Names must start with a lower case letter." });

    expect(screen.getByText("Names must start with a lower case letter.")).toBeInTheDocument();
  });

  it("does not render an error message when the field is valid", () => {
    setup({});

    expect(screen.queryByText("Names must start with a lower case letter.")).not.toBeInTheDocument();
  });

  function setup(input: { isSelected?: boolean; canRemove?: boolean; image?: string; error?: string; locked?: boolean }) {
    const values = defaultServiceWithPlacement({ title: "service-1", image: input.image ?? "" });
    const onSelect = vi.fn();
    const onRemove = vi.fn();
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <ul aria-label="services">
          <ServiceRow
            service={values.services[0]}
            serviceIndex={0}
            isSelected={input.isSelected ?? false}
            canRemove={input.canRemove ?? true}
            locked={input.locked}
            onSelect={onSelect}
            onRemove={onRemove}
            dependencies={{ ...DEPENDENCIES, useFieldError: () => ({ error: input.error }) }}
          />
        </ul>
      </Wrapper>
    );

    return { onSelect, onRemove };
  }
});
