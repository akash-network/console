import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SdlBuilderFormValuesType } from "@src/types";
import type { ApiProviderRegion } from "@src/types/provider";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import type { DEPENDENCIES } from "./RegionSelect";
import { filterRegions, RegionSelect } from "./RegionSelect";

import { fireEvent, render, screen } from "@testing-library/react";

const REGIONS: ApiProviderRegion[] = [
  { key: "eu-west", description: "Western Europe. Countries (FR, LU, BE, NL, GB, IE)", providers: [] },
  { key: "eu-central", description: "Central Europe. Countries (SI, HU, SK, PL, CZ, AT, CH, DE)", providers: [] },
  { key: "na-us-west", description: "North America United States of America West. States: (CA, OR, WA)", providers: [] }
];

describe("RegionSelect", () => {
  describe("filterRegions", () => {
    it("returns all regions for an empty or whitespace query", () => {
      expect(filterRegions(REGIONS, "")).toEqual(REGIONS);
      expect(filterRegions(REGIONS, "   ")).toEqual(REGIONS);
    });

    it("matches case-insensitive substrings of the visible key", () => {
      expect(filterRegions(REGIONS, "EU")).toEqual([REGIONS[0], REGIONS[1]]);
    });

    it("ignores text that only appears in the hidden description", () => {
      expect(filterRegions(REGIONS, "europe")).toEqual([]);
      expect(filterRegions(REGIONS, "america")).toEqual([]);
    });
  });

  it("writes the picked region, reflects it in the trigger, and resets the search", async () => {
    const { getValues } = setup({ regions: REGIONS });
    const trigger = screen.getByRole("button", { name: "Region" });

    fireEvent.click(trigger);
    fireEvent.change(await screen.findByRole("combobox", { name: "Search regions" }), { target: { value: "na" } });
    fireEvent.click(await screen.findByRole("option", { name: "na-us-west" }));

    expect(getValues().placements[0].region).toBe("na-us-west");
    expect(trigger).toHaveTextContent("na-us-west");

    fireEvent.click(trigger);
    expect(await screen.findByRole("combobox", { name: "Search regions" })).toHaveValue("");
  });

  it("clears the region and shows Any region in the trigger when Any region is picked", async () => {
    const { getValues } = setup({ regions: REGIONS, region: "eu-west" });
    const trigger = screen.getByRole("button", { name: "Region" });

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", { name: "Any region" }));

    expect(getValues().placements[0].region).toBeFalsy();
    expect(trigger).toHaveTextContent("Any region");
  });

  it("filters by the visible key, ignores description text, keeps Any region, and restores on clear", async () => {
    setup({ regions: REGIONS });

    fireEvent.click(screen.getByRole("button", { name: "Region" }));
    const input = await screen.findByRole("combobox", { name: "Search regions" });

    fireEvent.change(input, { target: { value: "eu" } });
    expect(screen.getByRole("option", { name: "eu-west" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "eu-central" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "na-us-west" })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "europe" } });
    expect(screen.getByText("No regions found.")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "eu-west" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Any region" })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByRole("option", { name: "na-us-west" })).toBeInTheDocument();
  });

  function setup(input: { regions: ApiProviderRegion[]; region?: string }) {
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
