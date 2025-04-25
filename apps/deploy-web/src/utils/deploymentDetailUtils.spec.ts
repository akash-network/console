import { leaseToDto } from "./deploymentDetailUtils";

describe("deploymentDetailUtils", () => {
  describe("leaseToDto", () => {
    it("should convert lease to dto", () => {
      const mockDeployment = {
        dseq: "123",
        groups: []
      };

      const lease = {
        lease: {
          lease_id: {
            owner: "test-owner",
            dseq: "123",
            gseq: 1,
            oseq: 1,
            provider: "provider1"
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
          account_id: {
            scope: "test-scope",
            xid: "test-xid"
          },
          payment_id: "test-payment-id",
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
          withdrawn: {
            denom: "uakt",
            amount: "0"
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
});
