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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var akash_v1beta4_1 = require("@akashnetwork/chain-sdk/private-types/akash.v1beta4");
var net_1 = require("@akashnetwork/net");
var proto_signing_1 = require("@cosmjs/proto-signing");
var stargate_1 = require("@cosmjs/stargate");
var mnemonic = process.env.TEST_WALLET_MNEMONIC;
var newAkashTypes = [akash_v1beta4_1.MsgCloseDeployment]
    .filter(function (x) { return "$type" in x; })
    .map(function (x) { return ["/" + x.$type, x]; });
var registry = new proto_signing_1.Registry(__spreadArray([], newAkashTypes, true));
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var signer, account, deploymentsResponse, deployments, closeDeploymentsMessages, txClient, gas, tx;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!mnemonic) {
                        throw new Error("TEST_WALLET_MNEMONIC is not provided");
                    }
                    return [4 /*yield*/, proto_signing_1.DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
                            prefix: "akash"
                        })];
                case 1:
                    signer = _a.sent();
                    return [4 /*yield*/, signer.getAccounts()];
                case 2:
                    account = (_a.sent())[0];
                    console.log("Fetching deployments...");
                    return [4 /*yield*/, fetch("".concat(net_1.netConfig.getBaseAPIUrl("sandbox"), "/akash/deployment/v1beta4/deployments/list?filters.owner=").concat(account.address, "&filters.state=active&pagination.limit=100"))];
                case 3:
                    deploymentsResponse = _a.sent();
                    return [4 /*yield*/, deploymentsResponse.json()];
                case 4:
                    deployments = (_a.sent()).deployments;
                    if (deployments.length === 0) {
                        console.log("No active deployments found. Exiting...");
                        return [2 /*return*/];
                    }
                    console.log("Found ".concat(deployments.length, " active deployments. Going to close them..."));
                    closeDeploymentsMessages = deployments.map(function (deployment) {
                        return {
                            typeUrl: "/".concat(akash_v1beta4_1.MsgCloseDeployment.$type),
                            value: akash_v1beta4_1.MsgCloseDeployment.fromPartial({
                                id: deployment.deployment.id
                            })
                        };
                    });
                    return [4 /*yield*/, stargate_1.SigningStargateClient.connectWithSigner(net_1.netConfig.getBaseRpcUrl("sandbox"), signer, {
                            registry: registry
                        })];
                case 5:
                    txClient = _a.sent();
                    console.log("Closing deployments...");
                    return [4 /*yield*/, txClient.simulate(account.address, closeDeploymentsMessages, "close deployments via script")];
                case 6:
                    gas = _a.sent();
                    return [4 /*yield*/, txClient.signAndBroadcast(account.address, closeDeploymentsMessages, {
                            amount: [{ amount: Math.ceil(2500 * closeDeploymentsMessages.length).toString(), denom: "uakt" }],
                            gas: Math.floor(1.3 * gas).toString()
                        })];
                case 7:
                    tx = _a.sent();
                    if (tx.code !== 0) {
                        console.error("Transaction failed with code ".concat(tx.code, ": ").concat(tx.rawLog));
                    }
                    else {
                        console.log("Transaction hash: ".concat(tx.transactionHash));
                    }
                    txClient.disconnect();
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error);
