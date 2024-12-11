import { AkashBlock } from "@akashnetwork/database/dbSchemas/akash";
import { Day } from "@akashnetwork/database/dbSchemas/base";
import { LoggerService } from "@akashnetwork/logging";
import { Op } from "sequelize";

import { sequelize } from "@src/db/dbConnection";

const logger = LoggerService.forContext("UsdSpendingTracker");

export async function updateUsdSpending() {
  // Check if there is a day flagged for update (akt price changed)
  let firstDayToRefresh = await Day.findOne({
    where: {
      aktPriceChanged: true
    },
    order: [["date", "ASC"]]
  });

  // Check for a block with missing usd spending
  const firstBlockToCompute = await AkashBlock.findOne({
    where: {
      totalUUsdSpent: null
    },
    include: [{ model: Day }],
    order: [["height", "ASC"]]
  });

  // If there is a block with missing usd spending, check if it is for a day earlier than the one flagged for update
  if (firstBlockToCompute && (!firstDayToRefresh || firstBlockToCompute.day.date < firstDayToRefresh?.date)) {
    firstDayToRefresh = firstBlockToCompute.day;
  }

  if (!firstDayToRefresh) {
    logger.info("No days to update usd spending.");
    return;
  }

  // Get all days from the first day to update
  const days = await Day.findAll({
    where: {
      date: { [Op.gte]: firstDayToRefresh.date }
    },
    order: [["date", "ASC"]]
  });

  logger.info(`There are ${days.length} days to update USD spending.`);

  for (const day of days) {
    logger.info(`Updating usd spending for blocks of day ${day.date.toISOString().substring(0, 10)}... `);
    let lastBlockOfPreviousDay: AkashBlock | null = null;

    if (day.firstBlockHeight > 1) {
      lastBlockOfPreviousDay = await AkashBlock.findOne({
        where: {
          height: day.firstBlockHeight - 1
        }
      });
    }

    const totalUUAktSpentEndOfPreviousDay = lastBlockOfPreviousDay?.totalUAktSpent ?? 0;
    const totalUUsdcSpentEndOfPreviousDay = lastBlockOfPreviousDay?.totalUUsdcSpent ?? 0;
    const totalUUsdSpentEndOfPreviousDay = lastBlockOfPreviousDay?.totalUUsdSpent ?? 0;
    const uaktToUUsd = day.aktPrice ?? 0;

    const [affectedCount] = await AkashBlock.update(
      {
        totalUUsdSpent: sequelize.literal(
          `${totalUUsdSpentEndOfPreviousDay} + ("totalUUsdcSpent" - ${totalUUsdcSpentEndOfPreviousDay}) + ("totalUAktSpent" - ${totalUUAktSpentEndOfPreviousDay}) * ${uaktToUUsd}`
        )
      },
      {
        where: {
          dayId: day.id
        }
      }
    );

    logger.info("Updated " + affectedCount + " blocks.");

    if (day.aktPriceChanged) {
      day.aktPriceChanged = false;
      await day.save();
    }
  }
}
