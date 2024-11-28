import { browserEnvConfig } from "@src/config/browser-env.config";
import { createServices } from "@src/services/http-factory/http-factory.service";

export const services = createServices(browserEnvConfig);

export const userHttpService = services.user;
export const stripeService = services.stripe;
export const txHttpService = services.tx;
