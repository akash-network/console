import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import type { DEPENDENCIES } from "./PlacementFields";
import { PlacementFields } from "./PlacementFields";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(PlacementFields.name, () => {
  it("edits the name of the placement it shows", async () => {
    const { getValues } = setup({ placementIndex: 1 });

    await userEvent.clear(screen.getByLabelText("Placement name"));
    await userEvent.type(screen.getByLabelText("Placement name"), "gpu-pool");

    expect(getValues().placements[1].name).toBe("gpu-pool");
    expect(getValues().placements[0].name).toBe("placement-1");
  });

  it("hands the region picker the placement it shows", () => {
    const { RegionSelect } = setup({ placementIndex: 1 });

    expect(RegionSelect).toHaveBeenCalledWith(expect.objectContaining({ placementIndex: 1, disabled: false }), expect.anything());
  });

  it.each([
    [1, "1 service in this placement"],
    [3, "3 services in this placement"]
  ])("counts %i service(s) in the placement", (serviceCount, text) => {
    setup({ serviceCount });

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("disables the name and the region while locked", () => {
    const { RegionSelect } = setup({ locked: true });

    expect(screen.getByLabelText("Placement name")).toBeDisabled();
    expect(RegionSelect).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }), expect.anything());
  });

  function setup(input: { placementIndex?: number; serviceCount?: number; locked?: boolean }) {
    const first = defaultPlacement({ name: "placement-1" });
    const second = defaultPlacement({ name: "placement-2" });
    const values: SdlBuilderFormValuesType = { placements: [first, second], services: [defaultService(first.id)], endpoints: [] };
    const RegionSelect = vi.fn(() => null);
    const dependencies: typeof DEPENDENCIES = { RegionSelect };
    let getValues: () => SdlBuilderFormValuesType = () => values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      getValues = form.getValues;
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <PlacementFields placementIndex={input.placementIndex ?? 0} serviceCount={input.serviceCount ?? 1} locked={input.locked} dependencies={dependencies} />
      </Wrapper>
    );

    return { RegionSelect, getValues: () => getValues() };
  }
});
