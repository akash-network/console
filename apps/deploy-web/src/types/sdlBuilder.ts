import { z } from "zod";

import { endpointNameValidationRegex } from "@src/utils/deploymentData/v1beta3";

export type ITemplate = {
  id: string;
  userId: string;
  username: string;
  title: string;
  description: string;
  isPublic: boolean;
  cpu: number;
  ram: number;
  storage: number;
  sdl: string;
  isFavorite: boolean;
};
export const ProfileGpuModelSchema = z.object({
  vendor: z.string(),
  name: z.string().optional(),
  memory: z.string().optional(),
  interface: z.string().optional()
});

export const ServicePersistentStorageSchema = z.object({
  name: z
    .string({ message: "Name is required." })
    .regex(/^[a-z0-9-]+$/, { message: "Invalid storage name. It must only be lower case letters, numbers and dashes." })
    .regex(/^[a-z]/, { message: "Invalid starting character. It can only start with a lowercase letter." })
    .regex(/[^-]$/, { message: "Invalid ending character. It can only end with a lowercase letter or number" }),
  type: z.string(),
  mount: z.string({ message: "Mount is required." }).regex(/^\/.*$/, { message: "Mount must be an absolute path." }),
  readOnly: z.boolean().optional()
});

export const CommandSchema = z.object({
  command: z.string(),
  arg: z.string()
});

export const EnvironmentVariableSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  isSecret: z.boolean()
});

export const ToSchema = z.object({
  id: z.string(),
  value: z.string()
});

export const AcceptSchema = z.object({
  id: z.string(),
  value: z.string()
});

export const ServiceExposeHTTPOptionsSchema = z.object({
  maxBodySize: z.number(),
  readTimeout: z.number(),
  sendTimeout: z.number(),
  nextTries: z.number(),
  nextTimeout: z.number(),
  nextCases: z.array(z.string())
});

export const PlacementAttributeSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string()
});

export const SignedBySchema = z.object({
  id: z.string(),
  value: z.string()
});

export const ProfileSchema = z.object({
  cpu: z.number(),
  hasGpu: z.boolean().optional(),
  gpu: z.number().optional(),
  gpuModels: z.array(ProfileGpuModelSchema).optional(),
  ram: z.number(),
  ramUnit: z.string(),
  storage: z.number(),
  storageUnit: z.string(),
  hasPersistentStorage: z.boolean().optional(),
  persistentStorage: z.number().optional(),
  persistentStorageUnit: z.string().optional(),
  persistentStorageParam: ServicePersistentStorageSchema.optional()
});

const Port = z
  .number()
  .multipleOf(1, { message: "Port numbers don't allow decimals." })
  .min(1, { message: "Port number must be at least 1." })
  .max(65535, { message: "Port number must be at most 65535." });

export const ExposeSchema = z.object({
  id: z.string(),
  port: Port,
  as: Port,
  to: z.array(ToSchema).optional(),
  proto: z.enum(["http", "tcp"]).optional(),
  global: z.boolean().optional(),
  accept: z.array(AcceptSchema).optional(),
  hasCustomHttpOptions: z.boolean().optional(),
  httpOptions: ServiceExposeHTTPOptionsSchema.optional(),
  ipName: z
    .string()
    .regex(endpointNameValidationRegex, {
      message: "Invalid ip name. It must only be lower case letters, numbers and dashes."
    })
    .regex(/^[a-z]/, { message: "Invalid starting character. It can only start with a lowercase letter." })
    .regex(/[^-]$/, { message: "Invalid ending character. It can only end with a lowercase letter or number" })
    .optional()
});

export const PlacementSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, { message: "Invalid placement name. It must only be lower case letters, numbers and dashes." })
    .regex(/^[a-z]/, { message: "Invalid starting character. It can only start with a lowercase letter." })
    .regex(/[^-]$/, { message: "Invalid ending character. It can only end with a lowercase letter or number" }),
  attributes: z.array(PlacementAttributeSchema).optional(),
  signedBy: z
    .object({
      allOf: z.array(SignedBySchema),
      anyOf: z.array(SignedBySchema)
    })
    .optional(),
  pricing: z.object({
    amount: z.number({ message: "Pricing amount is required." }).min(1, { message: "Pricing amount must be at least 1." }),
    denom: z.string({ message: "Pricing denom is required." })
  })
});

export const ServiceSchema = z.object({
  id: z.string(),
  title: z
    .string({ message: "Service name is required." })
    .regex(/^[a-z0-9-]+$/, { message: "Invalid service name. It must only be lower case letters, numbers and dashes." })
    .regex(/^[a-z]/, { message: "Invalid starting character. It can only start with a lowercase letter." })
    .regex(/[^-]$/, { message: "Invalid ending character. It can only end with a lowercase letter or number" }),
  image: z.string({ message: "Docker image name is required." }).regex(/^[a-z0-9\-_/:.]+$/, { message: "Invalid docker image name." }),
  profile: ProfileSchema,
  expose: z.array(ExposeSchema),
  command: CommandSchema.optional(),
  env: z.array(EnvironmentVariableSchema).optional(),
  placement: PlacementSchema,
  count: z.number({ message: "Service count is required." }).min(1, { message: "Service count must be at least 1." }),
  sshPubKey: z.string({ message: "SSH Public key is required." }).optional()
});

export const SdlBuilderFormValuesSchema = z.object({
  services: z.array(ServiceSchema)
});

export const SdlBuilderCommandFormValuesSchema = z.object({
  commands: z.array(CommandSchema)
});

export const ProviderRegionValueSchema = z.object({
  key: z.string(),
  description: z.string(),
  providers: z.array(z.string()).optional(),
  value: z.any().optional()
});

export const RentGpusFormValuesSchema = z.object({
  services: z.array(ServiceSchema),
  region: ProviderRegionValueSchema.optional()
});

export type ServiceType = z.infer<typeof ServiceSchema>;
export type SdlBuilderFormValuesType = z.infer<typeof SdlBuilderFormValuesSchema>;
export type ProfileGpuModelType = z.infer<typeof ProfileGpuModelSchema>;
export type ServicePersistentStorageType = z.infer<typeof ServicePersistentStorageSchema>;
export type CommandType = z.infer<typeof CommandSchema>;
export type EnvironmentVariableType = z.infer<typeof EnvironmentVariableSchema>;
export type ToType = z.infer<typeof ToSchema>;
export type AcceptType = z.infer<typeof AcceptSchema>;
export type ServiceExposeHTTPOptionsType = z.infer<typeof ServiceExposeHTTPOptionsSchema>;
export type PlacementAttributeType = z.infer<typeof PlacementAttributeSchema>;
export type SignedByType = z.infer<typeof SignedBySchema>;
export type ProfileType = z.infer<typeof ProfileSchema>;
export type ExposeType = z.infer<typeof ExposeSchema>;
export type PlacementType = z.infer<typeof PlacementSchema>;
export type SdlBuilderCommandFormValuesType = z.infer<typeof SdlBuilderCommandFormValuesSchema>;
export type ProviderRegionValueType = z.infer<typeof ProviderRegionValueSchema>;
export type RentGpusFormValuesType = z.infer<typeof RentGpusFormValuesSchema>;
