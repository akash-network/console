import type { paths } from "@akashnetwork/console-api-types";
import { z } from "zod";

export type CreateHardwareRequestData = paths["/v1/hardware-requests"]["post"]["requestBody"]["content"]["application/json"]["data"];
export type HardwareRequestCategory = CreateHardwareRequestData["category"];
export type HardwareRequestConfiguration = NonNullable<CreateHardwareRequestData["configuration"]>;

export const HARDWARE_REQUEST_CATEGORIES: { value: HardwareRequestCategory; label: string }[] = [
  { value: "gpu_model", label: "GPU model" },
  { value: "capacity", label: "More capacity" },
  { value: "region", label: "Region" },
  { value: "other", label: "Something else" }
];

export const MAX_GPU_QUANTITY = 1000;
export const MAX_GPU_MODEL_LENGTH = 100;
export const MAX_REGION_LENGTH = 100;
export const MAX_DETAILS_LENGTH = 2000;

export const hardwareRequestFormSchema = z
  .object({
    category: z.enum(["gpu_model", "capacity", "region", "other"]),
    gpuModel: z.string().trim().max(MAX_GPU_MODEL_LENGTH, `Use at most ${MAX_GPU_MODEL_LENGTH} characters`),
    quantity: z.number().int().min(1).max(MAX_GPU_QUANTITY),
    region: z.string().trim().max(MAX_REGION_LENGTH, `Use at most ${MAX_REGION_LENGTH} characters`),
    details: z.string().trim().max(MAX_DETAILS_LENGTH, `Use at most ${MAX_DETAILS_LENGTH} characters`),
    email: z.string().trim().email("Enter a valid email address"),
    includeConfiguration: z.boolean()
  })
  .superRefine((values, context) => {
    if (values.category === "gpu_model" && !values.gpuModel) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["gpuModel"], message: "Enter the GPU model you need" });
    }
    if (values.category === "region" && !values.region) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["region"], message: "Enter the region you need" });
    }
    if (values.category === "other" && !values.details) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["details"], message: "Describe what you need" });
    }
  });

export type HardwareRequestFormValues = z.infer<typeof hardwareRequestFormSchema>;

/** The form keeps every field while the user switches category, so only the fields the chosen category asks for are sent. */
export function toCreateHardwareRequestData(values: HardwareRequestFormValues, configuration: HardwareRequestConfiguration): CreateHardwareRequestData {
  const shared = {
    email: values.email,
    details: values.details || undefined,
    configuration: values.includeConfiguration ? configuration : undefined
  };

  switch (values.category) {
    case "gpu_model":
      return { ...shared, category: "gpu_model", gpuModel: values.gpuModel, quantity: values.quantity };
    case "capacity":
      return { ...shared, category: "capacity", gpuModel: values.gpuModel || undefined, quantity: values.quantity };
    case "region":
      return { ...shared, category: "region", region: values.region };
    case "other":
      return { ...shared, category: "other", details: values.details };
  }
}
