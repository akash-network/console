import type { PropsWithChildren } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { InlineEditInput, useFieldError } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import type { ConfigurationLock } from "../../ConfigurationPane/configurationLock";
import type { DEPENDENCIES } from "./ServiceCard";
import { ServiceCard } from "./ServiceCard";

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ServiceCard.name, () => {
  it("labels the card after its service", () => {
    setup({});

    expect(screen.getByRole("region", { name: "web service" })).toBeInTheDocument();
  });

  it.each([
    [true, "Complete"],
    [false, "Incomplete"]
  ])("shows the configuration status in the header (configured: %s)", (isConfigured, status) => {
    setup({ isConfigured });

    expect(within(screen.getByRole("region", { name: "web service" })).getByRole("img", { name: status })).toBeInTheDocument();
  });

  it("renders the service's sections while expanded", () => {
    const { ImageSection, HardwareSection, AdditionalSection } = setup({ isExpanded: true });

    expect(ImageSection).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 0, locked: false }), expect.anything());
    expect(HardwareSection).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 0, locked: false }), expect.anything());
    expect(AdditionalSection).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 0, locked: undefined }), expect.anything());
  });

  it.each<[ConfigurationLock, boolean, boolean]>([
    ["onchain", false, true],
    ["all", true, true]
  ])("maps the %s lock onto its sections", (locked, imageLocked, hardwareLocked) => {
    const { ImageSection, HardwareSection, AdditionalSection } = setup({ isExpanded: true, locked });

    expect(ImageSection).toHaveBeenCalledWith(expect.objectContaining({ locked: imageLocked }), expect.anything());
    expect(HardwareSection).toHaveBeenCalledWith(expect.objectContaining({ locked: hardwareLocked }), expect.anything());
    expect(AdditionalSection).toHaveBeenCalledWith(expect.objectContaining({ locked }), expect.anything());
  });

  it("unmounts its sections while collapsed", () => {
    const { ImageSection } = setup({ isExpanded: false });

    expect(ImageSection).not.toHaveBeenCalled();
  });

  it("expands and collapses through its chevron", async () => {
    const { onExpandedChange } = setup({ isExpanded: false });

    await userEvent.click(screen.getByRole("button", { name: "Expand web" }));

    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it("names the chevron for collapsing while expanded", () => {
    setup({ isExpanded: true });

    expect(screen.getByRole("button", { name: "Collapse web" })).toBeInTheDocument();
  });

  it("renames the service inline", async () => {
    const { getValues } = setup({});

    await userEvent.clear(screen.getByLabelText("Service name"));
    await userEvent.type(screen.getByLabelText("Service name"), "api{Enter}");

    expect(getValues().services[0].title).toBe("api");
  });

  it("removes the service", async () => {
    const { onRemove } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Remove web" }));

    expect(onRemove).toHaveBeenCalled();
  });

  it.each([
    ["when the placement would lose its last service", { canRemove: false }],
    ["while locked", { locked: "onchain" as const }]
  ])("offers no removal %s", (_, overrides) => {
    setup(overrides);

    expect(screen.queryByRole("button", { name: "Remove web" })).not.toBeInTheDocument();
  });

  it("tints the card while the service has a validation error", () => {
    const { form } = setup({});

    act(() => form().setError("services.0.image", { type: "manual", message: "Image is required" }));

    expect(screen.getByRole("region", { name: "web service" })).toHaveClass("border-destructive");
  });

  it("shows the service name's error below the header", () => {
    const { form } = setup({});

    act(() => form().setError("services.0.title", { type: "manual", message: "Service name must be unique" }));

    expect(screen.getByText("Service name must be unique")).toBeInTheDocument();
  });

  it("scrolls itself into view when asked to", () => {
    const scrollIntoView = vi.spyOn(HTMLElement.prototype, "scrollIntoView");

    setup({ shouldScrollIntoView: true });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
    scrollIntoView.mockRestore();
  });

  function setup(input: { isExpanded?: boolean; isConfigured?: boolean; canRemove?: boolean; locked?: ConfigurationLock; shouldScrollIntoView?: boolean }) {
    const values = defaultServiceWithPlacement({ title: "web" });
    const ImageSection = vi.fn(() => null);
    const HardwareSection = vi.fn(() => null);
    const AdditionalSection = vi.fn(() => null);
    const onExpandedChange = vi.fn();
    const onRemove = vi.fn();
    const dependencies: typeof DEPENDENCIES = { ImageSection, HardwareSection, AdditionalSection, InlineEditInput, useFieldError };
    let form: UseFormReturn<SdlBuilderFormValuesType> | undefined;
    const Wrapper = ({ children }: PropsWithChildren) => {
      form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <ServiceCard
          service={values.services[0]}
          serviceIndex={0}
          isExpanded={input.isExpanded ?? true}
          onExpandedChange={onExpandedChange}
          isConfigured={input.isConfigured ?? false}
          canRemove={input.canRemove ?? true}
          onRemove={onRemove}
          locked={input.locked}
          shouldScrollIntoView={input.shouldScrollIntoView}
          dependencies={dependencies}
        />
      </Wrapper>
    );

    const currentForm = () => form as UseFormReturn<SdlBuilderFormValuesType>;
    return { ImageSection, HardwareSection, AdditionalSection, onExpandedChange, onRemove, form: currentForm, getValues: () => currentForm().getValues() };
  }
});
