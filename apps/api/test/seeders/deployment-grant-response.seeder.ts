import { faker } from "@faker-js/faker";
import { merge } from "lodash";

export interface DeploymentGrantResponseSeederInput {
  granter?: string;
  grantee?: string;
  amount?: string;
}

export class DeploymentGrantResponseSeeder {
  static create(input: DeploymentGrantResponseSeederInput = {}) {
    return merge(
      {
        grants: [
          {
            granter: input.granter || "akash1testmasterwalletaddress",
            grantee: input.grantee || "akash1testwalletaddress",
            authorization: {
              "@type": "/akash.deployment.v1beta3.DepositDeploymentAuthorization",
              spend_limit: {
                denom: "uakt",
                amount: input.amount || "5000000"
              }
            },
            expiration: faker.date.future().toISOString()
          }
        ],
        pagination: {
          next_key: null,
          total: "1"
        }
      },
      input
    );
  }
}
