import { Provider } from "@akashnetwork/database/dbSchemas/akash";
import { secondsInDay } from "date-fns";
import { QueryTypes } from "sequelize";

import { sequelize } from "@src/db/dbConnection";

export async function updateProviderUptime() {
  console.log("Updating provider uptimes.");
  console.time("updateProviderUptimes");

  const providers = await Provider.findAll();

  for (const provider of providers) {
    const [{ offline_seconds_30d, offline_seconds_7d, offline_seconds_1d }] = await sequelize.query<{
      offline_seconds_30d: number;
      offline_seconds_7d: number;
      offline_seconds_1d: number;
    }>(
      `
    WITH offline_periods AS (
      SELECT
          "checkDate",
          LEAD("checkDate") OVER (ORDER BY "checkDate") AS "next_checkDate",
          "isOnline"
      FROM
          "providerSnapshot"
    WHERE "owner"=:owner AND "checkDate" >= NOW() - INTERVAL '30 days'
  )
  SELECT
      SUM(CASE WHEN NOT "isOnline" THEN EXTRACT(EPOCH FROM ("next_checkDate" - "checkDate")) ELSE 0 END) AS offline_seconds_30d,
      SUM(CASE WHEN NOT "isOnline" AND "checkDate" >= NOW() - INTERVAL '7 days' THEN EXTRACT(EPOCH FROM ("next_checkDate" - "checkDate")) ELSE 0 END) AS offline_seconds_7d,
      SUM(CASE WHEN NOT "isOnline" AND "checkDate" >= NOW() - INTERVAL '1 day' THEN EXTRACT(EPOCH FROM ("next_checkDate" - "checkDate")) ELSE 0 END) AS offline_seconds_1d
  FROM
      offline_periods;
    `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          owner: provider.owner
        }
      }
    );

    const uptime1d = Math.max(0, 1 - offline_seconds_1d / secondsInDay);
    const uptime7d = Math.max(0, 1 - offline_seconds_7d / (7 * secondsInDay));
    const uptime30d = Math.max(0, 1 - offline_seconds_30d / (30 * secondsInDay));

    if (uptime1d !== provider.uptime1d || uptime7d !== provider.uptime7d || uptime30d !== provider.uptime30d) {
      await Provider.update(
        {
          uptime1d: uptime1d,
          uptime7d: uptime7d,
          uptime30d: uptime30d
        },
        { where: { owner: provider.owner } }
      );
    }
  }

  console.timeEnd("updateProviderUptimes");
}
