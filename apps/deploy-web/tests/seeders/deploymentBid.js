"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDeploymentBid = buildDeploymentBid;
var wallet_1 = require("./wallet");
function buildDeploymentBid(overrides) {
    return __assign({ id: "1", owner: (0, wallet_1.genWalletAddress)(), provider: (0, wallet_1.genWalletAddress)(), dseq: "1", gseq: 1, oseq: 1, price: {
            denom: "uakt",
            amount: "1000000000000000000"
        }, state: "open", resourcesOffer: [
            {
                resources: {
                    id: 1,
                    cpu: {
                        units: {
                            val: "0.1"
                        },
                        attributes: []
                    },
                    gpu: {
                        units: {
                            val: "1"
                        },
                        attributes: []
                    },
                    memory: {
                        quantity: {
                            val: "1024"
                        },
                        attributes: []
                    },
                    storage: [],
                    endpoints: []
                },
                count: 1
            }
        ] }, overrides);
}
