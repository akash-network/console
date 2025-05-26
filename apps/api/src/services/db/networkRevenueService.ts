import { AkashBlock as Block } from "@akashnetwork/database/dbSchemas/akash";
import { Day } from "@akashnetwork/database/dbSchemas/base";
import { add } from "date-fns";
import { Op } from "sequelize";

import { getTodayUTC } from "@src/utils";
import { round, uaktToAKT, udenomToDenom } from "@src/utils/math";

type DalyRevenueType = {
  date: number;
  revenue: number;
  revenueUAkt?: number;
  revenueUUsdc?: number;
  aktPrice?: number;
  dateStr?: Date;
};

type RevenueStatsType = {
  now: number;
  oneDayAgo: number;
  twoDaysAgo: number;
  oneWeekAgo: number;
  twoWeeksAgo: number;
  thirtyDaysAgo: number;
  sixtyDaysAgo: number;
  ninetyDaysAgo: number;
  nowAkt?: number;
  oneDayAgoAkt?: number;
  twoDaysAgoAkt?: number;
  oneWeekAgoAkt?: number;
  twoWeeksAgAkt?: number;
  thirtyDaysAgoAkt?: number;
  sixtyDaysAgoAkt?: number;
  ninetyDaysAgoAkt?: number;
  nowUsdc?: number;
  oneDayAgoUsdc?: number;
  twoDaysAgoUsdc?: number;
  oneWeekAgoUsdc?: number;
  twoWeeksAgUsdc?: number;
  thirtyDaysAgoUsdc?: number;
  sixtyDaysAgoUsdc?: number;
  ninetyDaysAgoUsdc?: number;
};

