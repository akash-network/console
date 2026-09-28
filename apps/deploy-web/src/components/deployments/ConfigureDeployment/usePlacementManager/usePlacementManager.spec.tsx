import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { LOG_COLLECTOR_IMAGE } from "@src/config/log-collector.config";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultPlacement, defaultService, defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { usePlacementManager } from "./usePlacementManager";

import { act, renderHook } from "@testing-library/react";

describe(usePlacementManager.name, () => {
  it("appends a placement with a unique generated name and a default service, returning the service id", () => {
    const { result } = setup({ values: defaultServiceWithPlacement() });

    let addedServiceId = "";
    act(() => {
      addedServiceId = result.current.addPlacement();
    });

    expect(result.current.placements).toHaveLength(2);
    expect(result.current.placements[1].name).toBe("placement-1");

    const newPlacementServices = result.current.getPlacementServices(result.current.placements[1].id);
    expect(newPlacementServices).toHaveLength(1);
    expect(newPlacementServices[0].service.id).toBe(addedServiceId);
  });

  it("adds a service bound to the given placement with the next generated title and returns its id", () => {
    const initial = defaultServiceWithPlacement({ title: "service-1" });
    const { result } = setup({ values: initial });

    let addedId = "";
    act(() => {
      addedId = result.current.addService(initial.placements[0].id);
    });

    const added = result.current.getPlacementServices(initial.placements[0].id);
    expect(added).toHaveLength(2);
    expect(added[1].service.title).toBe("service-2");
    expect(added[1].service.placementId).toBe(initial.placements[0].id);
    expect(added[1].service.id).toBe(addedId);
  });

  it("seeds a newly added service on the default (small) preset", () => {
    const initial = defaultServiceWithPlacement({ title: "service-1" });
    const { result } = setup({ values: initial });

    act(() => {
      result.current.addService(initial.placements[0].id);
    });

    const added = result.current.getPlacementServices(initial.placements[0].id)[1].service;
    expect(added.profile).toMatchObject({ cpu: 1, ram: 2, ramUnit: "Gi" });
    expect(added.profile.storage[0]).toMatchObject({ size: 10, unit: "Gi" });
  });

  it("seeds an added placement's first service on the default (small) preset", () => {
    const { result } = setup({ values: defaultServiceWithPlacement() });

    act(() => {
      result.current.addPlacement();
    });

    const added = result.current.getPlacementServices(result.current.placements[1].id)[0].service;
    expect(added.profile).toMatchObject({ cpu: 1, ram: 2, ramUnit: "Gi" });
    expect(added.profile.storage[0]).toMatchObject({ size: 10, unit: "Gi" });
  });

  it("cascade-removes a placement together with its services", () => {
    const placementA = defaultPlacement({ name: "placement-1" });
    const placementB = defaultPlacement({ name: "placement-2" });
    const values: SdlBuilderFormValuesType = {
      placements: [placementA, placementB],
      services: [defaultService(placementA.id, { title: "web" }), defaultService(placementB.id, { title: "api" })],
      endpoints: []
    };
    const { result } = setup({ values });

    act(() => {
      result.current.removePlacement(placementA.id);
    });

    expect(result.current.placements).toHaveLength(1);
    expect(result.current.placements[0].id).toBe(placementB.id);
    expect(result.current.getPlacementServices(placementB.id)).toHaveLength(1);
    expect(result.current.getPlacementServices(placementA.id)).toHaveLength(0);
  });

  it("forbids removing the last placement", () => {
    const { result } = setup({ values: defaultServiceWithPlacement() });

    expect(result.current.canRemovePlacement).toBe(false);
  });

  it("allows removing a placement that holds every service while another placement remains", () => {
    const placementA = defaultPlacement({ name: "placement-1" });
    const placementB = defaultPlacement({ name: "placement-2" });
    const values: SdlBuilderFormValuesType = {
      placements: [placementA, placementB],
      services: [defaultService(placementA.id, { title: "web" })],
      endpoints: []
    };
    const { result } = setup({ values });

    expect(result.current.canRemovePlacement).toBe(true);

    act(() => {
      result.current.removePlacement(placementA.id);
    });

    expect(result.current.placements).toHaveLength(1);
    expect(result.current.placements[0].id).toBe(placementB.id);
    expect(result.current.getPlacementServices(placementB.id)).toHaveLength(0);
  });

  it("removes a service by id", () => {
    const placement = defaultPlacement();
    const serviceA = defaultService(placement.id, { title: "web" });
    const serviceB = defaultService(placement.id, { title: "api" });
    const { result } = setup({ values: { placements: [placement], services: [serviceA, serviceB], endpoints: [] } });

    act(() => {
      result.current.removeService(serviceB.id as string);
    });

    const remaining = result.current.getPlacementServices(placement.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].service.title).toBe("web");
  });

  it("forbids removing the last service overall", () => {
    const { result } = setup({ values: defaultServiceWithPlacement() });

    expect(result.current.canRemoveService).toBe(false);
  });

  it("removes a service together with its paired log collector", () => {
    const placement = defaultPlacement();
    const web = defaultService(placement.id, { title: "web" });
    const collector = defaultService(placement.id, { title: "web-log-collector", image: LOG_COLLECTOR_IMAGE });
    const api = defaultService(placement.id, { title: "api" });
    const { result } = setup({ values: { placements: [placement], services: [web, collector, api], endpoints: [] } });

    act(() => {
      result.current.removeService(web.id as string);
    });

    const remaining = result.current.getPlacementServices(placement.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].service.title).toBe("api");
  });

  it("adds a log collector for a service after every other service", () => {
    const placement = defaultPlacement();
    const web = defaultService(placement.id, { title: "web" });
    const api = defaultService(placement.id, { title: "api" });
    const { result, getValues } = setup({ values: { placements: [placement], services: [web, api], endpoints: [] } });

    act(() => {
      result.current.addLogCollector(web.id as string);
    });

    expect(getValues().services.map(service => service.title)).toEqual(["web", "api", "web-log-collector"]);
    expect(getValues().services[2]).toMatchObject({ id: `${web.id}-log-collector`, image: LOG_COLLECTOR_IMAGE, placementId: placement.id });
  });

  it("adds no second log collector to a service that already has one", () => {
    const placement = defaultPlacement();
    const web = defaultService(placement.id, { title: "web" });
    const { result, getValues } = setup({ values: { placements: [placement], services: [web], endpoints: [] } });

    act(() => {
      result.current.addLogCollector(web.id as string);
    });
    act(() => {
      result.current.addLogCollector(web.id as string);
    });

    expect(getValues().services.map(service => service.title)).toEqual(["web", "web-log-collector"]);
  });

  it("removes a service's trailing log collector without clearing the selection", () => {
    const placement = defaultPlacement();
    const web = defaultService(placement.id, { title: "web" });
    const api = defaultService(placement.id, { title: "api" });
    const collector = logCollectorOf(web);
    const { result, getValues, onSelectService } = setup({ values: { placements: [placement], services: [web, api, collector], endpoints: [] } });

    act(() => {
      result.current.removeLogCollector(web.id as string);
    });

    expect(getValues().services.map(service => service.title)).toEqual(["web", "api"]);
    expect(onSelectService).not.toHaveBeenCalled();
  });

  it("clears the selection before removing a log collector that sits before another service", () => {
    const placement = defaultPlacement();
    const web = defaultService(placement.id, { title: "web" });
    const api = defaultService(placement.id, { title: "api" });
    const collector = logCollectorOf(web);
    const { result, getValues, onSelectService } = setup({ values: { placements: [placement], services: [web, collector, api], endpoints: [] } });

    act(() => {
      result.current.removeLogCollector(web.id as string);
    });

    expect(onSelectService).toHaveBeenCalledWith("");
    expect(getValues().services.map(service => service.title)).toEqual(["web", "api"]);
    expect(result.current.getPlacementServices(placement.id).map(({ service, index }) => [service.title, index])).toEqual([
      ["web", 0],
      ["api", 1]
    ]);
  });

  it("leaves the services untouched when removing a log collector the service does not have", () => {
    const placement = defaultPlacement();
    const web = defaultService(placement.id, { title: "web" });
    const api = defaultService(placement.id, { title: "api" });
    const { result, getValues, onSelectService } = setup({ values: { placements: [placement], services: [web, api], endpoints: [] } });

    act(() => {
      result.current.removeLogCollector(web.id as string);
    });

    expect(getValues().services.map(service => service.title)).toEqual(["web", "api"]);
    expect(onSelectService).not.toHaveBeenCalled();
  });

  it("adds no log collector for a service that does not exist", () => {
    const { result, getValues } = setup({ values: defaultServiceWithPlacement({ title: "web" }) });

    act(() => {
      result.current.addLogCollector("missing-service");
      result.current.removeLogCollector("missing-service");
    });

    expect(getValues().services.map(service => service.title)).toEqual(["web"]);
  });

  function logCollectorOf(service: ServiceType): ServiceType {
    return {
      ...defaultService(service.placementId, { title: `${service.title}-log-collector`, image: LOG_COLLECTOR_IMAGE }),
      id: `${service.id}-log-collector`
    };
  }

  function setup(input: { values: SdlBuilderFormValuesType }) {
    const onSelectService = vi.fn();
    let getValues: () => SdlBuilderFormValuesType = () => input.values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: input.values });
      getValues = form.getValues;
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    const rendered = renderHook(() => usePlacementManager({ onSelectService }), { wrapper: Wrapper });
    return { ...rendered, onSelectService, getValues: () => getValues() };
  }
});
