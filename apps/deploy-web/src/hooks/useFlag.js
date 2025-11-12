"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useFlag = void 0;
var client_1 = require("@unleash/nextjs/client");
var browser_env_config_1 = require("@src/config/browser-env.config");
var useDummyFlag = function () { return true; };
exports.useFlag = browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL ? useDummyFlag : client_1.useFlag;
