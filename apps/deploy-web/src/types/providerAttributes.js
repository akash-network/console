"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerAttributesFormValuesSchema = exports.providerAttributeSchemaDetailValueSchema = void 0;
var zod_1 = require("zod");
exports.providerAttributeSchemaDetailValueSchema = zod_1.z.object({
    key: zod_1.z.string(),
    description: zod_1.z.string(),
    value: zod_1.z.any().optional()
});
exports.providerAttributesFormValuesSchema = zod_1.z.object({
    "host-uri": zod_1.z.string().min(1, { message: "Host URI is required." }),
    host: zod_1.z.string().min(1, { message: "Host is required." }),
    email: zod_1.z.string().min(1, { message: "Email is required." }),
    organization: zod_1.z.string().min(1, { message: "Organization is required." }),
    website: zod_1.z.string().optional(),
    tier: zod_1.z.string().optional(),
    "status-page": zod_1.z.string().optional(),
    "location-region": zod_1.z.string().min(1, { message: "Location region is required." }),
    country: zod_1.z.string().min(2, { message: "Country must be 2 letter code." }).max(2, { message: "Country must be 2 letter code." }),
    city: zod_1.z.string().max(3, { message: "City must be 3 letter code." }).min(3, { message: "City must be 3 letter code." }),
    timezone: zod_1.z.string().optional(),
    "location-type": zod_1.z.string().optional(),
    "hosting-provider": zod_1.z.string().optional(),
    "hardware-cpu": zod_1.z.string().min(1, { message: "Hardware CPU is required." }),
    "hardware-cpu-arch": zod_1.z.string().optional(),
    "hardware-gpu": zod_1.z.string().optional(),
    "hardware-gpu-model": zod_1.z.array(exports.providerAttributeSchemaDetailValueSchema),
    "hardware-disk": zod_1.z.array(exports.providerAttributeSchemaDetailValueSchema).min(1, { message: "Hardware disk is required." }),
    "hardware-memory": zod_1.z.string().min(1, { message: "Hardware memory is required." }),
    "network-provider": zod_1.z.string().optional(),
    "network-speed-up": zod_1.z.number().optional(),
    "network-speed-down": zod_1.z.number().optional(),
    "feat-persistent-storage": zod_1.z.boolean().optional(),
    "feat-persistent-storage-type": zod_1.z.array(exports.providerAttributeSchemaDetailValueSchema).optional(),
    "workload-support-chia": zod_1.z.boolean().optional(),
    "workload-support-chia-capabilities": zod_1.z.array(exports.providerAttributeSchemaDetailValueSchema).optional(),
    "feat-endpoint-ip": zod_1.z.boolean().optional(),
    "feat-endpoint-custom-domain": zod_1.z.boolean().optional(),
    "unknown-attributes": zod_1.z
        .array(zod_1.z.object({
        id: zod_1.z.string(),
        key: zod_1.z.string().min(1, { message: "Key is required." }),
        value: zod_1.z.string().min(1, { message: "Value is required." })
    }))
        .optional()
});
