import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import type { Resolver } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { ComputeResourcesCard, DEPENDENCIES } from "./ComputeResourcesCard";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ComputeResourcesCard.name, () => {
  it("writes the CPU count to the service profile", async () => {
    const { getValues } = setup({});

    const input = screen.getByLabelText("CPU Count");
    await userEvent.clear(input);
    await userEvent.type(input, "2");

    expect(getValues().services[0].profile.cpu).toBe(2);
  });

  it("clears the CPU count instead of writing NaN", async () => {
    const { getValues } = setup({});

    await userEvent.clear(screen.getByLabelText("CPU Count"));

    expect(getValues().services[0].profile.cpu).toBeNull();
  });

  it("seeds memory and storage from the service profile", () => {
    setup({ ram: 512, ramUnit: "Mi", storageSize: 10, storageUnit: "Gi" });

    expect(screen.getByLabelText("Memory")).toHaveValue(512);
    expect(screen.getByLabelText("Storage")).toHaveValue(10);
  });

  it("updates memory through the number+unit input", async () => {
    const { getValues } = setup({ ram: 512, ramUnit: "Mi" });

    const input = screen.getByLabelText("Memory");
    await userEvent.clear(input);
    await userEvent.type(input, "1024");

    expect(getValues().services[0].profile.ram).toBe(1024);
  });

  it("shows an inline error on the CPU field", async () => {
    setup({ cpuError: "CPU count is required." });

    expect(await screen.findByText("CPU count is required.")).toBeInTheDocument();
  });

  it("marks the CPU input as invalid when the field has an error", async () => {
    setup({ cpuError: "CPU count is required." });

    await screen.findByText("CPU count is required.");
    expect(screen.getByLabelText("CPU Count")).toHaveClass("ring-destructive");
  });

  it("shows the storage error inline when storage exceeds the maximum", async () => {
    setup({ storageSize: 1, storageUnit: "Gi", resolver: zodResolver(SdlBuilderFormValuesSchema) });

    const input = screen.getByLabelText("Storage");
    await userEvent.clear(input);
    await userEvent.type(input, "99999");

    expect(await screen.findByText(/Maximum amount of storage/i)).toBeInTheDocument();
  });

  it("shows the memory error inline when memory exceeds the maximum", async () => {
    setup({ ram: 512, ramUnit: "Mi", resolver: zodResolver(SdlBuilderFormValuesSchema) });

    const input = screen.getByLabelText("Memory");
    await userEvent.clear(input);
    await userEvent.type(input, "9999999");

    expect(await screen.findByText(/Maximum amount of memory/i)).toBeInTheDocument();
  });

  it("accepts a fractional memory value without flagging it as required", async () => {
    const { getValues } = setup({ ram: 1, ramUnit: "Gi", resolver: zodResolver(SdlBuilderFormValuesSchema) });

    const input = screen.getByLabelText("Memory");
    await userEvent.clear(input);
    await userEvent.type(input, "0.5");

    expect(getValues().services[0].profile.ram).toBe(0.5);
    expect(screen.queryByText("RAM is required.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Minimum amount of memory/i)).not.toBeInTheDocument();
  });

  it("shows a minimum error rather than a required error when memory is below 1 Mi", async () => {
    setup({ ram: 256, ramUnit: "Mi", resolver: zodResolver(SdlBuilderFormValuesSchema) });

    const input = screen.getByLabelText("Memory");
    await userEvent.clear(input);
    await userEvent.type(input, "0.5");

    expect(await screen.findByText(/Minimum amount of memory/i)).toBeInTheDocument();
    expect(screen.queryByText("RAM is required.")).not.toBeInTheDocument();
  });

  it("shows a required error when memory is cleared", async () => {
    setup({ ram: 256, ramUnit: "Mi", resolver: zodResolver(SdlBuilderFormValuesSchema) });

    await userEvent.clear(screen.getByLabelText("Memory"));

    expect(await screen.findByText("RAM is required.")).toBeInTheDocument();
  });

  function setup(input: {
    ram?: number;
    ramUnit?: string;
    storageSize?: number;
    storageUnit?: string;
    cpuError?: string;
    resolver?: Resolver<SdlBuilderFormValuesType>;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const values = defaultServiceWithPlacement({
      profile: {
        cpu: 0.5,
        gpu: 1,
        gpuModels: [{ vendor: "nvidia" }],
        hasGpu: false,
        ram: input.ram ?? 256,
        ramUnit: input.ramUnit ?? "Mi",
        storage: [{ size: input.storageSize ?? 1, unit: input.storageUnit ?? "Gi", isPersistent: false, type: "beta2" }]
      }
    });

    let getValues: () => SdlBuilderFormValuesType = () => values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onChange", resolver: input.resolver });
      getValues = form.getValues;
      const { setError } = form;
      useEffect(() => {
        if (input.cpuError) {
          setError(`services.${0}.profile.cpu`, { message: input.cpuError });
        }
      }, [input.cpuError, setError]);
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <ComputeResourcesCard serviceIndex={0} dependencies={{ ...DEPENDENCIES, ...input.dependencies }} />
      </Wrapper>
    );

    return { getValues: () => getValues() };
  }
});
