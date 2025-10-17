import { faker } from "@faker-js/faker";

import { createAkashAddress } from "./akash-address.seeder";
import { DenomSeeder } from "./denom.seeder";

export interface LeaseInput {
  owner?: string;
  dseq?: string;
  gseq?: number;
  oseq?: number;
  provider?: string;
  state?: string;
  price?: {
    denom?: string;
    amount?: string;
  };
  created_at?: string;
  closed_on?: string;
}

export interface LeaseOutput {
  lease: {
    id: {
      owner: string;
      dseq: string;
      gseq: number;
      oseq: number;
      provider: string;
      bseq: number;
    };
    state: string;
    price: {
      denom: string;
      amount: string;
    };
    created_at: string;
    closed_on: string;
    reason?: string;
  };
  escrow_payment: {
    id: {
      aid: {
        scope: string;
        xid: string;
      };
      xid: string;
    };
    state: {
      owner: string;
      state: string;
      rate: {
        denom: string;
        amount: string;
      };
      balance: {
        denom: string;
        amount: string;
      };
      unsettled: {
        denom: string;
        amount: string;
      };
      withdrawn: {
        denom: string;
        amount: string;
      };
    };
  };
}

export class LeaseApiResponseSeeder {
  static create(input: LeaseInput = {}): LeaseOutput {
    const {
      owner = createAkashAddress(),
      dseq = faker.string.numeric(10),
      gseq = faker.number.int({ min: 1, max: 10 }),
      oseq = faker.number.int({ min: 1, max: 10 }),
      provider = createAkashAddress(),
      state = faker.helpers.arrayElement(["active", "closed", "insufficient_funds"]),
      price = {
        denom: DenomSeeder.create(),
        amount: faker.string.numeric(6)
      },
      created_at = faker.date.past().toISOString(),
      closed_on = state === "closed" ? faker.date.recent().toISOString() : undefined
    } = input;

    const denom = price.denom || DenomSeeder.create();
    const amount = price.amount || faker.string.numeric(6);

    return {
      lease: {
        id: {
          owner,
          dseq,
          gseq,
          oseq,
          provider,
          bseq: faker.number.int({ min: 0, max: 10 })
        },
        state,
        price: {
          denom,
          amount
        },
        created_at,
        closed_on: closed_on || "0",
        reason: state === "closed" ? faker.helpers.arrayElement(["insufficient_funds", "provider_closed", "user_closed"]) : undefined
      },
      escrow_payment: {
        id: {
          aid: {
            scope: "deployment",
            xid: `${owner}/${dseq}`
          },
          xid: `${gseq}/${oseq}/${provider}`
        },
        state: {
          owner,
          state: state === "active" ? "open" : "closed",
          rate: {
            denom,
            amount
          },
          balance: {
            denom,
            amount: faker.string.numeric(6)
          },
          unsettled: {
            denom,
            amount: faker.string.numeric(6)
          },
          withdrawn: {
            denom,
            amount: faker.string.numeric(6)
          }
        }
      }
    };
  }

  static createMany(count: number, input: LeaseInput = {}): LeaseOutput[] {
    return Array.from({ length: count }, () => LeaseApiResponseSeeder.create(input));
  }
}
