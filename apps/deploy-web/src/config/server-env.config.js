"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverEnvConfig = void 0;
require("@akashnetwork/env-loader");
var env_config_schema_1 = require("./env-config.schema");
/** @deprecated use services.config from server-di-container.service.ts instead */
exports.serverEnvConfig = (0, env_config_schema_1.validateRuntimeEnvVars)(process.env);
