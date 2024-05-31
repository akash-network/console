import { z } from "zod";

export const deploymentRowSchema = z.object({
  dseq: z.string(),
  owner: z.string(),
  status: z.string(),
  createdHeight: z.number(),
  cpuUnits: z.number(),
  gpuUnits: z.number(),
  memoryQuantity: z.number(),
  storageQuantity: z.number()
});
export type DeploymentRowType = z.infer<typeof deploymentRowSchema>;