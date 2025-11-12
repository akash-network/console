"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRpcBid = buildRpcBid;
var faker_1 = require("@faker-js/faker");
var lodash_1 = require("lodash");
function buildRpcBid(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (0, lodash_1.merge)({
        bid: {
            id: {
                owner: faker_1.faker.string.hexadecimal({ length: 40, casing: "upper" }),
                dseq: faker_1.faker.number.int({ min: 1000000, max: 9999999 }).toString(),
                gseq: faker_1.faker.number.int({ min: 1, max: 10 }),
                oseq: faker_1.faker.number.int({ min: 1, max: 10 }),
                provider: faker_1.faker.string.hexadecimal({ length: 40, casing: "upper" }),
                bseq: faker_1.faker.number.int({ min: 1, max: 100 })
            },
            state: faker_1.faker.helpers.arrayElement(["open", "active", "closed"]),
            price: {
                denom: "uakt",
                amount: faker_1.faker.number.int({ min: 1000, max: 100000 }).toString()
            },
            created_at: faker_1.faker.date.recent().toISOString(),
            resources_offer: Array.from({ length: faker_1.faker.number.int({ min: 1, max: 3 }) }, function () { return ({
                resources: {
                    id: faker_1.faker.number.int({ min: 1, max: 10 }),
                    cpu: {
                        units: {
                            val: faker_1.faker.number.int({ min: 100, max: 1000 }).toString()
                        },
                        attributes: []
                    },
                    memory: {
                        quantity: {
                            val: faker_1.faker.number.int({ min: 512, max: 8192 }).toString()
                        },
                        attributes: []
                    },
                    storage: Array.from({ length: faker_1.faker.number.int({ min: 1, max: 2 }) }, function () { return ({
                        name: faker_1.faker.word.sample(),
                        quantity: {
                            val: faker_1.faker.number.int({ min: 1, max: 100 }).toString()
                        },
                        attributes: []
                    }); }),
                    gpu: {
                        units: {
                            val: faker_1.faker.number.int({ min: 1, max: 10 }).toString()
                        },
                        attributes: []
                    },
                    endpoints: []
                },
                count: faker_1.faker.number.int({ min: 1, max: 5 })
            }); })
        },
        escrow_account: {
            id: {
                scope: faker_1.faker.string.hexadecimal({ length: 40, casing: "upper" }),
                xid: faker_1.faker.string.hexadecimal({ length: 40, casing: "upper" })
            },
            state: {
                owner: faker_1.faker.string.hexadecimal({ length: 40, casing: "upper" }),
                state: faker_1.faker.helpers.arrayElement(["open", "active", "closed"]),
                transferred: [
                    {
                        denom: "uakt",
                        amount: faker_1.faker.number.int({ min: 0, max: 100000 }).toString()
                    }
                ],
                settled_at: faker_1.faker.date.future().toISOString(),
                funds: [
                    {
                        denom: "uakt",
                        amount: faker_1.faker.number.int({ min: 1000, max: 100000 }).toString()
                    }
                ],
                deposits: [
                    {
                        owner: faker_1.faker.string.hexadecimal({ length: 40, casing: "upper" }),
                        height: faker_1.faker.number.int({ min: 1000000, max: 9999999 }).toString(),
                        source: "grant",
                        balance: {
                            denom: "uakt",
                            amount: faker_1.faker.number.int({ min: 1000, max: 100000 }).toString()
                        }
                    }
                ]
            }
        }
    }, overrides);
}
