import { faker } from "@faker-js/faker";

export function buildBlockDetail() {
  return {
    block_id: {
      hash: faker.string.hexadecimal({ length: 64, casing: "upper" }),
      parts: {
        total: 1,
        hash: faker.string.hexadecimal({ length: 64, casing: "upper" })
      }
    },
    header: {
      version: {
        block: faker.number.int({ min: 1, max: 20 }).toString()
      },
      chain_id: faker.string.alphanumeric(10),
      height: faker.number.int({ min: 1000000, max: 9999999 }).toString(),
      time: faker.date.future().toISOString(),
      last_block_id: {
        hash: faker.string.hexadecimal({ length: 64, casing: "upper" }),
        parts: {
          total: 1,
          hash: faker.string.hexadecimal({ length: 64, casing: "upper" })
        }
      },
      last_commit_hash: faker.string.hexadecimal({ length: 64, casing: "upper" }),
      data_hash: faker.string.hexadecimal({ length: 64, casing: "upper" }),
      validators_hash: faker.string.hexadecimal({ length: 64, casing: "upper" }),
      next_validators_hash: faker.string.hexadecimal({ length: 64, casing: "upper" }),
      consensus_hash: faker.string.hexadecimal({ length: 64, casing: "upper" }),
      app_hash: faker.string.hexadecimal({ length: 64, casing: "upper" }),
      last_results_hash: faker.string.hexadecimal({ length: 64, casing: "upper" }),
      evidence_hash: faker.string.hexadecimal({ length: 64, casing: "upper" }),
      proposer_address: faker.string.hexadecimal({ length: 40, casing: "upper" })
    },
    data: {
      txs: []
    },
    evidence: {
      evidence: []
    },
    last_commit: {
      height: faker.number.int({ min: 1000000, max: 9999999 }).toString(),
      round: 0,
      block_id: {
        hash: faker.string.hexadecimal({ length: 64, casing: "upper" }),
        parts: {
          total: 1,
          hash: faker.string.hexadecimal({ length: 64, casing: "upper" })
        }
      },
      signatures: Array.from({ length: 3 }, () => ({
        block_id_flag: 2,
        validator_address: faker.string.hexadecimal({ length: 40, casing: "upper" }),
        timestamp: faker.date.future().toISOString(),
        signature: faker.string.hexadecimal({ length: 128, casing: "upper" })
      }))
    }
  };
}
