"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBlockDetail = buildBlockDetail;
var faker_1 = require("@faker-js/faker");
function buildBlockDetail() {
    return {
        block_id: {
            hash: faker_1.faker.string.hexadecimal({ length: 64, casing: "upper" }),
            parts: {
                total: 1,
                hash: faker_1.faker.string.hexadecimal({ length: 64, casing: "upper" })
            }
        },
        block: {
            header: {
                version: {
                    block: faker_1.faker.number.int({ min: 1, max: 20 }).toString()
                },
                chain_id: faker_1.faker.string.alphanumeric(10),
                height: faker_1.faker.number.int({ min: 1000000, max: 9999999 }).toString(),
                time: faker_1.faker.date.future().toISOString(),
                last_block_id: {
                    hash: faker_1.faker.string.hexadecimal({ length: 64, casing: "upper" }),
                    parts: {
                        total: 1,
                        hash: faker_1.faker.string.hexadecimal({ length: 64, casing: "upper" })
                    }
                },
                last_commit_hash: faker_1.faker.string.hexadecimal({ length: 64, casing: "upper" }),
                data_hash: faker_1.faker.string.hexadecimal({ length: 64, casing: "upper" }),
                validators_hash: faker_1.faker.string.hexadecimal({ length: 64, casing: "upper" }),
                next_validators_hash: faker_1.faker.string.hexadecimal({ length: 64, casing: "upper" }),
                consensus_hash: faker_1.faker.string.hexadecimal({ length: 64, casing: "upper" }),
                app_hash: faker_1.faker.string.hexadecimal({ length: 64, casing: "upper" }),
                last_results_hash: faker_1.faker.string.hexadecimal({ length: 64, casing: "upper" }),
                evidence_hash: faker_1.faker.string.hexadecimal({ length: 64, casing: "upper" }),
                proposer_address: faker_1.faker.string.hexadecimal({ length: 40, casing: "upper" })
            },
            data: {
                txs: []
            },
            evidence: {
                evidence: []
            },
            last_commit: {
                height: faker_1.faker.number.int({ min: 1000000, max: 9999999 }).toString(),
                round: 0,
                block_id: {
                    hash: faker_1.faker.string.hexadecimal({ length: 64, casing: "upper" }),
                    parts: {
                        total: 1,
                        hash: faker_1.faker.string.hexadecimal({ length: 64, casing: "upper" })
                    }
                },
                signatures: Array.from({ length: 3 }, function () { return ({
                    block_id_flag: 2,
                    validator_address: faker_1.faker.string.hexadecimal({ length: 40, casing: "upper" }),
                    timestamp: faker_1.faker.date.future().toISOString(),
                    signature: faker_1.faker.string.hexadecimal({ length: 128, casing: "upper" })
                }); })
            }
        }
    };
}
