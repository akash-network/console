import type { DeepPartial } from "react-hook-form";
import { faker } from "@faker-js/faker";
import { merge } from "lodash";

import type { RpcBid } from "@src/types/deployment";

export function buildRpcBid(overrides: DeepPartial<RpcBid> = {}): RpcBid {
  return merge(
    {
      bid: {
        id: {
          owner: faker.string.hexadecimal({ length: 40, casing: "upper" }),
          dseq: faker.number.int({ min: 1000000, max: 9999999 }).toString(),
          gseq: faker.number.int({ min: 1, max: 10 }),
          oseq: faker.number.int({ min: 1, max: 10 }),
          provider: faker.string.hexadecimal({ length: 40, casing: "upper" }),
          bseq: faker.number.int({ min: 1, max: 100 })
        },
        state: faker.helpers.arrayElement(["open", "active", "closed"]),
        price: {
          denom: "uakt",
          amount: faker.number.int({ min: 1000, max: 100000 }).toString()
        },
        created_at: faker.date.recent().toISOString(),
        resources_offer: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => ({
          resources: {
            id: faker.number.int({ min: 1, max: 10 }),
            cpu: {
              units: {
                val: faker.number.int({ min: 100, max: 1000 }).toString()
              },
              attributes: []
            },
            memory: {
              quantity: {
                val: faker.number.int({ min: 512, max: 8192 }).toString()
              },
              attributes: []
            },
            storage: Array.from({ length: faker.number.int({ min: 1, max: 2 }) }, () => ({
              name: faker.word.sample(),
              quantity: {
                val: faker.number.int({ min: 1, max: 100 }).toString()
              },
              attributes: []
            })),
            gpu: {
              units: {
                val: faker.number.int({ min: 1, max: 10 }).toString()
              },
              attributes: []
            },
            endpoints: []
          },
          count: faker.number.int({ min: 1, max: 5 })
        }))
      },
      escrow_account: {
        id: {
          scope: faker.string.hexadecimal({ length: 40, casing: "upper" }),
          xid: faker.string.hexadecimal({ length: 40, casing: "upper" })
        },
        state: {
          owner: faker.string.hexadecimal({ length: 40, casing: "upper" }),
          state: faker.helpers.arrayElement(["open", "active", "closed"]),
          transferred: [
            {
              denom: "uakt",
              amount: faker.number.int({ min: 0, max: 100000 }).toString()
            }
          ],
          settled_at: faker.date.future().toISOString(),
          funds: [
            {
              denom: "uakt",
              amount: faker.number.int({ min: 1000, max: 100000 }).toString()
            }
          ],
          deposits: [
            {
              owner: faker.string.hexadecimal({ length: 40, casing: "upper" }),
              height: faker.number.int({ min: 1000000, max: 9999999 }).toString(),
              source: "grant",
              balance: {
                denom: "uakt",
                amount: faker.number.int({ min: 1000, max: 100000 }).toString()
              }
            }
          ]
        }
      }
    },
    overrides
  );
}
