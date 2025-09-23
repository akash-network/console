import type { Bid } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { merge } from "lodash";

import { createAkashAddress } from "./akash-address.seeder";

export class BidSeeder {
  static create(params?: { owner?: string; provider?: string; dseq?: string; gseq?: number; oseq?: number }, overrides?: Partial<Bid>): Bid {
    const owner = params?.owner ?? createAkashAddress();
    const provider = params?.provider ?? createAkashAddress();
    const dseq = params?.dseq ?? faker.string.numeric(8);
    const gseq = params?.gseq ?? faker.number.int({ min: 1, max: 10 });
    const oseq = params?.oseq ?? faker.number.int({ min: 1, max: 10 });

    const defaultBid: Bid = {
      bid: {
        bid_id: {
          owner,
          dseq,
          gseq,
          oseq,
          provider
        },
        state: "open",
        price: {
          denom: "uakt",
          amount: faker.number.float({ min: 1, max: 1000 }).toString()
        },
        created_at: faker.string.numeric(8),
        resources_offer: [
          {
            resources: {
              cpu: {
                units: {
                  val: faker.number.int({ min: 100, max: 1000 }).toString()
                },
                attributes: []
              },
              memory: {
                quantity: {
                  val: faker.number.int({ min: 100000000, max: 1000000000 }).toString()
                },
                attributes: []
              },
              storage: [
                {
                  name: "default",
                  quantity: {
                    val: faker.number.int({ min: 100000000, max: 1000000000 }).toString()
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
            count: 1
          }
        ]
      },
      escrow_account: {
        id: {
          scope: "bid",
          xid: `${owner}/${dseq}/${gseq}/${oseq}/${provider}`
        },
        owner: provider,
        state: "open",
        balance: {
          denom: "uakt",
          amount: faker.number.float({ min: 100000, max: 1000000 }).toString()
        },
        transferred: {
          denom: "uakt",
          amount: "0.000000000000000000"
        },
        settled_at: faker.string.numeric(8),
        depositor: provider,
        funds: {
          denom: "uakt",
          amount: "0.000000000000000000"
        }
      }
    };

    return merge(defaultBid, overrides);
  }
}
