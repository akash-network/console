"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RentGpusFormValuesSchema = exports.ProviderRegionValueSchema = exports.SdlBuilderFormValuesSchema = exports.ServiceSchema = exports.PlacementSchema = exports.ExposeSchema = exports.ProfileSchema = exports.CredentialsSchema = exports.SignedBySchema = exports.PlacementAttributeSchema = exports.ServiceExposeHTTPOptionsSchema = exports.AcceptSchema = exports.ToSchema = exports.EnvironmentVariableSchema = exports.CommandSchema = exports.ServiceStorageSchema = exports.ProfileGpuModelSchema = void 0;
var zod_1 = require("zod");
var DatadogEnvConfig_1 = require("@src/components/sdl/DatadogEnvConfig/DatadogEnvConfig");
var LogCollectorControl_1 = require("@src/components/sdl/LogCollectorControl/LogCollectorControl");
var units_1 = require("@src/utils/akash/units");
var v1beta3_1 = require("@src/utils/deploymentData/v1beta3");
var keyValue_1 = require("@src/utils/keyValue/keyValue");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var unitUtils_1 = require("@src/utils/unitUtils");
var VALID_IMAGE_NAME = /^(?:(?:[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])(?:(?:\.(?:[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]))+)?(?::[0-9]+)?\/)?[a-z0-9]+(?:(?:(?:[._]|__|[-]*)[a-z0-9]+)+)?(?:\/[a-z0-9]+(?:(?:(?:[._]|__|[-]*)[a-z0-9]+)+)?)*(?::[a-zA-Z0-9_.-]+)?(?:@[a-zA-Z0-9_.:+-]+)?$/;
exports.ProfileGpuModelSchema = zod_1.z.object({
    vendor: zod_1.z.string().min(1, { message: "Vendor is required." }),
    name: zod_1.z.string().optional(),
    memory: zod_1.z.string().optional(),
    interface: zod_1.z.string().optional()
});
exports.ServiceStorageSchema = zod_1.z.object({
    size: zod_1.z.number().min(1, { message: "Storage is required." }).default(1),
    unit: zod_1.z.string().min(1, { message: "Storage unit is required." }).default("Gi"),
    isPersistent: zod_1.z.boolean().optional().default(false),
    name: zod_1.z
        .string()
        .regex(/^[a-z0-9-]+$/, { message: "Invalid storage name. It must only be lower case letters, numbers and dashes." })
        .regex(/^[a-z]/, { message: "Invalid starting character. It can only start with a lowercase letter." })
        .regex(/[^-]$/, { message: "Invalid ending character. It can only end with a lowercase letter or number" })
        .optional()
        .or(zod_1.z.literal("")),
    type: zod_1.z.string().optional(),
    mount: zod_1.z
        .string()
        .regex(/^\/.*$/, { message: "Mount must be an absolute path." })
        .optional()
        .or(zod_1.z.literal("")),
    isReadOnly: zod_1.z.boolean().optional()
});
exports.CommandSchema = zod_1.z.object({
    command: zod_1.z.string().optional(),
    arg: zod_1.z.string().optional()
});
exports.EnvironmentVariableSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    key: zod_1.z.string().min(1, { message: "Key is required." }),
    value: zod_1.z.string().optional(),
    isSecret: zod_1.z.boolean().optional()
});
exports.ToSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    value: zod_1.z.string().min(1, { message: "Value is required." })
});
exports.AcceptSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    value: zod_1.z.string().min(1, { message: "Value is required." })
});
exports.ServiceExposeHTTPOptionsSchema = zod_1.z.object({
    maxBodySize: zod_1.z.number().min(1, { message: "Max body size is required." }),
    readTimeout: zod_1.z.number().min(1, { message: "Read timeout is required." }),
    sendTimeout: zod_1.z.number().min(1, { message: "Send timeout is required." }),
    nextTries: zod_1.z.number().min(1, { message: "Next tries is required." }),
    nextTimeout: zod_1.z.number().min(1, { message: "Next timeout is required." }),
    nextCases: zod_1.z.array(zod_1.z.string()).min(1, { message: "Next cases is required." })
});
exports.PlacementAttributeSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    key: zod_1.z.string().min(1, { message: "Key is required." }),
    value: zod_1.z.string().min(1, { message: "Value is required." })
});
exports.SignedBySchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    value: zod_1.z.string().min(1, { message: "Value is required." })
});
exports.CredentialsSchema = zod_1.z
    .object({
    host: zod_1.z.enum(["docker.io", "ghcr.io"]).default("docker.io"),
    username: zod_1.z.string(),
    password: zod_1.z.string()
})
    .optional();
