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
exports.updateUsdSpending = void 0;
const akash_1 = require("@akashnetwork/cloudmos-shared/dbSchemas/akash");
const base_1 = require("@akashnetwork/cloudmos-shared/dbSchemas/base");
const dbConnection_1 = require("@src/db/dbConnection");
const sequelize_1 = require("sequelize");
function updateUsdSpending() {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        // Check if there is a day flagged for update (akt price changed)
        let firstDayToRefresh = yield base_1.Day.findOne({
            where: {
                aktPriceChanged: true
            },
            order: [["date", "ASC"]]
        });
        // Check for a block with missing usd spending
        const firstBlockToCompute = yield akash_1.AkashBlock.findOne({
            where: {
                totalUUsdSpent: null
            },
            include: [{ model: base_1.Day }],
            order: [["height", "ASC"]]
        });
        // If there is a block with missing usd spending, check if it is for a day earlier than the one flagged for update
        if (firstBlockToCompute && (!firstDayToRefresh || firstBlockToCompute.day.date < (firstDayToRefresh === null || firstDayToRefresh === void 0 ? void 0 : firstDayToRefresh.date))) {
            firstDayToRefresh = firstBlockToCompute.day;
        }
        if (!firstDayToRefresh) {
            console.log("No days to update usd spending.");
            return;
        }
        // Get all days from the first day to update
        const days = yield base_1.Day.findAll({
            where: {
                date: { [sequelize_1.Op.gte]: firstDayToRefresh.date }
            },
            order: [["date", "ASC"]]
        });
        console.log(`There are ${days.length} days to update USD spending.`);
        for (const day of days) {
            console.log(`Updating usd spending for blocks of day ${day.date.toISOString().substring(0, 10)}... `);
            let lastBlockOfPreviousDay = null;
            if (day.firstBlockHeight > 1) {
                lastBlockOfPreviousDay = yield akash_1.AkashBlock.findOne({
                    where: {
                        height: day.firstBlockHeight - 1
                    }
                });
            }
            const totalUUAktSpentEndOfPreviousDay = (_a = lastBlockOfPreviousDay === null || lastBlockOfPreviousDay === void 0 ? void 0 : lastBlockOfPreviousDay.totalUAktSpent) !== null && _a !== void 0 ? _a : 0;
            const totalUUsdcSpentEndOfPreviousDay = (_b = lastBlockOfPreviousDay === null || lastBlockOfPreviousDay === void 0 ? void 0 : lastBlockOfPreviousDay.totalUUsdcSpent) !== null && _b !== void 0 ? _b : 0;
            const totalUUsdSpentEndOfPreviousDay = (_c = lastBlockOfPreviousDay === null || lastBlockOfPreviousDay === void 0 ? void 0 : lastBlockOfPreviousDay.totalUUsdSpent) !== null && _c !== void 0 ? _c : 0;
            const uaktToUUsd = (_d = day.aktPrice) !== null && _d !== void 0 ? _d : 0;
            const [affectedCount] = yield akash_1.AkashBlock.update({
                totalUUsdSpent: dbConnection_1.sequelize.literal(`${totalUUsdSpentEndOfPreviousDay} + ("totalUUsdcSpent" - ${totalUUsdcSpentEndOfPreviousDay}) + ("totalUAktSpent" - ${totalUUAktSpentEndOfPreviousDay}) * ${uaktToUUsd}`)
            }, {
                where: {
                    dayId: day.id
                }
            });
            console.log("Updated " + affectedCount + " blocks.");
            if (day.aktPriceChanged) {
                day.aktPriceChanged = false;
                yield day.save();
            }
        }
    });
}
exports.updateUsdSpending = updateUsdSpending;
//# sourceMappingURL=usdSpendingTracker.js.map