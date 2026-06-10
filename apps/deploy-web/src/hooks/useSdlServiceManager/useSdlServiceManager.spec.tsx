import type { UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { LOG_COLLECTOR_IMAGE } from "@src/config/log-collector.config";
import type { SdlBuilderFormValuesType } from "@src/types";
import { useSdlServiceManager } from "./useSdlServiceManager";

import { act, renderHook } from "@testing-library/react";
import { buildSDLService } from "@tests/seeders/sdlService";

describe(useSdlServiceManager.name, () => {
  it("adds a new service with correct title", async () => {
    const { result, form } = await setup();

    await act(async () => {
      result.current.add();
    });

    const currentServices = form.getValues("services");
    expect(currentServices).toHaveLength(1);
    expect(currentServices[0].title).toBe("service-1");
  });

  it("adds multiple services with sequential titles", async () => {
    const { result, form } = await setup();

    await act(async () => {
      result.current.add();
    });

    await act(async () => {
      result.current.add();
    });

    await act(async () => {
      result.current.add();
    });

    const currentServices = form.getValues("services");
    expect(currentServices).toHaveLength(3);
    expect(currentServices[0].title).toBe("service-1");
    expect(currentServices[1].title).toBe("service-2");
    expect(currentServices[2].title).toBe("service-3");
  });

  it("adds services with correct titles when existing services have gaps", async () => {
    const { result, form } = await setup({
      defaultServices: [buildSDLService({ title: "service-1" }), buildSDLService({ title: "service-3" }), buildSDLService({ title: "service-5" })]
    });

    await act(async () => {
      result.current.add();
    });

    const currentServices = form.getValues("services");
    expect(currentServices).toHaveLength(4);
    expect(currentServices[3].title).toBe("service-6");
  });

  it("removes a service by index", async () => {
    const { result, form } = await setup({
      defaultServices: [buildSDLService({ title: "service-1" }), buildSDLService({ title: "service-2" }), buildSDLService({ title: "service-3" })]
    });

    await act(async () => {
      result.current.remove(1);
    });

    const currentServices = form.getValues("services");
    expect(currentServices).toHaveLength(2);
    expect(currentServices[0].title).toBe("service-1");
    expect(currentServices[1].title).toBe("service-3");
  });

  it("removes a service and its associated log collector service", async () => {
    const { result, form } = await setup({
      defaultServices: [
        buildSDLService({ title: "service-1" }),
        buildSDLService({
          title: "service-1-log-collector",
          image: LOG_COLLECTOR_IMAGE
        }),
        buildSDLService({ title: "service-2" })
      ]
    });

    await act(async () => {
      result.current.remove(0);
    });

    const currentServices = form.getValues("services");
    expect(currentServices).toHaveLength(1);
    expect(currentServices[0].title).toBe("service-2");
  });

  it("handles removal when no log collector service exists", async () => {
    const { result, form } = await setup({
      defaultServices: [buildSDLService({ title: "service-1" }), buildSDLService({ title: "service-2" })]
    });

    await act(async () => {
      result.current.remove(0);
    });

    const currentServices = form.getValues("services");
    expect(currentServices).toHaveLength(1);
    expect(currentServices[0].title).toBe("service-2");
  });

  it("ignores log collector services when calculating next service title", async () => {
    const { result, form } = await setup({
      defaultServices: [
        buildSDLService({ title: "service-1" }),
        buildSDLService({
          title: "service-1-log-collector",
          image: LOG_COLLECTOR_IMAGE
        }),
        buildSDLService({ title: "service-3" })
      ]
    });

    await act(async () => {
      result.current.add();
    });

    const currentServices = form.getValues("services");
    expect(currentServices).toHaveLength(4);
    expect(currentServices[3].title).toBe("service-4");
  });

  it("handles services with non-standard titles", async () => {
    const { result, form } = await setup({
      defaultServices: [buildSDLService({ title: "custom-service" }), buildSDLService({ title: "another-service" })]
    });

    await act(async () => {
      result.current.add();
    });

    const currentServices = form.getValues("services");
    expect(currentServices).toHaveLength(3);
    expect(currentServices[2].title).toBe("service-3");
  });

  it("handles empty services array", async () => {
    const { result, form } = await setup({
      defaultServices: []
    });

    await act(async () => {
      result.current.add();
    });

    const currentServices = form.getValues("services");
    expect(currentServices).toHaveLength(1);
    expect(currentServices[0].title).toBe("service-1");
  });

  it("gives each added service its own placement", async () => {
    const { result, form } = await setup({ defaultServices: [], defaultPlacements: [] });

    await act(async () => {
      result.current.add();
    });
    await act(async () => {
      result.current.add();
    });

    const services = form.getValues("services");
    const placements = form.getValues("placements");
    const placementIds = services.map(service => service.placementId);

    expect(new Set(placementIds).size).toBe(services.length);
    placementIds.forEach(id => expect(placements.some(placement => placement.id === id)).toBe(true));
  });

  it("removes the placement of a removed service when no other service references it", async () => {
    const { result, form } = await setup({
      defaultServices: [buildSDLService({ title: "service-1", placementId: "p-a" }), buildSDLService({ title: "service-2", placementId: "p-b" })],
      defaultPlacements: [
        { id: "p-a", name: "dcloud" },
        { id: "p-b", name: "dcloud" }
      ]
    });

    await act(async () => {
      result.current.remove(0);
    });

    expect(form.getValues("placements").map(placement => placement.id)).toEqual(["p-b"]);
  });

  it("keeps a placement that another service still references", async () => {
    const { result, form } = await setup({
      defaultServices: [buildSDLService({ title: "service-1", placementId: "p-shared" }), buildSDLService({ title: "service-2", placementId: "p-shared" })],
      defaultPlacements: [{ id: "p-shared", name: "dcloud" }]
    });

    await act(async () => {
      result.current.remove(0);
    });

    expect(form.getValues("placements").map(placement => placement.id)).toEqual(["p-shared"]);
  });

  async function setup({
    defaultServices = [],
    defaultPlacements = [{ id: "p-1", name: "dcloud" }]
  }: { defaultServices?: SdlBuilderFormValuesType["services"]; defaultPlacements?: SdlBuilderFormValuesType["placements"] } = {}) {
    let methods: UseFormReturn<SdlBuilderFormValuesType>;

    const TestWrapper = ({ children, defaultValues }: { children: React.ReactNode; defaultValues: SdlBuilderFormValuesType }) => {
      methods = useForm<SdlBuilderFormValuesType>({
        defaultValues
      });

      return <FormProvider {...methods}>{children}</FormProvider>;
    };

    const defaultFormValues: SdlBuilderFormValuesType = {
      placements: defaultPlacements,
      services: defaultServices,
      imageList: [],
      hasSSHKey: false
    };

    const { result } = renderHook(
      () =>
        useSdlServiceManager({
          control: methods.control
        }),
      {
        wrapper: ({ children }) => <TestWrapper defaultValues={defaultFormValues}>{children}</TestWrapper>
      }
    );

    return {
      result,
      form: await vi.waitFor(() => methods)
    };
  }
});