exports.ProfileSchema = zod_1.z
    .object({
    cpu: zod_1.z.number({ invalid_type_error: "CPU count is required." }).min(0.1, { message: "CPU count is required." }),
    hasGpu: zod_1.z.boolean().optional(),
    gpu: zod_1.z.number({ invalid_type_error: "GPU amount is required." }).optional(),
    gpuModels: zod_1.z.array(exports.ProfileGpuModelSchema).optional(),
    ram: zod_1.z.number().min(1, { message: "RAM is required." }),
    ramUnit: zod_1.z.string().min(1, { message: "RAM unit is required." }),
    storage: zod_1.z.array(exports.ServiceStorageSchema).min(1, { message: "Storage is required." })
})
    .superRefine(function (data, ctx) {
    var customIssues = [];
    if (data.hasGpu && !data.gpu) {
        customIssues.push({ code: zod_1.z.ZodIssueCode.custom, message: "Gpu amount is required.", path: ["gpu"], fatal: true });
    }
    if (data.storage.length > 1) {
        var names_1 = data.storage.map(function (storage) { return storage.name; });
        var mounts_1 = data.storage.map(function (storage) { return storage.mount; });
        data.storage.map(function (storage, index) {
            if (index === 0) {
                return;
            }
            if (!storage.size || storage.size < 1) {
                customIssues.push({ code: zod_1.z.ZodIssueCode.custom, message: "Storage amount is required", path: ["storage", index, "size"], fatal: true });
            }
            if (!storage.unit) {
                customIssues.push({ code: zod_1.z.ZodIssueCode.custom, message: "Storage unit is required", path: ["storage", index, "unit"], fatal: true });
            }
            if (!storage.name) {
                customIssues.push({ code: zod_1.z.ZodIssueCode.custom, message: "Storage name is required", path: ["storage", index, "name"], fatal: true });
            }
            if (!storage.type) {
                customIssues.push({ code: zod_1.z.ZodIssueCode.custom, message: "Storage type is required", path: ["storage", index, "type"], fatal: true });
            }
            if (!storage.mount) {
                customIssues.push({ code: zod_1.z.ZodIssueCode.custom, message: "Storage mount is required", path: ["storage", index, "mount"], fatal: true });
            }
            if (names_1.slice(0, index).includes(storage.name)) {
                customIssues.push({ code: zod_1.z.ZodIssueCode.custom, message: "Storage name must be unique", path: ["storage", index, "name"], fatal: true });
            }
            if (mounts_1.slice(0, index).includes(storage.mount)) {
                customIssues.push({ code: zod_1.z.ZodIssueCode.custom, message: "Storage mount must be unique", path: ["storage", index, "mount"], fatal: true });
            }
        });
    }
    if (customIssues.length) {
        customIssues.forEach(function (issue) {
            ctx.addIssue(issue);
        });
        return zod_1.z.NEVER;
    }
});
var Port = zod_1.z
    .number()
    .multipleOf(1, { message: "Port numbers don't allow decimals." })
    .min(1, { message: "Port number must be at least 1." })
    .max(65535, { message: "Port number must be at most 65535." });
