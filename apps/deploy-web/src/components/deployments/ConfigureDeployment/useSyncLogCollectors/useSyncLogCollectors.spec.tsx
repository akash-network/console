import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { generateLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import { syncLogCollectors, useSyncLogCollectors } from "./useSyncLogCollectors";

import { act, renderHook, waitFor } from "@testing-library/react";

describe(useSyncLogCollectors.name, () => {
  it("renames a log collector and repoints it at its service's pods after the service is renamed", async () => {
    const { result } = setup();

    act(() => result.current.setValue("services.0.title", "api"));

    await waitFor(() => expect(result.current.getValues("services.1.title")).toBe("api-log-collector"));
    expect(podLabelSelectorOf(result.current.getValues("services.1"))).toBe("akash.network/manifest-service=api");
  });

  it("moves a log collector along with its service to another placement", async () => {
    const { result, secondPlacementId } = setup();

    act(() => result.current.setValue("services.0.placementId", secondPlacementId));

    await waitFor(() => expect(result.current.getValues("services.1.placementId")).toBe(secondPlacementId));
  });

  it("gives a log collector its service's new pricing", async () => {
    const { result } = setup();

    act(() => result.current.setValue("services.0.pricing", { amount: 2500, denom: "uakt" }));

    await waitFor(() => expect(result.current.getValues("services.1.pricing")).toEqual({ amount: 2500, denom: "uakt" }));
  });

  function setup() {
    const placement = defaultPlacement({ name: "placement-1" });
    const secondPlacement = defaultPlacement({ name: "placement-2" });
    const web = defaultService(placement.id, { title: "web" });
    const values: SdlBuilderFormValuesType = {
      placements: [placement, secondPlacement],
      services: [web, generateLogCollectorService(web) as ServiceType],
      endpoints: []
    };
    const rendered = renderHook(() => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      useSyncLogCollectors(form);
      return form;
    });
    return { ...rendered, secondPlacementId: secondPlacement.id };
  }
});

describe(syncLogCollectors.name, () => {
  it("writes nothing while every log collector already matches its service", () => {
    const web = defaultService("placement-1", { title: "web" });
    const setValue = vi.fn();

    syncLogCollectors([web, generateLogCollectorService(web) as ServiceType], setValue);

    expect(setValue).not.toHaveBeenCalled();
  });

  it("writes only the fields that drifted", () => {
    const web = defaultService("placement-1", { title: "web" });
    const collector = { ...(generateLogCollectorService(web) as ServiceType), placementId: "placement-2" };
    const setValue = vi.fn();

    syncLogCollectors([web, collector], setValue);

    expect(setValue).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenCalledWith("services.1.placementId", "placement-1", { shouldDirty: true });
  });

  it("leaves services without a log collector alone", () => {
    const setValue = vi.fn();

    syncLogCollectors([defaultService("placement-1", { title: "web" }), defaultService("placement-1", { title: "api" })], setValue);

    expect(setValue).not.toHaveBeenCalled();
  });
});

function podLabelSelectorOf(service: ServiceType): string | undefined {
  return service.env?.find(entry => entry.key === "POD_LABEL_SELECTOR")?.value;
}
