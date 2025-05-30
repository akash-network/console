import z from "zod";

export const NetworkCapacityResponseSchema = z.object({
  activeProviderCount: z.number(),
  activeCPU: z.number(),
  activeGPU: z.number(),
  activeMemory: z.number(),
  activeStorage: z.number(),
  pendingCPU: z.number(),
  pendingGPU: z.number(),
  pendingMemory: z.number(),
  pendingStorage: z.number(),
  availableCPU: z.number(),
  availableGPU: z.number(),
  availableMemory: z.number(),
  availableStorage: z.number(),
  totalCPU: z.number(),
  totalGPU: z.number(),
  totalMemory: z.number(),
  totalStorage: z.number(),
  activeEphemeralStorage: z.number(),
  pendingEphemeralStorage: z.number(),
  availableEphemeralStorage: z.number(),
  activePersistentStorage: z.number(),
  pendingPersistentStorage: z.number(),
  availablePersistentStorage: z.number()
});

export type NetworkCapacityResponse = z.infer<typeof NetworkCapacityResponseSchema>;
