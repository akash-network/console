import type { IssueData } from "zod";
import { z } from "zod";

import { memoryUnits, storageUnits, validationConfig } from "@src/utils/akash/units";
import { ENDPOINT_NAME_VALIDATION_REGEX } from "@src/utils/deploymentData/v1beta3";
import { roundDecimal } from "@src/utils/mathHelpers";
import { bytesToShrink } from "@src/utils/unitUtils";

const VALID_IMAGE_NAME =
  /^(?:(?:[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])(?:(?:\.(?:[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]))+)?(?::[0-9]+)?\/)?[a-z0-9]+(?:(?:(?:[._]|__|[-]*)[a-z0-9]+)+)?(?:\/[a-z0-9]+(?:(?:(?:[._]|__|[-]*)[a-z0-9]+)+)?)*(?::[a-zA-Z0-9_.-]+)?(?:@[a-zA-Z0-9_.:+-]+)?$/;

export const ProfileGpuModelSchema = z.object({
  vendor: z.string().min(1, { message: "Vendor is required." }),
  name: z.string().optional(),
  memory: z.string().optional(),
  interface: z.string().optional()
});

export const ServiceStorageSchema = z.object({
  size: z.number().min(1, { message: "Storage is required." }).default(1),
  unit: z.string().min(1, { message: "Storage unit is required." }).default("Gi"),
  isPersistent: z.boolean().optional().default(false),
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, { message: "Invalid storage name. It must only be lower case letters, numbers and dashes." })
    .regex(/^[a-z]/, { message: "Invalid starting character. It can only start with a lowercase letter." })
    .regex(/[^-]$/, { message: "Invalid ending character. It can only end with a lowercase letter or number" })
    .optional()
    .or(z.literal("")),
  type: z.string().optional(),
  mount: z
    .string()
    .regex(/^\/.*$/, { message: "Mount must be an absolute path." })
    .optional()
    .or(z.literal("")),
  isReadOnly: z.boolean().optional()
});

export const CommandSchema = z.object({
  command: z.string().optional(),
  arg: z.string().optional()
});

export const EnvironmentVariableSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1, { message: "Key is required." }),
  value: z.string().optional(),
  isSecret: z.boolean().optional()
});

export const ToSchema = z.object({
  id: z.string().optional(),
  value: z.string().min(1, { message: "Value is required." })
});

export const AcceptSchema = z.object({
  id: z.string().optional(),
  value: z.string().min(1, { message: "Value is required." })
});

export const ServiceExposeHTTPOptionsSchema = z.object({
  maxBodySize: z.number().min(1, { message: "Max body size is required." }),
  readTimeout: z.number().min(1, { message: "Read timeout is required." }),
  sendTimeout: z.number().min(1, { message: "Send timeout is required." }),
  nextTries: z.number().min(1, { message: "Next tries is required." }),
  nextTimeout: z.number().min(1, { message: "Next timeout is required." }),
  nextCases: z.array(z.string()).min(1, { message: "Next cases is required." })
});

export const PlacementAttributeSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1, { message: "Key is required." }),
  value: z.string().min(1, { message: "Value is required." })
});

export const SignedBySchema = z.object({
  id: z.string().optional(),
  value: z.string().min(1, { message: "Value is required." })
});

export const CredentialsSchema = z
  .object({
    host: z.enum(["docker.io", "ghcr.io"]).default("docker.io"),
    username: z.string(),
    password: z.string()
  })
  .optional();

