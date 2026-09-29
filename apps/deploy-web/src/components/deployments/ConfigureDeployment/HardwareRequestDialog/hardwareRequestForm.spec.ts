import { describe, expect, it } from "vitest";

import type { HardwareRequestConfiguration, HardwareRequestFormValues } from "./hardwareRequestForm";
import { hardwareRequestFormSchema, toCreateHardwareRequestData } from "./hardwareRequestForm";

const CONFIGURATION: HardwareRequestConfiguration = {
  summary: "1 vCPU · 2 GiB memory · 1 GiB storage · Any region",
  cpu: 1,
  memoryBytes: 2 * 1024 ** 3,
  storageBytes: 1024 ** 3,
  region: null
};

function aFormValues(overrides: Partial<HardwareRequestFormValues> = {}): HardwareRequestFormValues {
  return {
    category: "gpu_model",
    gpuModel: "B200",
    quantity: 8,
    region: "",
    details: "",
    email: "jane@example.com",
    includeConfiguration: true,
    ...overrides
  };
}

describe("hardwareRequestFormSchema", () => {
  it.each([
    { category: "gpu_model", overrides: { gpuModel: "B200" } },
    { category: "capacity", overrides: { gpuModel: "" } },
    { category: "region", overrides: { gpuModel: "", region: "Frankfurt" } },
    { category: "other", overrides: { gpuModel: "", details: "Need ARM nodes" } }
  ] as const)("accepts a complete $category request", ({ category, overrides }) => {
    expect(hardwareRequestFormSchema.safeParse(aFormValues({ category, ...overrides })).success).toBe(true);
  });

  it.each([
    { category: "gpu_model", overrides: { gpuModel: "  " }, path: "gpuModel", message: "Enter the GPU model you need" },
    { category: "region", overrides: { region: "" }, path: "region", message: "Enter the region you need" },
    { category: "other", overrides: { details: " " }, path: "details", message: "Describe what you need" }
  ] as const)("asks for the $path a $category request needs", ({ category, overrides, path, message }) => {
    const result = hardwareRequestFormSchema.safeParse(aFormValues({ category, ...overrides }));

    expect(result.error?.issues).toEqual([expect.objectContaining({ path: [path], message })]);
  });

  it("rejects an invalid email", () => {
    const result = hardwareRequestFormSchema.safeParse(aFormValues({ email: "not-an-email" }));

    expect(result.error?.issues).toEqual([expect.objectContaining({ path: ["email"], message: "Enter a valid email address" })]);
  });

  it.each([0, 1001, 1.5])("rejects a quantity of %s", quantity => {
    expect(hardwareRequestFormSchema.safeParse(aFormValues({ quantity })).success).toBe(false);
  });

  it("rejects details longer than the API accepts", () => {
    const result = hardwareRequestFormSchema.safeParse(aFormValues({ details: "x".repeat(2001) }));

    expect(result.error?.issues).toEqual([expect.objectContaining({ path: ["details"], message: "Use at most 2000 characters" })]);
  });
});

describe(toCreateHardwareRequestData.name, () => {
  it("sends a GPU request with its model, quantity and configuration", () => {
    const data = toCreateHardwareRequestData(aFormValues({ details: "Training run", region: "ignored" }), CONFIGURATION);

    expect(data).toEqual({
      category: "gpu_model",
      gpuModel: "B200",
      quantity: 8,
      details: "Training run",
      email: "jane@example.com",
      configuration: CONFIGURATION
    });
  });

  it("sends a capacity request without a model when none was typed", () => {
    const data = toCreateHardwareRequestData(aFormValues({ category: "capacity", gpuModel: "", quantity: 32 }), CONFIGURATION);

    expect(data).toEqual({
      category: "capacity",
      gpuModel: undefined,
      quantity: 32,
      details: undefined,
      email: "jane@example.com",
      configuration: CONFIGURATION
    });
  });

  it("sends a capacity request with the model that was typed", () => {
    const data = toCreateHardwareRequestData(aFormValues({ category: "capacity", gpuModel: "H100" }), CONFIGURATION);

    expect(data).toMatchObject({ category: "capacity", gpuModel: "H100" });
  });

  it("sends a region request without the GPU fields", () => {
    const data = toCreateHardwareRequestData(aFormValues({ category: "region", region: "Frankfurt" }), CONFIGURATION);

    expect(data).toEqual({ category: "region", region: "Frankfurt", details: undefined, email: "jane@example.com", configuration: CONFIGURATION });
  });

  it("sends an other request with only its details", () => {
    const data = toCreateHardwareRequestData(aFormValues({ category: "other", details: "Need ARM nodes" }), CONFIGURATION);

    expect(data).toEqual({ category: "other", details: "Need ARM nodes", email: "jane@example.com", configuration: CONFIGURATION });
  });

  it("leaves the configuration out when the user unchecks it", () => {
    const data = toCreateHardwareRequestData(aFormValues({ includeConfiguration: false }), CONFIGURATION);

    expect(data.configuration).toBeUndefined();
  });
});
