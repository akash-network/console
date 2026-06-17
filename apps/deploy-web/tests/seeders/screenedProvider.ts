import { faker } from "@faker-js/faker";

import type { ScreenedProvider } from "@src/queries/useScreenedProviders";
import { genWalletAddress } from "./wallet";

export function buildScreenedProvider(overrides?: Partial<ScreenedProvider>): ScreenedProvider {
  return {
    owner: genWalletAddress(),
    hostUri: `https://${faker.internet.domainName()}:8443`,
    isAudited: faker.datatype.boolean(),
    createdAt: faker.date.past().toISOString(),
    location: faker.location.state({ abbreviated: true }),
    incidents: [],
    ...overrides
  };
}
