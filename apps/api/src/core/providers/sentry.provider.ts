import * as GlobalSentry from "@sentry/node";
import { container, inject } from "tsyringe";

import { config } from "@src/core/config";
import packageJson from "../../../package.json";

export const sentryOptions = {
  dsn: config.SENTRY_DSN,
  environment: config.DEPLOYMENT_ENV || config.NODE_ENV,
  tracesSampleRate: config.SENTRY_TRACES_RATE,
  release: packageJson.version,
  enabled: config.SENTRY_ENABLED === "true"
};

GlobalSentry.init({
  ...sentryOptions,
  serverName: config.SENTRY_SERVER_NAME,
  integrations: [new GlobalSentry.Integrations.Http({ tracing: true })]
});

const SENTRY = "SENTRY";

container.register(SENTRY, { useValue: GlobalSentry });

export type Sentry = typeof GlobalSentry;
export const InjectSentry = () => inject(SENTRY);
export const getSentry = () => container.resolve<Sentry>(SENTRY);
