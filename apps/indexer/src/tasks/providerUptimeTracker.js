"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProviderUptime = void 0;
const akash_1 = require("@akashnetwork/cloudmos-shared/dbSchemas/akash");
const dbConnection_1 = require("@src/db/dbConnection");
const date_fns_1 = require("date-fns");
const sequelize_1 = require("sequelize");
function updateProviderUptime() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Updating provider uptimes.");
        console.time("updateProviderUptimes");
        const providers = yield akash_1.Provider.findAll();
        for (const provider of providers) {
            const [{ offline_seconds_30d, offline_seconds_7d, offline_seconds_1d }] = yield dbConnection_1.sequelize.query(`
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
    `, {
                type: sequelize_1.QueryTypes.SELECT,
                replacements: {
                    owner: provider.owner
                }
            });
            const uptime1d = Math.max(0, 1 - offline_seconds_1d / date_fns_1.secondsInDay);
            const uptime7d = Math.max(0, 1 - offline_seconds_7d / (7 * date_fns_1.secondsInDay));
            const uptime30d = Math.max(0, 1 - offline_seconds_30d / (30 * date_fns_1.secondsInDay));
            if (uptime1d !== provider.uptime1d || uptime7d !== provider.uptime7d || uptime30d !== provider.uptime30d) {
                yield akash_1.Provider.update({
                    uptime1d: uptime1d,
                    uptime7d: uptime7d,
                    uptime30d: uptime30d
                }, { where: { owner: provider.owner } });
            }
        }
        console.timeEnd("updateProviderUptimes");
    });
}
exports.updateProviderUptime = updateProviderUptime;
//# sourceMappingURL=providerUptimeTracker.js.map