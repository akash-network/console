"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.DeploymentBalanceMonitor = void 0;
const chainDefinitions_1 = require("@akashnetwork/cloudmos-shared/chainDefinitions");
const monitoredValue_1 = require("@akashnetwork/cloudmos-shared/dbSchemas/base/monitoredValue");
const axios_1 = __importDefault(require("axios"));
const Sentry = __importStar(require("@sentry/node"));
class DeploymentBalanceMonitor {
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const monitoredValues = yield monitoredValue_1.MonitoredValue.findAll({
                where: {
                    tracker: "DeploymentBalanceMonitor"
                }
            });
            yield Promise.allSettled(monitoredValues.map((x) => this.updateValue(x)));
            console.log("Refreshed balances for " + monitoredValues.length + " deployments.");
        });
    }
    updateValue(monitoredValue) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const balance = yield this.getDeploymentBalance(monitoredValue.target);
                if (balance === null) {
                    throw new Error("Unable to get balance for " + monitoredValue.target);
                }
                monitoredValue.value = balance.toString();
                monitoredValue.lastUpdateDate = new Date();
                yield monitoredValue.save();
            }
            catch (err) {
                console.error(err);
                Sentry.captureException(err, { tags: { target: monitoredValue.target } });
            }
        });
    }
    getDeploymentBalance(target) {
        return __awaiter(this, void 0, void 0, function* () {
            const [owner, dseq] = target.split("/");
            const response = yield axios_1.default.get(`https://rest.cosmos.directory/akash/akash/deployment/v1beta3/deployments/info?id.owner=${owner}&id.dseq=${dseq}`, {
                timeout: 15000
            });
            const balance = response.data.escrow_account.balance;
            const funds = response.data.escrow_account.funds;
            const isAktDenom = balance.denom === chainDefinitions_1.activeChain.denom || balance.denom === chainDefinitions_1.activeChain.udenom;
            if (!balance || !funds || !isAktDenom) {
                return null;
            }
            const balanceAmount = balance.denom === chainDefinitions_1.activeChain.udenom ? parseInt(balance.amount) : parseInt(balance.amount) * 1000000;
            const fundsAmount = funds.denom === chainDefinitions_1.activeChain.udenom ? parseInt(funds.amount) : parseInt(funds.amount) * 1000000;
            return balanceAmount + fundsAmount;
        });
    }
}
exports.DeploymentBalanceMonitor = DeploymentBalanceMonitor;
//# sourceMappingURL=deploymentBalanceMonitor.js.map