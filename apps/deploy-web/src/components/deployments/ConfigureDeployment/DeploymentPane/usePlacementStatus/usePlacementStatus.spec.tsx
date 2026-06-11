import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import { getPlacementStatus, usePlacementStatus } from "./usePlacementStatus";

import { renderHook } from "@testing-library/react";

describe("getPlacementStatus", () => {
  it("reports a placement with no services as incomplete", () => {
    const placement = defaultPlacement();
    const values: SdlBuilderFormValuesType = { placements: [placement], services: [], endpoints: [] };

    expect(getPlacementStatus(values, placement.id)).toBe("incomplete");
  });

  it("reports a placement with no configured services as incomplete", () => {
    const placement = defaultPlacement();
    const values: SdlBuilderFormValuesType = {
      placements: [placement],
      services: [defaultService(placement.id, { title: "web", image: "" })],
      endpoints: []
    };

    expect(getPlacementStatus(values, placement.id)).toBe("incomplete");
  });

  it("reports a placement as complete when all of its services are configured", () => {
    const placement = defaultPlacement();
    const values: SdlBuilderFormValuesType = {
      placements: [placement],
      services: [defaultService(placement.id, { title: "web", image: "nginx:latest" })],
      endpoints: []
    };

    expect(getPlacementStatus(values, placement.id)).toBe("complete");
  });

  it("reports a placement as partial when some but not all of its services are configured", () => {
    const placement = defaultPlacement();
    const values: SdlBuilderFormValuesType = {
      placements: [placement],
      services: [defaultService(placement.id, { title: "web", image: "nginx:latest" }), defaultService(placement.id, { title: "api", image: "" })],
      endpoints: []
    };

    expect(getPlacementStatus(values, placement.id)).toBe("partial");
  });

  it("ignores services that belong to other placements", () => {
    const placement = defaultPlacement();
    const other = defaultPlacement();
    const values: SdlBuilderFormValuesType = {
      placements: [placement, other],
      services: [defaultService(placement.id, { title: "web", image: "nginx:latest" }), defaultService(other.id, { title: "api", image: "" })],
      endpoints: []
    };

    expect(getPlacementStatus(values, placement.id)).toBe("complete");
  });
});

describe("usePlacementStatus", () => {
  it("derives the status from the form context", () => {
    const placement = defaultPlacement();
    const values: SdlBuilderFormValuesType = {
      placements: [placement],
      services: [defaultService(placement.id, { title: "web", image: "nginx:latest" })],
      endpoints: []
    };

    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    const { result } = renderHook(() => usePlacementStatus(placement.id), { wrapper: Wrapper });

    expect(result.current).toBe("complete");
  });
});
