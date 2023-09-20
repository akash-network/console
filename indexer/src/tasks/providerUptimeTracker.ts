import { Provider } from "@shared/dbSchemas/akash";
import { ProviderSnapshot } from "@shared/dbSchemas/akash/providerSnapshot";
import { sequelize } from "@src/db/dbConnection";
import { toUTC } from "@src/shared/utils/date";
import { add } from "date-fns";
import { Op, QueryTypes } from "sequelize";

export async function updateProviderUptime() {
  console.log("Updating provider uptimes.");
  console.time("getAllProviders");

  const nowUtc = toUTC(new Date());
  const oneDayAgo = add(nowUtc, { days: -1 });
  const sevenDaysAgo = add(nowUtc, { days: -7 });
  const thirtyDaysAgo = add(nowUtc, { days: -30 });

  const providers = await sequelize.query<{
    owner: string;
    oldUptime1d: number;
    oldUptime7d: number;
    oldUptime30d: number;
    online1d: number;
    total1d: number;
    online7d: number;
    total7d: number;
    online30d: number;
    total30d: number;
  }>(
    `
SELECT 
	p."owner",
	p."uptime30d" AS "oldUptime30d",
	p."uptime7d" AS "oldUptime7d",
	p."uptime1d" AS "oldUptime1d",
	COUNT(ps.id) FILTER(WHERE ps."isOnline") AS "online30d",
	COUNT(ps.id) AS "total30d",
	COUNT(ps.id) FILTER(WHERE ps."isOnline" AND ps."checkDate" > $sevenDaysAgo) AS "online7d", 
	COUNT(ps.id) FILTER(WHERE ps."checkDate" > $sevenDaysAgo) AS "total7d",
	COUNT(ps.id) FILTER(WHERE ps."isOnline" AND ps."checkDate" > $oneDayAgo) AS "online1d", 
	COUNT(ps.id) FILTER(WHERE ps."checkDate" > $oneDayAgo) AS "total1d"
FROM "provider" p
INNER JOIN "providerSnapshot" ps ON p."owner"=ps."owner" AND ps."checkDate" > $thirtyDaysAgo
GROUP BY p."owner"`,
    {
      type: QueryTypes.SELECT,
      bind: {
        oneDayAgo: oneDayAgo,
        sevenDaysAgo: sevenDaysAgo,
        thirtyDaysAgo: thirtyDaysAgo
      }
    }
  );

  console.timeEnd("getAllProviders");

  console.time("updateProviderUptime");

  for (const provider of providers) {
    const uptime1d = provider.total1d > 0 ? provider.online1d / provider.total1d : 0;
    const uptime7d = provider.total7d > 0 ? provider.online7d / provider.total7d : 0;
    const uptime30d = provider.total30d > 0 ? provider.online30d / provider.total30d : 0;

    if (uptime1d !== provider.oldUptime1d || uptime7d !== provider.oldUptime7d || uptime30d !== provider.oldUptime30d) {
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

  console.timeEnd("updateProviderUptime");
}
