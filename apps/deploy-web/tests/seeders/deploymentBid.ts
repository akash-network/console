import type { BidDto } from "@src/types/deployment";
import { genWalletAddress } from "./wallet";

export function buildDeploymentBid(overrides?: Partial<BidDto>): BidDto {
  return {
    id: "1",
    owner: genWalletAddress(),
    provider: genWalletAddress(),
    dseq: "1",
    gseq: 1,
    oseq: 1,
    price: {
      denom: "uakt",
      amount: "1000000000000000000"
    },
    state: "open",
    resourcesOffer: [
      {
        resources: {
          cpu: {
            units: {
              val: "0.1"
            },
            attributes: []
          },
          gpu: {
            units: {
              val: "1"
            },
            attributes: []
          },
          memory: {
            quantity: {
              val: "1024"
            },
            attributes: []
          },
          storage: [],
          endpoints: []
        },
        count: 1
      }
    ],
    ...overrides
  };
}
