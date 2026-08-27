import { buildPlacementScreeningRequest, type ScreeningRequest, type ScreeningRequestBody } from "@src/queries/useScreenedProviders";
import { createApiSdk } from "@src/services/api-sdk/createApiSdk";
import { PROXY_API_BASE_URL } from "@src/services/auth/auth/interceptors";
import type { PlacementType } from "@src/types";

type VerificationPlacement = Pick<PlacementType, "name" | "verification">;

type Dependencies = {
  buildRequest: (sdl: string, placementName: string) => ScreeningRequestBody | null;
  screenProviders: (request: ScreeningRequest) => Promise<{ providers: readonly unknown[] }>;
};

const api = createApiSdk({ baseUrl: PROXY_API_BASE_URL });

const DEFAULT_DEPENDENCIES: Dependencies = {
  buildRequest: buildPlacementScreeningRequest,
  screenProviders: request => api.v1.screenProviders(request)
};

export async function findUnavailableVerificationPlacements(
  input: { sdl: string; placements: VerificationPlacement[]; timeZone?: string },
  dependencies: Dependencies = DEFAULT_DEPENDENCIES
): Promise<string[]> {
  const timeZone = input.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const checks = input.placements
    .filter(placement => placement.verification !== undefined)
    .map(async placement => {
      const request = dependencies.buildRequest(input.sdl, placement.name);
      if (!request) throw new Error(`Unable to screen placement ${placement.name}`);

      const result = await dependencies.screenProviders({ ...request, timezone: timeZone });
      return result.providers.length === 0 ? placement.name : null;
    });

  return (await Promise.all(checks)).filter((name): name is string => name !== null);
}

export function useVerificationProviderPreflight() {
  return findUnavailableVerificationPlacements;
}
