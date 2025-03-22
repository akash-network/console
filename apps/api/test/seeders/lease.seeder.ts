import { faker } from "@faker-js/faker";

import { AkashAddressSeeder } from "./akash-address.seeder";
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
    lease_id: {
      owner: string;
      dseq: string;
      gseq: number;
      oseq: number;
      provider: string;
    };
    state: string;
    price: {
      denom: string;
      amount: string;
    };
    created_at: string;
    closed_on: string;
  };
  escrow_payment: {
    account_id: {
      scope: string;
      xid: string;
    };
    payment_id: string;
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
    withdrawn: {
      denom: string;
      amount: string;
    };
  };
}

export class LeaseSeeder {
  static create(input: LeaseInput = {}): LeaseOutput {
    const {
      owner = AkashAddressSeeder.create(),
      dseq = faker.string.numeric(10),
      gseq = faker.number.int({ min: 1, max: 10 }),
      oseq = faker.number.int({ min: 1, max: 10 }),
      provider = AkashAddressSeeder.create(),
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
        lease_id: {
          owner,
          dseq,
          gseq,
          oseq,
          provider
        },
        state,
        price: {
          denom,
          amount
        },
        created_at,
        closed_on
      },
      escrow_payment: {
        account_id: {
          scope: "lease",
          xid: `${owner}/${dseq}/${gseq}/${oseq}/${provider}`
        },
        payment_id: faker.string.uuid(),
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
        withdrawn: {
          denom,
          amount: faker.string.numeric(6)
        }
      }
    };
  }

  static createMany(count: number, input: LeaseInput = {}): LeaseOutput[] {
    return Array.from({ length: count }, () => this.create(input));
  }
}
