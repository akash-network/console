import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ListDeploymentsItem, RpcLease } from "@src/types/deployment";
import { deploymentToDto, leaseToDto, listedDeploymentToDto } from "./deploymentDetailUtils";

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
        storageAmount: 0,
        reason: undefined,
        closedOn: "",
        reclamation: undefined
      });
    });

    it("maps the reclamation object and close reason when present", () => {
      const lease = mock<RpcLease>({
        lease: {
          id: { owner: "test-owner", dseq: "123", gseq: 1, oseq: 1, provider: "provider1", bseq: 1 },
          state: "reclaiming",
          price: { amount: "1000", denom: "uakt" },
          created_at: new Date().toISOString(),
          closed_on: "0",
          reason: "lease_closed_reason_unstable",
          reclamation: {
            window: "3600s",
            started_at: "1700000000",
            deadline: "1700003600",
            reason: "lease_closed_reason_unstable"
          }
        }
      });

      const dto = leaseToDto(lease, { groups: [] });

      expect(dto.reason).toBe("lease_closed_reason_unstable");
      expect(dto.closedOn).toBe("0");
      expect(dto.reclamation).toEqual({
        deadline: 1700003600,
        reason: "lease_closed_reason_unstable",
        startedAt: "1700000000",
        window: "3600s"
      });
    });
  });

  describe("listedDeploymentToDto", () => {
    it("carries the name, the leases and the console's record the api answered with", () => {
      const item = listedItem();

      const listed = listedDeploymentToDto(item);

      expect(listed.name).toBe("web");
      expect(listed.leases?.map(lease => lease.dseq)).toEqual(["1234"]);
      expect(listed.settings).toBe(item.settings);
      expect(listed.dseq).toBe("1234");
    });

    it("reports no name for a deployment the console never named", () => {
      const listed = listedDeploymentToDto({ ...listedItem(), name: null });

      expect(listed.name).toBeNull();
    });

    it("reports no record for a deployment the console holds none of", () => {
      const listed = listedDeploymentToDto({ ...listedItem(), settings: null });

      expect(listed.settings).toBeNull();
    });

    it("sizes each lease from the group it belongs to", () => {
      const listed = listedDeploymentToDto(listedItem());

      expect(listed.leases?.[0].cpuAmount).toBe(1);
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

  function listedItem(): ListDeploymentsItem {
    return {
      deployment: { id: { owner: "akash1owner", dseq: "1234" }, state: "active", hash: "hash", created_at: "1" },
      groups: [
        {
          id: { owner: "akash1owner", dseq: "1234", gseq: 1 },
          state: "open",
          group_spec: {
            name: "web",
            requirements: { signed_by: { all_of: [], any_of: [] }, attributes: [] },
            resources: [
              {
                resource: {
                  id: 1,
                  cpu: { units: { val: "1000" }, attributes: [] },
                  memory: { quantity: { val: "536870912" }, attributes: [] },
                  storage: [{ name: "default", quantity: { val: "536870912" }, attributes: [] }],
                  gpu: { units: { val: "0" }, attributes: [] },
                  endpoints: [{ kind: "SHARED_HTTP", sequence_number: 0 }]
                },
                count: 1,
                price: { denom: "uakt", amount: "100" }
              }
            ]
          },
          created_at: "1"
        }
      ],
      leases: [
        {
          id: { owner: "akash1owner", dseq: "1234", gseq: 1, oseq: 1, provider: "akash1provider", bseq: 1 },
          state: "active",
          price: { denom: "uakt", amount: "100" },
          created_at: "1",
          closed_on: "0"
        }
      ],
      escrow_account: {
        id: { scope: "deployment", xid: "1234" },
        state: {
          owner: "akash1owner",
          state: "open",
          transferred: [{ denom: "uakt", amount: "0" }],
          settled_at: "1",
          funds: [{ denom: "uakt", amount: "5000000" }],
          deposits: []
        }
      },
      name: "web",
      settings: { name: "web", runtimeLimitHours: null, runtimeEndsAt: null, closed: false }
    };
  }
});
