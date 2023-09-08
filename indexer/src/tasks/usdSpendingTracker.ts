import { AkashBlock } from "@shared/dbSchemas/akash";
import { Day } from "@shared/dbSchemas/base";
import { sequelize } from "@src/db/dbConnection";

export async function updateUsdcSpending() {
  const days = await Day.findAll({
    where: {
      aktPriceChanged: true
    },
    order: [["date", "ASC"]]
  });

  console.log(`There are ${days.length} days to update USD spending.`);
  for (const day of days) {
    console.log("Updating usd spending for blocks of day " + day.date + "...");
    await AkashBlock.update(
      {
        totalUUsdSpent: sequelize.literal(`"totalUUsdcSpent" + "totalUAktSpent" * ${day.aktPrice}`)
      },
      {
        where: {
          dayId: day.id
        }
      }
    );
  }
}
