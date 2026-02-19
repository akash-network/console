import { describe, expect, it } from "vitest";

import { deploymentToDto, leaseToDto } from "./deploymentDetailUtils";

describe("deploymentDetailUtils", () => {
  describe("leaseToDto", () => {
    it("should convert lease to dto", () => {
      const mockDeployment = {
        groups: []
      };

      const lease = {
        lease: {
          id: {
            owner: "test-owner",
            dseq: "123",
            gseq: 1,
            oseq: 1,
            provider: "provider1",
            bseq: 1
          },
          state: "active",
          price: {
            amount: "1000",
            denom: "uakt"
          },
          created_at: new Date().toISOString(),
          closed_on: ""
        },
        escrow_payment: {
          id: {
            aid: {
              scope: "test-scope",
              xid: "test-xid"
            },
            xid: "test-payment-id"
          },
          state: {
            owner: "test-owner",
            state: "active",
            rate: {
              denom: "uakt",
              amount: "1000"
            },
            balance: {
              denom: "uakt",
              amount: "1000"
            },
            unsettled: {
              denom: "uakt",
              amount: "0"
            },
            withdrawn: {
              denom: "uakt",
              amount: "0"
            }
          }
        }
      };

      expect(leaseToDto(lease, mockDeployment)).toEqual({
        cpuAmount: 0,
        dseq: "123",
        gpuAmount: 0,
        group: undefined,
        gseq: 1,
        id: "12311",
        memoryAmount: 0,
        oseq: 1,
        owner: "test-owner",
        price: {
          amount: "1000",
          denom: "uakt"
        },
        provider: "provider1",
        state: "active",
        storageAmount: 0
      });
    });
  });

  describe("deploymentToDto", () => {
    it("should convert deployment to dto", () => {
      const mockRpcDeployment = {
        deployment: {
          id: {
            owner: "test-owner",
            dseq: "123"
          },
          state: "active",
          hash: "test-hash",
          created_at: "1640995200"
        },
        groups: [
          {
            id: {
              owner: "test-owner",
              dseq: "123",
              gseq: 1
            },
            state: "active",
            group_spec: {
              name: "test-group",
              requirements: {
                signed_by: {
                  all_of: [],
                  any_of: []
                },
                attributes: []
              },
              resources: [
                {
                  resource: {
                    id: 1,
                    cpu: {
                      units: { val: "1000" },
                      attributes: []
                    },
                    memory: {
                      quantity: { val: "1000000" },
                      attributes: []
                    },
                    storage: [
                      {
                        name: "default",
                        quantity: { val: "1000000000" },
                        attributes: []
                      }
                    ],
                    gpu: {
                      units: { val: "0" },
                      attributes: []
                    },
                    endpoints: []
                  },
                  count: 1,
                  price: {
                    denom: "uakt",
                    amount: "1000"
                  }
                }
              ]
            },
            created_at: "1640995200"
          }
        ],
        escrow_account: {
          id: {
            scope: "test-scope",
            xid: "test-xid"
          },
          state: {
            owner: "test-owner",
            state: "active",
            transferred: [
              {
                denom: "uakt",
                amount: "1000"
              }
            ],
            settled_at: "1640995200",
            funds: [
              {
                denom: "uakt",
                amount: "10000"
              }
            ],
            deposits: []
          }
        }
      };

      const result = deploymentToDto(mockRpcDeployment);

      expect(result).toEqual({
        dseq: "123",
        state: "active",
        hash: "test-hash",
        denom: "uakt",
        createdAt: 1640995200,
        escrowBalance: 10000,
        transferred: {
          denom: "uakt",
          amount: "1000"
        },
        cpuAmount: 1,
        gpuAmount: 0,
        memoryAmount: 1000000,
        storageAmount: 1000000000,
        escrowAccount: mockRpcDeployment.escrow_account,
        groups: mockRpcDeployment.groups
      });
    });
  });
});
