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
exports.AddressBalanceMonitor = void 0;
const chainDefinitions_1 = require("@akashnetwork/cloudmos-shared/chainDefinitions");
const monitoredValue_1 = require("@akashnetwork/cloudmos-shared/dbSchemas/base/monitoredValue");
const axios_1 = __importDefault(require("axios"));
class AddressBalanceMonitor {
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const monitoredValues = yield monitoredValue_1.MonitoredValue.findAll({
                where: {
                    tracker: "AddressBalanceMonitor"
                }
            });
            yield Promise.allSettled(monitoredValues.map((x) => this.updateValue(x)));
            console.log("Refreshed balances for " + monitoredValues.length + " addresses.");
        });
    }
    updateValue(monitoredValue) {
        return __awaiter(this, void 0, void 0, function* () {
            const balance = yield this.getBalance(monitoredValue.target);
            if (balance === null) {
                throw new Error("Unable to get balance for " + monitoredValue.target);
            }
            monitoredValue.value = balance.toString();
            monitoredValue.lastUpdateDate = new Date();
            yield monitoredValue.save();
        });
    }
    getBalance(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield axios_1.default.get(`https://rest.cosmos.directory/${chainDefinitions_1.activeChain.cosmosDirectoryId}/cosmos/bank/v1beta1/balances/${address}`, {
                timeout: 15000
            });
            const balance = response.data.balances.find((x) => x.denom === chainDefinitions_1.activeChain.denom || x.denom === chainDefinitions_1.activeChain.udenom);
            if (!balance) {
                return null;
            }
            return balance.denom === chainDefinitions_1.activeChain.udenom ? parseInt(balance.amount) : parseInt(balance.amount) * 1000000;
        });
    }
}
exports.AddressBalanceMonitor = AddressBalanceMonitor;
//# sourceMappingURL=addressBalanceMonitor.js.map