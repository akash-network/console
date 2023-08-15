import { Op } from "sequelize";
import { Day } from "@shared/dbSchemas/base";
import { AkashBlock as Block } from "@shared/dbSchemas/akash";
import { add } from "date-fns";
import { getTodayUTC } from "@src/shared/utils/date";
import { round, uaktToAKT } from "@src/shared/utils/math";

export const getWeb3IndexRevenue = async (debug?: boolean) => {
  const dailyNetworkRevenues = await getDailyRevenue();

  let days = dailyNetworkRevenues.map((r) => ({
    date: r.date.getTime() / 1000,
    revenue: round(r.usd, 2),
    revenueUAkt: r.uakt,
    aktPrice: r.aktPrice,
    dateStr: r.date
  }));

  const today = getTodayUTC();
  const oneDayAgo = add(today, { days: -1 });
  const twoDaysAgo = add(today, { days: -2 });
  const oneWeekAgo = add(today, { weeks: -1 });
  const twoWeeksAgo = add(today, { weeks: -2 });
  const thirtyDaysAgo = add(today, { days: -30 });
  const sixtyDaysAgo = add(today, { days: -60 });
  const ninetyDaysAgo = add(today, { days: -90 });
  let totalRevenue: number = 0,
    oneDayAgoRevenue: number = 0,
    twoDaysAgoRevenue: number = 0,
    oneWeekAgoRevenue: number = 0,
    twoWeeksAgoRevenue: number = 0,
    thirtyDaysAgoRevenue: number = 0,
    sixtyDaysAgoRevenue: number = 0,
    ninetyDaysAgoRevenue: number = 0;
  let totalRevenueUAkt: number = 0,
    oneDayAgoRevenueUAkt: number = 0,
    twoDaysAgoRevenueUAkt: number = 0,
    oneWeekAgoRevenueUAkt: number = 0,
    twoWeeksAgoRevenueUAkt: number = 0,
    thirtyDaysAgoRevenueUAkt: number = 0,
    sixtyDaysAgoRevenueUAkt: number = 0,
    ninetyDaysAgoRevenueUAkt: number = 0;

  days.forEach((b) => {
    const date = new Date(b.date * 1000);

    if (date <= ninetyDaysAgo) {
      ninetyDaysAgoRevenue += b.revenue;
      ninetyDaysAgoRevenueUAkt += b.revenueUAkt;
    }
    if (date <= sixtyDaysAgo) {
      sixtyDaysAgoRevenue += b.revenue;
      sixtyDaysAgoRevenueUAkt += b.revenueUAkt;
    }
    if (date <= thirtyDaysAgo) {
      thirtyDaysAgoRevenue += b.revenue;
      thirtyDaysAgoRevenueUAkt += b.revenueUAkt;
    }
    if (date <= twoWeeksAgo) {
      twoWeeksAgoRevenue += b.revenue;
      twoWeeksAgoRevenueUAkt += b.revenueUAkt;
    }
    if (date <= oneWeekAgo) {
      oneWeekAgoRevenue += b.revenue;
      oneWeekAgoRevenueUAkt += b.revenueUAkt;
    }
    if (date <= twoDaysAgo) {
      twoDaysAgoRevenue += b.revenue;
      twoDaysAgoRevenueUAkt += b.revenueUAkt;
    }
    if (date <= oneDayAgo) {
      oneDayAgoRevenue += b.revenue;
      oneDayAgoRevenueUAkt += b.revenueUAkt;
    }

    totalRevenue += b.revenue;
    totalRevenueUAkt += b.revenueUAkt;
  }, 0);

  if (!debug) {
    days = days.map(({ dateStr, revenueUAkt, aktPrice, ...others }) => others) as any;
  }

  let revenueStats = {
    now: round(totalRevenue),
    oneDayAgo: round(oneDayAgoRevenue),
    twoDaysAgo: round(twoDaysAgoRevenue),
    oneWeekAgo: round(oneWeekAgoRevenue),
    twoWeeksAgo: round(twoWeeksAgoRevenue),
    thirtyDaysAgo: round(thirtyDaysAgoRevenue),
    sixtyDaysAgo: round(sixtyDaysAgoRevenue),
    ninetyDaysAgo: round(ninetyDaysAgoRevenue)
  };

  if (debug) {
    revenueStats = {
      ...revenueStats,
      nowAkt: uaktToAKT(totalRevenueUAkt, 6),
      oneDayAgoAkt: uaktToAKT(oneDayAgoRevenueUAkt, 6),
      twoDaysAgoAkt: uaktToAKT(twoDaysAgoRevenueUAkt, 6),
      oneWeekAgoAkt: uaktToAKT(oneWeekAgoRevenueUAkt, 6),
      twoWeeksAgAkt: uaktToAKT(twoWeeksAgoRevenueUAkt, 6),
      thirtyDaysAgoAkt: uaktToAKT(thirtyDaysAgoRevenueUAkt, 6),
      sixtyDaysAgoAkt: uaktToAKT(sixtyDaysAgoRevenueUAkt, 6),
      ninetyDaysAgoAkt: uaktToAKT(ninetyDaysAgoRevenueUAkt, 6)
    } as any;
  }

  const responseObj = {
    revenue: revenueStats,
    days
  };

  return responseObj;
};

async function getDailyRevenue() {
  const result = await Day.findAll({
    attributes: ["date", "aktPrice"],
    include: [
      {
        model: Block,
        as: "lastBlockYet",
        attributes: ["totalUAktSpent"],
        required: true
      }
    ],
    where: {
      aktPrice: { [Op.not]: null }
    },
    order: [["date", "ASC"]]
  });

  let stats = result.map((day) => ({
    date: day.date,
    totalUAktSpent: (day.lastBlockYet as Block).totalUAktSpent,
    aktPrice: day.aktPrice // TODO handle no price
  }));

  let relativeStats = stats.reduce((arr, dataPoint, index) => {
    arr[index] = {
      date: dataPoint.date,
      uakt: dataPoint.totalUAktSpent - (index > 0 ? stats[index - 1].totalUAktSpent : 0),
      aktPrice: dataPoint.aktPrice
    };

    return arr;
  }, []);

  return relativeStats.map((x) => ({
    date: x.date,
    uakt: x.uakt,
    akt: uaktToAKT(x.uakt, 6),
    usd: uaktToAKT(x.uakt, 6) * x.aktPrice,
    aktPrice: x.aktPrice
  }));
}
