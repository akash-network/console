import { faker } from "@faker-js/faker";
import { merge } from "lodash";

export interface FeeAllowanceResponseSeederInput {
  granter?: string;
  grantee?: string;
  amount?: string;
}

export class FeeAllowanceResponseSeeder {
  static create(input: FeeAllowanceResponseSeederInput = {}) {
    return merge(
      {
        allowance: {
          granter: input.granter || "akash1testmasterwalletaddress",
          grantee: input.grantee || "akash1testwalletaddress",
          allowance: {
            "@type": "/cosmos.feegrant.v1beta1.BasicAllowance",
            spend_limit: [
              {
                denom: "uakt",
                amount: input.amount || "1000000"
              }
            ],
            expiration: faker.date.future().toISOString()
          }
        }
      },
      input
    );
  }
}
