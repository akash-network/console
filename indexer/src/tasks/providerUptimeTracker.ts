import { Provider } from "@shared/dbSchemas/akash";
import { ProviderSnapshot } from "@shared/dbSchemas/akash/providerSnapshot";
import { toUTC } from "@src/shared/utils/date";
import { add } from "date-fns";
import { Op } from "sequelize";

export async function updateProviderUptime() {
  console.log("Updating provider uptimes.");
  console.time("getAllProviders");

  const nowUtc = toUTC(new Date());
  const providers = await Provider.findAll({
    where: {
      deletedHeight: null
    },
    include: [
      {
        model: ProviderSnapshot,
        attributes: ["isOnline", "id", "checkDate"],
        required: false,
        where: {
          checkDate: {
            [Op.gte]: add(nowUtc, { days: -30 })
          }
        }
      }
    ]
  });

  console.timeEnd("getAllProviders");

  console.time("updateProviderUptime");

  for (const provider of providers) {
    const snapshots1d = provider.providerSnapshots.filter((ps) => ps.checkDate >= add(nowUtc, { days: -1 }));
    const snapshots7d = provider.providerSnapshots.filter((ps) => ps.checkDate >= add(nowUtc, { days: -7 }));
    const snapshots30d = provider.providerSnapshots;

    const uptime1d = snapshots1d.some((ps) => ps.isOnline) ? snapshots1d.filter((ps) => ps.isOnline).length / snapshots1d.length : 0;
    const uptime7d = snapshots7d.some((ps) => ps.isOnline) ? snapshots7d.filter((ps) => ps.isOnline).length / snapshots7d.length : 0;
    const uptime30d = snapshots30d.some((ps) => ps.isOnline) ? snapshots30d.filter((ps) => ps.isOnline).length / provider.providerSnapshots.length : 0;

    provider.uptime1d = uptime1d;
    provider.uptime7d = uptime7d;
    provider.uptime30d = uptime30d;

    await provider.save();
  }

  console.timeEnd("updateProviderUptime");
}