export const ProfileSchema = z
  .object({
    cpu: z.number({ invalid_type_error: "CPU count is required." }).min(0.1, { message: "CPU count is required." }),
    hasGpu: z.boolean().optional(),
    gpu: z.number({ invalid_type_error: "GPU amount is required." }).optional(),
    gpuModels: z.array(ProfileGpuModelSchema).optional(),
    ram: z.number().min(1, { message: "RAM is required." }),
    ramUnit: z.string().min(1, { message: "RAM unit is required." }),
    storage: z.array(ServiceStorageSchema).min(1, { message: "Storage is required." })
  })
  .superRefine((data, ctx) => {
    const customIssues: IssueData[] = [];

    if (data.hasGpu && !data.gpu) {
      customIssues.push({ code: z.ZodIssueCode.custom, message: "Gpu amount is required.", path: ["gpu"], fatal: true });
    }

    if (data.storage.length > 1) {
      const names = data.storage.map(storage => storage.name);
      const mounts = data.storage.map(storage => storage.mount);

      data.storage.map((storage, index) => {
        if (index === 0) {
          return;
        }

        if (!storage.size || storage.size < 1) {
          customIssues.push({ code: z.ZodIssueCode.custom, message: "Storage amount is required", path: ["storage", index, "size"], fatal: true });
        }

        if (!storage.unit) {
          customIssues.push({ code: z.ZodIssueCode.custom, message: "Storage unit is required", path: ["storage", index, "unit"], fatal: true });
        }

        if (!storage.name) {
          customIssues.push({ code: z.ZodIssueCode.custom, message: "Storage name is required", path: ["storage", index, "name"], fatal: true });
        }

        if (!storage.type) {
          customIssues.push({ code: z.ZodIssueCode.custom, message: "Storage type is required", path: ["storage", index, "type"], fatal: true });
        }

        if (!storage.mount) {
          customIssues.push({ code: z.ZodIssueCode.custom, message: "Storage mount is required", path: ["storage", index, "mount"], fatal: true });
        }

        if (names.slice(0, index).includes(storage.name)) {
          customIssues.push({ code: z.ZodIssueCode.custom, message: "Storage name must be unique", path: ["storage", index, "name"], fatal: true });
        }

        if (mounts.slice(0, index).includes(storage.mount)) {
          customIssues.push({ code: z.ZodIssueCode.custom, message: "Storage mount must be unique", path: ["storage", index, "mount"], fatal: true });
        }
      });
    }

    if (customIssues.length) {
      customIssues.forEach(issue => {
        ctx.addIssue(issue);
      });

      return z.NEVER;
    }
  });

const Port = z
  .number()
  .multipleOf(1, { message: "Port numbers don't allow decimals." })
  .min(1, { message: "Port number must be at least 1." })
  .max(65535, { message: "Port number must be at most 65535." });

export const ExposeSchema = z.object({
  id: z.string().optional(),
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
    .regex(ENDPOINT_NAME_VALIDATION_REGEX, {
      message: "Invalid ip name. It must only be lower case letters, numbers and dashes."
    })
    .regex(/^[a-z]/, { message: "Invalid starting character. It can only start with a lowercase letter." })
    .regex(/[^-]$/, { message: "Invalid ending character. It can only end with a lowercase letter or number" })
    .optional()
    .or(z.literal(""))
});

export const PlacementSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Placement name is required." })
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
    amount: z.number().min(1, { message: "Pricing amount is required." }),
    denom: z.string().min(1, { message: "Pricing denom is required." })
  })
});

const validateCpuAmount = (value: number, serviceCount: number, context: z.RefinementCtx) => {
  if (serviceCount === 1 && value < 0.1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Minimum amount of CPU for a single service instance is 0.1.",
      path: ["profile", "cpu"],
      fatal: true
    });
    return z.NEVER;
  } else if (serviceCount === 1 && value > validationConfig.maxCpuAmount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Maximum amount of CPU for a single service instance is ${validationConfig.maxCpuAmount}.`,
      path: ["profile", "cpu"],
      fatal: true
    });
    return z.NEVER;
  } else if (serviceCount > 1 && serviceCount * value > validationConfig.maxGroupCpuCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Maximum total amount of CPU for a single service instance group is ${validationConfig.maxGroupCpuCount}.`,
      path: ["profile", "cpu"],
      fatal: true
    });
    return z.NEVER;
  }

  return true;
};

const validateGpuAmount = (value: number, serviceCount: number, context: z.RefinementCtx) => {
  if (value < 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "GPU amount must be greater than 0.",
      path: ["profile", "gpu"],
      fatal: true
    });
    return z.NEVER;
  } else if (serviceCount === 1 && value > validationConfig.maxGpuAmount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Maximum amount of GPU for a single service instance is ${validationConfig.maxGpuAmount}.`,
      path: ["profile", "gpu"],
      fatal: true
    });
    return z.NEVER;
  } else if (serviceCount > 1 && serviceCount * value > validationConfig.maxGroupGpuCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Maximum total amount of GPU for a single service instance group is ${validationConfig.maxGroupGpuCount}.`,
      path: ["profile", "gpu"],
      fatal: true
    });
    return z.NEVER;
  }
};

const validateMemoryAmount = (value: number, ramUnit: string, serviceCount: number, context: z.RefinementCtx) => {
  const currentUnit = memoryUnits.find(u => ramUnit.toLowerCase() === u.suffix.toLowerCase());
  const _value = (value || 0) * (currentUnit?.value || 0);
  const maxValue = bytesToShrink(validationConfig.maxMemory);
  const maxGroupValue = bytesToShrink(validationConfig.maxGroupMemory);

  if (serviceCount === 1 && _value < validationConfig.minMemory) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Minimum amount of memory for a single service instance is 1 Mi.",
      path: ["profile", "ram"],
      fatal: true
    });
    return z.NEVER;
  } else if (serviceCount === 1 && _value > validationConfig.maxMemory) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Maximum amount of memory for a single service instance is ${roundDecimal(maxValue.value, 2)} ${maxValue.unit}.`,
      path: ["profile", "ram"],
      fatal: true
    });
    return z.NEVER;
  } else if (serviceCount > 1 && serviceCount * _value > validationConfig.maxGroupMemory) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Maximum total amount of memory for a single service instance group is ${roundDecimal(maxGroupValue.value, 2)} ${maxGroupValue.unit}.`,
      path: ["profile", "ram"],
      fatal: true
    });
    return z.NEVER;
  }
};

