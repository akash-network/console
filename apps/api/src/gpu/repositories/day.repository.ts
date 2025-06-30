import { Day } from "@akashnetwork/database/dbSchemas/base";
import { Op } from "sequelize";
import { singleton } from "tsyringe";

@singleton()
export class DayRepository {
  async getDaysAfter(date: Date) {
    return await Day.findAll({ where: { date: { [Op.gte]: date } } });
  }
}
