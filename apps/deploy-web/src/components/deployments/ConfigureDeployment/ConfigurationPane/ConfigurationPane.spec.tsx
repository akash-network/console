import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES as HARDWARE_DEPENDENCIES, HardwareSection } from "./HardwareSection/HardwareSection";
import { ConfigurationPane, DEPENDENCIES } from "./ConfigurationPane";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe(ConfigurationPane.name, () => {
  it("shows the selected service title", () => {
    const values = defaultServiceWithPlacement({ title: "api" });
    setup({ values, selectedServiceId: values.services[0].id });

    expect(screen.getByText(/api/)).toBeInTheDocument();
  });

  it("shows no target when the selection matches no service", () => {
    const values = defaultServiceWithPlacement({ title: "api" });
    setup({ values, selectedServiceId: "missing" });

    expect(screen.queryByText("api")).not.toBeInTheDocument();
  });

  it("renders the image section for the selected service index", () => {
    const ImageSection = vi.fn(() => null);
    const values = defaultServiceWithPlacement({ title: "api" });

    setup({ values, selectedServiceId: values.services[0].id, dependencies: { ImageSection } });

    expect(ImageSection).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 0 }), expect.anything());
  });

  it("renders the hardware section for the selected service index", () => {
    const HardwareSection = vi.fn(() => null);
    const values = defaultServiceWithPlacement({ title: "api" });

    setup({ values, selectedServiceId: values.services[0].id, dependencies: { HardwareSection } });

    expect(HardwareSection).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 0 }), expect.anything());
  });

  it("renders the additional section for the selected service index", () => {
    const AdditionalSection = vi.fn(() => null);
    const values = defaultServiceWithPlacement({ title: "api" });

    setup({ values, selectedServiceId: values.services[0].id, dependencies: { AdditionalSection } });

    expect(AdditionalSection).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 0 }), expect.anything());
  });

  it("shows the newly selected service's values after switching services", () => {
    const placement = defaultPlacement();
    const serviceA = defaultService(placement.id, {
      title: "api",
      profile: {
        cpu: 0.5,
        gpu: 1,
        gpuModels: [{ vendor: "nvidia" }],
        hasGpu: false,
        ram: 512,
        ramUnit: "Mi",
        storage: [{ size: 1, unit: "Gi", isPersistent: false, type: "beta2" }]
      }
    });
    const serviceB = defaultService(placement.id, {
      title: "worker",
      profile: {
        cpu: 0.5,
        gpu: 1,
        gpuModels: [{ vendor: "nvidia" }],
        hasGpu: false,
        ram: 2048,
        ramUnit: "Mi",
        storage: [{ size: 9, unit: "Gi", isPersistent: false, type: "beta2" }]
      }
    });
    const values: SdlBuilderFormValuesType = { placements: [placement], services: [serviceA, serviceB], endpoints: [] };

    /** GpuCard fetches GPU models via React Query; stub it so this pane test stays provider-free and asserts only the Memory/Storage values. */
    const HardwareSectionWithStubbedGpu: typeof HardwareSection = props => (
      <HardwareSection {...props} dependencies={{ ...HARDWARE_DEPENDENCIES, GpuCard: () => null }} />
    );
    const dependencies = { ...DEPENDENCIES, HardwareSection: HardwareSectionWithStubbedGpu, AdditionalSection: () => null };

    const Tree = ({ selectedServiceId }: { selectedServiceId: string }) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return (
        <FormProvider {...form}>
          <ConfigurationPane selectedServiceId={selectedServiceId} dependencies={dependencies} />
        </FormProvider>
      );
    };

    const { rerender } = render(<Tree selectedServiceId={serviceA.id} />);
    expect(screen.getByLabelText("Memory")).toHaveValue(512);

    rerender(<Tree selectedServiceId={serviceB.id} />);

    expect(screen.getByLabelText("Memory")).toHaveValue(2048);
    expect(screen.getByLabelText("Storage")).toHaveValue(9);
  });

  it("shows the lock banner with cancel-and-edit while locked", async () => {
    const onCancelAndEdit = vi.fn();
    const values = defaultServiceWithPlacement({ title: "api" });
    setup({ values, selectedServiceId: values.services[0].id, locked: true, onCancelAndEdit });

    await userEvent.click(screen.getByRole("button", { name: /cancel and edit/i }));

    expect(onCancelAndEdit).toHaveBeenCalled();
  });

  it("locks the hardware and additional sections but never the image section", () => {
    const ImageSection = vi.fn(() => null);
    const HardwareSection = vi.fn(() => null);
    const AdditionalSection = vi.fn(() => null);
    const values = defaultServiceWithPlacement({ title: "api" });

    setup({ values, selectedServiceId: values.services[0].id, locked: true, dependencies: { ImageSection, HardwareSection, AdditionalSection } });

    expect(HardwareSection).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(AdditionalSection).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(ImageSection).not.toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
  });

  function setup(input: {
    values: SdlBuilderFormValuesType;
    selectedServiceId: string;
    locked?: boolean;
    onCancelAndEdit?: () => void;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: input.values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    return render(
      <Wrapper>
        <ConfigurationPane
          selectedServiceId={input.selectedServiceId}
          locked={input.locked}
          onCancelAndEdit={input.onCancelAndEdit}
          dependencies={MockComponents(DEPENDENCIES, input.dependencies)}
        />
      </Wrapper>
    );
  }
});