const validateStorageAmount = (value: number, storageUnit: string, serviceCount: number, context: z.RefinementCtx) => {
  const currentUnit = storageUnits.find(u => storageUnit.toLowerCase() === u.suffix.toLowerCase());
  const _value = (value || 0) * (currentUnit?.value || 0);
  const maxValue = bytesToShrink(validationConfig.maxStorage);

  if (serviceCount === 1 && _value < validationConfig.minStorage) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Minimum amount of storage for a single service instance is 5 Mi.",
      path: ["profile", "storage"],
      fatal: true
    });
    return z.NEVER;
  } else if (serviceCount === 1 && _value > validationConfig.maxStorage) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Maximum amount of storage for a single service instance is ${roundDecimal(maxValue.value, 2)} ${maxValue.unit}.`,
      path: ["profile", "storage"],
      fatal: true
    });
    return z.NEVER;
  }
};

export const ServiceSchema = z
  .object({
    id: z.string().optional(),
    title: z
      .string()
      .min(1, { message: "Service name is required." })
      .regex(/^[a-z0-9-]+$/, { message: "Invalid service name. It must only be lower case letters, numbers and dashes." })
      .regex(/^[a-z]/, { message: "Invalid starting character. It can only start with a lowercase letter." })
      .regex(/[^-]$/, { message: "Invalid ending character. It can only end with a lowercase letter or number" }),
    image: z.string().min(1, { message: "Docker image name is required." }),
    hasCredentials: z.boolean().optional(),
    credentials: CredentialsSchema,
    profile: ProfileSchema,
    expose: z.array(ExposeSchema),
    command: CommandSchema.optional(),
    env: z.array(EnvironmentVariableSchema).optional(),
    placement: PlacementSchema,
    count: z.number().min(1, { message: "Service count is required." }),
    sshPubKey: z.string().optional()
  })
  .superRefine((data, ctx) => {
    validateCpuAmount(data.profile.cpu, data.count, ctx);
    validateMemoryAmount(data.profile.ram, data.profile.ramUnit, data.count, ctx);
    validateStorageAmount(data.profile.storage[0].size, data.profile.storage[0].unit, data.count, ctx);
    if (data.profile.hasGpu) {
      validateGpuAmount(data.profile.gpu as number, data.count, ctx);
    }
  });

const ImageList = z.object({
  imageList: z.array(z.string()).optional()
});

const SSHKey = z.object({
  hasSSHKey: z.boolean().optional()
});

export const SdlBuilderFormValuesSchema = z
  .object({ services: z.array(ServiceSchema) })
  .merge(ImageList)
  .merge(SSHKey)
  .superRefine((data, ctx) => {
    // Docker image name validation
    // Image list is set when we deploy a linux instance
    if (data.imageList && data.imageList.length > 0) {
      for (let i = 0; i < data.services.length; i++) {
        if (!data.imageList.includes(data.services[i].image)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Docker image is not in the valid image list.",
            path: ["services", i, "image"],
            fatal: true
          });
          return z.NEVER;
        }
      }
    } else {
      for (let i = 0; i < data.services.length; i++) {
        if (!VALID_IMAGE_NAME.test(data.services[i].image)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid docker image name.",
            path: ["services", i, "image"],
            fatal: true
          });
          return z.NEVER;
        }
      }
    }

    // SSH key validation
    if (data.hasSSHKey) {
      for (let i = 0; i < data.services.length; i++) {
        if (!data.services[i].sshPubKey) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "SSH Public key is required.",
            path: ["services", i, "sshPubKey"],
            fatal: true
          });
          return z.NEVER;
        }
      }
    }
  });

export const ProviderRegionValueSchema = z.object({
  key: z.string().optional(),
  description: z.string().optional(),
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
export type ServiceStorageType = z.infer<typeof ServiceStorageSchema>;
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
export type ProviderRegionValueType = z.infer<typeof ProviderRegionValueSchema>;
export type RentGpusFormValuesType = z.infer<typeof RentGpusFormValuesSchema>;
