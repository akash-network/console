import { serverEnvConfig } from "@src/config/server-env.config";
import { createServices } from "@src/services/http-factory/http-factory.service";

export const services = createServices(serverEnvConfig);
