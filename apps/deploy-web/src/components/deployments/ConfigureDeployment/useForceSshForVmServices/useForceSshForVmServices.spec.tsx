import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { useForceSshForVmServices } from "./useForceSshForVmServices";

import { act, renderHook, waitFor } from "@testing-library/react";

const VM_IMAGE = "ghcr.io/akash-network/ubuntu-2404-ssh:2";

describe(useForceSshForVmServices.name, () => {
  it("turns expose ssh on for a deployment that holds a vm service", async () => {
    const { result } = setup({ image: VM_IMAGE });

    await waitFor(() => expect(result.current.getValues("hasSSHKey")).toBe(true));
  });

  it("turns expose ssh on once a service switches to a vm image", async () => {
    const { result } = setup({ image: "nginx:latest" });

    act(() => result.current.setValue("services.0.image", VM_IMAGE));

    await waitFor(() => expect(result.current.getValues("hasSSHKey")).toBe(true));
  });

  it("leaves expose ssh off for a deployment without vm services", () => {
    const { result } = setup({ image: "nginx:latest" });

    expect(result.current.getValues("hasSSHKey")).toBe(false);
  });

  function setup(input: { image: string }) {
    const values: SdlBuilderFormValuesType = { ...defaultServiceWithPlacement({ image: input.image }), hasSSHKey: false };
    return renderHook(() => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      useForceSshForVmServices(form);
      return form;
    });
  }
});
