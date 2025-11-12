"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRpcDeployment = buildRpcDeployment;
var faker_1 = require("@faker-js/faker");
var lodash_1 = require("lodash");
var denom_config_1 = require("@src/config/denom.config");
var wallet_1 = require("./wallet");
function buildRpcDeployment(_a) {
    var _b, _c, _d, _e;
    if (_a === void 0) { _a = {}; }
    var _f = _a.denom, denom = _f === void 0 ? denom_config_1.UAKT_DENOM : _f, overrides = __rest(_a, ["denom"]);
    var walletAddress = ((_c = (_b = overrides === null || overrides === void 0 ? void 0 : overrides.deployment) === null || _b === void 0 ? void 0 : _b.id) === null || _c === void 0 ? void 0 : _c.owner) || (0, wallet_1.genWalletAddress)();
    var dseq = ((_e = (_d = overrides === null || overrides === void 0 ? void 0 : overrides.deployment) === null || _d === void 0 ? void 0 : _d.id) === null || _e === void 0 ? void 0 : _e.dseq) || faker_1.faker.string.numeric({ length: 6 }).toString();
    return (0, lodash_1.merge)({
        deployment: {
            id: {
                owner: walletAddress,
                dseq: dseq
            },
            state: "closed",
            hash: "bLTCo5xFV2obtovLJ/rUZDHLkzAbB8vlXpF2iJGKpaY=",
            created_at: "666924"
        },
        groups: [
            {
                id: {
                    owner: walletAddress,
                    dseq: dseq,
                    gseq: 1
                },
                state: "closed",
                group_spec: {
                    name: "dcloud",
                    requirements: {
                        signed_by: {
                            all_of: [],
                            any_of: []
                        },
                        attributes: []
                    },
                    resources: [
                        {
                            resource: {
                                id: 1,
                                cpu: {
                                    units: {
                                        val: "500"
                                    },
                                    attributes: []
                                },
                                memory: {
                                    quantity: {
                                        val: "536870912"
                                    },
                                    attributes: []
                                },
                                storage: [
                                    {
                                        name: "default",
                                        quantity: {
                                            val: "536870912"
                                        },
                                        attributes: []
                                    }
                                ],
                                gpu: {
                                    units: {
                                        val: "0"
                                    },
                                    attributes: []
                                },
                                endpoints: [
                                    {
                                        kind: "SHARED_HTTP",
                                        sequence_number: 0
                                    }
                                ]
                            },
                            count: 1,
                            price: {
                                denom: denom,
                                amount: "10000.000000000000000000"
                            }
                        }
                    ]
                },
                created_at: "666924"
            }
        ],
        escrow_account: {
            id: {
                scope: "deployment",
                xid: "".concat(walletAddress, "/").concat(dseq)
            },
            state: {
                owner: walletAddress,
                state: "closed",
                transferred: [
                    {
                        denom: denom,
                        amount: "159.561600000000000000"
                    }
                ],
                settled_at: "667969",
                funds: [
                    {
                        denom: denom,
                        amount: "0.438400000000000000"
                    }
                ],
                deposits: []
            }
        }
    }, overrides);
}
