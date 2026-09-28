import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { PlacementManagerProvider, usePlacementManagerContext } from "./PlacementManagerProvider";

import { act, renderHook } from "@testing-library/react";

describe(PlacementManagerProvider.name, () => {
  it("hands out a manager that clears the selection through the given callback before a splice", () => {
    const { result, onSelectService, values } = setup();
    let addedServiceId = "";
    act(() => {
      addedServiceId = result.current.addService(values.placements[0].id);
    });

    act(() => {
      result.current.removeService(values.services[0].id as string);
    });

    expect(onSelectService).toHaveBeenCalledWith("");
    expect(result.current.getPlacementServices(values.placements[0].id).map(({ service }) => service.id)).toEqual([addedServiceId]);
  });

  it("refuses to hand out a manager outside a provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => renderHook(() => usePlacementManagerContext())).toThrow("usePlacementManagerContext must be used within a PlacementManagerProvider");

    consoleError.mockRestore();
  });

  function setup() {
    const values: SdlBuilderFormValuesType = defaultServiceWithPlacement();
    const onSelectService = vi.fn();
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return (
        <FormProvider {...form}>
          <PlacementManagerProvider onSelectService={onSelectService}>{children}</PlacementManagerProvider>
        </FormProvider>
      );
    };
    const rendered = renderHook(() => usePlacementManagerContext(), { wrapper: Wrapper });
    return { ...rendered, onSelectService, values };
  }
});
