import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { LOG_COLLECTOR_IMAGE } from "@src/config/log-collector.config";
import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import { configurationStatusOf, useConfigurationStatus } from "./useConfigurationStatus";

import { renderHook } from "@testing-library/react";

describe(configurationStatusOf.name, () => {
  it("rates each placement by how many of its services are configured", () => {
    const { values, complete, partial, incomplete } = setup();

    const status = configurationStatusOf(values);

    expect(status.placementStatus(complete.id)).toBe("complete");
    expect(status.placementStatus(partial.id)).toBe("partial");
    expect(status.placementStatus(incomplete.id)).toBe("incomplete");
  });

  it("rates a placement without services as incomplete and leaves log collectors out", () => {
    const { values, empty: emptyPlacement } = setupWithCollectorOnlyPlacement();

    expect(configurationStatusOf(values).placementStatus(emptyPlacement.id)).toBe("incomplete");
  });

  function setup() {
    const complete = defaultPlacement({ name: "complete" });
    const partial = defaultPlacement({ name: "partial" });
    const incomplete = defaultPlacement({ name: "incomplete" });
    const ready = defaultService(complete.id, { title: "ready", image: "nginx:latest" });
    const alsoReady = defaultService(partial.id, { title: "also-ready", image: "nginx:latest" });
    const empty = defaultService(partial.id, { title: "empty", image: "" });
    const alsoEmpty = defaultService(incomplete.id, { title: "also-empty", image: "" });
    const values: SdlBuilderFormValuesType = { placements: [complete, partial, incomplete], services: [ready, alsoReady, empty, alsoEmpty], endpoints: [] };
    return { values, complete, partial, incomplete };
  }

  function setupWithCollectorOnlyPlacement() {
    const empty = defaultPlacement({ name: "empty" });
    const collector = defaultService(empty.id, { title: "web-log-collector", image: LOG_COLLECTOR_IMAGE });
    const values: SdlBuilderFormValuesType = { placements: [empty], services: [collector], endpoints: [] };
    return { values, empty };
  }
});

describe(useConfigurationStatus.name, () => {
  it("rates the placements of the form it runs in", () => {
    const placement = defaultPlacement({ name: "placement-1" });
    const values: SdlBuilderFormValuesType = { placements: [placement], services: [defaultService(placement.id, { image: "nginx:latest" })], endpoints: [] };
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    const { result } = renderHook(() => useConfigurationStatus(), { wrapper: Wrapper });

    expect(result.current.placementStatus(placement.id)).toBe("complete");
  });
});
