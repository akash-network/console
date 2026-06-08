import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import type { DEPENDENCIES } from "./RegionSelect";
import { RegionSelect } from "./RegionSelect";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("RegionSelect", () => {
  it("writes the picked region to the placement", async () => {
    const { getValues } = setup({ regions: [{ key: "us-west", description: "US West", providers: [] }] });

    await userEvent.click(screen.getByRole("combobox", { name: "Region" }));
    await userEvent.click(await screen.findByRole("option", { name: "us-west" }));

    expect(getValues().placements[0].region).toBe("us-west");
  });

  it("clears the region when Any region is picked", async () => {
    const { getValues } = setup({
      regions: [{ key: "us-west", description: "US West", providers: [] }],
      region: "us-west"
    });

    await userEvent.click(screen.getByRole("combobox", { name: "Region" }));
    await userEvent.click(await screen.findByRole("option", { name: "Any region" }));

    expect(getValues().placements[0].region).toBeUndefined();
  });

  function setup(input: { regions: Array<{ key: string; description: string; providers: string[] }>; region?: string }) {
    const values = defaultServiceWithPlacement();
    values.placements[0].region = input.region;
    const useProviderRegions: typeof DEPENDENCIES.useProviderRegions = () => mock<ReturnType<typeof DEPENDENCIES.useProviderRegions>>({ data: input.regions });

    let getValues: () => SdlBuilderFormValuesType = () => values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      getValues = form.getValues;
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <RegionSelect placementIndex={0} dependencies={{ useProviderRegions }} />
      </Wrapper>
    );

    return { getValues: () => getValues() };
  }
});
