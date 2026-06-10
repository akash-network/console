import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { useEndpointManager } from "./useEndpointManager";

import { act, renderHook } from "@testing-library/react";

describe("useEndpointManager", () => {
  it("starts with no endpoints by default", () => {
    const { result } = setup({ values: defaultServiceWithPlacement() });

    expect(result.current.endpoints).toHaveLength(0);
  });

  it("appends an endpoint with a unique generated name", () => {
    const { result } = setup({ values: defaultServiceWithPlacement() });

    act(() => {
      result.current.addEndpoint();
    });

    expect(result.current.endpoints).toHaveLength(1);
    expect(result.current.endpoints[0].name).toBe("endpoint-1");

    act(() => {
      result.current.addEndpoint();
    });

    expect(result.current.endpoints).toHaveLength(2);
    expect(result.current.endpoints[1].name).toBe("endpoint-2");
  });

  it("removes an endpoint by id", () => {
    const values: SdlBuilderFormValuesType = {
      ...defaultServiceWithPlacement(),
      endpoints: [
        { id: "e-1", name: "endpoint-1" },
        { id: "e-2", name: "endpoint-2" }
      ]
    };
    const { result } = setup({ values });

    act(() => {
      result.current.removeEndpoint("e-1");
    });

    expect(result.current.endpoints).toHaveLength(1);
    expect(result.current.endpoints[0].id).toBe("e-2");
  });

  function setup(input: { values: SdlBuilderFormValuesType }) {
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: input.values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    return renderHook(() => useEndpointManager(), { wrapper: Wrapper });
  }
});
