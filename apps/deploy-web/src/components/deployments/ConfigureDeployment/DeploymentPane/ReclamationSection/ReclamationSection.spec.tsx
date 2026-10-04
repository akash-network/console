import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it } from "vitest";

import type { ReclamationMinWindow, SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { ReclamationSection } from "./ReclamationSection";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ReclamationSection.name, () => {
  it("renders the Reclamation label", () => {
    setup();
    expect(screen.getByText("Reclamation")).toBeInTheDocument();
  });

  it("defaults to Any when no reclamation window is set", () => {
    setup();
    expect(screen.getByRole("combobox", { name: "Reclamation" })).toHaveTextContent("Any");
  });

  it("reflects the existing reclamation window selection", () => {
    setup({ reclamationMinWindow: "24h" });
    expect(screen.getByRole("combobox", { name: "Reclamation" })).toHaveTextContent("1 day");
  });

  it.each([
    { label: "1 hour", expected: "1h" },
    { label: "4 hours", expected: "4h" },
    { label: "1 day", expected: "24h" },
    { label: "3 days", expected: "72h" }
  ])("writes $expected to reclamationMinWindow when $label is picked", async ({ label, expected }) => {
    const { getValues } = setup();

    await userEvent.click(screen.getByRole("combobox", { name: "Reclamation" }));
    await userEvent.click(await screen.findByRole("option", { name: label }));

    expect(getValues().reclamationMinWindow).toBe(expected);
  });

  it("offers Any as a selectable option from the default state", async () => {
    const { getValues } = setup();

    await userEvent.click(screen.getByRole("combobox", { name: "Reclamation" }));
    const anyOption = await screen.findByRole("option", { name: "Any" });
    expect(anyOption).toBeEnabled();

    await userEvent.click(anyOption);

    expect(getValues().reclamationMinWindow).toBeUndefined();
  });

  it("clears reclamationMinWindow back to Any when Any is picked after a value", async () => {
    const { getValues } = setup({ reclamationMinWindow: "24h" });

    await userEvent.click(screen.getByRole("combobox", { name: "Reclamation" }));
    await userEvent.click(await screen.findByRole("option", { name: "Any" }));

    expect(getValues().reclamationMinWindow).toBeUndefined();
  });

  it("offers only the dropdown windows when none is set", async () => {
    setup();

    await userEvent.click(screen.getByRole("combobox", { name: "Reclamation" }));

    expect((await screen.findAllByRole("option")).map(option => option.textContent)).toEqual(["Any", "1 hour", "4 hours", "1 day", "3 days"]);
  });

  it("offers a selected dropdown window once", async () => {
    setup({ reclamationMinWindow: "24h" });

    await userEvent.click(screen.getByRole("combobox", { name: "Reclamation" }));

    expect((await screen.findAllByRole("option")).map(option => option.textContent)).toEqual(["Any", "1 hour", "4 hours", "1 day", "3 days"]);
  });

  it("keeps an imported window the dropdown does not offer selectable as written", async () => {
    setup({ reclamationMinWindow: "90m" });

    expect(screen.getByRole("combobox", { name: "Reclamation" })).toHaveTextContent("90m");
    await userEvent.click(screen.getByRole("combobox", { name: "Reclamation" }));
    expect(await screen.findByRole("option", { name: "90m" })).toBeInTheDocument();
  });

  it("disables the control when the pane is locked", () => {
    setup({ locked: true });
    expect(screen.getByRole("combobox", { name: "Reclamation" })).toBeDisabled();
  });

  function setup(input: { reclamationMinWindow?: ReclamationMinWindow; locked?: boolean } = {}) {
    const values: SdlBuilderFormValuesType = { ...defaultServiceWithPlacement(), reclamationMinWindow: input.reclamationMinWindow };

    let getValues: () => SdlBuilderFormValuesType = () => values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      getValues = form.getValues;
      return (
        <TooltipProvider>
          <FormProvider {...form}>{children}</FormProvider>
        </TooltipProvider>
      );
    };

    render(
      <Wrapper>
        <ReclamationSection locked={input.locked} />
      </Wrapper>
    );

    return { getValues: () => getValues() };
  }
});
