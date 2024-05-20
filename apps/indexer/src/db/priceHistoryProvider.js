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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncPriceHistory = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const date_fns_1 = require("date-fns");
const chainDefinitions_1 = require("@akashnetwork/cloudmos-shared/chainDefinitions");
const base_1 = require("@akashnetwork/cloudmos-shared/dbSchemas/base");
const syncPriceHistory = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!chainDefinitions_1.activeChain.coinGeckoId) {
        console.log("No coin gecko id defined for this chain. Skipping price history sync.");
        return;
    }
    const endpointUrl = `https://api.coingecko.com/api/v3/coins/${chainDefinitions_1.activeChain.coinGeckoId}/market_chart?vs_currency=usd&days=360`;
    console.log("Fetching latest market data from " + endpointUrl);
    const response = yield (0, node_fetch_1.default)(endpointUrl);
    const data = yield response.json();
    const apiPrices = data.prices.map((pDate) => ({
        date: pDate[0],
        price: pDate[1]
    }));
    console.log(`There are ${apiPrices.length} prices to update.`);
    const days = yield base_1.Day.findAll();
    for (const day of days) {
        const priceData = apiPrices.find((x) => (0, date_fns_1.isSameDay)(new Date(x.date), day.date));
        if (priceData && priceData.price != day.aktPrice) {
            day.aktPrice = priceData.price;
            day.aktPriceChanged = true;
            yield day.save();
        }
    }
});
exports.syncPriceHistory = syncPriceHistory;
//# sourceMappingURL=priceHistoryProvider.js.map