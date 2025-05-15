import { sub } from "date-fns";
import * as semver from "semver";
import { QueryTypes } from "sequelize";
import { singleton } from "tsyringe";

import { chainDb } from "@src/db/dbConnection";
import { ProviderVersionsResponse } from "@src/provider/http-schemas/provider-versions.schema";
import { toUTC } from "@src/utils";
import { env } from "@src/utils/env";
import { round } from "@src/utils/math";

@singleton()
export class ProviderVersionsService {
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
          grace_date: toUTC(sub(new Date(), { minutes: env.PROVIDER_UPTIME_GRACE_PERIOD_MINUTES }))
        }
      }
    );

    const groupedMap = new Map<string, string[]>();

    for (const provider of providers) {
      const version = provider.akashVersion ?? "<UNKNOWN>";
      if (!groupedMap.has(version)) {
        groupedMap.set(version, []);
      }

      groupedMap.get(version).push(provider.hostUri);
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
