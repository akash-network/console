import { RouteProtectorService } from "@src/services/route-protector/route-protector.service";
import { services } from "../http/http-server.service";

export const routeProtector = new RouteProtectorService(services.featureFlagService, services.getSession);
