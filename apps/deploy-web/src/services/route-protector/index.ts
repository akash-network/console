import { getSession } from "@auth0/nextjs-auth0";

import { featureFlagService } from "@src/services/feature-flag";
import { RouteProtectorService } from "@src/services/route-protector/route-protector.service";

export const routeProtector = new RouteProtectorService(featureFlagService, getSession);
