import { Provider } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

export class ProviderSeeder {
  static create(overrides: Partial<CreationAttributes<Provider>> = {}): CreationAttributes<Provider> {
    return {
      owner: overrides.owner || faker.finance.ethereumAddress(),
      hostUri: overrides.hostUri || `https://${faker.internet.domainName()}/host`,
      createdHeight: overrides.createdHeight || faker.number.int({ min: 1, max: 10000000 }),
      deletedHeight: overrides.deletedHeight,
      email: overrides.email || faker.internet.email(),
      website: overrides.website || faker.internet.url(),
      akashVersion: overrides.akashVersion || `${faker.system.semver()}`,
      cosmosSdkVersion: overrides.cosmosSdkVersion || `v${faker.system.semver()}`,
      isOnline: overrides.isOnline !== undefined ? overrides.isOnline : faker.datatype.boolean(),
      lastCheckDate: overrides.lastCheckDate || faker.date.recent(),
      error: overrides.error,
      ip: overrides.ip || faker.internet.ipv4(),
      ipRegion: overrides.ipRegion || faker.location.state(),
      ipRegionCode: overrides.ipRegionCode || faker.location.state({ abbreviated: true }),
      ipCountry: overrides.ipCountry || faker.location.country(),
      ipCountryCode: overrides.ipCountryCode || faker.location.countryCode(),
      ipLat: overrides.ipLat || faker.location.latitude().toString(),
      ipLon: overrides.ipLon || faker.location.longitude().toString(),
      uptime1d: overrides.uptime1d || faker.number.float({ min: 0, max: 1, multipleOf: 0.01 }),
      uptime7d: overrides.uptime7d || faker.number.float({ min: 0, max: 1, multipleOf: 0.01 }),
      uptime30d: overrides.uptime30d || faker.number.float({ min: 0, max: 1, multipleOf: 0.01 }),
      updatedHeight: overrides.updatedHeight || faker.number.int({ min: 1, max: 10000000 }),
      lastSnapshotId: overrides.lastSnapshotId || faker.string.uuid(),
      nextCheckDate: overrides.nextCheckDate || faker.date.future(),
      failedCheckCount: overrides.failedCheckCount !== undefined ? overrides.failedCheckCount : faker.number.int({ min: 0, max: 10 }),
      lastSuccessfulSnapshotId: overrides.lastSuccessfulSnapshotId || faker.string.uuid(),
      downtimeFirstSnapshotId: overrides.downtimeFirstSnapshotId
    };
  }

  static async createInDatabase(overrides: Partial<CreationAttributes<Provider>> = {}): Promise<Provider> {
    const seed = ProviderSeeder.create(overrides);
    return await Provider.create(seed);
  }
}
