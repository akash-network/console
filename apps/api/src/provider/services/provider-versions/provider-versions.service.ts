import { sub } from "date-fns";
import * as semver from "semver";
import { QueryTypes } from "sequelize";
import { inject, singleton } from "tsyringe";

import { chainDb } from "@src/db/dbConnection";
import { ProviderVersionsResponse } from "@src/provider/http-schemas/provider-versions.schema";
import type { ProviderConfig } from "@src/provider/providers/config.provider";
import { PROVIDER_CONFIG } from "@src/provider/providers/config.provider";
import { toUTC } from "@src/utils";
import { round } from "@src/utils/math";

@singleton()
export class ProviderVersionsService {
  readonly #providerConfig: ProviderConfig;

  constructor(@inject(PROVIDER_CONFIG) providerConfig: ProviderConfig) {
    this.#providerConfig = providerConfig;
  }

  async getProviderVersions(): Promise<ProviderVersionsResponse> {
    const providers = await chainDb.query<{ hostUri: string; akashVersion: string }>(
      `
    SELECT DISTINCT ON ("hostUri") "hostUri","akashVersion"
    FROM provider p
    INNER JOIN "providerSnapshot" ps ON ps.id=p."lastSuccessfulSnapshotId"
    WHERE p."isOnline" IS TRUE OR ps."checkDate" >= :grace_date
  `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          grace_date: toUTC(sub(new Date(), { minutes: this.#providerConfig.PROVIDER_UPTIME_GRACE_PERIOD_MINUTES }))
        }
      }
    );

    const groupedMap = new Map<string, string[]>();

    for (const provider of providers) {
      const version = provider.akashVersion ?? "<UNKNOWN>";
      let providers = groupedMap.get(version);
      if (!providers) {
        providers = [];
        groupedMap.set(version, providers);
      }

      providers.push(provider.hostUri);
    }

    const grouped = Array.from(groupedMap.entries()).map(([version, providers]) => ({
      version,
      providers
    }));

    const nullVersionName = "<UNKNOWN>";
    const results = grouped.map(x => ({
      version: x.version ?? nullVersionName,
      count: x.providers.length,
      ratio: round(x.providers.length / providers.length, 2),
      providers: Array.from(new Set(x.providers))
    }));

    return results
      .filter(x => x.version !== nullVersionName) // Remove <UNKNOWN> version for sorting
      .sort((a, b) => semver.compare(b.version, a.version))
      .concat(results.filter(x => x.version === nullVersionName)) // Add back <UNKNOWN> version at the end
      .reduce(
        (acc, x) => {
          acc[x.version] = x;
          return acc;
        },
        {} as { [key: string]: (typeof results)[number] }
      );
  }
}
