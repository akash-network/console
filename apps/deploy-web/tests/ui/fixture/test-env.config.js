"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDERS_WHITELIST = exports.testEnvConfig = exports.testEnvSchema = void 0;
var zod_1 = require("zod");
exports.testEnvSchema = zod_1.z.object({
    BASE_URL: zod_1.z.string().default("http://localhost:3000"),
    TEST_WALLET_MNEMONIC: zod_1.z.string(),
    UI_CONFIG_SIGNATURE_PRIVATE_KEY: zod_1.z.string().optional(),
    NETWORK_ID: zod_1.z.enum(["mainnet", "sandbox"]).default("sandbox")
});
exports.testEnvConfig = exports.testEnvSchema.parse({
    BASE_URL: process.env.BASE_URL,
    TEST_WALLET_MNEMONIC: process.env.TEST_WALLET_MNEMONIC,
    UI_CONFIG_SIGNATURE_PRIVATE_KEY: process.env.UI_CONFIG_SIGNATURE_PRIVATE_KEY
});
exports.PROVIDERS_WHITELIST = {
    mainnet: ["provider.hurricane.akash.pub", "provider.europlots.com"],
    sandbox: ["provider.provider-02.sandbox-01.aksh.pw", "provider.europlots-sandbox.com"]
};
