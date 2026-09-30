import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementOptions } from "@src/queries/usePlacementOptions";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { ApiProviderRegion } from "@src/types/provider";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import type { DEPENDENCIES } from "./RegionSelect";
import { RegionSelect } from "./RegionSelect";

import { fireEvent, render, screen, within } from "@testing-library/react";

const REGIONS: ApiProviderRegion[] = [
  { key: "eu-west", description: "Western Europe. Countries (FR, LU, BE, NL, GB, IE)", providers: [] },
  { key: "eu-central", description: "Central Europe. Countries (SI, HU, SK, PL, CZ, AT, CH, DE)", providers: [] },
  { key: "na-us-west", description: "North America United States of America West. States: (CA, OR, WA)", providers: [] }
];

describe("RegionSelect", () => {
  it("writes a single picked region and names it in the trigger", async () => {
    const { getValues } = setup({ regions: REGIONS });
    const trigger = screen.getByRole("combobox", { name: "Region" });

    fireEvent.click(trigger);
    fireEvent.change(await screen.findByRole("combobox", { name: "Search regions" }), { target: { value: "na" } });
    fireEvent.click(await screen.findByRole("option", { name: "na-us-west" }));

    expect(getValues().placements[0].regions).toEqual(["na-us-west"]);
    expect(trigger).toHaveTextContent(/^na-us-west$/);
  });

  it("adds every picked region and names the first with a count of the others in the trigger", async () => {
    const { getValues } = setup({ regions: REGIONS });
    const trigger = screen.getByRole("combobox", { name: "Region" });

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", { name: "na-us-west" }));
    fireEvent.click(screen.getByRole("option", { name: "eu-west" }));
    fireEvent.click(screen.getByRole("option", { name: "eu-central" }));

    expect(getValues().placements[0].regions).toEqual(["na-us-west", "eu-west", "eu-central"]);
    expect(trigger).toHaveTextContent("na-us-west +2");
    expect(screen.getByRole("option", { name: "eu-west" })).toHaveAttribute("aria-checked", "true");
  });

  it("removes a region that is picked again", async () => {
    const { getValues } = setup({ regions: REGIONS, pickedRegions: ["eu-west", "na-us-west"] });

    fireEvent.click(screen.getByRole("combobox", { name: "Region" }));
    fireEvent.click(await screen.findByRole("option", { name: "eu-west" }));

    expect(getValues().placements[0].regions).toEqual(["na-us-west"]);
  });

  it("clears every region and shows Any region in the trigger when Any region is picked", async () => {
    const { getValues } = setup({ regions: REGIONS, pickedRegions: ["eu-west", "na-us-west"] });
    const trigger = screen.getByRole("combobox", { name: "Region" });

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", { name: "Any region" }));

    expect(getValues().placements[0].regions).toEqual([]);
    expect(trigger).toHaveTextContent("Any region");
  });

  it("shows Any region in the trigger for a placement that never picked one", () => {
    setup({ regions: REGIONS, pickedRegions: undefined });

    expect(screen.getByRole("combobox", { name: "Region" })).toHaveTextContent("Any region");
  });

  it("filters by the visible key, ignores description text, keeps Any region, and restores on clear", async () => {
    setup({ regions: REGIONS });

    fireEvent.click(screen.getByRole("combobox", { name: "Region" }));
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

  it("keeps its compact trigger unless asked otherwise", () => {
    setup({ regions: [] });

    expect(screen.getByRole("combobox", { name: "Region" })).toHaveClass("h-8");
  });

  it("sizes its trigger as the caller asks", () => {
    setup({ regions: [], triggerClassName: "h-9" });

    const trigger = screen.getByRole("combobox", { name: "Region" });
    expect(trigger).toHaveClass("h-9");
    expect(trigger).not.toHaveClass("h-8");
  });

  describe("availability", () => {
    it("offers the regions an online provider serves and lists the rest as unavailable", async () => {
      setup({ regions: REGIONS, availableRegions: ["eu-west"] });

      fireEvent.click(screen.getByRole("combobox", { name: "Region" }));
      const unavailable = within(await screen.findByRole("group", { name: "Unavailable" }));

      expect(screen.getByRole("option", { name: "eu-west" })).toHaveAttribute("aria-disabled", "false");
      expect(unavailable.queryByRole("option", { name: "eu-west" })).not.toBeInTheDocument();
      expect(unavailable.getByRole("option", { name: "eu-central" })).toHaveAttribute("aria-disabled", "true");
      expect(unavailable.getByRole("option", { name: "na-us-west" })).toHaveAttribute("aria-disabled", "true");
    });

    it("shows how many online providers advertise each offered region", async () => {
      setup({ regions: REGIONS, availableRegions: ["eu-west", "na-us-west"], regionProviderCounts: { "eu-west": 3, "na-us-west": 1 } });

      fireEvent.click(screen.getByRole("combobox", { name: "Region" }));

      expect(await screen.findByRole("option", { name: "eu-west" })).toHaveAccessibleDescription("3 providers");
      expect(screen.getByRole("option", { name: "na-us-west" })).toHaveAccessibleDescription("1 provider");
      expect(screen.getByRole("option", { name: "eu-central" })).not.toHaveAccessibleDescription();
    });

    it("leaves the counts out while provider inventory reports none", async () => {
      setup({ regions: REGIONS, availableRegions: ["eu-west"] });

      fireEvent.click(screen.getByRole("combobox", { name: "Region" }));

      expect(await screen.findByRole("option", { name: "eu-west" })).not.toHaveAccessibleDescription();
    });

    it("finds an unavailable region with the search box", async () => {
      setup({ regions: REGIONS, availableRegions: ["eu-west"] });

      fireEvent.click(screen.getByRole("combobox", { name: "Region" }));
      fireEvent.change(await screen.findByRole("combobox", { name: "Search regions" }), { target: { value: "central" } });

      expect(screen.getByRole("option", { name: "eu-central" })).toHaveAttribute("aria-disabled", "true");
      expect(screen.queryByText("No regions found.")).not.toBeInTheDocument();
    });

    it("still offers Any region when no region is available", async () => {
      setup({ regions: REGIONS, availableRegions: ["as-east"] });

      fireEvent.click(screen.getByRole("combobox", { name: "Region" }));

      expect(await screen.findByRole("option", { name: "Any region" })).toHaveAttribute("aria-disabled", "false");
      expect(screen.getByRole("option", { name: "eu-west" })).toHaveAttribute("aria-disabled", "true");
    });

    it("offers the whole catalog when availability cannot be loaded", async () => {
      setup({ regions: REGIONS });

      fireEvent.click(screen.getByRole("combobox", { name: "Region" }));

      expect(await screen.findByRole("option", { name: "eu-west" })).toHaveAttribute("aria-disabled", "false");
      expect(screen.getByRole("option", { name: "eu-central" })).toHaveAttribute("aria-disabled", "false");
      expect(screen.getByRole("option", { name: "na-us-west" })).toHaveAttribute("aria-disabled", "false");
      expect(screen.queryByRole("group", { name: "Unavailable" })).not.toBeInTheDocument();
    });

    it("offers the whole catalog when no provider is reported online", async () => {
      setup({ regions: REGIONS, availableRegions: [] });

      fireEvent.click(screen.getByRole("combobox", { name: "Region" }));

      expect(await screen.findByRole("option", { name: "eu-west" })).toHaveAttribute("aria-disabled", "false");
      expect(screen.getByRole("option", { name: "na-us-west" })).toHaveAttribute("aria-disabled", "false");
      expect(screen.queryByRole("group", { name: "Unavailable" })).not.toBeInTheDocument();
    });

    it("keeps a region the configuration already picks once nobody offers it, listed as unavailable but removable", async () => {
      const { getValues } = setup({ regions: REGIONS, pickedRegions: ["na-us-west"], availableRegions: ["eu-west"] });
      const trigger = screen.getByRole("combobox", { name: "Region" });

      expect(trigger).toHaveTextContent(/^na-us-west$/);
      expect(getValues().placements[0].regions).toEqual(["na-us-west"]);

      fireEvent.click(trigger);
      const unavailable = within(await screen.findByRole("group", { name: "Unavailable" }));
      const pickedUnavailable = unavailable.getByRole("option", { name: "na-us-west" });
      expect(pickedUnavailable).toHaveAttribute("aria-checked", "true");

      fireEvent.click(pickedUnavailable);
      expect(getValues().placements[0].regions).toEqual([]);
    });

    it("lists picked regions the catalog does not know as unavailable when nobody serves them", async () => {
      setup({ regions: REGIONS, pickedRegions: ["oc-aus", "as-east"], availableRegions: ["eu-west"] });

      fireEvent.click(screen.getByRole("combobox", { name: "Region" }));
      const unavailable = within(await screen.findByRole("group", { name: "Unavailable" }));

      expect(unavailable.getByRole("option", { name: "oc-aus" })).toHaveAttribute("aria-checked", "true");
      expect(unavailable.getByRole("option", { name: "as-east" })).toHaveAttribute("aria-checked", "true");
      expect(unavailable.getAllByRole("option").map(option => option.textContent)).toEqual(["eu-central", "na-us-west", "oc-aus", "as-east"]);
    });
  });

  function setup(input: {
    regions: ApiProviderRegion[];
    pickedRegions?: string[];
    availableRegions?: string[];
    regionProviderCounts?: Record<string, number>;
    triggerClassName?: string;
  }) {
    const values = defaultServiceWithPlacement();
    values.placements[0].regions = input.pickedRegions;

    const regionsQuery = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useProviderRegions>>(), { data: input.regions });
    const useProviderRegions: typeof DEPENDENCIES.useProviderRegions = () => regionsQuery;

    const placementOptions =
      input.availableRegions &&
      Object.assign(mock<PlacementOptions>(), { regions: input.availableRegions, regionProviderCounts: input.regionProviderCounts, gpus: [] });
    const placementOptionsQuery = Object.assign(mock<ReturnType<typeof DEPENDENCIES.usePlacementOptions>>(), { data: placementOptions });
    const usePlacementOptions: typeof DEPENDENCIES.usePlacementOptions = () => placementOptionsQuery;

    let getValues: () => SdlBuilderFormValuesType = () => values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      getValues = form.getValues;
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <RegionSelect placementIndex={0} triggerClassName={input.triggerClassName} dependencies={{ useProviderRegions, usePlacementOptions }} />
      </Wrapper>
    );

    return { getValues: () => getValues() };
  }
});