export const getWeb3IndexRevenue = async (debug?: boolean) => {
  const dailyNetworkRevenues = await getDailyRevenue();

  let days: DalyRevenueType[] = dailyNetworkRevenues.map(r => ({
    date: r.date.getTime() / 1000,
    revenue: round(r.usd, 2),
    revenueUAkt: r.uakt,
    revenueUUsdc: r.uusdc,
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
  let totalRevenueUUsdc: number = 0,
    oneDayAgoRevenueUUsdc: number = 0,
    twoDaysAgoRevenueUUsdc: number = 0,
    oneWeekAgoRevenueUUsdc: number = 0,
    twoWeeksAgoRevenueUUsdc: number = 0,
    thirtyDaysAgoRevenueUUsdc: number = 0,
    sixtyDaysAgoRevenueUUsdc: number = 0,
    ninetyDaysAgoRevenueUUsdc: number = 0;

  days.forEach(b => {
    const date = new Date(b.date * 1000);

    if (date <= ninetyDaysAgo) {
      ninetyDaysAgoRevenue += b.revenue;
      ninetyDaysAgoRevenueUAkt += b.revenueUAkt || 0;
      ninetyDaysAgoRevenueUUsdc += b.revenueUUsdc || 0;
    }
    if (date <= sixtyDaysAgo) {
      sixtyDaysAgoRevenue += b.revenue;
      sixtyDaysAgoRevenueUAkt += b.revenueUAkt || 0;
      sixtyDaysAgoRevenueUUsdc += b.revenueUUsdc || 0;
    }
    if (date <= thirtyDaysAgo) {
      thirtyDaysAgoRevenue += b.revenue;
      thirtyDaysAgoRevenueUAkt += b.revenueUAkt || 0;
      thirtyDaysAgoRevenueUUsdc += b.revenueUUsdc || 0;
    }
    if (date <= twoWeeksAgo) {
      twoWeeksAgoRevenue += b.revenue;
      twoWeeksAgoRevenueUAkt += b.revenueUAkt || 0;
      twoWeeksAgoRevenueUUsdc += b.revenueUUsdc || 0;
    }
    if (date <= oneWeekAgo) {
      oneWeekAgoRevenue += b.revenue;
      oneWeekAgoRevenueUAkt += b.revenueUAkt || 0;
      oneWeekAgoRevenueUUsdc += b.revenueUUsdc || 0;
    }
    if (date <= twoDaysAgo) {
      twoDaysAgoRevenue += b.revenue;
      twoDaysAgoRevenueUAkt += b.revenueUAkt || 0;
      twoDaysAgoRevenueUUsdc += b.revenueUUsdc || 0;
    }
    if (date <= oneDayAgo) {
      oneDayAgoRevenue += b.revenue;
      oneDayAgoRevenueUAkt += b.revenueUAkt || 0;
      oneDayAgoRevenueUUsdc += b.revenueUUsdc || 0;
    }

    totalRevenue += b.revenue;
    totalRevenueUAkt += b.revenueUAkt || 0;
    totalRevenueUUsdc += b.revenueUUsdc || 0;
  }, 0);

  if (!debug) {
    days = days.map(({ dateStr, revenueUAkt, revenueUUsdc, aktPrice, ...others }) => others);
  }

  let revenueStats: RevenueStatsType = {
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
      ninetyDaysAgoAkt: uaktToAKT(ninetyDaysAgoRevenueUAkt, 6),
      nowUsdc: udenomToDenom(totalRevenueUUsdc, 6),
      oneDayAgoUsdc: udenomToDenom(oneDayAgoRevenueUUsdc, 6),
      twoDaysAgoUsdc: udenomToDenom(twoDaysAgoRevenueUUsdc, 6),
      oneWeekAgoUsdc: udenomToDenom(oneWeekAgoRevenueUUsdc, 6),
      twoWeeksAgUsdc: udenomToDenom(twoWeeksAgoRevenueUUsdc, 6),
      thirtyDaysAgoUsdc: udenomToDenom(thirtyDaysAgoRevenueUUsdc, 6),
      sixtyDaysAgoUsdc: udenomToDenom(sixtyDaysAgoRevenueUUsdc, 6),
      ninetyDaysAgoUsdc: udenomToDenom(ninetyDaysAgoRevenueUUsdc, 6)
    };
  }

  const responseObj = {
    revenue: revenueStats,
    days
  };

  return responseObj;
};

export async function getDailyRevenue() {
  const result = await Day.findAll({
    attributes: ["date", "aktPrice"],
    include: [
      {
        model: Block,
        as: "lastBlockYet",
        attributes: ["totalUAktSpent", "totalUUsdcSpent"],
        required: true
      }
    ],
    where: {
      aktPrice: { [Op.not]: null }
    },
    order: [["date", "ASC"]]
  });

  const stats = result.map(day => ({
    date: day.date,
    totalUAktSpent: (day.lastBlockYet as Block).totalUAktSpent || 0,
    totalUUsdcSpent: (day.lastBlockYet as Block).totalUUsdcSpent || 0,
    aktPrice: day.aktPrice || 0 // TODO handle no price
  }));

  const relativeStats = stats.reduce<{ date: Date; uakt: number; uusdc: number; aktPrice: number }[]>((arr, dataPoint, index) => {
    arr[index] = {
      date: dataPoint.date,
      uakt: dataPoint.totalUAktSpent - (index > 0 ? stats[index - 1].totalUAktSpent : 0),
      uusdc: dataPoint.totalUUsdcSpent - (index > 0 ? stats[index - 1].totalUUsdcSpent : 0),
      aktPrice: dataPoint.aktPrice
    };

    return arr;
  }, []);

  return relativeStats.map(x => ({
    date: x.date,
    uakt: x.uakt,
    akt: uaktToAKT(x.uakt, 6),
    uusdc: x.uusdc,
    usdc: udenomToDenom(x.uusdc, 6),
    usd: uaktToAKT(x.uakt, 6) * x.aktPrice + udenomToDenom(x.uusdc, 6),
    aktPrice: x.aktPrice
  }));
}
