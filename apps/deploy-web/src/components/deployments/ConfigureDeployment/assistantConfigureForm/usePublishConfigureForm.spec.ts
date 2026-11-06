import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { ConfigureFormRegistry } from "@src/components/assistant/configureFormRegistry/configureFormRegistry";
import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import type { DeploymentFlowPhase } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES } from "./usePublishConfigureForm";
import { usePublishConfigureForm } from "./usePublishConfigureForm";

import { act, renderHook } from "@testing-library/react";

describe(usePublishConfigureForm.name, () => {
  it("publishes the form while mounted and withdraws it on unmount", () => {
    const { registry, unmount } = setup({});

    expect(registry.current).not.toBeNull();

    unmount();
    expect(registry.current).toBeNull();
  });

  it("reads the current values with the latest phase and the screening of the latest sdl", () => {
    const { registry, readPlacementScreening, rerender } = setup({});

    rerender({ phase: "error", sdl: "latest-sdl" });
    const read = registry.current!.read();

    expect(readPlacementScreening).toHaveBeenLastCalledWith("latest-sdl", [expect.objectContaining({ name: "dcloud" })]);
    expect(read).toEqual(
      expect.objectContaining({
        phase: "error",
        editable: true,
        providers: [{ placement: "dcloud", status: "screened", providersAbleToBid: 3, notBidding: 0 }],
        services: [expect.objectContaining({ name: "web", memory: "512Mi" })]
      })
    );
  });

  it("applies an edit to the form, marking the changed fields dirty", () => {
    const { registry, form, dirtyFields } = setup({});

    act(() =>
      registry.current!.applyEdit({
        services: [{ service: "web", changes: { memory: "1Gi" } }],
        placements: [{ placement: "dcloud", changes: { regions: [] } }]
      })
    );

    expect(form().getValues("services.0.profile")).toEqual(expect.objectContaining({ ram: 1, ramUnit: "Gi" }));
    expect(form().getValues("placements.0.regions")).toEqual([]);
    expect(dirtyFields()).toEqual(expect.objectContaining({ services: expect.anything(), placements: expect.anything() }));
  });

  it("refuses an edit once the deployment is past configuring", () => {
    const { registry, form, rerender } = setup({});

    rerender({ phase: "quoting", sdl: "sdl" });

    expect(() => registry.current!.applyEdit({ services: [{ service: "web", changes: { memory: "1Gi" } }], placements: [] })).toThrow(
      "The deployment is past configuring, so its settings can't change here. Edit the deployment first, then apply this again."
    );
    expect(form().getValues("services.0.profile.ram")).toBe(512);
  });

  function setup(input: { phase?: DeploymentFlowPhase }) {
    const registry = new ConfigureFormRegistry();
    const readPlacementScreening = vi.fn(() => [{ placement: "dcloud", status: "screened" as const, providersAbleToBid: 3, notBidding: 0 }]);
    const dependencies: typeof DEPENDENCIES = {
      useConfigureFormRegistry: () => registry,
      useCachedPlacementScreening: () => readPlacementScreening
    };
    const defaultValues = formValues();
    let currentForm: ReturnType<typeof useForm<SdlBuilderFormValuesType>> | undefined;

    const view = renderHook(
      ({ phase, sdl }: { phase: DeploymentFlowPhase; sdl: string }) => {
        const form = useForm<SdlBuilderFormValuesType>({ defaultValues });
        currentForm = form;
        usePublishConfigureForm({ form, phase, sdl }, dependencies);
        return form.formState.dirtyFields;
      },
      { initialProps: { phase: input.phase ?? "configuring", sdl: "sdl" } }
    );

    return {
      registry,
      readPlacementScreening,
      form: () => currentForm!,
      dirtyFields: () => view.result.current,
      rerender: view.rerender,
      unmount: view.unmount
    };
  }

  function formValues(): SdlBuilderFormValuesType {
    const values = defaultServiceWithPlacement({ title: "web", image: "nginx:alpine" });
    values.placements[0] = { ...values.placements[0], name: "dcloud", regions: ["us-west"] };
    return values;
  }
});
