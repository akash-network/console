import { container, inject } from "tsyringe";

import { config } from "@src/auth/config";

export const AUTH_CONFIG = "AUTH_CONFIG";

container.register(AUTH_CONFIG, { useValue: config });

export type AuthConfig = typeof config;

export const InjectAuthConfig = () => inject(AUTH_CONFIG);