exports.ExposeSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    port: Port,
    as: Port,
    to: zod_1.z.array(exports.ToSchema).optional(),
    proto: zod_1.z.enum(["http", "tcp"]).optional(),
    global: zod_1.z.boolean().optional(),
    accept: zod_1.z.array(exports.AcceptSchema).optional(),
    hasCustomHttpOptions: zod_1.z.boolean().optional(),
    httpOptions: exports.ServiceExposeHTTPOptionsSchema.optional(),
    ipName: zod_1.z
        .string()
        .regex(v1beta3_1.ENDPOINT_NAME_VALIDATION_REGEX, {
        message: "Invalid ip name. It must only be lower case letters, numbers and dashes."
    })
        .regex(/^[a-z]/, { message: "Invalid starting character. It can only start with a lowercase letter." })
        .regex(/[^-]$/, { message: "Invalid ending character. It can only end with a lowercase letter or number" })
        .optional()
        .or(zod_1.z.literal(""))
});
exports.PlacementSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, { message: "Placement name is required." })
        .regex(/^[a-z0-9-]+$/, { message: "Invalid placement name. It must only be lower case letters, numbers and dashes." })
        .regex(/^[a-z]/, { message: "Invalid starting character. It can only start with a lowercase letter." })
        .regex(/[^-]$/, { message: "Invalid ending character. It can only end with a lowercase letter or number" }),
    attributes: zod_1.z.array(exports.PlacementAttributeSchema).optional(),
    signedBy: zod_1.z
        .object({
        allOf: zod_1.z.array(exports.SignedBySchema),
        anyOf: zod_1.z.array(exports.SignedBySchema)
    })
        .optional(),
    pricing: zod_1.z.object({
        amount: zod_1.z.number().min(1, { message: "Pricing amount is required." }),
        denom: zod_1.z.string().min(1, { message: "Pricing denom is required." })
    })
});
var validateCpuAmount = function (value, serviceCount, context) {
    if (serviceCount === 1 && value < 0.1) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Minimum amount of CPU for a single service instance is 0.1.",
            path: ["profile", "cpu"],
            fatal: true
        });
        return zod_1.z.NEVER;
    }
    else if (serviceCount === 1 && value > units_1.validationConfig.maxCpuAmount) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Maximum amount of CPU for a single service instance is ".concat(units_1.validationConfig.maxCpuAmount, "."),
            path: ["profile", "cpu"],
            fatal: true
        });
        return zod_1.z.NEVER;
    }
    else if (serviceCount > 1 && serviceCount * value > units_1.validationConfig.maxGroupCpuCount) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Maximum total amount of CPU for a single service instance group is ".concat(units_1.validationConfig.maxGroupCpuCount, "."),
            path: ["profile", "cpu"],
            fatal: true
        });
        return zod_1.z.NEVER;
    }
    return true;
};
var validateGpuAmount = function (value, serviceCount, context) {
    if (value < 1) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "GPU amount must be greater than 0.",
            path: ["profile", "gpu"],
            fatal: true
        });
        return zod_1.z.NEVER;
    }
    else if (serviceCount === 1 && value > units_1.validationConfig.maxGpuAmount) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Maximum amount of GPU for a single service instance is ".concat(units_1.validationConfig.maxGpuAmount, "."),
            path: ["profile", "gpu"],
            fatal: true
        });
        return zod_1.z.NEVER;
    }
    else if (serviceCount > 1 && serviceCount * value > units_1.validationConfig.maxGroupGpuCount) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Maximum total amount of GPU for a single service instance group is ".concat(units_1.validationConfig.maxGroupGpuCount, "."),
            path: ["profile", "gpu"],
            fatal: true
        });
        return zod_1.z.NEVER;
    }
};
var validateMemoryAmount = function (value, ramUnit, serviceCount, context) {
    var currentUnit = units_1.memoryUnits.find(function (u) { return ramUnit.toLowerCase() === u.suffix.toLowerCase(); });
    var _value = (value || 0) * ((currentUnit === null || currentUnit === void 0 ? void 0 : currentUnit.value) || 0);
    var maxValue = (0, unitUtils_1.bytesToShrink)(units_1.validationConfig.maxMemory);
    var maxGroupValue = (0, unitUtils_1.bytesToShrink)(units_1.validationConfig.maxGroupMemory);
    if (serviceCount === 1 && _value < units_1.validationConfig.minMemory) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Minimum amount of memory for a single service instance is 1 Mi.",
            path: ["profile", "ram"],
            fatal: true
        });
        return zod_1.z.NEVER;
    }
    else if (serviceCount === 1 && _value > units_1.validationConfig.maxMemory) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Maximum amount of memory for a single service instance is ".concat((0, mathHelpers_1.roundDecimal)(maxValue.value, 2), " ").concat(maxValue.unit, "."),
            path: ["profile", "ram"],
            fatal: true
        });
        return zod_1.z.NEVER;
    }
    else if (serviceCount > 1 && serviceCount * _value > units_1.validationConfig.maxGroupMemory) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Maximum total amount of memory for a single service instance group is ".concat((0, mathHelpers_1.roundDecimal)(maxGroupValue.value, 2), " ").concat(maxGroupValue.unit, "."),
            path: ["profile", "ram"],
            fatal: true
        });
        return zod_1.z.NEVER;
    }
};
var validateStorageAmount = function (value, storageUnit, serviceCount, context) {
    var currentUnit = units_1.storageUnits.find(function (u) { return storageUnit.toLowerCase() === u.suffix.toLowerCase(); });
    var _value = (value || 0) * ((currentUnit === null || currentUnit === void 0 ? void 0 : currentUnit.value) || 0);
    var maxValue = (0, unitUtils_1.bytesToShrink)(units_1.validationConfig.maxStorage);
    if (serviceCount === 1 && _value < units_1.validationConfig.minStorage) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Minimum amount of storage for a single service instance is 5 Mi.",
            path: ["profile", "storage"],
            fatal: true
        });
        return zod_1.z.NEVER;
    }
    else if (serviceCount === 1 && _value > units_1.validationConfig.maxStorage) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Maximum amount of storage for a single service instance is ".concat((0, mathHelpers_1.roundDecimal)(maxValue.value, 2), " ").concat(maxValue.unit, "."),
            path: ["profile", "storage"],
            fatal: true
        });
        return zod_1.z.NEVER;
    }
};
exports.ServiceSchema = zod_1.z
    .object({
    id: zod_1.z.string().optional(),
    title: zod_1.z
        .string()
        .min(1, { message: "Service name is required." })
        .regex(/^[a-z0-9-]+$/, { message: "Invalid service name. It must only be lower case letters, numbers and dashes." })
        .regex(/^[a-z]/, { message: "Invalid starting character. It can only start with a lowercase letter." })
        .regex(/[^-]$/, { message: "Invalid ending character. It can only end with a lowercase letter or number" }),
    image: zod_1.z.string().min(1, { message: "Docker image name is required." }),
    hasCredentials: zod_1.z.boolean().optional(),
    credentials: exports.CredentialsSchema,
    profile: exports.ProfileSchema,
    expose: zod_1.z.array(exports.ExposeSchema),
    command: exports.CommandSchema.optional(),
    env: zod_1.z.array(exports.EnvironmentVariableSchema).optional(),
    placement: exports.PlacementSchema,
    count: zod_1.z.number().min(1, { message: "Service count is required." }),
    sshPubKey: zod_1.z.string().optional()
})
    .superRefine(function (data, ctx) {
    validateCpuAmount(data.profile.cpu, data.count, ctx);
    validateMemoryAmount(data.profile.ram, data.profile.ramUnit, data.count, ctx);
    validateStorageAmount(data.profile.storage[0].size, data.profile.storage[0].unit, data.count, ctx);
    if (data.profile.hasGpu) {
        validateGpuAmount(data.profile.gpu, data.count, ctx);
    }
});
var ImageList = zod_1.z.object({
    imageList: zod_1.z.array(zod_1.z.string()).optional()
});
var SSHKey = zod_1.z.object({
    hasSSHKey: zod_1.z.boolean().optional()
});
var logProviderVars = zod_1.z.discriminatedUnion("PROVIDER", [
    DatadogEnvConfig_1.datadogEnvSchema.extend({
        PROVIDER: zod_1.z.literal("DATADOG")
    })
]);
exports.SdlBuilderFormValuesSchema = zod_1.z
    .object({ services: zod_1.z.array(exports.ServiceSchema) })
    .merge(ImageList)
    .merge(SSHKey)
    .superRefine(function (data, ctx) {
    // Docker image name validation
    // Image list is set when we deploy a linux instance
    if (data.imageList && data.imageList.length > 0) {
        for (var i = 0; i < data.services.length; i++) {
            if (!data.imageList.includes(data.services[i].image)) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: "Docker image is not in the valid image list.",
                    path: ["services", i, "image"],
                    fatal: true
                });
                return zod_1.z.NEVER;
            }
        }
    }
    else {
        for (var i = 0; i < data.services.length; i++) {
            if (!VALID_IMAGE_NAME.test(data.services[i].image)) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: "Invalid docker image name.",
                    path: ["services", i, "image"],
                    fatal: true
                });
                return zod_1.z.NEVER;
            }
        }
    }
    // SSH key validation
    if (data.hasSSHKey) {
        for (var i = 0; i < data.services.length; i++) {
            if (!data.services[i].sshPubKey) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: "SSH Public key is required.",
                    path: ["services", i, "sshPubKey"],
                    fatal: true
                });
                return zod_1.z.NEVER;
            }
        }
    }
    for (var i = 0; i < data.services.length; i++) {
        if ((0, LogCollectorControl_1.isLogCollectorService)(data.services[i])) {
            var service = data.services[i];
            var env = (0, keyValue_1.kvArrayToObject)(service.env || []);
            var result = logProviderVars.safeParse(env);
            if (!result.success) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: "Invalid log provider configuration.",
                    path: ["services", i, "env"],
                    fatal: true
                });
            }
        }
    }
});
exports.ProviderRegionValueSchema = zod_1.z.object({
    key: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    providers: zod_1.z.array(zod_1.z.string()).optional(),
    value: zod_1.z.any().optional()
});
exports.RentGpusFormValuesSchema = zod_1.z.object({
    services: zod_1.z.array(exports.ServiceSchema),
    region: exports.ProviderRegionValueSchema.optional()
});
